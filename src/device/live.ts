// Controlador en vivo: conecta la interfaz con los mouses reales (varios a la vez).
//
// - Conecta todos los mouses presentes (WebHID en el navegador, Rust en escritorio), uno por familia,
//   elige el driver de cada uno (src/devices/) y lee su estado. Cada mouse tiene su tarjeta en
//   Inicio (store.devices) y el activo se muestra en las páginas (store.mouse/caps/identity).
// - Escucha los cambios del mouse activo y se los pasa a su driver, agrupando ráfagas (sliders),
//   con una cola serializada por mouse: nunca dos operaciones HID a la vez sobre el mismo.
// - Batería: en escritorio llega por eventos del núcleo Rust (uno por mouse); en la web se consulta
//   periódicamente.
// - Guarda en localStorage lo que el X6 no devuelve (luz y remapeos) y las preferencias.

import type { DeviceDriver, DeviceSession } from "../devices/driver"
import { displayName, isGenericProduct, normalizeIdentity, type DeviceIdentity } from "./identity"
import { createMockMouse } from "./mock"
import { servePanel } from "./panel"
import { loadPrefs, savePrefs } from "./persist"
import { hooks, LIVE, useStore, type DeviceEntry } from "./store"
import { connectTauriAll, type AppInfo, type BatteryEvent } from "./tauri"
import { isTauri, type Transport } from "./transport"
import type { MouseState } from "./types"
import { listenUpdates } from "./updates"
import { connectWebHidAll } from "./webhid"

interface Conn {
  id: string
  transport: Transport
  session: DeviceSession
  /** último estado que el mouse tiene (leído o ya enviado) */
  sentState: MouseState | null
  queue: Promise<void>
  flushTimer?: number
}

const conns = new Map<string, Conn>()
let applyingRemote = false
let connecting = false
let webBatteryTimer: number | undefined

const set = useStore.setState
const get = useStore.getState

/** Cambia el store sin disparar envíos al mouse. */
function remote(fn: () => void) {
  applyingRemote = true
  try {
    fn()
  } finally {
    applyingRemote = false
  }
}

/** Actualiza la entrada de un mouse (y, si es el activo, lo que muestran las páginas). */
function patchDevice(id: string, patch: Partial<DeviceEntry>) {
  remote(() =>
    set((s) => {
      const devices = s.devices.map((d) => (d.id === id ? { ...d, ...patch } : d))
      if (s.activeId !== id) return { devices }
      const d = devices.find((x) => x.id === id)!
      return { devices, mouse: d.mouse, caps: d.caps, identity: d.identity, connected: d.connected }
    }),
  )
}

/* ───────────── Conexión ───────────── */

