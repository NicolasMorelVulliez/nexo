// Modelo del estado del mouse, común a todas las familias (Motospeed X6, RAWM…).
// Cada driver (src/devices/) traduce entre este estado y su protocolo, y declara en
// `Capabilities` qué partes soporta: la interfaz muestra solo eso.

export type LightMode = "off" | "static" | "breath" | "rainbow" | "dpi"
export type RGB = { r: number; g: number; b: number }
export type ButtonId = "left" | "right" | "middle" | "side1" | "side2" | "dpi"
export type Connection = "dongle" | "cable"

export interface LightState {
  mode: LightMode
  color: RGB
  /** 1–255 */
  brightness: number
  /** 1–255 */
  speed: number
  /** Apagar la luz cuando el mouse está en reposo (RAWM). */
  autoOff?: boolean
}

export interface MouseState {
  /** 0–100 */
  battery: number
  charging: boolean
  connection: Connection
  /** valores de los niveles (la cantidad la define caps.dpi.slots) */
  dpi: number[]
  /** slot activo */
  dpiSlot: number
  /** cantidad de slots activos */
  dpiCount: number
  /** índice en caps.polling */
  pollingIndex: number
  liftOff: "low" | "high"
  motionSync: boolean
  angleSnap: boolean
  ripple: boolean
  /** X6: modo eSports */
  esports: boolean
  /** RAWM: índice en caps.powerModes */
  powerMode: number
  scrollForward: boolean
  /** ms */
  debounceMs: number
  /** segundos */
  sleepSec: number
  light: LightState
  /** id de acción (ver actions.ts) por botón */
  remaps: Record<ButtonId, string>
}

export interface PowerModeInfo {
  label: string
  desc: string
}

/** Qué soporta el mouse conectado. La UI se arma con esto. */
export interface Capabilities {
  /** id de familia del driver */
  family: "x6" | "rawm"
  /** nombre corto para textos ("el X6", "el ES21") */
  shortName: string
  dpi: { min: number; max: number; step: number; slots: number }
  /** Hz disponibles; pollingIndex apunta acá */
  polling: number[]
  lod: boolean
  motionSync: boolean
  angleSnap: boolean
  ripple: boolean
  scrollDirection: boolean
  /** X6: interruptor básico / eSports */
  esports: boolean
  /** RAWM: modos de energía */
  powerModes: PowerModeInfo[]
  /** opciones de debounce en ms (vacío = no soportado) */
  debounce: number[]
  /** opciones de suspensión en segundos (vacío = no soportado) */
  sleep: number[]
  light: {
    modes: LightMode[]
    /** "rgb" = cualquier color; "rgb3" = solo 7 colores (un bit por canal) */
    palette: "rgb" | "rgb3"
    speed: boolean
    brightness: boolean
    autoOff: boolean
    /** el mouse informa su luz actual */
    readable: boolean
  } | null
  remap: boolean
  /** botones remapeables, en orden */
  buttons: ButtonId[]
  /** imagen del mouse (ver ui/mouseImage.ts) */
  image: "x6" | "es21" | "generic"
  /** el mouse informa la batería al leer el estado */
  battery: boolean
}

/** Id de tecla que usa el comando de remapeo 0x52 del X6 */
export const BUTTON_KEY_ID: Partial<Record<ButtonId, number>> = {
  left: 0x00,
  right: 0x01,
  middle: 0x02,
  side1: 0x03,
  side2: 0x04,
}

export const BUTTON_LABEL: Record<ButtonId, string> = {
  left: "Clic izquierdo",
  right: "Clic derecho",
  middle: "Ruedita",
  side1: "Lateral delantero",
  side2: "Lateral trasero",
  dpi: "Botón de DPI",
}

export const BUTTON_ORDER: ButtonId[] = ["left", "right", "middle", "side1", "side2", "dpi"]
