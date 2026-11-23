// Protocolo HID del Motospeed X6 (ingeniería inversa de jchu634/X6-Utilities, MIT,
// documentada en keshuac.com, CC BY 4.0).
//
// Todos los buffers son el "data" del reporte, SIN el byte de report ID
// (igual que HIDDevice.sendReport / inputreport en WebHID). Para hidapi se antepone el ID.
//
// Correcciones respecto del original:
//  - Brillo y velocidad se envían con el valor nuevo (el original mandaba el anterior).
//  - Motion Sync / Angle Snap / Ripple van en el orden real del paquete.
//  - El paquete de DPI incluye la cantidad de niveles activos (el original mandaba 0).

export const REPORT_CMD = 0xb5 // comandos de configuración (20 bytes de datos)
export const REPORT_LONG = 0xb3 // pedido de estado y remapeo (60 bytes de datos)
export const REPORT_STATE = 0xb4 // respuesta con el estado (entrada)

export const CMD_LEN = 20
export const LONG_LEN = 60

export const VENDOR_ID = 0x0bda
export const PRODUCT_DONGLE = 0xffe0
export const PRODUCT_CABLE = 0xfff1
export const VENDOR_USAGE_PAGE = 0xffc1

export const POLLING_HZ = [125, 500, 1000, 2000, 4000, 8000] as const

export interface X6Settings {
  pollingIndex: number
  dpiSlot: number
  dpi: number[]
  dpiCount: number
  liftOff: "low" | "high"
  motionSync: boolean
  angleSnap: boolean
  ripple: boolean
  scrollForward: boolean
  esports: boolean
  debounceMs: number
  sleepMin: number
  /** 0–100 (en modo cable no es confiable) */
  battery: number
  charging: boolean
}

export type LightModeId = "off" | "static" | "breath" | "rainbow"

const pad = (bytes: number[], len: number) => {
  const out = new Uint8Array(len)
  out.set(bytes.slice(0, len))
  return out
}

const u8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
const le16 = (v: number) => {
  const n = Math.max(0, Math.min(0xffff, Math.round(v)))
  return [n & 0xff, (n >> 8) & 0xff]
}

/* ───────────── Pedido / lectura de estado ───────────── */

/** Pide el reporte de estado (0xB4). Se envía por el reporte 0xB3. */
export function encodeStateRequest() {
  return { reportId: REPORT_LONG, data: pad([0x06], LONG_LEN) }
}

/** Decodifica el reporte de estado 0xB4 (data sin report ID, ≥ 20 bytes). */
export function decodeState(data: Uint8Array): X6Settings {
  if (data.length < 20) throw new Error(`Reporte de estado demasiado corto (${data.length} bytes)`)
  const dpi: number[] = []
  for (let i = 5; i <= 13; i += 2) dpi.push(data[i] | (data[i + 1] << 8))
  const flags = data[15]
  const batt = data[19]
  return {
    pollingIndex: Math.min(POLLING_HZ.length - 1, data[2] >> 4),
    dpiSlot: Math.min(4, data[4]),
    dpi,
    dpiCount: Math.max(1, Math.min(5, data[16] || 5)),
    // bits 0-1 reflejan el valor del comando 0x42: 01 = bajo, 10 = alto
    liftOff: (flags & 0x03) === 0x02 ? "high" : "low",
    motionSync: (flags & (1 << 2)) !== 0,
    angleSnap: (flags & (1 << 3)) !== 0,
    ripple: (flags & (1 << 4)) !== 0,
    scrollForward: (flags & (1 << 6)) === 0,
    esports: (flags & (1 << 7)) !== 0,
    debounceMs: data[17],
    sleepMin: data[18],
    battery: Math.min(100, batt & 0x7f),
    charging: (batt & 0x80) !== 0,
  }
}

/* ───────────── Comandos (reporte 0xB5, 20 bytes) ───────────── */

export function encodeDpi(dpi: number[], slot: number, count: number) {
  const values = dpi.slice(0, 5)
  while (values.length < 5) values.push(values[values.length - 1] ?? 800)
  return {
    reportId: REPORT_CMD,
    data: pad([0x40, 0xff, u8(slot), 0xff, ...values.flatMap(le16), u8(Math.max(1, Math.min(5, count)))], CMD_LEN),
  }
}

export function encodePolling(index: number) {
  const table = POLLING_HZ.flatMap(le16) // 7d 00 f4 01 e8 03 d0 07 a0 0f 40 1f
  return { reportId: REPORT_CMD, data: pad([0x41, 0xff, u8(index), 0xff, ...table], CMD_LEN) }
}

export function encodeSensor(s: {
  liftOff: "low" | "high"
  motionSync: boolean
  angleSnap: boolean
  ripple: boolean
  scrollForward: boolean
  esports: boolean
}) {
  const onOff = (b: boolean) => (b ? 0x01 : 0x02)
  return {
    reportId: REPORT_CMD,
    data: pad(
      [
        0x42,
        s.liftOff === "low" ? 0x01 : 0x02,
        onOff(s.motionSync),
        onOff(s.angleSnap),
        onOff(s.ripple),
        0x00,
        s.scrollForward ? 0x01 : 0x02,
        s.esports ? 0x02 : 0x01,
      ],
      CMD_LEN,
    ),
  }
}

export function encodeDebounce(ms: number) {
  return { reportId: REPORT_CMD, data: pad([0x43, u8(Math.min(20, ms))], CMD_LEN) }
}

export function encodeSleep(minutes: number) {
  return { reportId: REPORT_CMD, data: pad([0x0a, 0x01, u8(Math.max(1, Math.min(60, minutes)))], CMD_LEN) }
}

export function encodeLight(l: {
  mode: LightModeId
  brightness: number
  speed: number
  color: { r: number; g: number; b: number }
}) {
  const bri = u8(l.brightness)
  const spd = u8(l.speed)
  const bytes =
    l.mode === "off"
      ? [0x24, 0x00]
      : l.mode === "static"
        ? [0x24, 0x01, bri, spd, u8(l.color.r), u8(l.color.g), u8(l.color.b)]
        : l.mode === "breath"
          ? [0x24, 0x02, bri, spd, u8(l.color.r), u8(l.color.g), u8(l.color.b)]
          : [0x24, 0x03, bri, spd, 0xff] // arcoíris: el byte 6 va en 0xFF (según la captura original)
  return { reportId: REPORT_CMD, data: pad(bytes, CMD_LEN) }
}

/* ───────────── Remapeo (reporte 0xB3, 60 bytes) ───────────── */

export function encodeRemap(keyId: number, feature: number, code: number) {
  return {
    reportId: REPORT_LONG,
    data: pad([0x52, u8(keyId), 0x00, u8(feature), (code >> 16) & 0xff, (code >> 8) & 0xff, code & 0xff], LONG_LEN),
  }
}

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ")
