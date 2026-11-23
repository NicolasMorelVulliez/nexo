//! Acceso HID al Motospeed X6.
//!
//! Un único hilo es dueño del dispositivo: la UI y el sondeo de batería le mandan
//! comandos por un canal, así nunca hay escrituras concurrentes.

use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::{Duration, Instant};

pub const VID: u16 = 0x0BDA;
pub const PIDS: [u16; 2] = [0xFFE0, 0xFFF1];
pub const PID_CABLE: u16 = 0xFFF1;
/// Colección vendor del X6 (interfaz 4) por la que viajan los comandos.
pub const USAGE_PAGE: u16 = 0xFFC1;
/// Únicos reportes de salida permitidos desde la UI (defensa en profundidad).
const ALLOWED_OUT: [u8; 2] = [0xB3, 0xB5];
pub const REPORT_STATE: u8 = 0xB4;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub vid: u16,
    pub pid: u16,
    pub product: String,
    pub manufacturer: String,
    pub cable: bool,
}

type Reply<T> = Sender<Result<T, String>>;

enum Cmd {
    Open(Reply<DeviceInfo>),
    Send(u8, Vec<u8>, Reply<()>),
    Request(u8, Vec<u8>, u8, u64, Reply<Vec<u8>>),
}

#[derive(Clone)]
pub struct Hid {
    tx: Sender<Cmd>,
}

impl Hid {
    pub fn spawn() -> Self {
        let (tx, rx) = channel::<Cmd>();
        std::thread::Builder::new()
            .name("nexo-hid".into())
            .spawn(move || worker(rx))
            .expect("no se pudo crear el hilo HID");
        Hid { tx }
    }

    fn call<T>(&self, make: impl FnOnce(Reply<T>) -> Cmd) -> Result<T, String> {
        let (t, r) = channel();
        self.tx.send(make(t)).map_err(|e| e.to_string())?;
        r.recv().map_err(|e| e.to_string())?
    }

    pub fn open(&self) -> Result<DeviceInfo, String> {
        self.call(Cmd::Open)
    }

    pub fn send(&self, report_id: u8, data: Vec<u8>) -> Result<(), String> {
        if !ALLOWED_OUT.contains(&report_id) {
            return Err(format!("reporte 0x{report_id:02X} no permitido"));
        }
        self.call(|r| Cmd::Send(report_id, data, r))
    }

    pub fn request(&self, report_id: u8, data: Vec<u8>, expect: u8, timeout_ms: u64) -> Result<Vec<u8>, String> {
        if !ALLOWED_OUT.contains(&report_id) {
            return Err(format!("reporte 0x{report_id:02X} no permitido"));
        }
        self.call(|r| Cmd::Request(report_id, data, expect, timeout_ms.min(5000), r))
    }
}

struct Open {
    dev: HidDevice,
    info: DeviceInfo,
}

fn worker(rx: Receiver<Cmd>) {
    let mut api: Option<HidApi> = None;
    let mut cur: Option<Open> = None;

    for cmd in rx {
        match cmd {
            Cmd::Open(reply) => {
                cur = None; // volver a enumerar siempre
                let r = ensure(&mut api, &mut cur).map(|o| o.info.clone());
                let _ = reply.send(r);
            }
            Cmd::Send(id, data, reply) => {
                let r = ensure(&mut api, &mut cur).and_then(|o| write(&o.dev, id, &data));
                if r.is_err() {
                    cur = None;
                }
                let _ = reply.send(r);
            }
            Cmd::Request(id, data, expect, timeout, reply) => {
                let r = ensure(&mut api, &mut cur).and_then(|o| {
                    drain(&o.dev);
                    write(&o.dev, id, &data)?;
                    read_report(&o.dev, expect, timeout)
                });
                if r.is_err() {
                    cur = None;
                }
                let _ = reply.send(r);
            }
        }
    }
}

fn ensure<'a>(api: &mut Option<HidApi>, cur: &'a mut Option<Open>) -> Result<&'a Open, String> {
    if cur.is_none() {
        let api = match api {
            Some(a) => {
                a.refresh_devices().map_err(|e| e.to_string())?;
                a
            }
            None => api.insert(HidApi::new().map_err(|e| e.to_string())?),
        };
        let found = api
            .device_list()
            .find(|d| d.vendor_id() == VID && PIDS.contains(&d.product_id()) && d.usage_page() == USAGE_PAGE)
            .ok_or_else(|| "No se encontró el mouse (dongle o cable)".to_string())?;
        let info = DeviceInfo {
            vid: found.vendor_id(),
            pid: found.product_id(),
            product: found.product_string().unwrap_or_default().trim().to_string(),
            manufacturer: found.manufacturer_string().unwrap_or_default().trim().to_string(),
            cable: found.product_id() == PID_CABLE,
        };
        let dev = found.open_device(api).map_err(|e| e.to_string())?;
        *cur = Some(Open { dev, info });
    }
    Ok(cur.as_ref().unwrap())
}

fn write(dev: &HidDevice, id: u8, data: &[u8]) -> Result<(), String> {
    let mut buf = Vec::with_capacity(data.len() + 1);
    buf.push(id);
    buf.extend_from_slice(data);
    dev.write(&buf).map(|_| ()).map_err(|e| format!("escritura HID: {e}"))
}

/// Descarta reportes viejos pendientes para no confundir respuestas.
fn drain(dev: &HidDevice) {
    let mut buf = [0u8; 65];
    for _ in 0..16 {
        match dev.read_timeout(&mut buf, 0) {
            Ok(n) if n > 0 => continue,
            _ => break,
        }
    }
}

fn read_report(dev: &HidDevice, expect: u8, timeout_ms: u64) -> Result<Vec<u8>, String> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut buf = [0u8; 65];
    loop {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Err("El mouse no respondió (¿está dormido o apagado?)".into());
        }
        let n = dev
            .read_timeout(&mut buf, left.as_millis() as i32)
            .map_err(|e| format!("lectura HID: {e}"))?;
        if n > 0 && buf[0] == expect {
            return Ok(buf[1..n].to_vec());
        }
    }
}
