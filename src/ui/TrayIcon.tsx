import { useEffect, useRef, useState } from "react"
import { drawTrayIcon, type TrayIconState } from "./trayIconDraw"

/**
 * Renderiza el ícono de bandeja en un <canvas>.
 * `size` es el tamaño en píxeles de grilla real (16 o 32); `display` es el
 * tamaño CSS con el que se muestra (por defecto igual a size).
 */
export function TrayIcon({
  state,
  size = 16,
  display,
  className,
}: {
  state: Omit<TrayIconState, "frame">
  size?: 16 | 24 | 32 | 48 | 64
  display?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!state.charging) return
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 4), 450)
    return () => window.clearInterval(id)
  }, [state.charging])

  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (ctx) drawTrayIcon(ctx, size, { ...state, frame })
  }, [state, size, frame])

  const css = display ?? size
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      style={{ width: css, height: css, imageRendering: "pixelated" }}
    />
  )
}
