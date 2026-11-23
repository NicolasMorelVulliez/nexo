import { create } from "zustand"
import {
  params,
  type DeviceSection,
  type SettingsSection,
  type Tab,
  type Wallpaper,
} from "../mockup/params"
import type { DeviceIdentity } from "./identity"
import { createMockMouse, DEFAULT_REMAPS } from "./mock"
import { loadPrefs, type Persisted } from "./persist"
import { isTauri } from "./transport"
import type { ButtonId, LightState, MouseState } from "./types"

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

interface StoreState {
  shell: Shell
  tab: Tab
  deviceTabOpen: boolean
  settingsTabOpen: boolean
  section: DeviceSection
  settingsSection: SettingsSection
  fontDrawer: boolean
  connected: boolean
  identity: DeviceIdentity
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
  setIdentityName: (vendor: string, product: string) => void

  setShell: (s: Shell) => void
  goHome: () => void
  openDevice: (section?: DeviceSection) => void
  closeDevice: () => void
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  setTab: (t: Tab) => void
  setSection: (s: DeviceSection) => void
  setSettingsSection: (s: SettingsSection) => void
  setFontDrawer: (open: boolean) => void
  connect: () => void
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
export const hooks: { connect: null | ((interactive: boolean) => void) } = { connect: null }

// En modo real el "Guardado en el mouse" lo marca el controlador cuando el envío termina.
const saved = () => (LIVE ? {} : { savedAt: Date.now() })

const prefs: Persisted = LIVE ? loadPrefs() : {}

/** Nombre real del dispositivo, p. ej. "Motospeed X6 Max". */
export const useDeviceName = () => useStore((s) => `${s.identity.vendor} ${s.identity.product}`)

export const useStore = create<StoreState>((set) => ({
  shell: isTauri() ? "desktop" : params.shell,
  tab: params.connected ? params.tab : "home",
  deviceTabOpen: params.connected && params.tab === "device",
  settingsTabOpen: params.tab === "settings",
  section: params.section,
  settingsSection: params.settingsSection,
  fontDrawer: params.fontDrawer,
  connected: params.connected,
  // En la app real sale de HIDDevice.productName / hidapi (ver identity.ts).
  identity: LIVE
    ? {
        vendor: prefs.deviceName?.vendor ?? "Motospeed",
        product: prefs.deviceName?.product ?? "X6",
        vid: 0x0bda,
        pid: 0xffe0,
        source: prefs.deviceName ? "recordado" : "por defecto",
      }
    : { vendor: "Motospeed", product: "X6 Max", vid: 0x0bda, pid: 0xffe0, source: "recordado" },
  mouse: createMockMouse({
    charging: params.charging,
    ...(params.battery !== undefined ? { battery: params.battery } : {}),
    ...(prefs.light ? { light: prefs.light as never } : {}),
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

  setShell: (shell) => set({ shell }),
  goHome: () => set({ tab: "home" }),
  openDevice: (section) =>
    set((s) => ({ tab: "device", deviceTabOpen: true, section: section ?? s.section })),
  closeDevice: () => set((s) => ({ deviceTabOpen: false, tab: s.tab === "device" ? "home" : s.tab })),
  openSettings: (section) =>
    set((s) => ({ tab: "settings", settingsTabOpen: true, settingsSection: section ?? s.settingsSection })),
  closeSettings: () =>
    set((s) => ({
      settingsTabOpen: false,
      fontDrawer: false,
      tab: s.tab === "settings" ? (s.deviceTabOpen ? "device" : "home") : s.tab,
    })),
  setTab: (tab) => set({ tab }),
  setSection: (section) => set({ section }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  setFontDrawer: (fontDrawer) => set({ fontDrawer }),
  connect: () => (hooks.connect ? hooks.connect(true) : set({ connected: true })),
  disconnect: () => set({ connected: false, tab: "home", deviceTabOpen: false }),
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
