// Driver de los mouses RAWM (protocolo en src/protocol/rawm.ts, detalle en docs/protocolo-rawm.md).
//
// Con el receptor 2.4G el mouse está detrás del canal 0: los paquetes llevan el prefijo
// 0xC0|canal y el receptor (con poca memoria) avisa cuánto buffer libre le queda; antes de
// mandarle otro paquete hay que esperar ese aviso. Por cable se habla directo, sin prefijo.

import { ACTION_BY_ID, actionForRawm } from "../device/actions.ts"
import type { Transport } from "../device/transport"
import type { ButtonId, Capabilities, LightMode, LightState, MouseState, PowerModeInfo } from "../device/types"
import {
  applyNotify,
  applyQueryResult,
  bufferSizeRequest,
  CHANNEL_MOUSE,
  CHANNEL_NONE,
  CMD_NOTIFY,
  CMD_QUERY_RESULT,
  cpiX,
  Deframer,
  defaultInfo,
  encodeBrightness,
  encodeMouseParam,
  encodeQuery,
  encodeSaveKeyProfile,
  encodeSleepTime,
  KEY_M1,
  KEY_M2,
  KEY_M3,
  KEY_M5,
  KEY_M6,
  KEY_M7,
  KeyConfigCollector,
  keyRecordBody,
  NOTIFY,
  parseKeyRecord,
  LED_AUTO_OFF,
  LED_B,
  LED_CPI,
  LED_FLAG,
  LED_G,
  LED_R,
  packCpi,
  packetize,
  parseInputReport,
  queryResultText,
  RAWM_USAGE_PAGE,
  RAWM_VENDOR_ID,
  type RawmInfo,
  type RawmParams,
} from "../protocol/rawm.ts"
import type { DeviceDriver, DeviceSession, DriverIdentity } from "./driver"
import { DEFAULT_RAWM_MODEL, findRawmModel, RAWM_PIDS, RAWM_RECEIVER_PIDS, type RawmModel } from "./rawm-models.ts"

const LED_ROTATE = 1 << 6
const LED_COLOR = LED_R | LED_G | LED_B
/** Buffer mínimo que tiene que informar el receptor para aceptar otro paquete ((32-2)*8). */
const MIN_FREE = 240
const LEVELS = 8

/** Botón de Nexo → id de tecla RAWM (M6 es el lateral delantero; M5, el trasero). */
export const RAWM_KEY: Partial<Record<ButtonId, number>> = {
  left: KEY_M1,
  right: KEY_M2,
  middle: KEY_M3,
  side1: KEY_M6,
  side2: KEY_M5,
  dpi: KEY_M7,
}
const RAWM_BUTTONS: ButtonId[] = ["left", "right", "middle", "side1", "side2", "dpi"]

/** Remapeos de Nexo a partir de los registros de un perfil. Sin registro = botón desactivado. */
export function remapsFromRecords(records: number[][]): Record<ButtonId, string> {
  const out = {} as Record<ButtonId, string>
  for (const b of RAWM_BUTTONS) {
    const rec = records.map(parseKeyRecord).find((r) => r && r.keyIds.length === 1 && r.keyIds[0] === RAWM_KEY[b])
    out[b] = rec ? actionForRawm(rec.binding) : "disable"
  }
  return out
}

/**
 * Registros nuevos del perfil: se reemplazan solo los botones que cambiaron (en su lugar), se borran
 * los desactivados y se conserva todo lo demás tal cual (botón de batería oculto, macros, combinaciones).
 */
export function recordsWithRemaps(records: number[][], next: Record<ButtonId, string>, prev: Record<ButtonId, string>) {
  const changed = new Map<number, ButtonId>()
  for (const b of RAWM_BUTTONS) if (next[b] !== prev[b] && next[b] !== "custom") changed.set(RAWM_KEY[b]!, b)
  const bodyFor = (b: ButtonId) => {
    const a = ACTION_BY_ID[next[b]]
    return a?.rawm ? keyRecordBody(RAWM_KEY[b]!, a.rawm) : null
  }
  const out: number[][] = []
  const done = new Set<number>()
  for (const r of records) {
    const rec = parseKeyRecord(r)
    const key = rec && rec.keyIds.length === 1 ? rec.keyIds[0] : -1
    const b = changed.get(key)
    if (!b) {
      out.push(r)
      continue
    }
    if (done.has(key)) continue
    done.add(key)
    const body = bodyFor(b)
    if (body) out.push(body)
  }
  for (const [key, b] of changed) {
    if (done.has(key)) continue
    const body = bodyFor(b)
    if (body) out.push(body)
  }
  return out
}

