// Protocolo HID de los mouses RAWM (ES21, ES11, G11…), sacado por ingeniería inversa del
// configurador web oficial (rawmtech.com/hub.html → hub.miracletek.net/hub/js/library.min.js).
// Detalle completo en docs/protocolo-rawm.md.
//
// Resumen:
//  - Colección vendor usagePage 0xFF00. Reportes SIN report ID (WebHID: sendReport(0, data)),
//    de 64 bytes en las dos direcciones.
//  - Arriba de los reportes hay un flujo de bytes ("eventos"). Cada evento empieza con
//    [cmd | ((len >> 4) & 0xF0), len & 0xFF] y `len` cuenta toda la longitud, cabecera incluida.
//  - Salida: [0x80 | n, n bytes de flujo]. Para hablarle al mouse que está detrás del receptor
//    se antepone [0xC0 | canal] (canal 0 = mouse).
//  - Entrada: mismo formato. Tipo 0x40 = aviso de buffer libre del receptor (control de flujo).
//    Cada mensaje del dispositivo viene precedido por FF FF FF FF.
//  - CMD_QUERY → CMD_QUERY_RESULT con un JSON de texto con todo el estado (cpi, polling, lod…).
//  - Escritura: CONFIG_TYPE_MOUSE_PARAM lleva TODO el estado del mouse en un paquete
//    (se lee, se modifica y se reenvía entero). Suspensión y brillo tienen comando propio.
//  - Si el dispositivo informa "crc":1, cada evento se envuelve en CONFIG_TYPE_CRC (CRC-16/CCITT-FALSE).

export const RAWM_VENDOR_ID = 0x1915
export const RAWM_USAGE_PAGE = 0xff00
export const PACKET_SIZE = 64

export const CMD_QUERY = 0x1
export const CMD_QUERY_RESULT = 0x2
export const CMD_CONFIG = 0x3
export const CMD_ACTION = 0x6
export const CMD_NOTIFY = 0xb

export const CONFIG_TYPE_RESET = 0x3
export const CONFIG_TYPE_LIGHT = 0x12
export const CONFIG_TYPE_MOUSE_PARAM = 0x15
export const CONFIG_TYPE_MOUSE_KEY = 0x16
export const CONFIG_TYPE_MOUSE_FUNCTION = 0x18
export const CONFIG_TYPE_SET_SLEEP_TIME = 0x21
export const CONFIG_TYPE_CRC = 0x24
export const CONFIG_TYPE_SET_BRIGHTNESS = 0x31

export const OS_PC = 0x3

/** ACTION: guardar la configuración de botones en la memoria flash (1 | perfil<<8 = empezar, 0 = terminar). */
export const ACTION_SAVE_CONFIG_TO_FDS = 0x34

export const PACKET_TYPE_MASK = 0xc0
export const PACKET_SIZE_MASK = 0x3f
export const PACKET_TYPE_RAW_DATA = 0x00
export const PACKET_TYPE_BUFFER_SIZE = 0x40
export const PACKET_TYPE_EVENT_DATA = 0x80
export const PACKET_TYPE_EXTENDED = 0xc0

export const CHANNEL_NONE = 0xff
export const CHANNEL_MOUSE = 0x0

/** Tipos de CMD_NOTIFY (el mouse avisa cambios hechos desde los botones o pedidos). */
export const NOTIFY = {
  CPI: 0x0,
  POLLING: 0x1,
  LIGHT: 0x2,
  POWER_MODE: 0x5,
  CPI2: 0x6,
  LOD: 0x7,
  KEY_DELAY: 0x8,
  MOTION_SYNC: 0xd,
  ANGLE_TUNING: 0xe,
  ANGLE_SNAPPING: 0xf,
  RIPPLE_CONTROL: 0x10,
  MOUSE_CONFIG: 0x14,
  BATTERY_LEVELS: 0x16,
  BATTERY: 0x17,
  SLEEP_TIME: 0x1a,
} as const

/** Flags del byte `light` (LED del mouse). */
export const LED_B = 1 << 0
export const LED_G = 1 << 1
export const LED_R = 1 << 2
export const LED_FLAG = 1 << 3
export const LED_CPI = 1 << 4
export const LED_AUTO_OFF = 1 << 5

