import { AnimatePresence, motion } from "motion/react"
import { useState, type ReactNode } from "react"
import { useDeviceName, useStore } from "../device/store"
import { params } from "../mockup/params"
import { SPRING } from "../lib/util"
import { Button, Segmented } from "../ui/controls"
import { BatteryBar, BatteryGlyph } from "../ui/display"
import {
  IconChevronUp,
  IconMaximize,
  IconPower,
  IconSearch,
  IconVolume,
  IconWifi,
  IconWinClose,
  IconWinMinimize,
} from "../ui/icons"
import { AppIcon } from "../ui/Logo"
import { TrayIcon } from "../ui/TrayIcon"
import { trayTooltip } from "../ui/trayIconDraw"
import { AppRoot } from "./AppRoot"

/**
 * Mockup de la app de escritorio: ventana sin marco (la barra superior hace de
 * barra de título), barra de tareas de Windows 11 con el ícono de batería en la
 * bandeja y su flyout.
 */
export function DesktopShell() {
  return (
    <div className="relative h-full overflow-hidden" style={{ background: "var(--wallpaper-desktop)" }}>
      <div
        className="absolute left-1/2 top-[22px] flex -translate-x-1/2 flex-col overflow-hidden"
        style={{
          width: "min(1420px, calc(100vw - 56px))",
          height: "min(890px, calc(100vh - 48px - 40px))",
          borderRadius: 10,
          background: "var(--bg)",
          boxShadow: "0 0 0 1px rgb(255 255 255 / .1), 0 30px 80px -10px rgb(0 0 0 / .7), 0 8px 24px rgb(0 0 0 / .3)",
        }}
      >
        <AppRoot trailing={<CaptionButtons />} />
      </div>
      <Taskbar />
      <TrayFlyout />
    </div>
  )
}

