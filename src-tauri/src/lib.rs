//! Nexo — núcleo de escritorio (Tauri 2).
//!
//! - HID: un hilo dueño de los mouses (hid.rs, Motospeed X6 y RAWM, los dos a la vez si están
//!   conectados); la UI y la bandeja le piden comandos indicando la familia.
//! - Bandeja: ícono con el % de batería dibujado en runtime (tray_icon.rs); clic izquierdo abre el
//!   panel rápido (ventana "panel", ?panel=1), clic derecho el menú.
//! - Ventana: al cerrarla se destruye el WebView (la bandeja sigue viva con muy poca RAM);
//!   se vuelve a crear al hacer clic en el ícono.
//! - Portable: si junto al exe hay un archivo "portable" (o portable.ini), los datos se
//!   guardan al lado del exe y no se ofrece "Iniciar con Windows".

mod hid;
mod tray_icon;

use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri_plugin_updater::UpdaterExt;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Battery {
    /** familia del mouse ("x6" | "rawm") */
    family: String,
    connected: bool,
    level: Option<u8>,
    charging: bool,
    cable: bool,
}

struct Shared {
    hid: hid::Hid,
    /** mouses abiertos (uno por familia) */
    info: Mutex<Vec<hid::DeviceInfo>>,
    battery: Mutex<HashMap<String, Battery>>,
    /** mouse que muestra el ícono de la bandeja (el activo en la UI) */
    tray_family: Mutex<Option<String>>,
    /** nombre de cada mouse para el tooltip */
    names: Mutex<HashMap<String, String>>,
    last_io: Mutex<Instant>,
    poll_secs: AtomicU64,
    poll_now: AtomicBool,
    style: Mutex<tray_icon::Style>,
    portable: bool,
    data_dir: Option<PathBuf>,
    /** ítem del menú de la bandeja para actualizar (cambia de texto si hay versión nueva) */
    update_item: Mutex<Option<MenuItem<tauri::Wry>>>,
    update: Mutex<Option<UpdateInfo>>,
}

const RELEASES_URL: &str = "https://github.com/NicolasMorelVulliez/nexo/releases/latest";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    version: String,
    notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    portable: bool,
    version: String,
}

/* ───────────── Comandos para la UI ───────────── */

#[tauri::command(async)]
fn hid_open_all(state: State<Shared>) -> Result<Vec<hid::DeviceInfo>, String> {
    touch_io(&state);
    let infos = state.hid.open_all()?;
    *state.info.lock().unwrap() = infos.clone();
    Ok(infos)
}

#[tauri::command(async)]
fn hid_send(state: State<Shared>, family: String, report_id: u8, data: Vec<u8>) -> Result<(), String> {
    touch_io(&state);
    state.hid.send(hid::Family::parse(&family)?, report_id, data)
}

#[tauri::command(async)]
fn hid_read(state: State<Shared>, family: String, timeout_ms: u64) -> Result<Vec<Vec<u8>>, String> {
    touch_io(&state);
    state.hid.read(hid::Family::parse(&family)?, timeout_ms)
}

/// Marca actividad de la UI: el sondeo de batería RAWM espera para no mezclar respuestas.
fn touch_io(state: &Shared) {
    *state.last_io.lock().unwrap() = Instant::now();
}

#[tauri::command(async)]
fn hid_request(
    state: State<Shared>,
    family: String,
    report_id: u8,
    data: Vec<u8>,
    expect: u8,
    timeout_ms: u64,
) -> Result<Vec<u8>, String> {
    touch_io(&state);
    state.hid.request(hid::Family::parse(&family)?, report_id, data, expect, timeout_ms)
}

#[tauri::command]
fn app_info(state: State<Shared>) -> AppInfo {
    AppInfo { portable: state.portable, version: env!("CARGO_PKG_VERSION").into() }
}

#[tauri::command]
fn battery_state(state: State<Shared>) -> Vec<Battery> {
    state.battery.lock().unwrap().values().cloned().collect()
}

