// Controlador en vivo: conecta la interfaz con el mouse real.
//
// - Conecta (WebHID en el navegador, Rust en escritorio), elige el driver de la familia
//   (src/devices/) y lee el estado.
// - Escucha los cambios del store y le pasa al driver el estado nuevo, agrupando ráfagas
//   (sliders) y en una cola serializada: nunca dos operaciones HID a la vez.
// - Batería: en escritorio llega por eventos del núcleo Rust; en la web se consulta
//   periódicamente.
// - Guarda en localStorage lo que el mouse no devuelve (luz y remapeos del X6) y las preferencias.

import type { DeviceSession } from "../devices/driver"
import { displayName, isGenericProduct, normalizeIdentity } from "./identity"
import { loadPrefs, savePrefs } from "./persist"
import { servePanel } from "./panel"
import { listenUpdates } from "./updates"
import { hooks, LIVE, useStore } from "./store"
import { connectTauri, type AppInfo, type BatteryEvent } from "./tauri"
import { isTauri, type Transport } from "./transport"
import type { MouseState } from "./types"
import { connectWebHid } from "./webhid"

let transport: Transport | null = null
let session: DeviceSession | null = null
let applyingRemote = false
let queue: Promise<void> = Promise.resolve()
/** último estado que el mouse tiene (leído o ya enviado) */
let sentState: MouseState | null = null
let flushTimer: number | undefined
let webBatteryTimer: number | undefined
let lastFamily: string | undefined

const set = useStore.setState
const get = useStore.getState

/* ───────────── Conexión ───────────── */

async function connect(interactive: boolean, prefer?: string) {
  if (get().status === "connecting") return
  set({ status: "connecting", error: null })
  try {
    const want = prefer ?? lastFamily
    const { transport: t, driver } = isTauri() ? await connectTauri(want) : await connectWebHid(interactive, want)
    transport = t
    session = await driver.open(t)
    lastFamily = driver.family
    t.onDisconnect(() => onLost("Se desconectó el mouse."))
    set({ caps: session.caps })
    rememberIdentity()
    await readState()
    set({ connected: true, status: "ready", error: null })
    startWebBattery()
  } catch (err) {
    transport = null
    session = null
    const msg = err instanceof Error ? err.message : String(err)
    // Sin permiso previo en la web no es un error: solo hay que tocar "Conectar".
    set({ connected: false, status: interactive || isTauri() ? "error" : "idle", error: interactive || isTauri() ? msg : null })
  }
}

function onLost(reason: string) {
  transport = null
  session = null
  window.clearInterval(webBatteryTimer)
  set({ connected: false, status: "error", error: reason, tab: "home", deviceTabOpen: false })
}

/** Nombre real: lo informa el firmware (RAWM, o el X6 por cable); si no, se usa el recordado. */
function rememberIdentity() {
  if (!transport || !session) return
  const { product, manufacturer, cable, vid, pid } = transport.info
  const fromDriver = session.identity()
  if (fromDriver) {
    set({ identity: { vendor: fromDriver.vendor, product: fromDriver.product, vid, pid, source: "firmware" } })
  } else if (session.caps.family === "x6" && product && !isGenericProduct(product)) {
    const id = normalizeIdentity(manufacturer || "Motospeed", product)
    set({ identity: { ...id, vid, pid, source: cable ? "cable" : "recordado" } })
  } else {
    set((s) => ({ identity: { ...s.identity, vid, pid } }))
  }
}

/** Lee el estado del mouse y lo vuelca al store sin disparar envíos. */
async function readState() {
  if (!session) return
  const s = session
  const st = await enqueue(() => s.read())
  applyingRemote = true
  set((cur) => ({ mouse: { ...cur.mouse, ...st }, caps: s.caps }))
  applyingRemote = false
  sentState = get().mouse
  // algunos mouses (RAWM) recién dicen su modelo al leer el estado
  rememberIdentity()
}

/** Relee el mouse (botón "Leer del mouse"). */
export async function refreshFromMouse() {
  try {
    await readState()
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) })
  }
}

/** Escritorio: pasa al otro mouse conectado (si hay más de uno). */
function switchDevice() {
  const next = get().caps.family === "x6" ? "rawm" : "x6"
  set({ status: "idle" })
  void connect(false, next)
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

function scheduleFlush() {
  window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(flush, 90)
}

function flush() {
  if (!session || !sentState) return
  const s = session
  enqueue(async () => {
    const next = get().mouse
    const prev = sentState!
    if (next === prev) return
    await s.apply(next, prev)
    sentState = next
  })
    .then(() => set({ savedAt: Date.now(), error: null }))
    .catch((err) => set({ error: `No se pudo guardar en el mouse: ${err instanceof Error ? err.message : err}` }))
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

async function setupTauri(panel: boolean) {
  const { listen } = await import("@tauri-apps/api/event")
  const { invoke } = await import("@tauri-apps/api/core")
  listen<BatteryEvent>("battery", ({ payload }) => {
    if (!payload.connected) return
    applyingRemote = true
    set((s) => ({
      mouse: {
        ...s.mouse,
        battery: payload.level ?? s.mouse.battery,
        charging: payload.charging,
        connection: payload.cable ? "cable" : "dongle",
      },
    }))
    applyingRemote = false
    if (!get().connected && get().status !== "connecting") connect(false)
  })
  if (!panel) {
    listenUpdates()
    servePanel()
  }
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
  // Reintento automático mientras no haya mouse (el receptor puede enchufarse después).
  window.setInterval(() => {
    if (!get().connected && get().status !== "connecting") connect(false)
  }, 4000)
}

/* ───────────── Arranque ───────────── */

export function startLive(opts: { panel?: boolean } = {}) {
  if (!LIVE) return
  lastFamily = loadPrefs().lastFamily
  hooks.connect = (interactive) => void connect(interactive)
  hooks.switchDevice = switchDevice

  useStore.subscribe((s, prev) => {
    // 1) Enviar cambios al mouse (la batería y la conexión no se escriben)
    if (!applyingRemote && session && s.mouse !== prev.mouse) scheduleFlush()
    // 2) Guardar preferencias locales
    if (
      s.appearance !== prev.appearance ||
      s.app !== prev.app ||
      s.mouse.light !== prev.mouse.light ||
      s.mouse.remaps !== prev.mouse.remaps ||
      s.identity !== prev.identity ||
      s.caps.family !== prev.caps.family
    ) {
      const { customWallpaper: _omit, ...appearance } = s.appearance
      const { installMode: _im, ...app } = s.app
      const x6 = s.caps.family === "x6"
      savePrefs({
        appearance,
        app,
        lastFamily: s.caps.family,
        // la luz, los remapeos y el nombre del X6 no se pueden leer por el dongle: se recuerdan acá
        ...(x6
          ? {
              light: s.mouse.light as never,
              remaps: s.mouse.remaps,
              deviceName: s.identity.source === "por defecto" ? undefined : { vendor: s.identity.vendor, product: s.identity.product },
            }
          : {}),
      })
    }
  })

  if (isTauri()) {
    setupTauri(!!opts.panel)
    connect(false)
  } else {
    // Si el navegador ya tiene permiso para el mouse, reconecta sin pedir nada.
    connect(false)
  }
}