/** Conecta todos los mouses presentes que todavía no estén conectados. */
async function connectAll(interactive: boolean) {
  if (connecting) return
  connecting = true
  if (!get().devices.some((d) => d.connected)) set({ status: "connecting", error: null })
  try {
    const found = isTauri() ? await connectTauriAll() : await connectWebHidAll(interactive, [...conns.keys()])
    // escritorio: los que ya no aparecen se desconectaron
    if (isTauri()) for (const id of [...conns.keys()]) if (!found.some((f) => f.driver.family === id)) onLost(id)
    for (const f of found) {
      if (conns.has(f.driver.family)) continue
      try {
        await addConn(f.transport, f.driver)
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    }
    const any = get().devices.some((d) => d.connected)
    set({ status: any ? "ready" : interactive || isTauri() ? "error" : "idle", ...(any ? { error: null } : {}) })
    if (any) startWebBattery()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const any = get().devices.some((d) => d.connected)
    // Sin permiso previo en la web no es un error: solo hay que tocar "Conectar".
    if (!any) set({ status: interactive || isTauri() ? "error" : "idle", error: interactive || isTauri() ? msg : null })
    else if (interactive) set({ error: msg })
  } finally {
    connecting = false
  }
}

/** Mouse base antes de leerlo: el X6 no devuelve su luz ni sus remapeos, se usan los recordados. */
function baseMouse(family: string): MouseState {
  const p = loadPrefs()
  return createMockMouse(
    family === "x6"
      ? { ...(p.light ? { light: p.light as never } : {}), ...(p.remaps ? { remaps: p.remaps as never } : {}) }
      : {},
  )
}

/** Nombre real: lo informa el firmware (RAWM, o el X6 por cable); si no, se usa el recordado. */
function identityOf(t: Transport, session: DeviceSession, prev?: DeviceIdentity): DeviceIdentity {
  const { product, manufacturer, cable, vid, pid } = t.info
  const fromDriver = session.identity()
  if (fromDriver) return { vendor: fromDriver.vendor, product: fromDriver.product, vid, pid, source: "firmware" }
  if (session.caps.family === "x6" && product && !isGenericProduct(product)) {
    const id = normalizeIdentity(manufacturer || "Motospeed", product)
    return { ...id, vid, pid, source: cable ? "cable" : "recordado" }
  }
  if (prev) return { ...prev, vid, pid }
  const saved = loadPrefs().deviceName
  return session.caps.family === "x6"
    ? { vendor: saved?.vendor ?? "Motospeed", product: saved?.product ?? "X6", vid, pid, source: saved ? "recordado" : "por defecto" }
    : { vendor: "RAWM", product: session.caps.shortName, vid, pid, source: "firmware" }
}

async function addConn(t: Transport, driver: DeviceDriver) {
  const id = driver.family
  const session = await driver.open(t)
  const conn: Conn = { id, transport: t, session, sentState: null, queue: Promise.resolve() }
  const st = await enqueue(conn, () => session.read())
  const mouse = { ...baseMouse(id), ...st }
  conn.sentState = mouse
  conns.set(id, conn)
  const entry: DeviceEntry = { id, caps: session.caps, identity: identityOf(t, session), mouse, connected: true }
  remote(() =>
    set((s) => ({ devices: [...s.devices.filter((d) => d.id !== id), entry].sort((a, b) => order(a.id) - order(b.id)) })),
  )
  t.onDisconnect(() => onLost(id))
  // el activo: el último usado si está, si no el primero que conecte
  const s = get()
  const active = s.devices.find((d) => d.id === s.activeId && d.connected)
  const preferred = loadPrefs().lastFamily
  if (!active || (id === preferred && s.activeId !== id && !s.deviceTabs.length)) selectActive(id)
  else if (s.activeId === id) patchDevice(id, entry)
}

/** Orden de las tarjetas en Inicio: el último usado primero. */
function order(id: string) {
  return id === loadPrefs().lastFamily ? 0 : 1
}

function selectActive(id: string) {
  remote(() => {
    const d = get().devices.find((x) => x.id === id)
    if (d) set({ activeId: id, mouse: d.mouse, caps: d.caps, identity: d.identity, connected: d.connected })
  })
}

function onLost(id: string) {
  const conn = conns.get(id)
  if (!conn) return
  window.clearTimeout(conn.flushTimer)
  conns.delete(id)
  remote(() =>
    set((s) => {
      const devices = s.devices.filter((d) => d.id !== id)
      const deviceTabs = s.deviceTabs.filter((t) => t !== id)
      if (s.activeId !== id) return { devices, deviceTabs }
      const next = devices.find((d) => d.connected)
      return next
        ? { devices, deviceTabs, activeId: next.id, mouse: next.mouse, caps: next.caps, identity: next.identity, connected: true }
        : { devices, deviceTabs, connected: false, status: "error", error: "Se desconectó el mouse.", tab: "home" }
    }),
  )
  if (!conns.size) window.clearInterval(webBatteryTimer)
}

/** Lee el estado de un mouse y lo vuelca al store sin disparar envíos. */
async function readState(id: string) {
  const conn = conns.get(id)
  if (!conn) return
  const st = await enqueue(conn, () => conn.session.read())
  const cur = get().devices.find((d) => d.id === id)
  if (!cur) return
  const mouse = { ...cur.mouse, ...st }
  conn.sentState = mouse
  // algunos mouses (RAWM) recién dicen su modelo al leer el estado
  patchDevice(id, { mouse, caps: conn.session.caps, identity: identityOf(conn.transport, conn.session, cur.identity) })
}

/** Relee el mouse activo (botón "Leer del mouse"). */
export async function refreshFromMouse() {
  const id = get().activeId
  if (!id) return
  try {
    await readState(id)
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) })
  }
}

