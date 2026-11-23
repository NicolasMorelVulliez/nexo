// Controlador en vivo: conecta la interfaz con el mouse real.
//
// - Conecta (WebHID en el navegador, Rust en escritorio) y lee el estado 0xB4.
// - Escucha los cambios del store y manda solo los comandos afectados, agrupando
//   ráfagas (sliders) y en una cola serializada: nunca dos escrituras a la vez.
// - Batería: en escritorio llega por eventos del núcleo Rust; en la web se consulta
//   periódicamente.
// - Guarda en localStorage lo que el mouse no devuelve (luz, remapeos) y las preferencias.

import { ACTION_BY_ID } from "./actions"
import { displayName, isGenericProduct, normalizeIdentity } from "./identity"
import { savePrefs } from "./persist"
import { hooks, LIVE, useStore } from "./store"
import { connectTauri, type AppInfo, type BatteryEvent } from "./tauri"
import { isTauri, type Transport } from "./transport"
import { BUTTON_KEY_ID, BUTTON_ORDER, type MouseState } from "./types"
import { connectWebHid } from "./webhid"
import {
  decodeState,
  encodeDebounce,
  encodeDpi,
  encodeLight,
  encodePolling,
  encodeRemap,
  encodeSensor,
  encodeSleep,
  encodeStateRequest,
  REPORT_STATE,
} from "../protocol/x6"

type Packet = { reportId: number; data: Uint8Array }

let transport: Transport | null = null
let applyingRemote = false
let queue: Promise<void> = Promise.resolve()
const pending = new Map<string, Packet>()
let flushTimer: number | undefined
let webBatteryTimer: number | undefined

const set = useStore.setState
const get = useStore.getState

/* ───────────── Conexión ───────────── */

async function connect(interactive: boolean) {
  if (get().status === "connecting") return
  set({ status: "connecting", error: null })
  try {
    transport = isTauri() ? await connectTauri() : await connectWebHid(interactive)
    transport.onDisconnect(() => onLost("Se desconectó el mouse."))
    rememberIdentity()
    await readState()
    set({ connected: true, status: "ready", error: null })
    startWebBattery()
  } catch (err) {
    transport = null
    const msg = err instanceof Error ? err.message : String(err)
    // Sin permiso previo en la web no es un error: solo hay que tocar "Conectar".
    set({ connected: false, status: interactive || isTauri() ? "error" : "idle", error: interactive || isTauri() ? msg : null })
  }
}

function onLost(reason: string) {
  transport = null
  window.clearInterval(webBatteryTimer)
  set({ connected: false, status: "error", error: reason, tab: "home", deviceTabOpen: false })
}

/** Nombre real: por cable el firmware dice el modelo; por el dongle es genérico y se usa el recordado. */
function rememberIdentity() {
  if (!transport) return
  const { product, manufacturer, cable, vid, pid } = transport.info
  if (product && !isGenericProduct(product)) {
    const id = normalizeIdentity(manufacturer || "Motospeed", product)
    set({ identity: { ...id, vid, pid, source: cable ? "cable" : "recordado" } })
  } else {
    set((s) => ({ identity: { ...s.identity, vid, pid } }))
  }
}

/** Lee el reporte de estado y lo vuelca al store sin disparar envíos. */
async function readState() {
  if (!transport) return
  const req = encodeStateRequest()
  const data = await enqueue(() => transport!.request(req.reportId, req.data, REPORT_STATE, 2000))
  const st = decodeState(data)
  const cable = transport.info.cable
  applyingRemote = true
  set((s) => ({
    mouse: {
      ...s.mouse,
      ...st,
      // por cable la batería no es confiable
      battery: cable ? s.mouse.battery : st.battery,
      charging: cable ? false : st.charging,
      connection: cable ? "cable" : "dongle",
    },
  }))
  applyingRemote = false
}

/** Relee el mouse (botón "Leer del mouse"). */
export async function refreshFromMouse() {
  try {
    await readState()
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) })
  }
}

/* ───────────── Envíos ───────────── */

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function schedule(key: string, pkt: Packet) {
  pending.set(key, pkt)
  window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(flush, 90)
}

function flush() {
  const batch = [...pending.values()]
  pending.clear()
  if (!transport || !batch.length) return
  enqueue(async () => {
    for (const p of batch) await transport!.send(p.reportId, p.data)
  })
    .then(() => set({ savedAt: Date.now(), error: null }))
    .catch((err) => set({ error: `No se pudo guardar en el mouse: ${err instanceof Error ? err.message : err}` }))
}

