import { useState, type ComponentType } from "react"
import { useStore } from "../device/store"
import type { LightMode, RGB } from "../device/types"
import { hexToRgb, rgbToHex } from "../lib/util"
import { ColorWheel } from "../ui/ColorWheel"
import { Card, OptionButton, Segmented, Slider, ToggleRow } from "../ui/controls"
import {
  IconBan,
  IconBulb,
  IconDot,
  IconMoonClock,
  IconPalette,
  IconPulse,
  IconRainbow,
  IconSliders,
  IconTarget,
} from "../ui/icons"
import { MouseBox } from "../ui/MouseBox"
import { fitMouse, MouseStage } from "../ui/MouseStage"

const MODES: { id: LightMode; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { id: "off", label: "Apagado", Icon: IconBan },
  { id: "static", label: "Color fijo", Icon: IconDot },
  { id: "breath", label: "Respiración", Icon: IconPulse },
  { id: "rainbow", label: "Arcoíris", Icon: IconRainbow },
  { id: "dpi", label: "Según DPI", Icon: IconTarget },
]

/** Los mouses con un bit por canal (RAWM) solo pueden mostrar estos 7 colores. */
const SWATCHES_RGB3 = ["#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"]

const SWATCHES = [
  "#ff3b30",
  "#0a84ff",
  "#ff9500",
  "#3d6bd6",
  "#ffcc00",
  "#8b5cf6",
  "#34c759",
  "#ff2d55",
  "#ffffff",
  "#ff8fab",
  "#00c7be",
  "#000000",
]

const pct = (v: number) => `${Math.round((v / 255) * 100)}%`