/** Estado completo del mouse, con los nombres del firmware. Es lo que viaja en MOUSE_PARAM. */
export interface RawmParams {
  /** CPI activo: x | (y << 16). y = 0 → igual a x. */
  resolution: number
  pollingRate: number
  light: number
  /** 8 niveles (0 = sin usar), cada uno x | (y << 16). */
  cpiLevels: number[]
  cpiLevelColors: number[]
  onboard: number
  powerMode: number
  lod: number
  /** Debounce en ms por botón (7 en el ES21). */
  keyDelay: number[]
  motionSync: number
  /** Con signo (−128…127). */
  angleTuning: number
  angleSnapping: number
  rippleControl: number
  txOutputPower: number
  /** mV de la tabla de batería (11 valores). */
  batteryLevels: number[]
  autoTxPower: number
  onboardStatus: number[]
  glassModeEnabled: number
}

/** Lo que informa el dispositivo en CMD_QUERY_RESULT (más el estado de MOUSE_PARAM). */
export interface RawmInfo extends RawmParams {
  deviceName: string
  productId: number
  vendorId: number
  revision: string
  battery: number
  charging: boolean
  sleepTime: number
  brightness: number
  crcSupported: boolean
  wired: boolean
  sensor: string
  /** cantidad de perfiles de botones ("ocn") y perfil activo ("oci") */
  onboardConfigNum: number
  onboardIndex: number
}

/** Valores por defecto del firmware (reset_device_info del configurador oficial). */
export function defaultInfo(): RawmInfo {
  return {
    resolution: 1600,
    pollingRate: -1,
    light: LED_CPI | LED_AUTO_OFF,
    cpiLevels: [400, 800, 1600, 3200, 0, 0, 0, 0],
    cpiLevelColors: [LED_B, LED_G, LED_G | LED_R, LED_R, 0, 0, 0, 0],
    onboard: 0,
    powerMode: 2,
    lod: 1,
    keyDelay: [8, 8, 8, 8, 8, 8, 8],
    motionSync: 1,
    angleTuning: 0,
    angleSnapping: 0,
    rippleControl: 0,
    txOutputPower: 0xff,
    // tabla de todos los modelos en RAWMHUB (y la que informa el ES21 real); si el mouse manda la suya, la reemplaza
    batteryLevels: [4100, 4020, 3900, 3790, 3720, 3670, 3630, 3610, 3560, 3480, 3200],
    autoTxPower: 1,
    onboardStatus: [LED_B | 0x80, LED_G | 0x80, LED_G | LED_R | 0x80, LED_R | 0x80],
    glassModeEnabled: 0,
    deviceName: "",
    productId: 0xffff,
    vendorId: 0,
    revision: "",
    battery: 100,
    charging: false,
    sleepTime: 60,
    brightness: 0x80,
    crcSupported: false,
    wired: false,
    sensor: "",
    onboardConfigNum: 1,
    onboardIndex: 0,
  }
}

/* ───────────── CPI X/Y ───────────── */

export const cpiX = (v: number) => v & 0xffff
export const cpiY = (v: number) => ((v >>> 16) & 0xffff) || (v & 0xffff)
export const packCpi = (x: number, y?: number) => (y && y !== x ? ((x & 0xffff) | ((y & 0xffff) << 16)) >>> 0 : x & 0xffff)

/* ───────────── Eventos ───────────── */

/** CRC-16/CCITT-FALSE (init 0xFFFF), igual que crc16_compute del firmware. */
export function crc16(data: ArrayLike<number>, len = data.length) {
  let crc = 0xffff
  for (let i = 0; i < len; i++) {
    crc = ((crc >> 8) & 0xff) | ((crc << 8) & 0xffff)
    crc ^= data[i] & 0xff
    crc ^= (crc & 0xff) >> 4
    crc ^= (crc << 12) & 0xffff
    crc ^= ((crc & 0xff) << 5) & 0xffff
  }
  return crc & 0xffff
}

/** Cierra un evento: escribe la longitud en la cabecera y, si hace falta, lo envuelve con CRC. */
export function finishEvent(body: number[], crc: boolean): Uint8Array {
  const ev = Uint8Array.from(body.map((b) => b & 0xff))
  const len = ev.length
  ev[0] = (((len >> 4) & 0xf0) | ev[0]) & 0xff
  ev[1] = len & 0xff
  if (!crc) return ev
  const total = len + 5
  const c = crc16(ev, len)
  const out = new Uint8Array(total)
  out[0] = (((total >> 4) & 0xf0) | CMD_CONFIG) & 0xff
  out[1] = total & 0xff
  out[2] = CONFIG_TYPE_CRC
  out[3] = c & 0xff
  out[4] = (c >> 8) & 0xff
  out.set(ev, 5)
  return out
}