const sensorKeys: (keyof MouseState)[] = ["liftOff", "motionSync", "angleSnap", "ripple", "scrollForward", "esports"]

function diffAndSend(m: MouseState, prev: MouseState) {
  if (m.dpi !== prev.dpi || m.dpiSlot !== prev.dpiSlot || m.dpiCount !== prev.dpiCount)
    schedule("dpi", encodeDpi(m.dpi, m.dpiSlot, m.dpiCount))
  if (m.pollingIndex !== prev.pollingIndex) schedule("polling", encodePolling(m.pollingIndex))
  if (sensorKeys.some((k) => m[k] !== prev[k])) schedule("sensor", encodeSensor(m))
  if (m.debounceMs !== prev.debounceMs) schedule("debounce", encodeDebounce(m.debounceMs))
  if (m.sleepMin !== prev.sleepMin) schedule("sleep", encodeSleep(m.sleepMin))
  if (m.light !== prev.light) schedule("light", encodeLight(m.light))
  if (m.remaps !== prev.remaps)
    for (const b of BUTTON_ORDER) {
      if (m.remaps[b] === prev.remaps[b]) continue
      const a = ACTION_BY_ID[m.remaps[b]]
      if (a) schedule(`remap:${b}`, encodeRemap(BUTTON_KEY_ID[b], a.feature, a.code))
    }
}

/* ───────────── Batería ───────────── */

function startWebBattery() {
  if (isTauri()) return
  window.clearInterval(webBatteryTimer)
  webBatteryTimer = window.setInterval(() => {
    if (document.hidden) return
    refreshFromMouse()
  }, get().app.pollSeconds * 1000)
}

async function setupTauri() {
  const { listen } = await import("@tauri-apps/api/event")
  const { invoke } = await import("@tauri-apps/api/core")
  listen<BatteryEvent>("battery", ({ payload }) => {
    if (!payload.connected) return
    set((s) => ({
      mouse: {
        ...s.mouse,
        battery: payload.level ?? s.mouse.battery,
        charging: payload.charging,
        connection: payload.cable ? "cable" : "dongle",
      },
    }))
    if (!get().connected && get().status !== "connecting") connect(false)
  })
  const info = await invoke<AppInfo>("app_info")
  set((s) => ({ app: { ...s.app, installMode: info.portable ? "portable" : "installed" } }))
  const pushTray = () => {
    const s = get()
    invoke("set_tray_prefs", {
      style: s.app.trayStyle,
      pollSecs: s.app.pollSeconds,
      name: displayName(s.identity),
    }).catch(() => {})
  }
  pushTray()
  useStore.subscribe((s, prev) => {
    if (s.app.trayStyle !== prev.app.trayStyle || s.app.pollSeconds !== prev.app.pollSeconds || s.identity !== prev.identity)
      pushTray()
  })
  // Reintento automático mientras no haya mouse (el dongle puede enchufarse después).
  window.setInterval(() => {
    if (!get().connected && get().status !== "connecting") connect(false)
  }, 4000)
}

/* ───────────── Arranque ───────────── */

export function startLive() {
  if (!LIVE) return
  hooks.connect = (interactive) => void connect(interactive)

  useStore.subscribe((s, prev) => {
    // 1) Enviar cambios al mouse
    if (!applyingRemote && transport && s.mouse !== prev.mouse) diffAndSend(s.mouse, prev.mouse)
    // 2) Guardar preferencias locales
    if (
      s.appearance !== prev.appearance ||
      s.app !== prev.app ||
      s.mouse.light !== prev.mouse.light ||
      s.mouse.remaps !== prev.mouse.remaps ||
      s.identity !== prev.identity
    ) {
      const { customWallpaper: _omit, ...appearance } = s.appearance
      const { installMode: _im, ...app } = s.app
      savePrefs({
        appearance,
        app,
        light: s.mouse.light as never,
        remaps: s.mouse.remaps,
        deviceName: s.identity.source === "por defecto" ? undefined : { vendor: s.identity.vendor, product: s.identity.product },
      })
    }
  })

  if (isTauri()) {
    setupTauri()
    connect(false)
  } else {
    // Si el navegador ya tiene permiso para el mouse, reconecta sin pedir nada.
    connect(false)
  }
}
