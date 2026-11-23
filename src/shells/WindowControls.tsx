import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useStore } from "../device/store"
import { IconMaximize, IconWinClose, IconWinMinimize } from "../ui/icons"

/** Botones de ventana estilo Windows 11 para la app de escritorio real (ventana sin marco). */
export function WindowControls() {
  const closeToTray = useStore((s) => s.app.closeToTray)
  const win = getCurrentWindow()
  const buttons = [
    { label: "Minimizar", Icon: IconWinMinimize, hover: "hover:bg-[var(--surface-3)]", run: () => win.minimize() },
    { label: "Maximizar", Icon: IconMaximize, hover: "hover:bg-[var(--surface-3)]", run: () => win.toggleMaximize() },
    {
      label: closeToTray ? "Cerrar (sigue en la bandeja)" : "Salir",
      Icon: IconWinClose,
      hover: "hover:bg-[#c42b1c] hover:text-white",
      run: () => (closeToTray ? win.close() : invoke("quit_app")),
    },
  ]
  return (
    <div className="-mr-3 ml-1 flex h-[52px] self-start">
      {buttons.map(({ label, Icon, hover, run }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => void run()}
          className={`grid h-full w-[46px] place-items-center border-0 bg-transparent text-[var(--fg-2)] transition-colors ${hover}`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}
