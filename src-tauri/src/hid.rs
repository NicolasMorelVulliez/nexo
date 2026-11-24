//! Acceso HID a los mouses soportados (Motospeed X6 y RAWM).
//!
//! Un único hilo es dueño del dispositivo: la UI y el sondeo de batería le mandan
//! comandos por un canal, así nunca hay escrituras concurrentes.
//!
//! Cada familia declara VID, PIDs, la colección vendor por la que viajan los comandos y
//! los únicos reportes de salida que la UI puede mandar (defensa en profundidad).

use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Family {
    X6,
    Rawm,
}

impl Family {
    pub fn id(self) -> &'static str {
        match self {
            Family::X6 => "x6",
            Family::Rawm => "rawm",
        }
    }

    pub fn parse(s: &str) -> Result<Family, String> {
        match s {
            "x6" => Ok(Family::X6),
            "rawm" => Ok(Family::Rawm),
            _ => Err(format!("familia desconocida: {s}")),
        }
    }
}

struct FamilySpec {
    family: Family,
    vid: u16,
    pids: &'static [u16],
    usage_page: u16,
    allowed_out: &'static [u8],
}

pub const X6_PID_CABLE: u16 = 0xFFF1;
pub const X6_REPORT_STATE: u8 = 0xB4;

/// Receptores RAWM: el mouse está detrás, en el canal 0.
const RAWM_RECEIVERS: &[u16] = &[0x2347, 0x2346, 0x234B, 0x233C, 0x233B, 0x2336, 0x2335, 0x232A, 0x232B];

const FAMILIES: &[FamilySpec] = &[
    FamilySpec { family: Family::X6, vid: 0x0BDA, pids: &[0xFFE0, 0xFFF1], usage_page: 0xFFC1, allowed_out: &[0xB3, 0xB5] },
    FamilySpec {
        family: Family::Rawm,
        vid: 0x1915,
        pids: &[
            0x2352, 0x2349, 0x2348, 0x2344, 0x2343, 0x234A, 0x2341, 0x2340, 0x233F, 0x233E, 0x233A, 0x2333, 0x2339,
            0x2338, 0x2337, 0x2334, 0x2331, 0x2332, 0x232E, 0x232D, 0x232C, 0x2329, 0x2328, 0x2347, 0x2346, 0x234B,
            0x233C, 0x233B, 0x2336, 0x2335, 0x232A, 0x232B,
        ],
        usage_page: 0xFF00,
        // sin report ID
        allowed_out: &[0x00],
    },
];

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub vid: u16,
    pub pid: u16,
    pub product: String,
    pub manufacturer: String,
    pub cable: bool,
    pub usage_page: u16,
    pub family: String,
}

type Reply<T> = Sender<Result<T, String>>;

enum Cmd {
    OpenAll(Reply<Vec<DeviceInfo>>),
    Send(Family, u8, Vec<u8>, Reply<()>),
    Request(Family, u8, Vec<u8>, u8, u64, Reply<Vec<u8>>),
    Read(Family, u64, Reply<Vec<Vec<u8>>>),
    RawmQuery(u64, Reply<String>),
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

    /// Vuelve a enumerar y abre todos los mouses soportados (uno por familia). Los que ya estaban
    /// abiertos y siguen conectados se conservan.
    pub fn open_all(&self) -> Result<Vec<DeviceInfo>, String> {
        self.call(Cmd::OpenAll)
    }

    pub fn send(&self, family: Family, report_id: u8, data: Vec<u8>) -> Result<(), String> {
        self.call(|r| Cmd::Send(family, report_id, data, r))
    }

    pub fn request(&self, family: Family, report_id: u8, data: Vec<u8>, expect: u8, timeout_ms: u64) -> Result<Vec<u8>, String> {
        self.call(|r| Cmd::Request(family, report_id, data, expect, timeout_ms.min(5000), r))
    }

    /// Reportes de entrada desde la última lectura/envío (sin repetidos seguidos).
    pub fn read(&self, family: Family, timeout_ms: u64) -> Result<Vec<Vec<u8>>, String> {
        self.call(|r| Cmd::Read(family, timeout_ms.min(5000), r))
    }

    /// RAWM: pide el estado (CMD_QUERY) y devuelve el JSON. Atómico respecto de la UI.
    pub fn rawm_query(&self, timeout_ms: u64) -> Result<String, String> {
        self.call(|r| Cmd::RawmQuery(timeout_ms.min(5000), r))
    }
}

struct Open {
    dev: HidDevice,
    info: DeviceInfo,
    spec: &'static FamilySpec,
    last: Option<Vec<u8>>,
}

