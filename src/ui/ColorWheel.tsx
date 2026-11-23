import { useState, type PointerEvent } from "react"
import type { RGB } from "../device/types"
import { clamp, hsvToRgb, rgbToHex, rgbToHsv } from "../lib/util"
import { Slider } from "./controls"

const HUE_STOPS = Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} 100% 50%)`).join(", ")

/** Rueda de color HSV (tono = ángulo, saturación = radio) + barra de intensidad. */
export function ColorWheel({
  color,
  onChange,
  size = 168,
  disabled,
}: {
  color: RGB
  onChange: (c: RGB) => void
  size?: number
  disabled?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  // HSV local: evita perder el tono cuando la saturación o la intensidad llegan a 0.
  const [local, setLocal] = useState(() => rgbToHsv(color))
  const hex = rgbToHex(color)
  const hsv = rgbToHex(hsvToRgb(local.h, local.s, local.v)) === hex ? local : rgbToHsv(color)

  const R = size / 2
  const emit = (h: number, s: number, v: number) => {
    setLocal({ h, s, v })
    onChange(hsvToRgb(h, s, v))
  }

  const pick = (el: HTMLElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect()
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    const s = clamp(Math.hypot(dx, dy) / (rect.width / 2), 0, 1)
    emit(h, s, hsv.v === 0 ? 1 : hsv.v)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    pick(e.currentTarget, e.clientX, e.clientY)
  }

  const rad = (hsv.h * Math.PI) / 180
  const tx = R + Math.cos(rad) * hsv.s * (R - 2)
  const ty = R + Math.sin(rad) * hsv.s * (R - 2)
  const pure = rgbToHex(hsvToRgb(hsv.h, hsv.s, 1))

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        role="application"
        aria-label="Rueda de color"
        className="relative shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          touchAction: "none",
          cursor: disabled ? "default" : "crosshair",
          opacity: disabled ? 0.4 : 1,
          background: `radial-gradient(circle closest-side, #fff, rgb(255 255 255 / 0) 100%), conic-gradient(from 90deg, ${HUE_STOPS})`,
          boxShadow: "0 10px 30px -10px rgb(0 0 0 / 0.6), inset 0 0 0 1px rgb(255 255 255 / 0.12)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => dragging && pick(e.currentTarget, e.clientX, e.clientY)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 20,
            height: 20,
            left: tx - 10,
            top: ty - 10,
            background: hex,
            boxShadow: "0 0 0 3px #fff, 0 3px 10px rgb(0 0 0 / 0.45)",
            transform: dragging ? "scale(1.15)" : undefined,
            transition: "transform 160ms cubic-bezier(.3,1.5,.6,1)",
          }}
        />
      </div>
      <Slider
        ariaLabel="Intensidad del color"
        value={Math.round(hsv.v * 100)}
        min={0}
        max={100}
        disabled={disabled}
        onChange={(v) => emit(hsv.h, hsv.s, v / 100)}
        className="w-full"
        fillStyle={{ background: "transparent" }}
        trackStyle={{
          height: 10,
          marginTop: -5,
          background: `linear-gradient(90deg, #000, ${pure})`,
          boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
        }}
      />
    </div>
  )
}
