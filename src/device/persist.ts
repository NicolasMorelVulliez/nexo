// Preferencias locales (localStorage): apariencia, ajustes de la app y lo que el X6
// no permite leer de vuelta (luz y remapeos), más el nombre real del modelo.

const KEY = "nexo:prefs:v1"

export interface Persisted {
  appearance?: Record<string, unknown>
  app?: Record<string, unknown>
  light?: Record<string, unknown>
  remaps?: Record<string, string>
  deviceName?: { vendor: string; product: string }
}

export function loadPrefs(): Persisted {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Persisted
  } catch {
    return {}
  }
}

export function savePrefs(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* almacenamiento lleno o bloqueado: no es crítico */
  }
}