const POWER_3: PowerModeInfo[] = [
  { label: "Oficina", desc: "Consumo mínimo. El polling rate queda limitado a 125 Hz." },
  { label: "Bajo consumo", desc: "Consumo bajo y rendimiento moderado. Polling de hasta 1000 Hz." },
  { label: "Alto rendimiento", desc: "Más consumo y la mejor respuesta del sensor. Ideal para jugar." },
]
const POWER_2: PowerModeInfo[] = [
  { label: "Bajo consumo", desc: "Consumo bajo y rendimiento moderado. Mayor autonomía." },
  { label: "Alto rendimiento", desc: "Más consumo y la mejor respuesta del sensor. Ideal para jugar." },
]

export function rawmCaps(model: RawmModel): Capabilities {
  return {
    family: "rawm",
    shortName: model.name,
    dpi: { min: model.cpi[0], max: model.cpi[1], step: model.step, slots: LEVELS },
    polling: model.polling,
    lod: model.lods > 1,
    motionSync: true,
    angleSnap: true,
    ripple: true,
    scrollDirection: false,
    esports: false,
    powerModes: model.power === 3 ? POWER_3 : model.power === 2 ? POWER_2 : [],
    debounce: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    // el configurador oficial permite de 10 s a 30 min
    sleep: [10, 30, 60, 120, 300, 600, 1200, 1800],
    light: { modes: ["off", "static", "rainbow", "dpi"], palette: "rgb3", speed: false, brightness: model.brightness, autoOff: true, readable: true },
    remap: true,
    buttons: RAWM_BUTTONS,
    battery: true,
  }
}

/* ───────────── Conversión estado RAWM ↔ Nexo ───────────── */

function lightFromInfo(info: RawmInfo, prev?: LightState): LightState {
  const l = info.light
  const color = { r: l & LED_R ? 255 : 0, g: l & LED_G ? 255 : 0, b: l & LED_B ? 255 : 0 }
  const mode: LightMode = l & LED_CPI ? "dpi" : l & LED_ROTATE ? "rainbow" : (l & LED_COLOR) === 0 ? "off" : "static"
  return {
    mode,
    color: mode === "off" && prev ? prev.color : color,
    brightness: info.brightness || 1,
    speed: prev?.speed ?? 128,
    autoOff: (l & LED_AUTO_OFF) !== 0,
  }
}

function lightToByte(light: LightState, current: number) {
  const bit = (v: number, b: number) => (v >= 128 ? b : 0)
  let color = bit(light.color.r, LED_R) | bit(light.color.g, LED_G) | bit(light.color.b, LED_B)
  // los bits de color salen del estado (que refleja lo leído del mouse); en arcoíris y según DPI
  // no se ven, pero se mandan igual para no alterarlos. Color fijo sin color = blanco.
  if (light.mode === "static" && color === 0) color = LED_COLOR
  let v = current & ~(LED_ROTATE | LED_CPI | LED_COLOR | LED_AUTO_OFF)
  if (light.mode === "off") color = 0
  if (light.mode === "rainbow") v |= LED_ROTATE
  if (light.mode === "dpi") v |= LED_CPI
  if (light.autoOff) v |= LED_AUTO_OFF
  return (v | color) & 0xff
}

export function infoToState(info: RawmInfo, caps: Capabilities, prevLight?: LightState): Partial<MouseState> {
  const levels = info.cpiLevels.slice(0, LEVELS)
  while (levels.length < LEVELS) levels.push(0)
  const count = Math.max(1, levels.filter((v) => v !== 0).length)
  const slot = Math.max(0, levels.findIndex((v) => v === info.resolution || cpiX(v) === cpiX(info.resolution)))
  const firstUsed = cpiX(levels[0]) || cpiX(info.resolution)
  const dpi = levels.map((v) => cpiX(v) || firstUsed)
  const pIdx = caps.polling.indexOf(info.pollingRate)
  return {
    dpi,
    dpiSlot: Math.min(slot, count - 1),
    dpiCount: count,
    pollingIndex: pIdx >= 0 ? pIdx : caps.polling.length - 1,
    liftOff: info.lod <= 1 ? "low" : "high",
    motionSync: info.motionSync !== 0,
    angleSnap: info.angleSnapping !== 0,
    ripple: info.rippleControl !== 0,
    powerMode: Math.max(0, Math.min(Math.max(0, caps.powerModes.length - 1), info.powerMode)),
    debounceMs: (info.keyDelay[0] ?? 8) & 0xf,
    sleepSec: info.sleepTime,
    light: lightFromInfo(info, prevLight),
    battery: Math.max(0, Math.min(100, info.battery)),
    charging: info.charging,
    connection: info.wired ? "cable" : "dongle",
  }
}