const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff]
const le32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]

/** CMD_QUERY: pide el JSON de estado. Lleva la hora actual (segundos, 64 bits LE). */
export function encodeQuery(crc: boolean, nowMs = Date.now()) {
  const body = [CMD_QUERY, 0, OS_PC, 0, 0]
  let t = Math.floor(nowMs / 1000)
  for (let i = 0; i < 8; i++) {
    body.push(t & 0xff)
    t = Math.floor(t / 256)
  }
  return finishEvent(body, crc)
}

/** CONFIG_TYPE_MOUSE_PARAM: el estado completo (send_event_mouse_param). */
export function encodeMouseParam(p: RawmParams, crc: boolean) {
  const body = [CMD_CONFIG, 0, CONFIG_TYPE_MOUSE_PARAM]
  const res32 = (p.resolution & 0xffff0000) !== 0
  body.push(...(res32 ? [0, 0] : le16(p.resolution)))
  body.push(...le16(p.pollingRate), p.light)
  const levels32 = p.cpiLevels.some((v) => (v & 0xffff0000) !== 0)
  if (levels32) body.push(0)
  else {
    body.push(p.cpiLevels.length)
    for (const v of p.cpiLevels) body.push(...le16(v))
  }
  body.push(p.onboard, p.powerMode)
  body.push(...(res32 ? le32(p.resolution) : [0, 0, 0, 0]))
  if (!levels32) body.push(0)
  else {
    body.push(p.cpiLevels.length)
    for (const v of p.cpiLevels) body.push(...le32(v))
  }
  body.push(p.lod, p.keyDelay.length, ...p.keyDelay)
  body.push(p.motionSync, p.angleTuning & 0xff, p.angleSnapping, p.rippleControl)
  body.push(p.cpiLevelColors.length, ...p.cpiLevelColors.map((c) => c & 0x7))
  body.push(p.txOutputPower, p.batteryLevels.length)
  for (const v of p.batteryLevels) body.push(...le16(v))
  body.push(p.autoTxPower, p.onboardStatus.length, ...p.onboardStatus, p.glassModeEnabled)
  return finishEvent(body, crc)
}

/** Tiempo de suspensión en segundos (el configurador oficial permite 10 s – 30 min). */
export function encodeSleepTime(seconds: number, crc: boolean) {
  const s = Math.max(10, Math.min(1800, Math.round(seconds)))
  return finishEvent([CMD_CONFIG, 0, CONFIG_TYPE_SET_SLEEP_TIME, ...le16(s)], crc)
}

export function encodeBrightness(value: number, crc: boolean) {
  return finishEvent([CMD_CONFIG, 0, CONFIG_TYPE_SET_BRIGHTNESS, Math.max(0, Math.min(255, Math.round(value)))], crc)
}

/* ───────────── Paquetes (reportes de 64 bytes) ───────────── */

/**
 * Parte el flujo de eventos en reportes de salida.
 * Directo al receptor (canal NONE): [0x80|n, n ≤ 63 bytes]. Al mouse: [0xC0|canal, 0x80|n, n ≤ 62 bytes].
 */
export function packetize(stream: Uint8Array, channel: number): Uint8Array[] {
  const direct = channel === CHANNEL_NONE
  const max = direct ? PACKET_SIZE - 1 : PACKET_SIZE - 2
  const out: Uint8Array[] = []
  for (let off = 0; off < stream.length; off += max) {
    const chunk = stream.subarray(off, off + max)
    const pkt = new Uint8Array(PACKET_SIZE)
    let i = 0
    if (!direct) pkt[i++] = PACKET_TYPE_EXTENDED | (channel & PACKET_SIZE_MASK)
    pkt[i++] = PACKET_TYPE_EVENT_DATA | chunk.length
    pkt.set(chunk, i)
    out.push(pkt)
  }
  return out
}

/** Pedido de "¿cuánto buffer libre tenés?" al receptor para un canal (receptores con poca memoria). */
export function bufferSizeRequest(channel: number) {
  const pkt = new Uint8Array(PACKET_SIZE)
  pkt[0] = PACKET_TYPE_EXTENDED | (channel & PACKET_SIZE_MASK)
  pkt[1] = PACKET_TYPE_BUFFER_SIZE
  return pkt
}

