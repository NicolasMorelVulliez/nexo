import { create } from "zustand"
import { rawmCaps } from "../devices/rawm"
import { DEFAULT_RAWM_MODEL } from "../devices/rawm-models"
import { X6_CAPS } from "../devices/x6"
import {
  params,
  type DeviceSection,
  type SettingsSection,
  type Tab,
  type Wallpaper,
} from "../mockup/params"
import type { DeviceIdentity } from "./identity"
import { createMockMouse, DEFAULT_REMAPS } from "./mock"
import type { UpdateInfo, UpdateState } from "./updates"
import { loadPrefs, type Persisted } from "./persist"
import { isTauri } from "./transport"
import type { ButtonId, Capabilities, LightState, MouseState } from "./types"

export type Shell = "web" | "desktop"
export type ThemeMode = "dark" | "light" | "system"
export type FontPreset = "default" | "harmony" | "system" | "custom"

export interface Appearance {
  themeMode: ThemeMode
  accent: string
  wallpaper: Wallpaper
  /** 0–100 */
  wallBlur: number
  /** 0–100 */
  wallBrightness: number
  font: FontPreset
  customFontName: string | null
  /** URL (object URL) de la imagen subida como fondo */
  customWallpaper: string | null
  /** color del fondo liso en modo vidrio */
  glassColor: string
}

export interface AppSettings {
  trayStyle: "bg" | "nobg"
  pollSeconds: number
  lowBattery: number
  autostart: boolean
  closeToTray: boolean
  reduceMotion: boolean
  installMode: "installed" | "portable"
}

/** Un mouse conectado (o simulado). El activo además se copia en mouse/caps/identity/connected. */
export interface DeviceEntry {
  /** familia: "x6" | "rawm" (un mouse por familia) */
  id: string
  caps: Capabilities
  identity: DeviceIdentity
  mouse: MouseState
  connected: boolean
}

interface StoreState {
  shell: Shell
  tab: Tab
  /** mouses conectados (cada uno con su tarjeta en Inicio) */
  devices: DeviceEntry[]
  /** mouse activo: el que muestran las páginas de configuración */
  activeId: string | null
  /** mouses con pestaña abierta arriba */
  deviceTabs: string[]
  settingsTabOpen: boolean
  section: DeviceSection
  settingsSection: SettingsSection
  fontDrawer: boolean
  connected: boolean
  identity: DeviceIdentity
  /** qué soporta el mouse activo (lo define el driver) */
  caps: Capabilities
  mouse: MouseState
  selectedButton: ButtonId
  savedAt: number
  appearance: Appearance
  app: AppSettings
  flyoutOpen: boolean
  sidebarCollapsed: boolean
  /** true = hardware real; false = mockup con mouse simulado */
  live: boolean
  status: "idle" | "connecting" | "ready" | "error"
  error: string | null
  /** versión nueva de la app de escritorio, si hay */
  appUpdate: UpdateInfo | null
  updateState: UpdateState
  setIdentityName: (vendor: string, product: string) => void

  setShell: (s: Shell) => void
  goHome: () => void
  /** Hace activo otro mouse (las páginas pasan a mostrar ese). */
  selectDevice: (id: string) => void
  /** Abre la pestaña de un mouse (por defecto el activo) y lo hace activo. */
  openDevice: (section?: DeviceSection, id?: string) => void
  /** Cierra la pestaña de un mouse (por defecto el activo). */
  closeDevice: (id?: string) => void
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  setTab: (t: Tab) => void
  setSection: (s: DeviceSection) => void
  setSettingsSection: (s: SettingsSection) => void
  setFontDrawer: (open: boolean) => void
  connect: () => void
  /** Web: abre el selector para sumar otro mouse. Escritorio: vuelve a buscar mouses conectados. */
  addDevice: () => void
  disconnect: () => void
  setFlyout: (open: boolean) => void
  toggleSidebar: () => void
  selectButton: (b: ButtonId) => void

  update: (patch: Partial<MouseState>) => void
  setDpiValue: (slot: number, value: number) => void
  setLight: (patch: Partial<LightState>) => void
  setRemap: (button: ButtonId, actionId: string) => void
  resetRemaps: () => void
  setAppearance: (patch: Partial<Appearance>) => void
  setApp: (patch: Partial<AppSettings>) => void
}

/** Modo real salvo en el mockup (?mockup=1). */
export const LIVE = !params.mockup

/** El controlador en vivo registra acá cómo conectar (evita una importación circular). */
export const hooks: { connect: null | ((interactive: boolean) => void); rescan: null | (() => void) } = {
  connect: null,
  rescan: null,
}

