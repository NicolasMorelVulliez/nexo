import { motion } from "motion/react"
import mouseUrl from "../assets/x6-top.webp"
import { useDeviceName, useStore } from "../device/store"
import { Button } from "../ui/controls"
import { BatteryReadout } from "../ui/display"
import { IconBulb, IconHand, IconPlus, IconSignal, IconSliders, IconPlug } from "../ui/icons"

/**
 * Inicio: mezcla de G Hub (mouse protagonista + batería debajo) y ATK (tarjeta del
 * dispositivo con accesos rápidos y "Agregar dispositivo"). El fondo es el de la app.
 */
export function HomePage() {
  const s = useStore()
  const name = useDeviceName()
  const { battery, charging, connection } = s.mouse
  const desktop = s.shell === "desktop"

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden pb-6">
      {/* Tarjeta del dispositivo (ATK) */}
      <motion.div
        className="device-card group relative w-[400px] overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]"
        style={{ boxShadow: "var(--card-shadow)" }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.05 }}
        whileHover={s.connected ? { y: -4 } : undefined}
      >
        <button
          type="button"
          disabled={!s.connected}
          onClick={() => s.openDevice()}
          className="relative grid h-[340px] w-full place-items-center border-0 bg-transparent"
          aria-label={`Abrir configuración del ${name}`}
        >
          <img
            src={mouseUrl}
            alt={name}
            draggable={false}
            className="h-[248px] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            style={{
              opacity: s.connected ? 1 : 0.3,
              filter: "drop-shadow(0 0 1px rgb(255 255 255 / .2)) drop-shadow(0 26px 30px rgb(0 0 0 / .55))",
            }}
          />
          {/* Batería estilo G Hub, debajo del mouse */}
          <span className="absolute bottom-5 text-[13px] text-[var(--fg-2)]">
            {!s.connected ? (
              desktop ? (
                <span className="flex items-center gap-2">
                  <span className="dot live" /> Buscando el mouse…
                </span>
              ) : (
                "Sin conectar"
              )
            ) : connection === "cable" ? (
              <span className="flex items-center gap-1.5">
                <IconPlug size={14} /> Conectado por cable
              </span>
            ) : (
              <BatteryReadout level={battery} charging={charging} />
            )}
          </span>
        </button>

        <div className="border-t border-[var(--border)] px-6 pb-5 pt-5">
          <div className="text-[26px] font-bold leading-tight tracking-tight">{name}</div>
          <div className="mt-3 flex items-center">
            <span className="flex items-center gap-3 text-[13.5px] text-[var(--fg-2)]">
              <IconSignal size={16} />
              <span className="h-3.5 w-px bg-[var(--border-2)]" />
              {s.connected ? (connection === "dongle" ? "Dongle 2.4 GHz" : "Cable USB") : "Desconectado"}
            </span>
            {s.connected && (
              <span className="ml-auto flex items-center gap-1">
                <button type="button" className="icon-btn" title="Iluminación" onClick={() => s.openDevice("lighting")}>
                  <IconBulb size={17} />
                </button>
                <button type="button" className="icon-btn" title="Botones" onClick={() => s.openDevice("buttons")}>
                  <IconHand size={17} />
                </button>
                <button type="button" className="icon-btn" title="Parámetros" onClick={() => s.openDevice("params")}>
                  <IconSliders size={17} />
                </button>
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        className="mt-10 flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        {!s.connected && !desktop ? (
          <Button variant="primary" size="lg" onClick={s.connect}>
            <IconPlug size={16} /> Conectar mouse
          </Button>
        ) : (
          <Button variant="primary" onClick={s.connected ? undefined : s.connect}>
            <IconPlus size={15} /> Agregar dispositivo
          </Button>
        )}
        <p className="text-[14px] text-[var(--fg-2)]">
          {desktop
            ? "Conectá el dongle 2.4 GHz o el cable USB: Nexo lo detecta solo."
            : "Conectá el dongle 2.4 GHz o el cable USB. Requiere Chrome o Edge."}
        </p>
      </motion.div>
    </div>
  )
}
