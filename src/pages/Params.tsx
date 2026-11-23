import { motion } from "motion/react"
import { useStore } from "../device/store"
import { SPRING_SOFT } from "../lib/util"
import { Card, Segmented, ToggleRow } from "../ui/controls"
import { IconHand, IconInfo, IconLift, IconMoonClock, IconMove, IconScroll, IconStraight, IconWave } from "../ui/icons"

const DEBOUNCE = [0, 1, 2, 4, 8, 15, 20]
const SLEEP = [1, 2, 3, 5, 10, 20, 30, 60]

export function ParamsPage() {
  const mouse = useStore((s) => s.mouse)
  const update = useStore((s) => s.update)
  const low = mouse.liftOff === "low"

  return (
    <div className="scroll grid h-full grid-cols-[1.08fr_1fr] content-start gap-4 pr-1">
      {/* Columna izquierda */}
      <div className="flex flex-col gap-4">
        <section className="card flex flex-col gap-2.5 p-3">
          <ToggleRow
            icon={IconMove}
            title="Sincronización de movimiento"
            desc="Corrige el movimiento con un algoritmo para trayectorias más precisas, con una latencia mínima extra."
            checked={mouse.motionSync}
            onChange={(v) => update({ motionSync: v })}
          />
          <ToggleRow
            icon={IconStraight}
            title="Corrección de línea recta"
            desc="Endereza el temblor al mover el mouse en línea recta. Ideal para diseño y dibujo."
            checked={mouse.angleSnap}
            onChange={(v) => update({ angleSnap: v })}
          />
          <ToggleRow
            icon={IconWave}
            title="Corrección de ondulación"
            desc="Elimina el temblor ondulado en movimientos rápidos a DPI alto."
            checked={mouse.ripple}
            onChange={(v) => update({ ripple: v })}
          />
          <ToggleRow
            icon={IconScroll}
            title="Invertir dirección del scroll"
            desc="La ruedita desplaza en el sentido contrario."
            checked={!mouse.scrollForward}
            onChange={(v) => update({ scrollForward: !v })}
          />
        </section>

        <Card
          icon={IconHand}
          title="Retardo de rebote (debounce)"
          desc="Evita clics repetidos o falsos por rebote o temblor del botón."
        >
          <Segmented
            ariaLabel="Debounce"
            value={DEBOUNCE.includes(mouse.debounceMs) ? mouse.debounceMs : -1}
            onChange={(v) => update({ debounceMs: v })}
            options={DEBOUNCE.map((v) => ({ value: v, label: `${v}ms` }))}
          />
        </Card>
      </div>

      {/* Columna derecha */}
      <div className="flex flex-col gap-4">
        <Card
          icon={IconMoonClock}
          title="Tiempo de suspensión"
          desc="El mouse entra en reposo tras este tiempo sin uso para ahorrar batería. Se despierta al moverlo o hacer clic."
        >
          <Segmented
            ariaLabel="Tiempo de suspensión"
            value={SLEEP.includes(mouse.sleepMin) ? mouse.sleepMin : -1}
            onChange={(v) => update({ sleepMin: v })}
            options={SLEEP.map((v) => ({ value: v, label: `${v}min` }))}
          />
        </Card>

        <section className="card flex overflow-hidden">
          <div className="card-pad flex-1">
            <h3 className="card-title">
              <IconLift size={16} /> Distancia de levantamiento (LOD)
            </h3>
            <p className="card-desc">Distancia máxima entre la base del mouse y la superficie antes de que el sensor deje de leer.</p>
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
                <path d="M4 26 C4 10 22 3 38 3 C54 3 72 10 72 26 Z" fill="none" stroke="currentColor" strokeWidth="2" />
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

        <section className="card card-pad flex gap-3">
          <IconInfo size={18} className="mt-0.5 shrink-0 text-[var(--fg-2)]" />
          <p className="text-[13px] leading-relaxed text-[var(--fg-2)]">
            Todo se guarda en la memoria del X6: funciona igual en cualquier PC, sin tener la app abierta.
          </p>
        </section>
      </div>
    </div>
  )
}