/// Preferencias de la bandeja: estilo, intervalo, qué mouse muestra el ícono y el nombre de cada uno.
#[tauri::command]
fn set_tray_prefs(
    app: AppHandle,
    state: State<Shared>,
    style: String,
    poll_secs: u64,
    family: Option<String>,
    names: HashMap<String, String>,
) {
    *state.style.lock().unwrap() = if style == "nobg" { tray_icon::Style::NoBg } else { tray_icon::Style::Bg };
    state.poll_secs.store(poll_secs.clamp(15, 3600), Ordering::Relaxed);
    if family.is_some() {
        *state.tray_family.lock().unwrap() = family;
    }
    state.names.lock().unwrap().extend(names.into_iter().filter(|(_, v)| !v.trim().is_empty()));
    update_tray(&app, 0);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/* ───────────── Actualizaciones (GitHub Releases + tauri-plugin-updater) ───────────── */

async fn check_update(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let found = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    let info = found.map(|u| UpdateInfo { version: u.version.clone(), notes: u.body.clone() });
    let shared = app.state::<Shared>();
    *shared.update.lock().unwrap() = info.clone();
    if let Some(item) = shared.update_item.lock().unwrap().as_ref() {
        let text = match &info {
            Some(i) => format!("Instalar actualización ({})", i.version),
            None => "Buscar actualizaciones".to_string(),
        };
        let _ = item.set_text(text);
    }
    if let Some(i) = &info {
        let _ = app.emit("update-available", i.clone());
    }
    Ok(info)
}

async fn install_update(app: &AppHandle) -> Result<(), String> {
    if app.state::<Shared>().portable {
        // la portable no se instala: se abre la página de descargas
        let _ = std::process::Command::new("explorer").arg(RELEASES_URL).spawn();
        return Ok(());
    }
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Ya tenés la última versión".to_string())?;
    let _ = app.emit("update-progress", "downloading");
    update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    app.restart();
}

#[tauri::command]
async fn update_check(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    check_update(&app).await
}

#[tauri::command]
async fn update_install(app: AppHandle) -> Result<(), String> {
    install_update(&app).await
}

#[tauri::command]
fn refresh_battery(state: State<Shared>) {
    state.poll_now.store(true, Ordering::Relaxed);
}

/* ───────────── Batería y bandeja ───────────── */

fn state_request() -> Vec<u8> {
    let mut d = vec![0u8; 60];
    d[0] = 0x06;
    d
}

fn has_rawm(shared: &Shared) -> bool {
    shared.info.lock().unwrap().iter().any(|i| i.family == "rawm")
}

fn poll_once(shared: &Shared, info: &hid::DeviceInfo) -> Result<Battery, String> {
    if info.family == "rawm" {
        let json = shared.hid.rawm_query(2500)?;
        let v: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
        let direct = !hid::rawm::is_receiver(info.pid);
        return Ok(Battery {
            family: info.family.clone(),
            connected: true,
            level: v.get("battery").and_then(|x| x.as_u64()).map(|b| b.min(100) as u8),
            charging: v.get("chr").and_then(|x| x.as_u64()) == Some(1),
            cable: direct || v.get("wired").and_then(|x| x.as_u64()) == Some(1),
        });
    }
    let data = shared.hid.request(hid::Family::X6, 0xB3, state_request(), hid::X6_REPORT_STATE, 1500)?;
    if data.len() < 20 {
        return Err("estado corto".into());
    }
    let raw = data[19];
    Ok(Battery {
        family: info.family.clone(),
        connected: true,
        level: Some((raw & 0x7F).min(100)),
        charging: raw & 0x80 != 0,
        cable: info.cable,
    })
}

/// Consulta la batería de cada mouse abierto (si falla, vuelve a enumerar una vez).
fn poll_battery(app: &AppHandle) -> Vec<Battery> {
    let shared = app.state::<Shared>();
    if shared.info.lock().unwrap().is_empty() {
        if let Ok(infos) = shared.hid.open_all() {
            *shared.info.lock().unwrap() = infos;
        }
    }
    let infos = shared.info.lock().unwrap().clone();
    let mut out = Vec::new();
    let mut failed = false;
    for info in &infos {
        match poll_once(&shared, info) {
            Ok(b) => out.push(b),
            Err(_) => failed = true,
        }
    }
    if failed {
        // puede que un receptor se haya reconectado: volver a enumerar y reintentar los que fallaron
        if let Ok(infos) = shared.hid.open_all() {
            *shared.info.lock().unwrap() = infos.clone();
            let done: Vec<String> = out.iter().map(|b| b.family.clone()).collect();
            for info in infos.iter().filter(|i| !done.contains(&i.family)) {
                if let Ok(b) = poll_once(&shared, info) {
                    out.push(b);
                }
            }
        }
    }
    out
}

/// Batería que muestra el ícono: la del mouse activo en la UI (o la primera que haya).
fn tray_battery(shared: &Shared) -> Battery {
    let map = shared.battery.lock().unwrap();
    let fam = shared.tray_family.lock().unwrap().clone();
    fam.and_then(|f| map.get(&f).cloned())
        .or_else(|| map.values().find(|b| b.connected).cloned())
        .unwrap_or_default()
}

fn update_tray(app: &AppHandle, frame: u8) {
    let shared = app.state::<Shared>();
    let style = *shared.style.lock().unwrap();
    let b = tray_battery(&shared);
    let level = if b.connected { b.level } else { None };
    let rgba = tray_icon::render(tray_icon::State {
        level,
        charging: b.charging,
        cable: b.connected && b.cable,
        style,
        frame,
    });
    // tooltip: una línea por mouse (el del ícono primero)
    let names = shared.names.lock().unwrap().clone();
    let mut all: Vec<Battery> = shared.battery.lock().unwrap().values().filter(|x| x.connected).cloned().collect();
    all.sort_by_key(|x| x.family != b.family);
    let name_of = |f: &str| names.get(f).cloned().unwrap_or_else(|| if f == "rawm" { "RAWM".into() } else { "Motospeed X6".into() });
    let tip = if all.is_empty() {
        tray_icon::tooltip(None, false, false, &name_of(&b.family))
    } else {
        all.iter()
            .map(|x| tray_icon::tooltip(x.level, x.charging, x.cable, &name_of(&x.family)))
            .collect::<Vec<_>>()
            .join("
")
    };
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_icon(Some(Image::new_owned(rgba, tray_icon::SIZE, tray_icon::SIZE)));
        let _ = tray.set_tooltip(Some(tip));
    }
}

fn poll_loop(app: AppHandle) {
    let mut last = Instant::now() - Duration::from_secs(3600);
    let mut frame = 0u8;
    loop {
        let shared = app.state::<Shared>();
        let every = Duration::from_secs(shared.poll_secs.load(Ordering::Relaxed));
        let ui_busy = has_rawm(&shared) && shared.last_io.lock().unwrap().elapsed() < Duration::from_secs(3);
        if !ui_busy && (shared.poll_now.swap(false, Ordering::Relaxed) || last.elapsed() >= every) {
            last = Instant::now();
            let all = poll_battery(&app);
            {
                let mut map = shared.battery.lock().unwrap();
                map.clear();
                for b in &all {
                    map.insert(b.family.clone(), b.clone());
                }
            }
            update_tray(&app, frame);
            for b in all {
                let _ = app.emit("battery", b);
            }
        } else {
            let b = tray_battery(&shared);
            if b.connected && b.charging {
                frame = (frame + 1) % 4; // animación de carga en el ícono
                update_tray(&app, frame);
            }
        }
        std::thread::sleep(Duration::from_millis(450));
    }
}

/* ───────────── Panel rápido de la bandeja ───────────── */

const PANEL_W: f64 = 360.0;
const PANEL_H: f64 = 530.0;
/** momento en que se cerró el panel (para que el mismo clic en el ícono no lo vuelva a abrir) */
static PANEL_CLOSED: Mutex<Option<Instant>> = Mutex::new(None);

fn toggle_panel(app: &AppHandle, cursor: tauri::PhysicalPosition<f64>) {
    if let Some(w) = app.get_webview_window("panel") {
        let _ = w.close();
        return;
    }
    if PANEL_CLOSED.lock().unwrap().is_some_and(|t| t.elapsed() < Duration::from_millis(350)) {
        return;
    }
    let shared = app.state::<Shared>();
    let mut builder = WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("index.html?panel=1".into()))
        .title("Nexo")
        .inner_size(PANEL_W, PANEL_H)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .transparent(true)
        .shadow(false)
        .visible(false);
    if let Some(dir) = &shared.data_dir {
        builder = builder.data_directory(dir.clone());
    }
    let Ok(w) = builder.build() else { return };
    // arriba del ícono, dentro del área de trabajo (sin tapar la barra de tareas)
    if let Ok(Some(m)) = app.monitor_from_point(cursor.x, cursor.y) {
        let s = m.scale_factor();
        let work = m.work_area();
        let (pw, ph, pad) = (PANEL_W * s, PANEL_H * s, 6.0 * s);
        let (wx, wy) = (work.position.x as f64, work.position.y as f64);
        let (ww, wh) = (work.size.width as f64, work.size.height as f64);
        let x = (cursor.x - pw / 2.0).clamp(wx + pad, wx + ww - pw - pad);
        let y = if cursor.y < wy { wy + pad } else { wy + wh - ph - pad };
        let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
    }
    let _ = w.show();
    let _ = w.set_focus();
    let w2 = w.clone();
    w.on_window_event(move |e| {
        if let tauri::WindowEvent::Focused(false) = e {
            *PANEL_CLOSED.lock().unwrap() = Some(Instant::now());
            let _ = w2.close();
        }
    });
}

