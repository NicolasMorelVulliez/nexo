// Preferencias locales (localStorage): apariencia, ajustes de la app y lo que el X6
// no permite leer de vuelta (luz y remapeos), más el nombre real del modelo y el último mouse usado.

const KEY = "nexo:prefs:v1"

export interface Persisted {
  appearance?: Record<string, unknown>
  app?: Record<string, unknown>
  light?: Record<string, unknown>
  remaps?: Record<string, string>
  deviceName?: { vendor: string; product: string }
  /** familia del último mouse usado ("x6" | "rawm"), para elegir si hay varios conectados */
  lastFamily?: string
}

export function loadPrefs(): Persisted {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Persisted
  } catch {
    return {}
  }
}

/** Guarda mezclando con lo anterior (lo que no se pasa, se conserva). */
export function savePrefs(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadPrefs(), ...p }))
  } catch {
    /* almacenamiento lleno o bloqueado: no es crítico */
  }
}