/** Arma los parámetros de MOUSE_PARAM a partir del estado de Nexo (sobre lo último leído). */
export function stateToParams(m: MouseState, info: RawmInfo, model: RawmModel): RawmParams {
  const count = Math.max(1, Math.min(LEVELS, m.dpiCount))
  const cpiLevels = Array.from({ length: LEVELS }, (_, i) => {
    if (i >= count) return 0
    const old = info.cpiLevels[i] ?? 0
    const x = m.dpi[i]
    // si el nivel tenía Y distinto y no se tocó X, se conserva tal cual
    return cpiX(old) === x ? old : packCpi(x)
  })
  const slot = Math.min(m.dpiSlot, count - 1)
  return {
    resolution: cpiLevels[slot],
    pollingRate: model.polling[m.pollingIndex] ?? info.pollingRate,
    light: lightToByte(m.light, info.light) | LED_FLAG,
    cpiLevels,
    cpiLevelColors: info.cpiLevelColors,
    onboard: info.onboard,
    powerMode: m.powerMode,
    lod: m.liftOff === "low" ? 1 : Math.max(2, model.lods),
    keyDelay: info.keyDelay.map((v) => (v & 0xf0) | (m.debounceMs & 0xf)),
    motionSync: m.motionSync ? 1 : 0,
    angleTuning: info.angleTuning,
    angleSnapping: m.angleSnap ? 1 : 0,
    rippleControl: m.ripple ? 1 : 0,
    txOutputPower: info.txOutputPower,
    batteryLevels: info.batteryLevels,
    autoTxPower: info.autoTxPower,
    onboardStatus: info.onboardStatus,
    glassModeEnabled: info.glassModeEnabled,
  }
}