function CaptionButtons() {
  return (
    <div className="-mr-3 ml-1 flex h-[52px] self-start">
      {[
        { label: "Minimizar", Icon: IconWinMinimize, hover: "hover:bg-[var(--surface-3)]" },
        { label: "Maximizar", Icon: IconMaximize, hover: "hover:bg-[var(--surface-3)]" },
        { label: "Cerrar a la bandeja", Icon: IconWinClose, hover: "hover:bg-[#c42b1c] hover:text-white" },
      ].map(({ label, Icon, hover }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          className={`grid h-full w-[46px] place-items-center border-0 bg-transparent text-[var(--fg-2)] transition-colors ${hover}`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}

/* ───────────── Barra de tareas ───────────── */

function Taskbar() {
  const mouse = useStore((s) => s.mouse)
  const connected = useStore((s) => s.connected)
  const app = useStore((s) => s.app)
  const themeMode = useStore((s) => s.appearance.themeMode)
  const flyoutOpen = useStore((s) => s.flyoutOpen)
  const setFlyout = useStore((s) => s.setFlyout)
  const [hover, setHover] = useState(params.tooltip)
  const cable = mouse.connection === "cable"
  const level = connected ? mouse.battery : null
  const ink = themeMode === "light" ? "#1b1b1f" : "#ffffff"
  const now = new Date()

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex h-[48px] items-center px-3"
      style={{
        background: "var(--taskbar-bg)",
        backdropFilter: "blur(40px) saturate(160%)",
        WebkitBackdropFilter: "blur(40px) saturate(160%)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / .07)",
      }}
    >
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
        <TaskbarBtn label="Inicio">
          <span className="grid grid-cols-2 gap-[2px]">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-[9px] w-[9px] rounded-[1.5px] bg-[#4cc2ff]" />
            ))}
          </span>
        </TaskbarBtn>
        <TaskbarBtn label="Buscar">
          <IconSearch size={18} />
        </TaskbarBtn>
        <TaskbarBtn label="Explorador">
          <span className="h-[16px] w-[20px] rounded-[3px]" style={{ background: "linear-gradient(180deg,#ffd55c,#e8a317)" }} />
        </TaskbarBtn>
        <TaskbarBtn label="Navegador">
          <span className="h-[20px] w-[20px] rounded-full" style={{ background: "conic-gradient(from 200deg,#0fb5ff,#29d07b,#0f7bff,#0fb5ff)" }} />
        </TaskbarBtn>
        <TaskbarBtn label="Nexo" active>
          <AppIcon size={24} />
        </TaskbarBtn>
      </div>

      <div className="ml-auto flex h-full items-center gap-0.5">
        <TaskbarBtn label="Mostrar íconos ocultos" small>
          <IconChevronUp size={15} />
        </TaskbarBtn>
        <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(params.tooltip)}>
          <TaskbarBtn label="Batería del mouse (bandeja)" small active={flyoutOpen} onClick={() => setFlyout(!flyoutOpen)}>
            <TrayIcon size={16} state={{ level, charging: mouse.charging, cable, style: app.trayStyle, ink }} />
          </TaskbarBtn>
          <AnimatePresence>
            {hover && !flyoutOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-[46px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[var(--modal)] px-2.5 py-1.5 text-[12px]"
                style={{ boxShadow: "0 0 0 1px var(--border), 0 8px 20px rgb(0 0 0 / .35)" }}
              >
                {trayTooltip(level, mouse.charging, cable)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <TaskbarBtn label="Red y sonido" small wide>
          <span className="flex items-center gap-2">
            <IconWifi size={15} />
            <IconVolume size={15} />
          </span>
        </TaskbarBtn>
        <div className="ml-1 flex flex-col items-end px-2 text-[11.5px] leading-[1.25]">
          <span>{now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
          <span>{now.toLocaleDateString("es-AR")}</span>
        </div>
      </div>
    </div>
  )
}

function TaskbarBtn({
  label,
  children,
  active,
  small,
  wide,
  onClick,
}: {
  label: string
  children: ReactNode
  active?: boolean
  small?: boolean
  wide?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative grid place-items-center rounded-[5px] border-0 transition-colors hover:bg-[var(--surface-3)]"
      style={{
        height: small ? 36 : 40,
        width: wide ? 60 : small ? 32 : 40,
        background: active ? "var(--surface-3)" : "transparent",
      }}
    >
      {children}
      {active && !small && <span className="absolute bottom-[2px] h-[3px] w-[16px] rounded-full bg-[#4cc2ff]" />}
    </button>
  )
}

/* ───────────── Flyout de bandeja ───────────── */

function TrayFlyout() {
  const name = useDeviceName()
  const open = useStore((s) => s.flyoutOpen)
  const setFlyout = useStore((s) => s.setFlyout)
  const mouse = useStore((s) => s.mouse)
  const connected = useStore((s) => s.connected)
  const update = useStore((s) => s.update)
  const lowBattery = useStore((s) => s.app.lowBattery)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={SPRING}
          className="absolute bottom-[58px] right-[110px] z-30 w-[340px] rounded-[14px] border border-[var(--border)] bg-[var(--modal)] p-4"
          style={{ boxShadow: "0 20px 60px rgb(0 0 0 / .55)" }}
        >
          <div className="flex items-center gap-3">
            <AppIcon size={30} />
            <div className="leading-tight">
              <div className="text-[14.5px]">{name}</div>
              <div className="text-[12px] text-[var(--fg-3)]">
                {connected ? (mouse.connection === "dongle" ? "Dongle 2.4 GHz" : "Cable USB") : "Sin dispositivo"}
              </div>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
              <span className="dot live" /> En línea
            </span>
          </div>

          <div className="mt-4 rounded-[10px] bg-[var(--surface-2)] px-4 py-3.5">
            <div className="flex items-end justify-between">
              <span className="num text-[40px] leading-none">
                {mouse.battery}
                <span className="text-[22px] text-[var(--fg-2)]">%</span>
              </span>
              <span className="mb-1 flex items-center gap-2 text-[12.5px] text-[var(--fg-2)]">
                {mouse.charging ? "Cargando" : "En uso"}
                <BatteryGlyph level={mouse.battery} charging={mouse.charging} />
              </span>
            </div>
            <div className="mt-3">
              <BatteryBar level={mouse.battery} charging={mouse.charging} />
            </div>
            <div className="mt-2 text-[11.5px] text-[var(--fg-3)]">Último chequeo hace 12 s · aviso al {lowBattery}%</div>
          </div>

          <div className="mb-2 mt-4 text-[12.5px] text-[var(--fg-3)]">Cambio rápido de DPI</div>
          <Segmented
            ariaLabel="DPI rápido"
            value={mouse.dpiSlot}
            onChange={(i) => update({ dpiSlot: i })}
            options={mouse.dpi.slice(0, mouse.dpiCount).map((v, i) => ({
              value: i,
              label: v >= 1000 ? `${(v / 1000).toLocaleString("es-AR")}k` : String(v),
            }))}
          />

          <div className="mt-4 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => setFlyout(false)}>
              Abrir Nexo
            </Button>
            <Button aria-label="Salir" title="Salir">
              <IconPower size={15} /> Salir
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