// En modo real el "Guardado en el mouse" lo marca el controlador cuando el envío termina.
const saved = () => (LIVE ? {} : { savedAt: Date.now() })

const prefs: Persisted = LIVE ? loadPrefs() : {}

/** Mouse simulado del mockup (?device=es21) o, en modo real, el último usado hasta que conecte. */
const mockEs21 = LIVE ? prefs.lastFamily === "rawm" : params.device === "es21"
const initialCaps: Capabilities = mockEs21 ? rawmCaps(DEFAULT_RAWM_MODEL) : X6_CAPS
const initialIdentity: DeviceIdentity = mockEs21
  ? { vendor: "RAWM", product: DEFAULT_RAWM_MODEL.name, vid: 0x1915, pid: 0x233c, source: "firmware" }
  : LIVE
    ? {
        vendor: prefs.deviceName?.vendor ?? "Motospeed",
        product: prefs.deviceName?.product ?? "X6",
        vid: 0x0bda,
        pid: 0xffe0,
        source: prefs.deviceName ? "recordado" : "por defecto",
      }
    : { vendor: "Motospeed", product: "X6 Max", vid: 0x0bda, pid: 0xffe0, source: "recordado" }
const es21Mock: Partial<MouseState> = {
  dpi: [400, 800, 1600, 3200, 6400, 12800, 1600, 1600],
  dpiSlot: 2,
  dpiCount: 6,
  pollingIndex: 3,
  powerMode: 2,
  debounceMs: 4,
  sleepSec: 60,
  scrollForward: true,
  light: { mode: "dpi", color: { r: 255, g: 255, b: 255 }, brightness: 160, speed: 128, autoOff: true },
}

/** Mouses simulados del mockup: los dos a la vez (el activo lo elige ?device=). */
const mockDevices: DeviceEntry[] = LIVE
  ? []
  : [
      {
        id: "x6",
        caps: X6_CAPS,
        identity: { vendor: "Motospeed", product: "X6 Max", vid: 0x0bda, pid: 0xffe0, source: "recordado" },
        mouse: createMockMouse({ charging: params.charging, ...(params.battery !== undefined ? { battery: params.battery } : {}) }),
        connected: params.connected,
      },
      {
        id: "rawm",
        caps: rawmCaps(DEFAULT_RAWM_MODEL),
        identity: { vendor: "RAWM", product: DEFAULT_RAWM_MODEL.name, vid: 0x1915, pid: 0x233c, source: "firmware" },
        mouse: createMockMouse({ ...es21Mock, battery: 64, charging: false }),
        connected: params.connected,
      },
    ]
const mockActive = mockDevices.find((d) => d.id === (mockEs21 ? "rawm" : "x6"))

/** Nombre real del dispositivo, p. ej. "Motospeed X6 Max". */
export const useDeviceName = () => useStore((s) => `${s.identity.vendor} ${s.identity.product}`)

