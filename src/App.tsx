import { MotionConfig } from "motion/react"
import { useEffect, useState } from "react"
import { useStore } from "./device/store"
import { FONT_STACKS } from "./lib/fonts"
import { params } from "./mockup/params"
import { Switcher } from "./mockup/Switcher"
import { AppRoot } from "./shells/AppRoot"
import { DesktopShell } from "./shells/DesktopShell"
import { WindowControls } from "./shells/WindowControls"
import { isTauri } from "./device/transport"

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const on = () => setDark(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return dark
}

export function App() {
  const shell = useStore((s) => s.shell)
  const a = useStore((s) => s.appearance)
  const reduceMotion = useStore((s) => s.app.reduceMotion)
  const systemDark = useSystemDark()
  const theme = a.themeMode === "system" ? (systemDark ? "dark" : "light") : a.themeMode

  // Tema, fondo, color de tema, fuente y desenfoque → variables en <html>
  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
    html.dataset.wallpaper = a.wallpaper === "custom" && !a.customWallpaper ? "dots" : a.wallpaper
    html.style.setProperty("--glass-color", a.glassColor)
    html.style.setProperty("--accent", a.accent)
    html.style.setProperty("--font-ui", FONT_STACKS[a.font])
    html.style.setProperty("--wall-blur", `${Math.round((a.wallBlur / 100) * 48)}px`)
    html.style.setProperty("--wall-brightness", String(0.25 + (a.wallBrightness / 100) * 0.75))
  }, [theme, a])

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion)
  }, [reduceMotion])

  // Pausar animaciones decorativas con la pestaña / ventana oculta
  useEffect(() => {
    const onVis = () => document.documentElement.classList.toggle("paused", document.hidden)
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      {isTauri() ? (
        <AppRoot trailing={<WindowControls />} />
      ) : shell === "web" ? (
        <AppRoot />
      ) : (
        <DesktopShell />
      )}
      {params.mockup && !params.shot && <Switcher />}
    </MotionConfig>
  )
}
