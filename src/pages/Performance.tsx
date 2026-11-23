import { AnimatePresence, motion } from "motion/react"
import { useStore } from "../device/store"
import { POLLING_RATES } from "../device/types"
import { Card, OptionButton, Segmented } from "../ui/controls"
import { AnimatedNumber, BatteryBar } from "../ui/display"
import { IconBattery, IconGauge, IconSignal } from "../ui/icons"
import { LogoMark } from "../ui/Logo"
import { StageLayout } from "./StageLayout"

const hzLabel = (r: number) => (r >= 1000 ? `${r / 1000}K` : String(r))

export function PerformancePage() {
  const mouse = useStore((s) => s.mouse)
  const update = useStore((s) => s.update)
  const cable = mouse.connection === "cable"

  return (
    <StageLayout
      bottom={
        <Card icon={IconSignal} title="Polling rate" className="shrink-0">
          <Segmented
            ariaLabel="Polling rate"
            gradient
            size="lg"
            value={mouse.pollingIndex}
            onChange={(i) => update({ pollingIndex: i })}
            options={POLLING_RATES.map((r, i) => ({ value: i, label: hzLabel(r) }))}
          />
          <div className="mt-2.5 flex justify-between text-[12.5px] text-[var(--fg-3)]">
            <span>Uso diario</span>
            <span className="tnum">
              {(1000 / POLLING_RATES[mouse.pollingIndex]).toLocaleString("es-AR", { maximumFractionDigits: 3 })} ms
              de intervalo
            </span>
            <span>Competitivo</span>
          </div>
        </Card>
      }
      right={
        <>
          <Card className="overflow-hidden">
            <LogoMark
              height={84}
              className="pointer-events-none absolute -right-3 -top-3 text-[var(--fg)] opacity-[0.08]"
            />
            <h3 className="card-title">
              <IconBattery size={16} /> Batería
            </h3>
            <div className="mt-4 flex items-baseline gap-1">
              {cable ? (
                <span className="num text-[44px] leading-none">Cable</span>
              ) : (
                <>
                  <AnimatedNumber value={mouse.battery} className="text-[56px] leading-none" />
                  <span className="num text-[28px] text-[var(--fg-2)]">%</span>
                </>
              )}
            </div>
            <div className="mt-2 flex gap-4 text-[13px] text-[var(--fg-2)]">
              <span>{mouse.charging ? "Cargando" : "En uso"}</span>
              <span>{cable ? "Cable USB" : "Dongle 2.4 GHz"}</span>
            </div>
            <p className="card-desc">
              Más polling rate y el modo eSports consumen más batería. El nivel se consulta
              periódicamente desde el dongle.
            </p>
            <div className="mt-4">
              <BatteryBar level={cable ? 100 : mouse.battery} charging={mouse.charging} />
            </div>
          </Card>

          <Card icon={IconGauge} title="Modo de rendimiento">
            <div className="flex flex-col gap-2.5">
              <OptionButton group="perf-mode" pressed={!mouse.esports} onClick={() => update({ esports: false })}>
                <span>Modo básico</span>
              </OptionButton>
              <OptionButton group="perf-mode" pressed={mouse.esports} onClick={() => update({ esports: true })}>
                <span>Modo eSports</span>
              </OptionButton>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={String(mouse.esports)}
                className="card-desc mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {mouse.esports
                  ? "El sensor trabaja a máxima respuesta y menor latencia. Ideal para jugar; reduce la autonomía."
                  : "El sensor trabaja en un estado de bajo consumo: mayor autonomía, ideal para el uso diario."}
              </motion.p>
            </AnimatePresence>
          </Card>
        </>
      }
    />
  )
}
