import { AnimatePresence, motion } from "motion/react"
import type { CSSProperties } from "react"
import mouseUrl from "../assets/x6-top.webp"
import type { ButtonId, LightState } from "../device/types"
import { BUTTON_LABEL, BUTTON_ORDER } from "../device/types"
import { rgbToHex } from "../lib/util"

/** Relación de aspecto de la foto recortada (422×767). */
export const MOUSE_ASPECT = 422 / 767

/** Posición de cada botón sobre la foto (% del ancho / alto) y lado de su etiqueta. */
const HOTSPOT: Record<ButtonId, { x: number; y: number; side: "l" | "r" }> = {
  left: { x: 27, y: 13, side: "l" },
  middle: { x: 50, y: 21, side: "r" },
  right: { x: 74, y: 33, side: "r" },
  side1: { x: 4.6, y: 34.5, side: "l" },
  side2: { x: 4.6, y: 51, side: "r" },
}

/** Margen lateral que necesita el escenario cuando muestra etiquetas. */
export const LABEL_SPACE = 150

export function MouseStage({
  height,
  light,
  labels,
  selected,
  onSelect,
  dim,
}: {
  height: number
  light?: LightState
  /** si se pasan, se muestran hotspots + etiquetas (pantalla Botones) */
  labels?: Record<ButtonId, string>
  selected?: ButtonId
  onSelect?: (b: ButtonId) => void
  dim?: boolean
}) {
  const imgH = Math.max(120, height)
  const imgW = imgH * MOUSE_ASPECT
  const side = labels ? LABEL_SPACE : 0
  const lit = light && light.mode !== "off" && !dim
  const color = light ? rgbToHex(light.color) : "#ffffff"
  const intensity = light ? 0.3 + 0.55 * (light.brightness / 255) : 0
  const t = light ? 1 - light.speed / 255 : 0 // 0 = rápido, 1 = lento

  const glowStyle: CSSProperties = {
    left: side + imgW * -0.42,
    top: imgH * -0.1,
    width: imgW * 1.84,
    height: imgH * 1.2,
  }

  return (
    <div className="relative shrink-0" style={{ width: imgW + side * 2, height: imgH }}>
      {/* Halo de iluminación (vista previa del efecto) */}
      <AnimatePresence>
        {lit && (
          <motion.div
            key={light.mode}
            className="pointer-events-none absolute"
            style={glowStyle}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: intensity, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={
                light.mode === "rainbow"
                  ? {
                      background:
                        "conic-gradient(#ff3b3b, #ffb13b, #f5ff3b, #3bff6a, #3be4ff, #3b5bff, #c43bff, #ff3b3b)",
                      WebkitMask: "radial-gradient(closest-side, #000 15%, transparent 100%)",
                      mask: "radial-gradient(closest-side, #000 15%, transparent 100%)",
                      opacity: 0.55,
                      animation: `spin ${2.5 + t * 7}s linear infinite`,
                    }
                  : {
                      background: `radial-gradient(closest-side, ${color}, ${color}c0 50%, ${color}40 70%, transparent)`,
                      animation:
                        light.mode === "breath"
                          ? `glow-breathe ${1.4 + t * 4.6}s ease-in-out infinite`
                          : undefined,
                    }
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mouse */}
      <div
        className="absolute top-0"
        style={{ left: side, width: imgW, height: imgH, animation: "float-y 8s ease-in-out infinite" }}
      >
        <img
          src={mouseUrl}
          alt="Mouse"
          draggable={false}
          className="h-full w-full select-none"
          style={{
            opacity: dim ? 0.35 : 1,
            filter: "drop-shadow(0 0 1px rgb(255 255 255 / 0.22)) drop-shadow(0 24px 30px rgb(0 0 0 / 0.5))",
            transition: "opacity 400ms ease",
          }}
        />

        {/* Luz de la ruedita */}
        {lit && (
          <div
            className="pointer-events-none absolute rounded-full mix-blend-screen"
            style={{
              left: "41%",
              top: "8.5%",
              width: "18%",
              height: "18%",
              background:
                light.mode === "rainbow"
                  ? "conic-gradient(#ff3b3b, #f5ff3b, #3bff6a, #3be4ff, #c43bff, #ff3b3b)"
                  : `radial-gradient(closest-side, ${color}, transparent)`,
              WebkitMask: "radial-gradient(closest-side, #000 30%, transparent)",
              mask: "radial-gradient(closest-side, #000 30%, transparent)",
              opacity: intensity,
              animation:
                light.mode === "breath"
                  ? `glow-breathe ${1.4 + t * 4.6}s ease-in-out infinite`
                  : light.mode === "rainbow"
                    ? `spin ${2.5 + t * 7}s linear infinite`
                    : undefined,
            }}
          />
        )}

        {/* Hotspots + etiquetas (estilo ATK) */}
        {labels &&
          BUTTON_ORDER.map((b) => {
            const p = HOTSPOT[b]
            const active = selected === b
            return (
              <div key={b}>
                <button
                  type="button"
                  aria-label={BUTTON_LABEL[b]}
                  aria-pressed={active}
                  className="hotspot"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  onClick={() => onSelect?.(b)}
                />
                <motion.button
                  type="button"
                  aria-pressed={active}
                  className="key-label"
                  onClick={() => onSelect?.(b)}
                  initial={{ opacity: 0, x: p.side === "l" ? 8 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: BUTTON_ORDER.indexOf(b) * 0.05 }}
                  style={{
                    top: `calc(${p.y}% - 22px)`,
                    ...(p.side === "l"
                      ? { right: `calc(${100 - p.x}% + 20px)` }
                      : { left: `calc(${p.x}% + 20px)` }),
                  }}
                >
                  <small>{BUTTON_LABEL[b]}</small>
                  <span className="whitespace-nowrap text-[14px]">{labels[b]}</span>
                </motion.button>
              </div>
            )
          })}
      </div>
    </div>
  )
}

/** Alto de mouse que entra en una caja (contemplando etiquetas laterales si las hay). */
export function fitMouse(box: { width: number; height: number }, withLabels = false, maxH = 9999) {
  const side = withLabels ? LABEL_SPACE : 0
  const byWidth = (box.width - side * 2) / MOUSE_ASPECT
  return Math.max(120, Math.min(box.height - 12, byWidth, maxH))
}
