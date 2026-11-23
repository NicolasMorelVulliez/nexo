import { useStore } from "../device/store"
import { Button, Segmented } from "../ui/controls"

/** Selector flotante para recorrer el mockup (solo con ?mockup=1). */
export function Switcher() {
  const s = useStore()
  return (
    <div
      className={
        s.shell === "desktop"
          ? "fixed bottom-[5px] left-3 z-50 flex items-center gap-2 rounded-[10px] border border-[var(--border-2)] bg-[var(--modal)] p-1 pl-3"
          : "fixed left-1/2 top-[9px] z-50 flex -translate-x-1/2 items-center gap-2 rounded-[10px] border border-[var(--border-2)] bg-[var(--modal)] p-1 pl-3"
      }
      style={{ boxShadow: "0 12px 40px rgb(0 0 0 / .5)" }}
    >
      <span className="eyebrow" style={{ color: "var(--accent)" }}>
        Mockup
      </span>
      <Segmented
        ariaLabel="Versión"
        value={s.shell}
        onChange={s.setShell}
        options={[
          { value: "web", label: "Web" },
          { value: "desktop", label: "Escritorio" },
        ]}
      />
      <Segmented
        ariaLabel="Fondo"
        value={s.appearance.wallpaper === "glass" ? "glass" : "dots"}
        onChange={(v) => s.setAppearance({ wallpaper: v, wallBlur: v === "dots" ? 3 : 0 })}
        options={[
          { value: "dots", label: "ATK" },
          { value: "glass", label: "Vidrio" },
        ]}
      />
      <Button size="sm" variant="ghost" onClick={() => (s.connected ? s.disconnect() : s.connect())}>
        {s.connected ? "Desconectar" : "Conectar"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => s.update({ charging: !s.mouse.charging })}>
        {s.mouse.charging ? "Sin cargar" : "Cargando"}
      </Button>
      {s.shell === "desktop" && (
        <Button size="sm" variant="ghost" onClick={() => s.setFlyout(!s.flyoutOpen)}>
          Flyout
        </Button>
      )}
    </div>
  )
}
