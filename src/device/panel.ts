// Panel rápido de la bandeja (ventana chica "panel", ?panel=1).
//
// Para que nunca haya dos controladores hablando con el mouse a la vez:
//  - si la ventana principal está abierta, el panel es un "espejo": recibe el estado por eventos
//    ("panel-state") y le manda los cambios ("panel-patch") para que los aplique ella;
//  - si no está abierta, el panel arranca su propio controlador (startLive) y escribe directo.

import { startLive } from "./live"
import { useStore } from "./store"
import type { MouseState } from "./types"

let mirror = false

/** Aplica un cambio desde el panel. */
export function panelUpdate(patch: Partial<MouseState>) {
  useStore.getState().update(patch)
  if (mirror) void import("@tauri-apps/api/event").then(({ emitTo }) => emitTo("main", "panel-patch", patch))
}

export async function startPanel() {
  const { invoke } = await import("@tauri-apps/api/core")
  const { listen, emitTo } = await import("@tauri-apps/api/event")
  mirror = await invoke<boolean>("main_window_open").catch(() => false)
  if (!mirror) {
    startLive({ panel: true })
    return
  }
  listen<Pick<ReturnType<typeof useStore.getState>, "mouse" | "caps" | "identity" | "connected">>("panel-state", ({ payload }) =>
    useStore.setState({ ...payload, status: payload.connected ? "ready" : "idle" }),
  )
  emitTo("main", "panel-hello", null)
}

/** Lado de la ventana principal: atiende al panel si está abierto. */
export async function servePanel() {
  const { listen, emitTo } = await import("@tauri-apps/api/event")
  const send = () => {
    const s = useStore.getState()
    emitTo("panel", "panel-state", { mouse: s.mouse, caps: s.caps, identity: s.identity, connected: s.connected }).catch(() => {})
  }
  listen("panel-hello", send)
  listen<Partial<MouseState>>("panel-patch", ({ payload }) => {
    if (useStore.getState().connected) useStore.getState().update(payload)
  })
  useStore.subscribe((s, prev) => {
    if (s.mouse !== prev.mouse || s.caps !== prev.caps || s.identity !== prev.identity || s.connected !== prev.connected) send()
  })
}