/* ───────────── Envíos ───────────── */

function enqueue<T>(conn: Conn, job: () => Promise<T>): Promise<T> {
  const run = conn.queue.then(job, job)
  conn.queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function scheduleFlush(id: string) {
  const conn = conns.get(id)
  if (!conn) return
  window.clearTimeout(conn.flushTimer)
  conn.flushTimer = window.setTimeout(() => flush(conn), 90)
}

function flush(conn: Conn) {
  if (!conn.sentState) return
  enqueue(conn, async () => {
    const d = get().devices.find((x) => x.id === conn.id)
    const next = get().activeId === conn.id ? get().mouse : d?.mouse
    const prev = conn.sentState!
    if (!next || next === prev) return
    await conn.session.apply(next, prev)
    conn.sentState = next
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
    for (const id of conns.keys()) readState(id).catch(() => {})
  }, get().app.pollSeconds * 1000)
}

async function setupTauri(panel: boolean) {
  const { listen } = await import("@tauri-apps/api/event")
  const { invoke } = await import("@tauri-apps/api/core")
  listen<BatteryEvent>("battery", ({ payload }) => {
    if (!payload.connected) return
    const d = get().devices.find((x) => x.id === payload.family)
    if (!d) {
      // apareció un mouse que la UI todavía no conectó
      connectAll(false)
      return
    }
    patchDevice(d.id, {
      mouse: {
        ...d.mouse,
        battery: payload.level ?? d.mouse.battery,
        charging: payload.charging,
        connection: payload.cable ? "cable" : "dongle",
      },
    })
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
      family: s.activeId,
      names: Object.fromEntries(s.devices.map((d) => [d.id, displayName(d.identity)])),
    }).catch(() => {})
  }
  pushTray()
  useStore.subscribe((s, prev) => {
    if (
      s.app.trayStyle !== prev.app.trayStyle ||
      s.app.pollSeconds !== prev.app.pollSeconds ||
      s.activeId !== prev.activeId ||
      s.devices.length !== prev.devices.length ||
      s.identity !== prev.identity
    )
      pushTray()
  })
  // Busca mouses nuevos o desconectados (un receptor puede enchufarse después).
  window.setInterval(() => connectAll(false), 5000)
}

/* ───────────── Arranque ───────────── */

export function startLive(opts: { panel?: boolean } = {}) {
  if (!LIVE) return
  hooks.connect = (interactive) => void connectAll(interactive)
  hooks.rescan = () => void connectAll(false)

  useStore.subscribe((s, prev) => {
    // 1) Enviar los cambios del mouse activo (la batería y la conexión no se escriben)
    if (!applyingRemote && s.activeId && s.activeId === prev.activeId && s.mouse !== prev.mouse) scheduleFlush(s.activeId)
    // 2) Guardar preferencias locales
    if (
      s.appearance !== prev.appearance ||
      s.app !== prev.app ||
      s.mouse.light !== prev.mouse.light ||
      s.mouse.remaps !== prev.mouse.remaps ||
      s.identity !== prev.identity ||
      s.activeId !== prev.activeId
    ) {
      const { customWallpaper: _omit, ...appearance } = s.appearance
      const { installMode: _im, ...app } = s.app
      const x6 = s.caps.family === "x6"
      savePrefs({
        appearance,
        app,
        ...(s.activeId ? { lastFamily: s.activeId } : {}),
        // la luz, los remapeos y el nombre del X6 no se pueden leer por el dongle: se recuerdan acá
        ...(x6 && s.connected
          ? {
              light: s.mouse.light as never,
              remaps: s.mouse.remaps,
              deviceName: s.identity.source === "por defecto" ? undefined : { vendor: s.identity.vendor, product: s.identity.product },
            }
          : {}),
      })
    }
  })

  if (isTauri()) setupTauri(!!opts.panel)
  // Si ya hay permiso (web) o mouses enchufados (escritorio), conecta todos sin pedir nada.
  connectAll(false)
}