const PARAM_KEYS: (keyof MouseState)[] = [
  "dpi",
  "dpiSlot",
  "dpiCount",
  "pollingIndex",
  "liftOff",
  "motionSync",
  "angleSnap",
  "ripple",
  "powerMode",
  "debounceMs",
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ───────────── Sesión ───────────── */

class RawmSession implements DeviceSession {
  caps: Capabilities
  private model: RawmModel
  private info = defaultInfo()
  private readonly channel: number
  private readonly viaReceiver: boolean
  private readonly deframer = new Deframer()
  private flowPending = false
  private gotQuery = false
  private lastLight: LightState | undefined
  private readonly t: Transport
  private readonly keys = new KeyConfigCollector()
  /** registros de botones por perfil, tal como los informó el mouse */
  private keyProfiles: number[][][] | null = null

  constructor(t: Transport) {
    this.t = t
    this.viaReceiver = RAWM_RECEIVER_PIDS.includes(t.info.pid)
    this.channel = this.viaReceiver ? CHANNEL_MOUSE : CHANNEL_NONE
    this.model = findRawmModel(t.info.pid) ?? DEFAULT_RAWM_MODEL
    this.caps = rawmCaps(this.model)
  }

  identity(): DriverIdentity | null {
    if (!this.info.deviceName) return null
    return { vendor: "RAWM", product: this.model.name, fromDevice: true }
  }

  /** Procesa reportes de entrada: arma mensajes del canal del mouse y aplica los NOTIFY. */
  private ingest(reports: Uint8Array[]) {
    let free = -1
    for (const r of reports) {
      const p = parseInputReport(r)
      if (!p || p.channel !== this.channel) continue
      if (p.kind === "buffer") {
        free = p.free
        continue
      }
      for (const m of this.deframer.push(p.bytes)) {
        if (m.cmd === CMD_QUERY_RESULT) {
          this.info = applyQueryResult(this.info, queryResultText(m.payload))
          this.gotQuery = true
        } else if (m.cmd === CMD_NOTIFY) {
          if (m.payload[0] === NOTIFY.MOUSE_CONFIG) this.keys.feed(m.payload.subarray(1))
          else this.info = applyNotify(this.info, m.payload)
        }
      }
    }
    return free
  }

  /**
   * Espera a que el receptor tenga lugar para otro paquete. Con el mouse enlazado el receptor no avisa
   * solo: hay que preguntarle (paquete C0|canal 40), como hace el configurador oficial cada 25 ms.
   */
  private async waitFree(timeoutMs = 1500) {
    const until = Date.now() + timeoutMs
    while (Date.now() < until) {
      await this.t.send(0, bufferSizeRequest(this.channel))
      const free = this.ingest(await this.t.read(Math.max(1, Math.min(30, until - Date.now()))))
      if (free >= MIN_FREE) return
    }
    throw new Error("El mouse no responde: movelo para despertarlo y probá de nuevo.")
  }

  private async sendEvents(events: Uint8Array[]) {
    const total = events.reduce((n, e) => n + e.length, 0)
    const stream = new Uint8Array(total)
    let off = 0
    for (const e of events) {
      stream.set(e, off)
      off += e.length
    }
    for (const pkt of packetize(stream, this.channel)) {
      if (this.flowPending) await this.waitFree()
      await this.t.send(0, pkt)
      this.flowPending = this.viaReceiver
    }
  }

  private async query() {
    this.gotQuery = false
    this.ingest(await this.t.read(0)) // descartar lo viejo
    this.deframer.reset()
    this.keys.reset()
    // el primer pedido después de un rato sin actividad a veces no tiene respuesta: se reintenta
    for (let attempt = 0; attempt < 3 && !this.gotQuery; attempt++) {
      this.flowPending = false
      await this.sendEvents([encodeQuery(this.info.crcSupported)])
      const until = Date.now() + 1200
      while (!this.gotQuery && Date.now() < until) this.ingest(await this.t.read(Math.max(1, until - Date.now())))
    }
    if (!this.gotQuery)
      throw new Error(
        this.viaReceiver
          ? "El mouse no respondió por el receptor (¿está dormido, apagado o en Bluetooth?). Movelo y probá de nuevo."
          : "El mouse no respondió.",
      )
    // después del estado el mouse manda NOTIFY con datos extra (tabla de batería, perfiles de botones…).
    // Por el receptor llegan más tarde (antes viene un NOTIFY largo con las direcciones del enlace):
    // se esperan hasta 1,5 s a que empiecen y hasta 4 s al marcador de fin (0xFF).
    const start = Date.now()
    for (;;) {
      const el = Date.now() - start
      if (this.keys.done || el > 4000 || (el > 1500 && this.keys.profiles.length === 0)) break
      this.ingest(await this.t.read(50))
    }
    if (this.keys.done && this.keys.profiles.length) this.keyProfiles = this.keys.profiles.map((p) => (p ?? []).slice())
    const model = findRawmModel(this.info.productId, this.info.deviceName)
    if (model && model !== this.model) {
      this.model = model
      this.caps = rawmCaps(model)
    }
  }

  async read(): Promise<Partial<MouseState>> {
    await this.query()
    const st = infoToState(this.info, this.caps, this.lastLight)
    // conectado directo (PID del mouse) = cable; el firmware no siempre manda "wired"
    if (!this.viaReceiver) st.connection = "cable"
    const profile = this.keyProfiles?.[this.info.onboardIndex]
    if (profile) st.remaps = remapsFromRecords(profile)
    this.lastLight = st.light
    return st
  }

  async apply(m: MouseState, prev: MouseState) {
    this.lastLight = m.light
    const events: Uint8Array[] = []
    const crc = this.info.crcSupported
    const lightChanged = (lightToByte(m.light, this.info.light) & ~LED_FLAG) !== (this.info.light & ~LED_FLAG)
    if (PARAM_KEYS.some((k) => m[k] !== prev[k]) || (m.light !== prev.light && lightChanged)) {
      const params = stateToParams(m, this.info, this.model)
      events.push(encodeMouseParam(params, crc))
      this.info = { ...this.info, ...params, light: params.light & ~LED_FLAG }
    }
    if (m.sleepSec !== prev.sleepSec && m.sleepSec !== this.info.sleepTime) {
      events.push(encodeSleepTime(m.sleepSec, crc))
      this.info = { ...this.info, sleepTime: m.sleepSec }
    }
    if (this.caps.light?.brightness && m.light.brightness !== prev.light.brightness && m.light.brightness !== this.info.brightness) {
      events.push(encodeBrightness(m.light.brightness, crc))
      this.info = { ...this.info, brightness: m.light.brightness }
    }
    if (m.remaps !== prev.remaps && RAWM_BUTTONS.some((b) => m.remaps[b] !== prev.remaps[b])) {
      const idx = this.info.onboardIndex
      const profile = this.keyProfiles?.[idx]
      if (!profile) throw new Error("No se pudo leer la configuración de botones del mouse: tocá «Leer del mouse» y probá de nuevo.")
      const records = recordsWithRemaps(profile, m.remaps, prev.remaps)
      events.push(...encodeSaveKeyProfile(idx, records, crc))
      this.keyProfiles![idx] = records
    }
    if (!events.length) return
    await this.sendEvents(events)
    // dejar que el receptor termine de reenviar antes de la próxima operación
    if (this.viaReceiver) await this.waitFree().catch(() => sleep(50))
    this.flowPending = false
  }
}

export const rawmDriver: DeviceDriver = {
  family: "rawm",
  webhidFilters: [{ vendorId: RAWM_VENDOR_ID, usagePage: RAWM_USAGE_PAGE }],
  matches: (vid, pid, pages) => vid === RAWM_VENDOR_ID && RAWM_PIDS.includes(pid) && pages.includes(RAWM_USAGE_PAGE),
  open: async (t) => new RawmSession(t),
}