export type InputPacket =
  | { kind: "data"; channel: number; bytes: Uint8Array }
  | { kind: "buffer"; channel: number; free: number }

/** Decodifica un reporte de entrada (sin report ID). */
export function parseInputReport(report: Uint8Array): InputPacket | null {
  let b = report
  let channel = CHANNEL_NONE
  if ((b[0] & PACKET_TYPE_MASK) === PACKET_TYPE_EXTENDED) {
    channel = b[0] & PACKET_SIZE_MASK
    b = b.subarray(1)
  }
  const type = b[0] & PACKET_TYPE_MASK
  const size = b[0] & PACKET_SIZE_MASK
  if (type === PACKET_TYPE_BUFFER_SIZE) {
    const free = (b[1] | (b[2] << 8) | (b[3] << 16) | (b[4] << 24)) >>> 0
    return { kind: "buffer", channel, free }
  }
  if (size === 0) return null
  return { kind: "data", channel, bytes: b.slice(1, 1 + size) }
}

export interface RawmMessage {
  cmd: number
  /** Cuerpo del evento sin los 2 bytes de cabecera. */
  payload: Uint8Array
}

/**
 * Rearma el flujo de entrada de un canal en mensajes. Cada mensaje viene precedido por
 * FF FF FF FF. Si el buffer no arranca así, se descarta hasta el próximo marcador.
 */
export class Deframer {
  private buf = new Uint8Array(0)

  push(bytes: Uint8Array): RawmMessage[] {
    const joined = new Uint8Array(this.buf.length + bytes.length)
    joined.set(this.buf)
    joined.set(bytes, this.buf.length)
    this.buf = joined
    const out: RawmMessage[] = []
    for (;;) {
      const start = findMarker(this.buf)
      if (start < 0) {
        // conservar los últimos 3 bytes por si el marcador quedó partido
        this.buf = this.buf.slice(Math.max(0, this.buf.length - 3))
        break
      }
      if (start > 0) this.buf = this.buf.slice(start)
      if (this.buf.length < 6) break
      const len = ((this.buf[4] << 4) & 0xf00) | this.buf[5]
      if (len < 2) {
        this.buf = this.buf.slice(4)
        continue
      }
      if (this.buf.length < 4 + len) break
      out.push({ cmd: this.buf[4] & 0xf, payload: this.buf.slice(6, 4 + len) })
      this.buf = this.buf.slice(4 + len)
    }
    return out
  }

  reset() {
    this.buf = new Uint8Array(0)
  }
}

function findMarker(b: Uint8Array) {
  for (let i = 0; i + 3 < b.length; i++) if (b[i] === 0xff && b[i + 1] === 0xff && b[i + 2] === 0xff && b[i + 3] === 0xff) return i
  return -1
}

/* ───────────── Lectura de estado ───────────── */

/** Texto del CMD_QUERY_RESULT (puede terminar en \0). */
export function queryResultText(payload: Uint8Array) {
  const end = payload.length && payload[payload.length - 1] === 0 ? payload.length - 1 : payload.length
  let s = ""
  for (let i = 0; i < end; i++) s += String.fromCharCode(payload[i])
  return s
}

