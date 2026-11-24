// Modelos RAWM conocidos, tomados de la tabla de dispositivos que trae RAWMHUB 2.0.0.3
// (la misma que usa el configurador web oficial). El mouse informa su PID ("pi") y su nombre
// ("dn") al leer el estado, aunque esté conectado por el receptor.

export interface RawmModel {
  pid: number
  name: string
  /** CPI mínimo y máximo */
  cpi: [number, number]
  step: number
  polling: number[]
  /** cantidad de modos de energía (0, 2 o 3) */
  power: number
  /** cantidad de alturas de LOD */
  lods: number
  brightness: boolean
  sensor: string
}

export const RAWM_MODELS: RawmModel[] = [
  { pid: 0x2352, name: "ES21Pro", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2349, name: "ES21Pro(AkamiKarubi Model)", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2348, name: "SADES Dagger", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2344, name: "G11Pro", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: true, sensor: "PAW3395" },
  { pid: 0x2343, name: "G11Plus", cpi: [50,12000], step: 50, polling: [125,250,500,1000,2000], power: 2, lods: 1, brightness: true, sensor: "PAW3311" },
  { pid: 0x234a, name: "LEVIATHAN V4", cpi: [50,45000], step: 50, polling: [125,250,500,1000,2000,4000,8000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2341, name: "ES11", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: true, sensor: "PAW3395" },
  { pid: 0x2340, name: "SA-SL01C", cpi: [50,12000], step: 50, polling: [125,250,500,1000,2000], power: 2, lods: 1, brightness: true, sensor: "PAW3311" },
  { pid: 0x233f, name: "ER21", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: true, sensor: "PAW3395" },
  { pid: 0x233e, name: "SA-SH01S", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: true, sensor: "PAW3395" },
  { pid: 0x233a, name: "G11", cpi: [50,12000], step: 50, polling: [125,250,500,1000,2000], power: 2, lods: 1, brightness: true, sensor: "PAW3311" },
  { pid: 0x2333, name: "ES21", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: true, sensor: "PAW3395" },
  { pid: 0x2339, name: "ER21M", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2338, name: "ER21Pro", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2337, name: "ES21M", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2334, name: "ES21Pro", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2331, name: "SA-MH01Pro", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x2332, name: "SA-SH01Pro", cpi: [50,30000], step: 50, polling: [125,250,500,1000], power: 3, lods: 3, brightness: false, sensor: "PAW3950" },
  { pid: 0x232e, name: "SA-SH01", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: false, sensor: "PAW3395" },
  { pid: 0x232d, name: "SA-SL01", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: false, sensor: "PAW3395" },
  { pid: 0x232c, name: "SA-MH01", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: false, sensor: "PAW3395" },
  { pid: 0x2329, name: "SA-ML01", cpi: [50,26000], step: 50, polling: [125,250,500,1000], power: 3, lods: 2, brightness: false, sensor: "PAW3395" },
  { pid: 0x2328, name: "Knife", cpi: [200,6200], step: 100, polling: [125,250,500,1000], power: 0, lods: 2, brightness: false, sensor: "" },
]

/** Receptores (y cables) RAWM: el mouse real está detrás y se identifica por protocolo. */
export const RAWM_RECEIVER_PIDS = [0x2347, 0x2346, 0x234b, 0x233c, 0x233b, 0x2336, 0x2335, 0x232a, 0x232b]

export const RAWM_PIDS = [...RAWM_MODELS.map((m) => m.pid), ...RAWM_RECEIVER_PIDS]

export function findRawmModel(pid: number, name = ""): RawmModel | undefined {
  return RAWM_MODELS.find((m) => m.pid === pid) ?? RAWM_MODELS.find((m) => m.name.toLowerCase() === name.toLowerCase())
}

/** Modelo por defecto si el mouse todavía no informó quién es (el del usuario: ES21). */
export const DEFAULT_RAWM_MODEL = findRawmModel(0x2333)!
