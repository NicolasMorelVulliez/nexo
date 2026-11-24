import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState, type ComponentType, type ReactNode } from "react"
import { refreshFromMouse } from "../device/live"
import { installUpdate } from "../device/updates"
import { useDeviceName, useStore } from "../device/store"
import type { DeviceSection } from "../mockup/params"
import { ButtonsPage } from "../pages/Buttons"
import { DpiPage } from "../pages/Dpi"
import { HomePage } from "../pages/Home"
import { LightingPage } from "../pages/Lighting"
import { ParamsPage } from "../pages/Params"
import { PerformancePage } from "../pages/Performance"
import { SettingsView } from "../pages/settings/SettingsView"
import { cn, SPRING } from "../lib/util"
import { BatteryGlyph } from "../ui/display"
import {
  IconBug,
  IconBulb,
  IconCheck,
  IconChevronRight,
  IconDownload,
  IconGauge,
  IconGear,
  IconHand,
  IconMoon,
  IconPanel,
  IconRefresh,
  IconSignal,
  IconSliders,
  IconSun,
  IconTarget,
  IconX,
} from "../ui/icons"
import { LogoWordmark } from "../ui/Logo"
import { Backdrop } from "./Backdrop"

/** Descargas: el workflow de Pages define VITE_REPO = "usuario/nexo". */
const RELEASES_URL = import.meta.env.VITE_REPO
  ? `https://github.com/${import.meta.env.VITE_REPO}/releases/latest`
  : "https://github.com"

export const SECTIONS: { id: DeviceSection; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { id: "buttons", label: "Botones", Icon: IconHand },
  { id: "dpi", label: "DPI", Icon: IconTarget },
  { id: "performance", label: "Rendimiento", Icon: IconGauge },
  { id: "params", label: "Parámetros", Icon: IconSliders },
  { id: "lighting", label: "Iluminación", Icon: IconBulb },
]

const PAGES: Record<DeviceSection, ComponentType> = {
  buttons: ButtonsPage,
  dpi: DpiPage,
  performance: PerformancePage,
  params: ParamsPage,
  lighting: LightingPage,
}

/* ───────────── Barra superior ───────────── */

function useSavedFlash() {
  const savedAt = useStore((s) => s.savedAt)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!savedAt) return
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), 1600)
    return () => window.clearTimeout(id)
  }, [savedAt])
  return visible
}

function TopBar({ trailing }: { trailing?: ReactNode }) {
  const s = useStore()
  const deviceName = useDeviceName()
  const saved = useSavedFlash()
  const dark = (s.appearance.themeMode === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : s.appearance.themeMode === "dark")

  return (
    <header className="relative z-[2] flex h-[52px] shrink-0 items-center gap-2 pl-4 pr-3" data-tauri-drag-region>
      <div className="flex h-[34px] items-center gap-1 rounded-full bg-[var(--surface-2)] pl-3.5 pr-1">
        <LogoWordmark height={15} />
        <button
          type="button"
          onClick={s.goHome}
          aria-current={s.tab === "home" ? "page" : undefined}
          className={cn(
            "ml-2 flex h-[28px] items-center gap-1.5 rounded-full border-0 px-3 text-[14px]",
            s.tab === "home" ? "bg-[var(--surface-3)] text-[var(--fg)]" : "bg-transparent text-[var(--fg-2)] hover:text-[var(--fg)]",
          )}
        >
          <IconRefresh size={13} /> Inicio
        </button>
      </div>

      {s.deviceTabOpen && (
        <Tab label={deviceName} selected={s.tab === "device"} onSelect={() => s.setTab("device")} onClose={s.closeDevice} />
      )}
      {s.settingsTabOpen && (
        <Tab label="Ajustes" selected={s.tab === "settings"} onSelect={() => s.setTab("settings")} onClose={s.closeSettings} />
      )}

      <div className="h-full flex-1" data-tauri-drag-region />

      {s.appUpdate && (
        <button
          type="button"
          onClick={() => void installUpdate()}
          disabled={s.updateState === "installing"}
          className="flex h-[30px] items-center gap-1.5 rounded-[6px] border-0 px-3 text-[13px] font-semibold"
          style={{ background: "color-mix(in srgb, var(--accent) 22%, transparent)", color: "var(--accent)" }}
          title={s.appUpdate.notes ?? undefined}
        >
          {s.updateState === "installing" ? "Actualizando Nexo…" : `Nexo ${s.appUpdate.version} disponible · Actualizar`}
        </button>
      )}

      {s.error && (
        <span
          className="flex h-[30px] max-w-[420px] items-center gap-1.5 truncate rounded-[6px] px-3 text-[13px]"
          style={{ background: "color-mix(in srgb, var(--danger) 18%, transparent)", color: "var(--danger)" }}
          title={s.error}
        >
          {s.error}
        </span>
      )}

      <AnimatePresence>
        {saved && (
          <motion.span
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING}
            className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[var(--primary)] px-3 text-[13px] text-[var(--on-primary)]"
          >
            <IconCheck size={14} /> Guardado en el mouse
          </motion.span>
        )}
      </AnimatePresence>

      {s.live && s.connected && (
        <button type="button" className="icon-btn" aria-label="Leer del mouse" title="Leer del mouse" onClick={() => void refreshFromMouse()}>
          <IconRefresh size={17} />
        </button>
      )}
      <button
        type="button"
        className="icon-btn"
        aria-label="Cambiar tema"
        title="Cambiar tema"
        onClick={() => s.setAppearance({ themeMode: dark ? "light" : "dark" })}
      >
        {dark ? <IconMoon size={18} /> : <IconSun size={18} />}
      </button>
      {s.shell === "web" && (
        <a
          className="btn outline pill sm ml-1 gap-1.5 no-underline"
          href={RELEASES_URL}
          target="_blank"
          rel="noreferrer"
        >
          Nexo para Windows <IconDownload size={13} />
        </a>
      )}
      <button
        type="button"
        className="icon-btn"
        aria-label="Ajustes"
        title="Ajustes"
        onClick={() => s.openSettings()}
      >
        <IconGear size={18} />
      </button>
      {trailing}
    </header>
  )
}

