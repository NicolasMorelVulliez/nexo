// Actualizaciones de la app de escritorio: las busca el núcleo Rust (tauri-plugin-updater contra
// GitHub Releases, latest.json firmado) al arrancar y cada 6 h; acá se muestran y se instalan.
// La web no necesita esto: GitHub Pages siempre sirve la última versión.

import { useStore } from "./store"
import { isTauri } from "./transport"

export interface UpdateInfo {
  version: string
  notes?: string | null
}

export type UpdateState = "idle" | "checking" | "uptodate" | "installing" | "error"

const set = useStore.setState

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null
  const { invoke } = await import("@tauri-apps/api/core")
  set({ updateState: "checking" })
  try {
    const info = await invoke<UpdateInfo | null>("update_check")
    set({ appUpdate: info, updateState: info ? "idle" : "uptodate" })
    return info
  } catch {
    set({ updateState: "error" })
    return null
  }
}

export async function installUpdate() {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  set({ updateState: "installing" })
  try {
    // descarga, instala (modo pasivo) y reinicia Nexo; en la portable abre la página de descargas
    await invoke("update_install")
    set({ updateState: "idle" })
  } catch (err) {
    set({ updateState: "error", error: `No se pudo actualizar: ${err instanceof Error ? err.message : err}` })
  }
}

export async function listenUpdates() {
  if (!isTauri()) return
  const { listen } = await import("@tauri-apps/api/event")
  listen<UpdateInfo>("update-available", ({ payload }) => set({ appUpdate: payload }))
  checkForUpdate()
}