/** Aplica el JSON del CMD_QUERY_RESULT sobre `info` (parse_device_info del configurador oficial). */
export function applyQueryResult(info: RawmInfo, text: string): RawmInfo {
  const j = JSON.parse(text) as Record<string, unknown>
  const n = (k: string) => (typeof j[k] === "number" ? (j[k] as number) : undefined)
  const arr = (k: string) => (Array.isArray(j[k]) ? (j[k] as number[]) : undefined)
  const next: RawmInfo = { ...info }
  const s = (k: string) => (typeof j[k] === "string" ? (j[k] as string) : undefined)
  next.revision = s("revision") ?? s("r") ?? next.revision
  next.battery = n("battery") ?? next.battery
  next.resolution = n("cpi") ?? next.resolution
  next.pollingRate = n("polling") ?? next.pollingRate
  next.light = n("light") ?? next.light
  next.cpiLevels = arr("cpi_l") ?? next.cpiLevels
  next.cpiLevelColors = arr("cpi_l_c") ?? next.cpiLevelColors
  next.onboard = n("ob") ?? next.onboard
  next.powerMode = n("pm") ?? next.powerMode
  next.deviceName = s("dn") ?? next.deviceName
  next.productId = n("pi") ?? next.productId
  next.vendorId = n("vi") ?? next.vendorId
  next.lod = n("lod") ?? next.lod
  next.keyDelay = arr("kd") ?? next.keyDelay
  next.motionSync = n("ms") ?? next.motionSync
  const at = n("at")
  if (at !== undefined) next.angleTuning = (at << 24) >> 24
  next.angleSnapping = n("as") ?? next.angleSnapping
  next.rippleControl = n("rctrl") ?? next.rippleControl
  const chr = n("chr")
  if (chr !== undefined) next.charging = chr === 1
  next.txOutputPower = n("top") ?? next.txOutputPower
  next.autoTxPower = n("atp") ?? next.autoTxPower
  next.sleepTime = n("st") ?? next.sleepTime
  const crc = n("crc")
  if (crc !== undefined) next.crcSupported = crc === 1
  const gm = j.gm
  if (Array.isArray(gm)) next.glassModeEnabled = gm[1] as number
  else if (typeof gm === "number") next.glassModeEnabled = 1
  next.onboardStatus = arr("ocs") ?? next.onboardStatus
  const wired = n("wired")
  if (wired !== undefined) next.wired = wired === 1
  next.sensor = s("sst") ?? next.sensor
  next.brightness = n("lbn") ?? next.brightness
  next.onboardConfigNum = n("ocn") ?? n("onboard_config_num") ?? next.onboardConfigNum
  next.onboardIndex = n("oci") ?? next.onboardIndex
  return next
}

/** Aplica un CMD_NOTIFY (cambios hechos desde el mouse o datos extra después del query). */
export function applyNotify(info: RawmInfo, payload: Uint8Array): RawmInfo {
  const type = payload[0]
  const d = payload.subarray(1)
  const u16 = (i: number) => d[i] | (d[i + 1] << 8)
  const next = { ...info }
  switch (type) {
    case NOTIFY.CPI:
      next.resolution = u16(0)
      break
    case NOTIFY.CPI2:
      next.resolution = (d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24)) >>> 0
      break
    case NOTIFY.POLLING:
      next.pollingRate = u16(0)
      break
    case NOTIFY.LIGHT:
      next.light = d[0]
      break
    case NOTIFY.POWER_MODE:
      next.powerMode = d[0]
      break
    case NOTIFY.LOD:
      next.lod = d[0]
      break
    case NOTIFY.KEY_DELAY:
      next.keyDelay = Array.from(d)
      break
    case NOTIFY.MOTION_SYNC:
      next.motionSync = d[0]
      break
    case NOTIFY.ANGLE_TUNING:
      next.angleTuning = (d[0] << 24) >> 24
      break
    case NOTIFY.ANGLE_SNAPPING:
      next.angleSnapping = d[0]
      break
    case NOTIFY.RIPPLE_CONTROL:
      next.rippleControl = d[0]
      break
    case NOTIFY.BATTERY_LEVELS: {
      const lv: number[] = []
      for (let i = 0; i + 1 < d.length; i += 2) lv.push(u16(i))
      next.batteryLevels = lv
      break
    }
    case NOTIFY.BATTERY:
      next.battery = d[0]
      next.charging = d[1] === 1
      break
    case NOTIFY.SLEEP_TIME:
      next.sleepTime = u16(0)
      break
    default:
      return info
  }
  return next
}

/* ───────────── Botones (perfiles en flash) ───────────── */

// Ids de tecla del mouse (tabla "keys" de RAWMHUB): M1 izquierdo 10, M2 derecho 11, M3 medio 12,
// M4 13 (oculto en el ES21: indicador de batería), M5 lateral trasero 14, M6 lateral delantero 15, M7 DPI 16.
export const KEY_M1 = 10
export const KEY_M2 = 11
export const KEY_M3 = 12
export const KEY_M5 = 14
export const KEY_M6 = 15
export const KEY_M7 = 16

export const MOUSE_KEY_TYPE_KBD = 0x0
export const MOUSE_KEY_TYPE_MKEY = 0x1
export const MOUSE_KEY_TYPE_WHEEL = 0x3
export const MOUSE_KEY_TYPE_MEDIA = 0x4
export const MOUSE_KEY_TYPE_AC_PAN = 0x5
export const TOUCH_TYPE_PRESS = 0x2
export const FUNCTION_TOGGLE_CPI = 0x1
export const FUNCTION_NEXT_CPI = 0x2
export const FUNCTION_PREVIOUS_CPI = 0x3
export const FUNCTION_SHOW_POWER = 0xe

