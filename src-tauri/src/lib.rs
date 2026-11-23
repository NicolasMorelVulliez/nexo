//! Nexo — núcleo de escritorio (Tauri 2).
//!
//! - HID: un hilo dueño del mouse (hid.rs); la UI y la bandeja le piden comandos.
//! - Bandeja: ícono con el % de batería dibujado en runtime (tray_icon.rs).
//! - Ventana: al cerrarla se destruye el WebView (la bandeja sigue viva con muy poca RAM);
//!   se vuelve a crear al hacer clic en el ícono.
//! - Portable: si junto al exe hay un archivo "portable" (o portable.ini), los datos se
//!   guardan al lado del exe y no se ofrece "Iniciar con Windows".

mod hid;
mod tray_icon;

use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Battery {
    connected: bool,
    level: Option<u8>,
    charging: bool,
    cable: bool,
}

struct Shared {
    hid: hid::Hid,
    info: Mutex<Option<hid::DeviceInfo>>,
    battery: Mutex<Battery>,
    poll_secs: AtomicU64,
    poll_now: AtomicBool,
    style: Mutex<tray_icon::Style>,
    name: Mutex<String>,
    portable: bool,
    data_dir: Option<PathBuf>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    portable: bool,
    version: String,
}

/* ───────────── Comandos para la UI ───────────── */

#[tauri::command(async)]
fn hid_open(state: State<Shared>) -> Result<hid::DeviceInfo, String> {
    let info = state.hid.open()?;
    *state.info.lock().unwrap() = Some(info.clone());
    Ok(info)
}

#[tauri::command(async)]
fn hid_send(state: State<Shared>, report_id: u8, data: Vec<u8>) -> Result<(), String> {
    state.hid.send(report_id, data)
}

#[tauri::command(async)]
fn hid_request(
    state: State<Shared>,
    report_id: u8,
    data: Vec<u8>,
    expect: u8,
    timeout_ms: u64,
) -> Result<Vec<u8>, String> {
    state.hid.request(report_id, data, expect, timeout_ms)
}

#[tauri::command]
fn app_info(state: State<Shared>) -> AppInfo {
    AppInfo { portable: state.portable, version: env!("CARGO_PKG_VERSION").into() }
}

#[tauri::command]
fn battery_state(state: State<Shared>) -> Battery {
    *state.battery.lock().unwrap()
}

#[tauri::command]
fn set_tray_prefs(app: AppHandle, state: State<Shared>, style: String, poll_secs: u64, name: String) {
    *state.style.lock().unwrap() = if style == "nobg" { tray_icon::Style::NoBg } else { tray_icon::Style::Bg };
    state.poll_secs.store(poll_secs.clamp(15, 3600), Ordering::Relaxed);
    if !name.trim().is_empty() {
        *state.name.lock().unwrap() = name.trim().to_string();
    }
    let b = *state.battery.lock().unwrap();
    update_tray(&app, b, 0);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
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

fn poll_battery(app: &AppHandle) -> Battery {
    let shared = app.state::<Shared>();
    let mut attempt = shared.hid.request(0xB3, state_request(), hid::REPORT_STATE, 1500);
    if attempt.is_err() {
        // puede que el dongle se haya reconectado: volver a enumerar y reintentar
        if let Ok(info) = shared.hid.open() {
            *shared.info.lock().unwrap() = Some(info);
            attempt = shared.hid.request(0xB3, state_request(), hid::REPORT_STATE, 1500);
        }
    }
    let cable = shared.info.lock().unwrap().as_ref().map(|i| i.cable).unwrap_or(false);
    match attempt {
        Ok(data) if data.len() >= 20 => {
            let raw = data[19];
            Battery { connected: true, level: Some((raw & 0x7F).min(100)), charging: raw & 0x80 != 0, cable }
        }
        _ => Battery::default(),
    }
}

fn update_tray(app: &AppHandle, b: Battery, frame: u8) {
    let shared = app.state::<Shared>();
    let style = *shared.style.lock().unwrap();
    let name = shared.name.lock().unwrap().clone();
    let level = if b.connected { b.level } else { None };
    let rgba = tray_icon::render(tray_icon::State {
        level,
        charging: b.charging,
        cable: b.connected && b.cable,
        style,
        frame,
    });
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_icon(Some(Image::new_owned(rgba, tray_icon::SIZE, tray_icon::SIZE)));
        let _ = tray.set_tooltip(Some(tray_icon::tooltip(level, b.charging, b.connected && b.cable, &name)));
    }
}

fn poll_loop(app: AppHandle) {
    let mut last = Instant::now() - Duration::from_secs(3600);
    let mut frame = 0u8;
    loop {
        let shared = app.state::<Shared>();
        let every = Duration::from_secs(shared.poll_secs.load(Ordering::Relaxed));
        if shared.poll_now.swap(false, Ordering::Relaxed) || last.elapsed() >= every {
            last = Instant::now();
            let b = poll_battery(&app);
            *shared.battery.lock().unwrap() = b;
            update_tray(&app, b, frame);
            let _ = app.emit("battery", b);
        } else {
            let b = *shared.battery.lock().unwrap();
            if b.connected && b.charging {
                frame = (frame + 1) % 4; // animación de carga en el ícono
                update_tray(&app, b, frame);
            }
        }
        std::thread::sleep(Duration::from_millis(450));
    }
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
            info: Mutex::new(None),
            battery: Mutex::new(Battery::default()),
            poll_secs: AtomicU64::new(60),
            poll_now: AtomicBool::new(true),
            style: Mutex::new(tray_icon::Style::Bg),
            name: Mutex::new("Motospeed X6".into()),
            portable,
            data_dir,
        })
        .invoke_handler(tauri::generate_handler![
            hid_open,
            hid_send,
            hid_request,
            app_info,
            battery_state,
            set_tray_prefs,
            refresh_battery,
            quit_app
        ])
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Abrir Nexo", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "Actualizar batería", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &refresh, &sep, &quit])?;
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
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            if !std::env::args().any(|a| a == "--minimized") {
                show_main(app.handle());
            }
            let handle = app.handle().clone();
            std::thread::Builder::new().name("nexo-battery".into()).spawn(move || poll_loop(handle))?;
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