export function LightingPage() {
  const light = useStore((s) => s.mouse.light)
  const setLight = useStore((s) => s.setLight)
  const caps = useStore((s) => s.caps)
  const lc = caps.light
  const [format, setFormat] = useState<"hex" | "rgb">("rgb")
  const hex = rgbToHex(light.color)
  const usesColor = light.mode === "static" || light.mode === "breath"
  const usesSpeed = !!lc?.speed && (light.mode === "breath" || light.mode === "rainbow")
  const modes = MODES.filter((m) => lc?.modes.includes(m.id))
  const rgb3 = lc?.palette === "rgb3"

  if (!lc)
    return (
      <div className="flex h-full flex-col gap-5">
        <MouseBox className="flex-1" render={(box) => <MouseStage height={fitMouse(box, false, 420)} />} />
        <Card icon={IconBulb} title="Iluminación">
          <p className="card-desc">El {caps.shortName} no tiene luz configurable.</p>
        </Card>
      </div>
    )

  const setChannel = (k: keyof RGB, v: string) => {
    const n = Math.max(0, Math.min(255, Number(v.replace(/\D/g, "")) || 0))
    setLight({ color: { ...light.color, [k]: n } })
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <MouseBox className="flex-1" render={(box) => <MouseStage height={fitMouse(box, false, 420)} light={light} />} />

      <div className="grid h-[332px] shrink-0 grid-cols-[1fr_1fr_1.35fr] gap-4">
        <Card icon={IconBulb} title="Modo de efecto">
          <div className="grid grid-cols-2 gap-2">
            {modes.map(({ id, label, Icon }) => (
              <OptionButton
                key={id}
                variant="mode"
                group="light-mode"
                pressed={light.mode === id}
                onClick={() => setLight({ mode: id })}
              >
                <Icon size={15} />
                <span>{label}</span>
              </OptionButton>
            ))}
          </div>
          <p className="card-desc mt-auto pt-3">
            {lc.readable
              ? light.mode === "dpi"
                ? `El color indica el nivel de DPI activo.`
                : `Se lee del ${caps.shortName} al conectarlo.`
              : `El ${caps.shortName} no informa su luz actual: se muestra la última configuración aplicada desde esta app.`}
          </p>
        </Card>

        <Card icon={IconSliders} title="Ajustes del efecto">
          {lc.brightness && (
            <>
              <div className="flex items-center justify-between text-[13.5px]">
                <span>Brillo</span>
                <span className="tnum text-[var(--fg-2)]">{pct(light.brightness)}</span>
              </div>
              <Slider
                ariaLabel="Brillo"
                value={light.brightness}
                min={1}
                max={255}
                disabled={light.mode === "off"}
                onChange={(v) => setLight({ brightness: v })}
                className="mt-2"
              />
            </>
          )}
          {lc.speed && (
            <>
              <div
                className="mt-6 flex items-center justify-between text-[13.5px]"
                style={{ opacity: usesSpeed ? 1 : 0.4 }}
              >
                <span>Velocidad</span>
                <span className="tnum text-[var(--fg-2)]">{usesSpeed ? pct(light.speed) : "—"}</span>
              </div>
              <Slider
                ariaLabel="Velocidad"
                value={light.speed}
                min={1}
                max={255}
                disabled={!usesSpeed}
                onChange={(v) => setLight({ speed: v })}
                className="mt-2"
              />
            </>
          )}
          {lc.autoOff && (
            <div className={lc.brightness ? "mt-5" : ""}>
              <ToggleRow
                icon={IconMoonClock}
                title="Apagar en reposo"
                desc="La luz se apaga mientras el mouse está quieto para ahorrar batería."
                checked={!!light.autoOff}
                onChange={(v) => setLight({ autoOff: v })}
              />
            </div>
          )}
        </Card>

        <Card
          icon={IconPalette}
          title="Color"
          actions={
            rgb3 ? undefined : (
              <Segmented
                ariaLabel="Formato"
                value={format}
                onChange={setFormat}
                options={[
                  { value: "hex", label: "HEX" },
                  { value: "rgb", label: "RGB" },
                ]}
              />
            )
          }
        >
          {rgb3 ? (
            <div style={{ opacity: usesColor ? 1 : 0.4 }}>
              <div className="grid grid-cols-7 gap-2">
                {SWATCHES_RGB3.map((s) => {
                  const c = hexToRgb(s)!
                  const on = (k: "r" | "g" | "b") => (light.color[k] >= 128 ? 255 : 0)
                  const selected = c.r === on("r") && c.g === on("g") && c.b === on("b")
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-label={`Color ${s}`}
                      disabled={!usesColor}
                      onClick={() => setLight({ color: c })}
                      className="aspect-square rounded-[6px] border-0"
                      style={{
                        background: s,
                        boxShadow: selected
                          ? "0 0 0 2px var(--bg), 0 0 0 3.5px var(--fg)"
                          : "inset 0 0 0 1px var(--border-2)",
                      }}
                    />
                  )
                })}
              </div>
              <p className="card-desc mt-3">
                El LED del {caps.shortName} combina rojo, verde y azul encendidos o apagados: admite estos 7 colores.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 gap-4" style={{ opacity: usesColor ? 1 : 0.4 }}>
              <div className="w-[150px] shrink-0">
                <ColorWheel
                  color={light.color}
                  size={150}
                  disabled={!usesColor}
                  onChange={(c) => setLight({ color: c })}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="grid grid-cols-6 gap-2">
                  {SWATCHES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-label={`Color ${s}`}
                      disabled={!usesColor}
                      onClick={() => setLight({ color: hexToRgb(s)! })}
                      className="aspect-square rounded-[6px] border-0"
                      style={{
                        background: s,
                        boxShadow:
                          s === hex ? "0 0 0 2px var(--bg), 0 0 0 3.5px var(--fg)" : "inset 0 0 0 1px var(--border-2)",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-auto">
                  {format === "hex" ? (
                    <input
                      aria-label="Color HEX"
                      className="field w-full uppercase"
                      defaultValue={hex}
                      key={hex}
                      disabled={!usesColor}
                      onBlur={(e) => {
                        const c = hexToRgb(e.target.value)
                        if (c) setLight({ color: c })
                      }}
                    />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(["r", "g", "b"] as const).map((k) => (
                        <label key={k} className="flex items-center gap-1.5">
                          <span className="text-[12px] uppercase text-[var(--fg-3)]">{k}</span>
                          <input
                            aria-label={k.toUpperCase()}
                            className="field w-full px-1"
                            value={light.color[k]}
                            disabled={!usesColor}
                            onChange={(e) => setChannel(k, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