/** Qué hace un botón. Teclado: `mod` = modificador (usage HID, p. ej. 0xE0 Ctrl), `code` = usage HID. */
export type RawmBinding =
  | { kind: "key"; type: number; code: number; mod: number; mod2: number }
  | { kind: "fn"; touch: number; fn: number; data: number }

/** Un registro de configuración de botón tal como lo guarda el mouse (evento CONFIG completo). */
export interface KeyRecord {
  keyIds: number[]
  binding: RawmBinding | null
  /** bytes originales del evento (para reenviar sin tocar lo que Nexo no entiende) */
  raw: number[]
}

/** Decodifica un registro (add_key_info del configurador). Devuelve null si no es de botón. */
export function parseKeyRecord(ev: ArrayLike<number>): KeyRecord | null {
  const b = Array.from(ev)
  if (b.length < 5 || (b[0] & 0xf) !== CMD_CONFIG) return null
  const len = ((b[0] << 4) & 0xf00) | b[1]
  const type = b[2]
  const n = b[3]
  if (n > 2 || 4 + n > Math.min(len, b.length)) return null
  const keyIds = b.slice(4, 4 + n)
  const i = 4 + n
  const at = (k: number) => (k < Math.min(len, b.length) ? b[k] : 0)
  let binding: RawmBinding | null = null
  if (type === CONFIG_TYPE_MOUSE_KEY) {
    binding = { kind: "key", mod: at(i), type: at(i + 1), code: at(i + 2), mod2: at(i + 3) }
  } else if (type === CONFIG_TYPE_MOUSE_FUNCTION) {
    binding = { kind: "fn", touch: at(i), fn: at(i + 1), data: at(i + 2) | (at(i + 3) << 8) }
  } else if (type !== 0x5 && type !== 0x2b) {
    return null // ni botón ni macro
  }
  return { keyIds, binding, raw: b.slice(0, Math.min(len, b.length)) }
}

/** Arma el registro de un botón (send_event_mouse_key / send_event_mouse_function), con cabecera completa. */
export function keyRecordBody(keyId: number, bnd: RawmBinding): number[] {
  const body =
    bnd.kind === "key"
      ? [CMD_CONFIG, 0, CONFIG_TYPE_MOUSE_KEY, 1, keyId, bnd.mod, bnd.type, bnd.code, bnd.mod2, 0]
      : [CMD_CONFIG, 0, CONFIG_TYPE_MOUSE_FUNCTION, 1, keyId, bnd.touch, bnd.fn, bnd.data & 0xff, (bnd.data >> 8) & 0xff, 0, 0, 0]
  return Array.from(finishEvent(body, false))
}

export function encodeAction(action: number, value: number, crc: boolean) {
  return finishEvent([CMD_ACTION, 0, action, ...le32(value >>> 0)], crc)
}

export function encodeConfigReset(crc: boolean) {
  return finishEvent([CMD_CONFIG, 0, CONFIG_TYPE_RESET], crc)
}

/**
 * Guarda el perfil `profile` con exactamente estos registros (como el configurador oficial):
 * RESET → SAVE(1 | perfil<<8) → registros → SAVE(0).
 */
export function encodeSaveKeyProfile(profile: number, records: number[][], crc: boolean): Uint8Array[] {
  return [
    encodeConfigReset(crc),
    encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 1 | ((profile & 0xff) << 8), crc),
    ...records.map((r) => finishEvent(r.map((v, k) => (k === 0 ? v & 0x0f : k === 1 ? 0 : v)), crc)),
    encodeAction(ACTION_SAVE_CONFIG_TO_FDS, 0, crc),
  ]
}

/**
 * Junta los NOTIFY 0x14 que manda el mouse después del estado: un byte = empieza el perfil N
 * (0xFF = terminó); más bytes = un registro del perfil actual.
 */
export class KeyConfigCollector {
  profiles: number[][][] = []
  done = false
  private current = -1

  reset() {
    this.profiles = []
    this.done = false
    this.current = -1
  }

  feed(data: Uint8Array) {
    if (data.length === 1) {
      if (data[0] === 0xff) this.done = true
      else {
        this.current = data[0]
        this.profiles[this.current] = []
      }
      return
    }
    if (this.current >= 0 && data.length >= 2) this.profiles[this.current].push(Array.from(data))
  }
}

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ")