#[tauri::command]
fn open_main(app: AppHandle) {
    if let Some(p) = app.get_webview_window("panel") {
        let _ = p.close();
    }
    show_main(&app);
}

#[tauri::command]
fn main_window_open(app: AppHandle) -> bool {
    app.get_webview_window("main").is_some()
}

/* ───────────── Ventana ───────────── */

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let shared = app.state::<Shared>();
    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Nexo")
        .inner_size(1380.0, 880.0)
        .min_inner_size(1100.0, 700.0)
        .decorations(false)
        .center()
        .visible(true);
    if let Some(dir) = &shared.data_dir {
        builder = builder.data_directory(dir.clone());
    }
    if let Err(e) = builder.build() {
        eprintln!("no se pudo abrir la ventana: {e}");
    }
}

fn portable_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?.to_path_buf();
    ["portable", "portable.ini", "portable.txt"]
        .iter()
        .any(|f| dir.join(f).exists())
        .then(|| dir.join("NexoData"))
}

pub fn run() {
    let data_dir = portable_dir();
    let portable = data_dir.is_some();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(Shared {
            hid: hid::Hid::spawn(),
            info: Mutex::new(Vec::new()),
            battery: Mutex::new(HashMap::new()),
            tray_family: Mutex::new(None),
            names: Mutex::new(HashMap::new()),
            last_io: Mutex::new(Instant::now() - Duration::from_secs(60)),
            poll_secs: AtomicU64::new(60),
            poll_now: AtomicBool::new(true),
            style: Mutex::new(tray_icon::Style::Bg),
            portable,
            data_dir,
            update_item: Mutex::new(None),
            update: Mutex::new(None),
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            hid_open_all,
            hid_send,
            hid_request,
            hid_read,
            app_info,
            battery_state,
            set_tray_prefs,
            refresh_battery,
            update_check,
            update_install,
            open_main,
            main_window_open,
            quit_app
        ])
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Abrir Nexo", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "Actualizar batería", true, None::<&str>)?;
            let update = MenuItem::with_id(app, "update", "Buscar actualizaciones", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &refresh, &update, &sep, &quit])?;
            *app.state::<Shared>().update_item.lock().unwrap() = Some(update.clone());
            let icon = tray_icon::render(tray_icon::State {
                level: None,
                charging: false,
                cable: false,
                style: tray_icon::Style::Bg,
                frame: 0,
            });
            TrayIconBuilder::with_id("main")
                .icon(Image::new_owned(icon, tray_icon::SIZE, tray_icon::SIZE))
                .tooltip("Nexo")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => show_main(app),
                    "refresh" => app.state::<Shared>().poll_now.store(true, Ordering::Relaxed),
                    "update" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let pending = app.state::<Shared>().update.lock().unwrap().is_some();
                            if pending {
                                let _ = install_update(&app).await;
                            } else if let Ok(None) = check_update(&app).await {
                                if let Some(item) = app.state::<Shared>().update_item.lock().unwrap().as_ref() {
                                    let _ = item.set_text("Nexo está al día");
                                }
                            }
                        });
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    // clic izquierdo: panel rápido (batería, DPI, polling, modo); "Abrir Nexo" está en el panel y en el menú
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, position, .. } = e {
                        toggle_panel(tray.app_handle(), position);
                    }
                })
                .build(app)?;

            if !std::env::args().any(|a| a == "--minimized") {
                show_main(app.handle());
            }
            let handle = app.handle().clone();
            std::thread::Builder::new().name("nexo-battery".into()).spawn(move || poll_loop(handle))?;
            // buscar actualizaciones al arrancar y cada 6 horas
            let handle = app.handle().clone();
            std::thread::Builder::new().name("nexo-update".into()).spawn(move || {
                std::thread::sleep(Duration::from_secs(20));
                loop {
                    let _ = tauri::async_runtime::block_on(check_update(&handle));
                    std::thread::sleep(Duration::from_secs(6 * 3600));
                }
            })?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error al iniciar Nexo");

    app.run(|_app, event| {
        // Cerrar la ventana no cierra la app: sigue en la bandeja. "Salir" usa exit(0).
        if let RunEvent::ExitRequested { api, code, .. } = event {
            if code.is_none() {
                api.prevent_exit();
            }
        }
    });
}
