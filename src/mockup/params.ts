// Parámetros de URL del modo mockup:
//   ?mockup=1             muestra el selector flotante
//   &shell=web|desktop
//   &view=inicio|conectar|botones|dpi|rendimiento|parametros|iluminacion|
//         apariencia|fuentes|fondos|general|acerca
//   &theme=dark|light
//   &wallpaper=dots|glass|plain   (dots = ATK con puntos animados, glass = vidrio color liso)
//   &glass=RRGGBB                 color del vidrio
//   &flyout=1 &tooltip=1 &charging=1 &battery=NN
//   &device=x6|es21       mouse simulado (por defecto x6)
//   &shot=1               oculta el selector (para capturas)
//   ?panel=1              panel rápido de la bandeja (lo abre la app de escritorio en su propia ventana)

export type Tab = "home" | "device" | "settings"
export type DeviceSection = "buttons" | "dpi" | "performance" | "params" | "lighting"
export type SettingsSection = "appearance" | "wallpapers" | "general" | "about"
export type Wallpaper = "dots" | "glass" | "plain" | "custom"

const q = new URLSearchParams(window.location.search)
const view = q.get("view") ?? ""

const DEVICE_VIEWS: Record<string, DeviceSection> = {
  botones: "buttons",
  dpi: "dpi",
  rendimiento: "performance",
  parametros: "params",
  iluminacion: "lighting",
}
const SETTINGS_VIEWS: Record<string, SettingsSection> = {
  apariencia: "appearance",
  fuentes: "appearance",
  fondos: "wallpapers",
  general: "general",
  acerca: "about",
}

const tab: Tab = DEVICE_VIEWS[view] ? "device" : SETTINGS_VIEWS[view] ? "settings" : "home"
const wallpaper = q.get("wallpaper")

export const params = {
  mockup: q.get("mockup") === "1",
  shot: q.get("shot") === "1",
  shell: (q.get("shell") === "desktop" ? "desktop" : "web") as "web" | "desktop",
  tab,
  section: DEVICE_VIEWS[view] ?? ("buttons" as DeviceSection),
  settingsSection: SETTINGS_VIEWS[view] ?? ("appearance" as SettingsSection),
  fontDrawer: view === "fuentes",
  /** sin mouse: solo con view=conectar, o sin parámetros fuera del modo mockup */
  connected: view !== "conectar" && (q.get("mockup") === "1" || view !== ""),
  theme: (q.get("theme") === "light" ? "light" : "dark") as "dark" | "light",
  wallpaper: ((w) => (w === "glass" || w === "liquid" ? "glass" : w === "plain" ? "plain" : "dots"))(wallpaper) as Wallpaper,
  glassColor: /^[0-9a-f]{6}$/i.test(q.get("glass") ?? "") ? `#${q.get("glass")}` : "#050506",
  flyout: q.get("flyout") === "1",
  panel: q.get("panel") === "1",
  tooltip: q.get("tooltip") === "1",
  charging: q.get("charging") === "1",
  device: (q.get("device") === "es21" ? "es21" : "x6") as "x6" | "es21",
  battery: q.has("battery") ? Math.max(0, Math.min(100, Number(q.get("battery")))) : undefined,
}
