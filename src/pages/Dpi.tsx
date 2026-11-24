import { motion } from "motion/react"
import { useStore } from "../device/store"
import { SPRING } from "../lib/util"
import { Button, Card, Segmented, Slider, Stepper } from "../ui/controls"
import { AnimatedNumber } from "../ui/display"
import { IconTarget } from "../ui/icons"
import { StageLayout } from "./StageLayout"

const fmt = (v: number) => Math.round(v).toLocaleString("es-AR")
const PRESETS = [400, 800, 1600, 3200, 6400, 12800]
/** Color de cada nivel (como los indicadores de DPI de los mouse gamer). */
const LEVEL_COLORS = ["#ff4d4f", "#3d6bd6", "#2fcb64", "#f5b334", "#b05cff", "#00c7be", "#ff8fab", "#ffffff"]

export function DpiPage() {
  const mouse = useStore((s) => s.mouse)
  const update = useStore((s) => s.update)
  const setDpiValue = useStore((s) => s.setDpiValue)
  const { min, max, step, slots } = useStore((s) => s.caps.dpi)
  const { dpiSlot, dpiCount } = mouse
  const dpi = mouse.dpi.slice(0, slots)
  const current = dpi[dpiSlot] ?? dpi[0]
  const marks = [0.2, 0.4, 0.6, 0.8].map((f) => Math.round((max * f) / 1000) * 1000)
  const presets = PRESETS.filter((p) => p >= min && p <= max).slice(0, 6)

  return (
    <StageLayout
      maxMouse={440}
      bottom={
        <Card
          icon={IconTarget}
          title="Niveles de DPI"
          desc="Elegí un nivel y ajustá su valor. El botón de DPI del mouse recorre los niveles activos."
          className="shrink-0"
        >
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
            {dpi.map((v, i) => {
              const active = i === dpiSlot
              const enabled = i < dpiCount
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!enabled}
                  onClick={() => update({ dpiSlot: i })}
                  className="relative flex h-[74px] flex-col items-start justify-between rounded-[10px] border-0 bg-[var(--surface-2)] px-3.5 py-2.5 text-left transition-opacity"
                  style={{ opacity: enabled ? 1 : 0.35 }}
                >
                  {active && (
                    <motion.span
                      layoutId="dpi-level"
                      className="absolute inset-0 rounded-[10px] bg-[var(--primary)]"
                      transition={SPRING}
                    />
                  )}
                  <span
                    className="relative flex w-full items-center justify-between text-[12px]"
                    style={{
                      color: active ? "var(--on-primary)" : "var(--fg-3)",
                    }}
                  >
                    Nivel {i + 1}
                    <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLORS[i] }} />
                  </span>
                  <span
                    className={`num relative leading-none ${slots > 5 ? "text-[20px]" : "text-[24px]"}`}
                    style={{
                      color: active ? "var(--on-primary)" : "var(--fg)",
                    }}
                  >
                    {fmt(v)}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Slider
              ariaLabel="DPI del nivel"
              value={current}
              min={min}
              max={max}
              step={step}
              marks={marks}
              onChange={(v) => setDpiValue(dpiSlot, v)}
              className="flex-1"
            />
            <Stepper
              ariaLabel="DPI"
              value={current}
              min={min}
              max={max}
              step={step}
              onChange={(v) => setDpiValue(dpiSlot, v)}
              format={fmt}
            />
          </div>
        </Card>
      }
      right={
        <>
          <Card>
            <h3 className="card-title">DPI actual</h3>
            <div className="mt-3 flex items-baseline gap-2">
              <AnimatedNumber value={current} format={fmt} className="text-[64px] leading-none" />
              <span className="num text-[20px] text-[var(--fg-3)]">DPI</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[var(--fg-2)]">
              <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLORS[dpiSlot] }} />
              Nivel {dpiSlot + 1} de {dpiCount}
            </div>
          </Card>

          <Card title="Niveles activos" desc="Cuántos niveles recorre el botón de DPI.">
            <Segmented
              ariaLabel="Niveles activos"
              value={dpiCount}
              onChange={(n) => update({ dpiCount: n, dpiSlot: Math.min(dpiSlot, n - 1) })}
              options={Array.from({ length: slots }, (_, i) => i + 1).map((n) => ({ value: n, label: String(n) }))}
            />
          </Card>

          <Card title="Valores rápidos" desc={`Aplicar al nivel ${dpiSlot + 1}.`}>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={p === current ? "primary" : undefined}
                  onClick={() => setDpiValue(dpiSlot, p)}
                  className="tnum"
                >
                  {fmt(p)}
                </Button>
              ))}
            </div>
          </Card>
        </>
      }
    />
  )
}