fn worker(rx: Receiver<Cmd>) {
    let mut api: Option<HidApi> = None;
    // un dispositivo abierto por familia (X6 y RAWM pueden estar a la vez)
    let mut open: HashMap<Family, Open> = HashMap::new();

    for cmd in rx {
        match cmd {
            Cmd::OpenAll(reply) => {
                let r = open_all(&mut api, &mut open);
                let _ = reply.send(r);
            }
            Cmd::Send(fam, id, data, reply) => {
                let r = ensure(&mut api, &mut open, fam).and_then(|o| {
                    check_allowed(o, id)?;
                    o.last = None;
                    write(&o.dev, id, &data)
                });
                if r.is_err() {
                    open.remove(&fam);
                }
                let _ = reply.send(r);
            }
            Cmd::Request(fam, id, data, expect, timeout, reply) => {
                let r = ensure(&mut api, &mut open, fam).and_then(|o| {
                    check_allowed(o, id)?;
                    drain(&o.dev);
                    write(&o.dev, id, &data)?;
                    read_report(&o.dev, expect, timeout)
                });
                if r.is_err() {
                    open.remove(&fam);
                }
                let _ = reply.send(r);
            }
            Cmd::Read(fam, timeout, reply) => {
                let r = ensure(&mut api, &mut open, fam).and_then(|o| read_new(o, timeout));
                if r.is_err() {
                    open.remove(&fam);
                }
                let _ = reply.send(r);
            }
            Cmd::RawmQuery(timeout, reply) => {
                let r = ensure(&mut api, &mut open, Family::Rawm).and_then(|o| {
                    o.last = None;
                    rawm::query(&o.dev, rawm::channel_for(o.info.pid), timeout)
                });
                if r.is_err() {
                    open.remove(&Family::Rawm);
                }
                let _ = reply.send(r);
            }
        }
    }
}

fn check_allowed(o: &Open, id: u8) -> Result<(), String> {
    if o.spec.allowed_out.contains(&id) {
        Ok(())
    } else {
        Err(format!("reporte 0x{id:02X} no permitido"))
    }
}

/// Mejor dispositivo presente de cada familia. Con el mouse RAWM por cable y el receptor
/// enchufados a la vez se elige el cable (es el que responde).
fn present(api: &mut HidApi) -> Result<Vec<(std::ffi::CString, DeviceInfo, &'static FamilySpec)>, String> {
    api.refresh_devices().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for spec in FAMILIES {
        let mut cands: Vec<_> = api
            .device_list()
            .filter(|d| d.vendor_id() == spec.vid && spec.pids.contains(&d.product_id()) && d.usage_page() == spec.usage_page)
            .collect();
        cands.sort_by_key(|d| spec.family == Family::Rawm && RAWM_RECEIVERS.contains(&d.product_id()));
        if let Some(d) = cands.first() {
            let info = DeviceInfo {
                vid: d.vendor_id(),
                pid: d.product_id(),
                product: d.product_string().unwrap_or_default().trim().to_string(),
                manufacturer: d.manufacturer_string().unwrap_or_default().trim().to_string(),
                cable: spec.family == Family::X6 && d.product_id() == X6_PID_CABLE,
                usage_page: spec.usage_page,
                family: spec.family.id().into(),
            };
            out.push((d.path().to_owned(), info, spec));
        }
    }
    Ok(out)
}

fn api_of(api: &mut Option<HidApi>) -> Result<&mut HidApi, String> {
    if api.is_none() {
        *api = Some(HidApi::new().map_err(|e| e.to_string())?);
    }
    Ok(api.as_mut().unwrap())
}

fn open_all(api: &mut Option<HidApi>, open: &mut HashMap<Family, Open>) -> Result<Vec<DeviceInfo>, String> {
    let api = api_of(api)?;
    let found = present(api)?;
    // cerrar los que ya no están o cambiaron (p. ej. se enchufó el cable del RAWM)
    open.retain(|fam, o| found.iter().any(|(_, i, s)| s.family == *fam && i.pid == o.info.pid));
    for (path, info, spec) in found {
        if open.contains_key(&spec.family) {
            continue;
        }
        if let Ok(dev) = api.open_path(&path) {
            open.insert(spec.family, Open { dev, info, spec, last: None });
        }
    }
    if open.is_empty() {
        return Err("No se encontró ningún mouse compatible (receptor o cable)".into());
    }
    let mut infos: Vec<DeviceInfo> = open.values().map(|o| o.info.clone()).collect();
    infos.sort_by(|a, b| b.family.cmp(&a.family));
    Ok(infos)
}

