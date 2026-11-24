import { motion } from "motion/react"
import { LIVE, useStore, type DeviceEntry } from "../device/store"
import { hasWebHid, isTauri } from "../device/transport"
import { Button } from "../ui/controls"
import { BatteryReadout } from "../ui/display"
import { IconBulb, IconHand, IconPlus, IconSignal, IconSliders, IconPlug } from "../ui/icons"
import { mouseImageFor } from "../ui/mouseImage"

/**
 * Inicio: mezcla de G Hub (mouse protagonista + batería debajo) y ATK (tarjeta del
 * dispositivo con accesos rápidos y "Agregar dispositivo"). Una tarjeta por mouse conectado.
 */
export function HomePage() {
  const s = useStore()
  const desktop = s.shell === "desktop"
  // celulares, Firefox y Safari no tienen WebHID: no se puede hablar con el mouse
  const noWebHid = LIVE && !isTauri() && !hasWebHid()
  const mobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  const connected = s.devices.filter((d) => d.connected)
  // sin mouses: una tarjeta "vacía" con el último usado
  const cards: DeviceEntry[] = connected.length
    ? connected
    : [{ id: s.activeId ?? s.caps.family, caps: s.caps, identity: s.identity, mouse: s.mouse, connected: s.connected }]
  const any = cards.some((c) => c.connected)

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden pb-6">
      <div className="flex flex-wrap items-stretch justify-center gap-6">
        {cards.map((d, i) => (
          <DeviceCard key={d.id} d={d} index={i} narrow={cards.length > 1} />
        ))}
      </div>

      <motion.div
        className="mt-10 flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        {noWebHid ? (
          <div className="max-w-[460px] rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-center text-[14px] leading-relaxed text-[var(--fg-2)]">
            <div className="mb-1 font-bold text-[var(--fg)]">
              {mobile ? "En el celular no se puede conectar el mouse" : "Este navegador no puede conectar el mouse"}
            </div>
            Nexo usa WebHID, que solo existe en Chrome y Edge de computadora (Windows, Mac, Linux o ChromeOS).
            {mobile ? " Los navegadores de Android y iPhone no lo tienen." : " Firefox y Safari no lo tienen."} Abrí esta
            página en una PC o instalá Nexo para Windows.
          </div>
        ) : !any && !desktop ? (
          <Button variant="primary" size="lg" onClick={s.connect}>
            <IconPlug size={16} /> Conectar mouse
          </Button>
        ) : (
          <Button variant="primary" onClick={any ? s.addDevice : s.connect}>
            <IconPlus size={15} /> {desktop ? "Buscar mouses" : "Agregar dispositivo"}
          </Button>
        )}
        <p className="text-[14px] text-[var(--fg-2)]">
          {desktop
            ? "Conectá el receptor 2.4 GHz o el cable USB: Nexo detecta solo todos los mouses. Compatible con Motospeed X6 y mouses RAWM."
            : "Conectá el receptor 2.4 GHz o el cable USB. Requiere Chrome o Edge. Compatible con Motospeed X6 y mouses RAWM."}
        </p>
      </motion.div>
    </div>
  )
}

function DeviceCard({ d, index, narrow }: { d: DeviceEntry; index: number; narrow: boolean }) {
  const openDevice = useStore((s) => s.openDevice)
  const desktop = useStore((s) => s.shell === "desktop")
  const name = `${d.identity.vendor} ${d.identity.product}`
  const { battery, charging, connection } = d.mouse
  const wireless = d.caps.family === "x6" ? "Dongle 2.4 GHz" : "Receptor 2.4 GHz"
  const mouseUrl = mouseImageFor(d.caps.image).url

  return (
    <motion.div
      className="device-card group relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]"
      style={{ boxShadow: "var(--card-shadow)", width: narrow ? 370 : 400 }}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.05 + index * 0.07 }}
      whileHover={d.connected ? { y: -4 } : undefined}
    >
      <button
        type="button"
        disabled={!d.connected}
        onClick={() => openDevice(undefined, d.id)}
        className="relative grid h-[340px] w-full place-items-center border-0 bg-transparent"
        aria-label={`Abrir configuración del ${name}`}
      >
        <img
          src={mouseUrl}
          alt={name}
          draggable={false}
          className="h-[248px] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          style={{
            opacity: d.connected ? 1 : 0.3,
            filter: "drop-shadow(0 0 1px rgb(255 255 255 / .2)) drop-shadow(0 26px 30px rgb(0 0 0 / .55))",
          }}
        />
        {/* Batería estilo G Hub, debajo del mouse */}
        <span className="absolute bottom-5 text-[13px] text-[var(--fg-2)]">
          {!d.connected ? (
            desktop ? (
              <span className="flex items-center gap-2">
                <span className="dot live" /> Buscando el mouse…
              </span>
            ) : (
              "Sin conectar"
            )
          ) : connection === "cable" && !charging ? (
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
            {d.connected ? (connection === "dongle" ? wireless : "Cable USB") : "Desconectado"}
          </span>
          {d.connected && (
            <span className="ml-auto flex items-center gap-1">
              <button type="button" className="icon-btn" title="Iluminación" onClick={() => openDevice("lighting", d.id)}>
                <IconBulb size={17} />
              </button>
              <button type="button" className="icon-btn" title="Botones" onClick={() => openDevice("buttons", d.id)}>
                <IconHand size={17} />
              </button>
              <button type="button" className="icon-btn" title="Parámetros" onClick={() => openDevice("params", d.id)}>
                <IconSliders size={17} />
              </button>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