export const useStore = create<StoreState>((set) => ({
  shell: isTauri() ? "desktop" : params.shell,
  tab: params.connected ? params.tab : "home",
  devices: mockDevices,
  activeId: mockActive?.id ?? null,
  deviceTabs: params.connected && params.tab === "device" && mockActive ? [mockActive.id] : [],
  settingsTabOpen: params.tab === "settings",
  section: params.section,
  settingsSection: params.settingsSection,
  fontDrawer: params.fontDrawer,
  connected: params.connected,
  // En la app real sale de HIDDevice.productName / hidapi o del firmware (ver identity.ts).
  identity: mockActive?.identity ?? initialIdentity,
  caps: mockActive?.caps ?? initialCaps,
  mouse: mockActive?.mouse ?? createMockMouse({
    ...(mockEs21 ? es21Mock : {}),
    charging: params.charging,
    ...(params.battery !== undefined ? { battery: params.battery } : {}),
    ...(prefs.light && !mockEs21 ? { light: prefs.light as never } : {}),
    ...(prefs.remaps ? { remaps: prefs.remaps as never } : {}),
  }),
  selectedButton: "side1",
  savedAt: 0,
  appearance: {
    themeMode: params.theme,
    accent: "#ff7a1a",
    wallpaper: params.wallpaper,
    wallBlur: params.wallpaper === "dots" ? 3 : 0,
    wallBrightness: 100,
    font: "default",
    customFontName: null,
    customWallpaper: null,
    glassColor: params.glassColor,
    ...(prefs.appearance as object),
  },
  app: {
    trayStyle: "bg",
    pollSeconds: 60,
    lowBattery: 15,
    autostart: true,
    closeToTray: true,
    reduceMotion: false,
    installMode: "installed",
    ...(prefs.app as object),
  },
  flyoutOpen: params.flyout,
  sidebarCollapsed: false,
  live: LIVE,
  status: "idle",
  error: null,
  appUpdate: null,
  updateState: "idle",

  setShell: (shell) => set({ shell }),
  goHome: () => set({ tab: "home" }),
  selectDevice: (id) =>
    set((s) => {
      const d = s.devices.find((x) => x.id === id)
      if (!d || s.activeId === id) return {}
      return { activeId: id, mouse: d.mouse, caps: d.caps, identity: d.identity, connected: d.connected }
    }),
  openDevice: (section, id) => {
    const target = id ?? useStore.getState().activeId
    if (target) useStore.getState().selectDevice(target)
    set((s) => ({
      tab: "device",
      deviceTabs: target && !s.deviceTabs.includes(target) ? [...s.deviceTabs, target] : s.deviceTabs,
      section: section ?? s.section,
    }))
  },
  closeDevice: (id) =>
    set((s) => {
      const target = id ?? s.activeId
      const deviceTabs = s.deviceTabs.filter((t) => t !== target)
      const closingActive = s.tab === "device" && target === s.activeId
      if (!closingActive) return { deviceTabs }
      // si queda otra pestaña de mouse, se pasa a esa
      const next = deviceTabs[deviceTabs.length - 1]
      const d = next ? s.devices.find((x) => x.id === next) : undefined
      return d
        ? { deviceTabs, activeId: d.id, mouse: d.mouse, caps: d.caps, identity: d.identity, connected: d.connected }
        : { deviceTabs, tab: "home" as Tab }
    }),
  openSettings: (section) =>
    set((s) => ({ tab: "settings", settingsTabOpen: true, settingsSection: section ?? s.settingsSection })),
  closeSettings: () =>
    set((s) => ({
      settingsTabOpen: false,
      fontDrawer: false,
      tab: s.tab === "settings" ? (s.deviceTabs.length ? "device" : "home") : s.tab,
    })),
  setTab: (tab) => set({ tab }),
  setSection: (section) => set({ section }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  setFontDrawer: (fontDrawer) => set({ fontDrawer }),
  connect: () =>
    hooks.connect
      ? hooks.connect(true)
      : set((s) => ({ connected: true, devices: s.devices.map((d) => ({ ...d, connected: true })) })),
  addDevice: () => (isTauri() ? hooks.rescan?.() : hooks.connect?.(true)),
  disconnect: () => set({ connected: false, tab: "home", deviceTabs: [] }),
  setFlyout: (flyoutOpen) => set({ flyoutOpen }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  selectButton: (selectedButton) => set({ selectedButton }),

  update: (patch) => set((s) => ({ mouse: { ...s.mouse, ...patch }, ...saved() })),
  setDpiValue: (slot, value) =>
    set((s) => {
      const dpi = s.mouse.dpi.slice()
      dpi[slot] = value
      return { mouse: { ...s.mouse, dpi }, ...saved() }
    }),
  setLight: (patch) =>
    set((s) => ({ mouse: { ...s.mouse, light: { ...s.mouse.light, ...patch } }, ...saved() })),
  setRemap: (button, actionId) =>
    set((s) => ({ mouse: { ...s.mouse, remaps: { ...s.mouse.remaps, [button]: actionId } }, ...saved() })),
  resetRemaps: () => set((s) => ({ mouse: { ...s.mouse, remaps: { ...DEFAULT_REMAPS } }, ...saved() })),
  setAppearance: (patch) => set((s) => ({ appearance: { ...s.appearance, ...patch } })),
  setApp: (patch) => set((s) => ({ app: { ...s.app, ...patch } })),
  setIdentityName: (vendor, product) =>
    set((s) => ({ identity: { ...s.identity, vendor: vendor.trim() || "Motospeed", product: product.trim() || "X6", source: "recordado" } })),
}))

// El mouse activo se edita en mouse/caps/identity/connected; se refleja en su entrada de devices.
useStore.subscribe((s, prev) => {
  if (!s.activeId || s.activeId !== prev.activeId) return
  if (s.mouse === prev.mouse && s.caps === prev.caps && s.identity === prev.identity && s.connected === prev.connected) return
  const i = s.devices.findIndex((d) => d.id === s.activeId)
  if (i < 0) return
  const devices = s.devices.slice()
  devices[i] = { ...devices[i], mouse: s.mouse, caps: s.caps, identity: s.identity, connected: s.connected }
  useStore.setState({ devices })
})