fn ensure<'a>(api: &mut Option<HidApi>, open: &'a mut HashMap<Family, Open>, fam: Family) -> Result<&'a mut Open, String> {
    if !open.contains_key(&fam) {
        let api = api_of(api)?;
        let (path, info, spec) = present(api)?
            .into_iter()
            .find(|(_, _, s)| s.family == fam)
            .ok_or_else(|| "No se encontró el mouse (receptor o cable)".to_string())?;
        let dev = api.open_path(&path).map_err(|e| e.to_string())?;
        open.insert(fam, Open { dev, info, spec, last: None });
    }
    Ok(open.get_mut(&fam).unwrap())
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

/// Lee lo que haya llegado (sin bloquear) y, si no llegó nada nuevo, espera hasta `timeout_ms`.
/// Los dispositivos sin report ID se leen tal cual (hidapi no antepone el 0).
fn read_new(o: &mut Open, timeout_ms: u64) -> Result<Vec<Vec<u8>>, String> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut out: Vec<Vec<u8>> = Vec::new();
    let mut buf = [0u8; 65];
    // tope para no quedar atrapados si el dispositivo manda reportes sin parar
    for _ in 0..4096 {
        let wait = if out.is_empty() {
            deadline.saturating_duration_since(Instant::now()).as_millis() as i32
        } else {
            0
        };
        let n = o.dev.read_timeout(&mut buf, wait).map_err(|e| format!("lectura HID: {e}"))?;
        if n == 0 {
            if !out.is_empty() || Instant::now() >= deadline {
                break;
            }
            continue;
        }
        let r = buf[..n].to_vec();
        if o.last.as_deref() == Some(&r[..]) {
            if Instant::now() >= deadline {
                break;
            }
            continue;
        }
        o.last = Some(r.clone());
        out.push(r);
        if out.len() >= 256 {
            break;
        }
    }
    Ok(out)
}

/// Mínimo del protocolo RAWM para la bandeja (la UI usa src/protocol/rawm.ts).
pub mod rawm {
    use super::*;

    const PACKET: usize = 64;
    const CHANNEL_NONE: u8 = 0xFF;
    const CMD_QUERY: u8 = 0x1;
    const CMD_QUERY_RESULT: u8 = 0x2;

    pub fn is_receiver(pid: u16) -> bool {
        RAWM_RECEIVERS.contains(&pid)
    }

    pub fn channel_for(pid: u16) -> u8 {
        if RAWM_RECEIVERS.contains(&pid) {
            0
        } else {
            CHANNEL_NONE
        }
    }

    /// Evento CMD_QUERY sin CRC (como el primer pedido del configurador oficial).
    pub fn query_event(now_secs: u64) -> Vec<u8> {
        let mut ev = vec![CMD_QUERY, 0, 0x3, 0, 0];
        let mut t = now_secs;
        for _ in 0..8 {
            ev.push((t & 0xFF) as u8);
            t >>= 8;
        }
        let len = ev.len();
        ev[0] |= ((len >> 4) & 0xF0) as u8;
        ev[1] = (len & 0xFF) as u8;
        ev
    }

    pub fn packet(ev: &[u8], channel: u8) -> Vec<u8> {
        let mut p = Vec::with_capacity(PACKET);
        if channel != CHANNEL_NONE {
            p.push(0xC0 | (channel & 0x3F));
        }
        p.push(0x80 | ev.len() as u8);
        p.extend_from_slice(ev);
        p.resize(PACKET, 0);
        p
    }

    /// Bytes de datos de un reporte de entrada si es del canal pedido.
    pub fn data_of(report: &[u8], channel: u8) -> Option<&[u8]> {
        let (ch, b) = if !report.is_empty() && report[0] & 0xC0 == 0xC0 {
            (report[0] & 0x3F, &report[1..])
        } else {
            (CHANNEL_NONE, report)
        };
        if ch != channel || b.is_empty() || b[0] & 0xC0 == 0x40 {
            return None;
        }
        let size = (b[0] & 0x3F) as usize;
        b.get(1..1 + size)
    }

    /// Busca un CMD_QUERY_RESULT completo en el flujo (cada mensaje empieza con FF FF FF FF).
    pub fn find_query_result(stream: &[u8]) -> Option<String> {
        let mut i = 0;
        while i + 6 <= stream.len() {
            if stream[i..i + 4] == [0xFF; 4] {
                let len = (((stream[i + 4] as usize) << 4) & 0xF00) | stream[i + 5] as usize;
                if len >= 2 && i + 4 + len <= stream.len() {
                    if stream[i + 4] & 0x0F == CMD_QUERY_RESULT {
                        let body = &stream[i + 6..i + 4 + len];
                        let body = body.strip_suffix(&[0]).unwrap_or(body);
                        return Some(body.iter().map(|&c| c as char).collect());
                    }
                    i += 4 + len;
                    continue;
                }
            }
            i += 1;
        }
        None
    }

