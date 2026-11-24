import { motion } from "motion/react"
import { useStore } from "../device/store"
import { SPRING_SOFT } from "../lib/util"
import { Card, Segmented, ToggleRow } from "../ui/controls"
import { IconHand, IconInfo, IconLift, IconMoonClock, IconMove, IconScroll, IconStraight, IconWave } from "../ui/icons"

/** 30 → "30 s", 300 → "5 min" */
const sleepLabel = (sec: number) => (sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`)

export function ParamsPage() {
  const mouse = useStore((s) => s.mouse)
  const update = useStore((s) => s.update)
  const caps = useStore((s) => s.caps)
  const low = mouse.liftOff === "low"
  const anyToggle = caps.motionSync || caps.angleSnap || caps.ripple || caps.scrollDirection

  return (
    <div className="scroll grid h-full grid-cols-[1.08fr_1fr] content-start gap-4 pr-1">
      {/* Columna izquierda */}
      <div className="flex flex-col gap-4">
        {anyToggle && (
          <section className="card flex flex-col gap-2.5 p-3">
            {caps.motionSync && (
              <ToggleRow
                icon={IconMove}
                title="Sincronización de movimiento"
                desc="Corrige el movimiento con un algoritmo para trayectorias más precisas, con una latencia mínima extra."
                checked={mouse.motionSync}
                onChange={(v) => update({ motionSync: v })}
              />
            )}
            {caps.angleSnap && (
              <ToggleRow
                icon={IconStraight}
                title="Corrección de línea recta"
                desc="Endereza el temblor al mover el mouse en línea recta. Ideal para diseño y dibujo."
                checked={mouse.angleSnap}
                onChange={(v) => update({ angleSnap: v })}
              />
            )}
            {caps.ripple && (
              <ToggleRow
                icon={IconWave}
                title="Corrección de ondulación"
                desc="Elimina el temblor ondulado en movimientos rápidos a DPI alto."
                checked={mouse.ripple}
                onChange={(v) => update({ ripple: v })}
              />
            )}
            {caps.scrollDirection && (
              <ToggleRow
                icon={IconScroll}
                title="Invertir dirección del scroll"
                desc="La ruedita desplaza en el sentido contrario."
                checked={!mouse.scrollForward}
                onChange={(v) => update({ scrollForward: !v })}
              />
            )}
          </section>
        )}

        {caps.debounce.length > 0 && (
          <Card
            icon={IconHand}
            title="Retardo de rebote (debounce)"
            desc="Evita clics repetidos o falsos por rebote o temblor del botón."
          >
            <Segmented
              ariaLabel="Debounce"
              value={caps.debounce.includes(mouse.debounceMs) ? mouse.debounceMs : -1}
              onChange={(v) => update({ debounceMs: v })}
              options={caps.debounce.map((v) => ({
                value: v,
                label: caps.debounce.length > 8 ? String(v) : `${v}ms`,
              }))}
            />
            {caps.debounce.length > 8 && (
              <p className="card-desc mt-2">Valores en milisegundos. Se aplica a todos los botones.</p>
            )}
          </Card>
        )}
      </div>

      {/* Columna derecha */}
      <div className="flex flex-col gap-4">
        {caps.sleep.length > 0 && (
          <Card
            icon={IconMoonClock}
            title="Tiempo de suspensión"
            desc="El mouse entra en reposo tras este tiempo sin uso para ahorrar batería. Se despierta al moverlo o hacer clic."
          >
            <Segmented
              ariaLabel="Tiempo de suspensión"
              value={caps.sleep.includes(mouse.sleepSec) ? mouse.sleepSec : -1}
              onChange={(v) => update({ sleepSec: v })}
              options={caps.sleep.map((v) => ({
                value: v,
                label: sleepLabel(v),
              }))}
            />
            {!caps.sleep.includes(mouse.sleepSec) && (
              <p className="card-desc mt-2">Valor actual del mouse: {sleepLabel(mouse.sleepSec)}.</p>
            )}
          </Card>
        )}

        {caps.lod && (
          <section className="card flex overflow-hidden">
            <div className="card-pad flex-1">
              <h3 className="card-title">
                <IconLift size={16} /> Distancia de levantamiento (LOD)
              </h3>
              <p className="card-desc">
                Distancia máxima entre la base del mouse y la superficie antes de que el sensor deje de leer.
              </p>
              <Segmented
                ariaLabel="Distancia de levantamiento"
                value={mouse.liftOff}
                onChange={(v) => update({ liftOff: v })}
                options={[
                  { value: "low", label: "Baja" },
                  { value: "high", label: "Alta" },
                ]}
                className="mt-4"
              />
            </div>
            {/* Ilustración: el mouse se eleva sobre la superficie punteada */}
            <div className="relative w-[200px] shrink-0 border-l border-[var(--border)] bg-[var(--surface-2)]">
              <div className="absolute inset-x-0 bottom-[38px] border-t-2 border-dotted border-[var(--fg-3)]" />
              <motion.div
                className="absolute left-1/2 -ml-[38px] w-[76px]"
                animate={{ bottom: low ? 46 : 74 }}
                transition={SPRING_SOFT}
              >
                <svg viewBox="0 0 76 30" className="w-full text-[var(--fg)]" aria-hidden>
                  <path
                    d="M4 26 C4 10 22 3 38 3 C54 3 72 10 72 26 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M38 3 V14" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 26 H56" stroke="currentColor" strokeWidth="2" />
                </svg>
                <div className="mx-auto h-[10px] w-[2px] bg-[var(--accent)]" />
              </motion.div>
              <div className="absolute bottom-3 w-full text-center text-[12px] text-[var(--fg-2)]">
                {low ? "Corte bajo" : "Corte alto"}
              </div>
            </div>
          </section>
        )}

        <section className="card card-pad flex gap-3">
          <IconInfo size={18} className="mt-0.5 shrink-0 text-[var(--fg-2)]" />
          <p className="text-[13px] leading-relaxed text-[var(--fg-2)]">
            Todo se guarda en la memoria del {caps.shortName}: funciona igual en cualquier PC, sin tener la app abierta.
          </p>
        </section>
      </div>
    </div>
  )
}