function Tab({
  label,
  selected,
  onSelect,
  onClose,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      role="tab"
      aria-selected={selected}
      tabIndex={0}
      className="tab cursor-pointer"
      onClick={onSelect}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING}
    >
      {label}
      <button
        type="button"
        className="close border-0 bg-transparent"
        aria-label={`Cerrar ${label}`}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <IconX size={12} />
      </button>
    </motion.div>
  )
}

/* ───────────── Vista del dispositivo (sidebar + sección) ───────────── */

function Sidebar() {
  const s = useStore()
  const name = useDeviceName()
  const { battery, charging, connection } = s.mouse
  return (
    <aside className="card sidebar flex w-[236px] shrink-0 flex-col p-2.5">
      <button
        type="button"
        onClick={s.goHome}
        className="flex w-full items-center rounded-[10px] border-0 bg-[var(--surface-2)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--surface-3)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--fg-2)] tnum">
            {connection === "cable" ? "Cable" : `${battery}%`}
            <BatteryGlyph level={battery} charging={charging} width={16} />
            <IconSignal size={13} />
          </div>
          <div className="mt-1 truncate text-[15px] leading-tight">{name}</div>
        </div>
        <IconChevronRight size={16} className="text-[var(--fg-3)]" />
      </button>

      <div className="px-3 pb-1.5 pt-4 text-[12.5px] text-[var(--fg-3)]">Configuración del mouse</div>
      <nav className="flex flex-col gap-1 pl-1.5">
        {SECTIONS.map(({ id, label, Icon }) => {
          const active = s.section === id
          return (
            <button
              key={id}
              type="button"
              className="nav-item"
              aria-current={active ? "page" : undefined}
              onClick={() => s.setSection(id)}
            >
              {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={SPRING} />}
              <span className="relative">
                <Icon size={18} />
              </span>
              <span className="relative">{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex items-center justify-between px-3 py-2 text-[12.5px] text-[var(--fg-3)]">
        <button type="button" className="flex items-center gap-1.5 border-0 bg-transparent hover:text-[var(--fg)]">
          <IconBug size={14} /> Reportar un problema
        </button>
        <button type="button" className="icon-btn h-7 w-7" aria-label="Contraer panel">
          <IconPanel size={16} />
        </button>
      </div>
    </aside>
  )
}

function DeviceView() {
  const section = useStore((s) => s.section)
  const Page = PAGES[section]
  return (
    <div className="flex h-full min-h-0 gap-5 px-4 pb-4 pt-1">
      <Sidebar />
      <div className="relative min-h-0 min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ───────────── Raíz ───────────── */

export function AppRoot({ trailing }: { trailing?: ReactNode }) {
  const tab = useStore((s) => s.tab)
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Backdrop />
      <TopBar trailing={trailing} />
      <main className="relative z-[1] min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "home" && <HomePage />}
            {tab === "device" && <DeviceView />}
            {tab === "settings" && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