    pub fn query(dev: &HidDevice, channel: u8, timeout_ms: u64) -> Result<String, String> {
        drain(dev);
        let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        write(dev, 0, &packet(&query_event(now), channel))?;
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        let mut stream: Vec<u8> = Vec::new();
        let mut buf = [0u8; 65];
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return Err("El mouse no respondió (¿está dormido o apagado?)".into());
            }
            let n = dev.read_timeout(&mut buf, left.as_millis() as i32).map_err(|e| format!("lectura HID: {e}"))?;
            if let Some(d) = data_of(&buf[..n], channel) {
                stream.extend_from_slice(d);
                if let Some(json) = find_query_result(&stream) {
                    return Ok(json);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::rawm::*;

    #[test]
    fn rawm_query_packet_matches_js_codec() {
        // mismo pedido que genera encodeQuery(false) + packetize(…, CHANNEL_NONE) en src/protocol/rawm.ts
        let ev = query_event(0x6B04DC0D);
        assert_eq!(ev, vec![0x01, 0x0D, 0x03, 0x00, 0x00, 0x0D, 0xDC, 0x04, 0x6B, 0, 0, 0, 0]);
        let p = packet(&ev, 0xFF);
        assert_eq!(&p[..3], &[0x8D, 0x01, 0x0D]);
        assert_eq!(p.len(), 64);
        let p = packet(&ev, 0);
        assert_eq!(&p[..3], &[0xC0, 0x8D, 0x01]);
    }

    /// Contra hardware real (solo lectura): abre todos los mouses a la vez y le pide el estado a cada uno.
    /// `cargo test --lib -- --ignored multi_real --nocapture`
    #[test]
    #[ignore]
    fn multi_real_devices_open_together() {
        let hid = super::Hid::spawn();
        let infos = hid.open_all().expect("no hay mouses");
        for i in &infos {
            println!("abierto: {} {} {:04X}:{:04X}", i.family, i.product, i.vid, i.pid);
        }
        if infos.iter().any(|i| i.family == "x6") {
            let mut req = vec![0u8; 60];
            req[0] = 0x06;
            match hid.request(super::Family::X6, 0xB3, req, super::X6_REPORT_STATE, 2000) {
                Ok(st) => println!("X6: batería {}%", st[19] & 0x7f),
                Err(e) => println!("X6 sin respuesta (¿dormido o apagado?): {e}"),
            }
        }
        if infos.iter().any(|i| i.family == "rawm") {
            match hid.rawm_query(3000) {
                Ok(j) => println!("RAWM: {}", &j[..j.len().min(90)]),
                Err(e) => println!("RAWM sin respuesta (¿dormido?): {e}"),
            }
        }
    }

    /// Contra hardware real (solo lectura): `cargo test --lib -- --ignored rawm_real`
    #[test]
    #[ignore]
    fn rawm_real_device_query() {
        let hid = super::Hid::spawn();
        let infos = hid.open_all().expect("no hay mouses");
        let info = infos.into_iter().find(|i| i.family == "rawm").expect("no hay mouse RAWM");
        let json = hid.rawm_query(4000).or_else(|_| hid.rawm_query(4000)).expect("sin respuesta");
        println!("{} {:04X}: {json}", info.product, info.pid);
        assert!(json.contains("\"dn\""));
        // lectura genérica (la que usa la UI)
        let _ = hid.read(super::Family::Rawm, 100).expect("hid_read");
    }

    #[test]
    fn rawm_parses_query_result_across_packets() {
        // reportes reales del receptor RAWM (233C), partidos en dos paquetes
        let json = br#"{"r":"1.0.2","dn":"RAWM Receiver"}"#;
        let mut stream = vec![0xFF, 0xFF, 0xFF, 0xFF, 0x02, (json.len() + 2) as u8];
        stream.extend_from_slice(json);
        let (a, b) = stream.split_at(20);
        let mut r1 = vec![0x80 | a.len() as u8];
        r1.extend_from_slice(a);
        let mut r2 = vec![0x80 | b.len() as u8];
        r2.extend_from_slice(b);
        let mut acc = Vec::new();
        acc.extend_from_slice(data_of(&r1, 0xFF).unwrap());
        assert!(find_query_result(&acc).is_none());
        acc.extend_from_slice(data_of(&r2, 0xFF).unwrap());
        assert_eq!(find_query_result(&acc).unwrap(), r#"{"r":"1.0.2","dn":"RAWM Receiver"}"#);
        // aviso de buffer libre del canal 0: no son datos
        assert!(data_of(&[0xC0, 0x52, 0, 0, 0, 0], 0).is_none());
    }
}
