// Modelo del estado del Motospeed X6.
// Los campos siguen el reporte de configuración 0xB4 y los comandos 0xB5/0xB3
// documentados en el repo original (jchu634/X6-Utilities, MIT).

export type LightMode = "off" | "static" | "breath" | "rainbow"
export type RGB = { r: number; g: number; b: number }
export type ButtonId = "left" | "right" | "middle" | "side1" | "side2"
export type Connection = "dongle" | "cable"

export interface LightState {
  mode: LightMode
  color: RGB
  /** 1–255 */
  brightness: number
  /** 1–255 */
  speed: number
}

export interface MouseState {
  /** 0–100 */
  battery: number
  charging: boolean
  connection: Connection
  /** 5 slots, 100–26000 */
  dpi: number[]
  /** slot activo, 0–4 */
  dpiSlot: number
  /** cantidad de slots activos, 1–5 */
  dpiCount: number
  /** índice en POLLING_RATES */
  pollingIndex: number
  liftOff: "low" | "high"
  motionSync: boolean
  angleSnap: boolean
  ripple: boolean
  esports: boolean
  scrollForward: boolean
  /** 0–20 ms */
  debounceMs: number
  /** 1–60 min */
  sleepMin: number
  light: LightState
  /** id de acción (ver actions.ts) por botón */
  remaps: Record<ButtonId, string>
}

export const POLLING_RATES = [125, 500, 1000, 2000, 4000, 8000] as const
export const DPI_MIN = 100
export const DPI_MAX = 26000
export const DPI_STEP = 100

/** Id de tecla que usa el comando de remapeo 0x52 */
export const BUTTON_KEY_ID: Record<ButtonId, number> = {
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
}

export const BUTTON_ORDER: ButtonId[] = ["left", "right", "middle", "side1", "side2"]
