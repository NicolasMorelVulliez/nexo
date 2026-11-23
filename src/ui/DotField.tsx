import { useEffect, useRef } from "react"

/**
 * Fondo de puntos tipo semitono (halftone), animado y sutil.
 * - Los puntos nacen en una esquina y se desvanecen hacia el centro.
 * - El tamaño de cada punto sigue ondas diagonales lentas (como la referencia).
 * - Liviano: un solo path por cuadro, ~30 fps, se pausa con la ventana oculta
 *   y queda estático con "reducir animaciones".
 */
export function DotField({
  spacing = 20,
  maxRadius = 3,
  reach = 0.62,
  corner = "top-right",
  frequency = 0.0085,
}: {
  /** distancia entre puntos (px); más alto = menos puntos */
  spacing?: number
  maxRadius?: number
  /** alcance del campo, como fracción de la diagonal */
  reach?: number
  corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left"
  /** escala de las ondas; más alto = bandas más chicas (útil en miniaturas) */
  frequency?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let lastFrame = 0
    let color = "rgb(255 255 255 / 0.5)"
    let colorCheckedAt = -1e9
    const start = performance.now()

    const reduced = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("reduce-motion")

    const draw = (now: number) => {
      if (now - colorCheckedAt > 1000) {
        color = getComputedStyle(canvas).getPropertyValue("--dot-color").trim() || color
        colorCheckedAt = now
      }
      const t = (now - start) / 1000
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color

      const ox = corner.endsWith("right") ? w : 0
      const oy = corner.startsWith("bottom") ? h : 0
      const R = Math.hypot(w, h) * reach
      const half = spacing / 2

      ctx.beginPath()
      for (let row = 0, y = half; y < h + spacing; row++, y += spacing) {
        const xOff = row % 2 ? half : 0 // filas intercaladas, como un semitono
        for (let x = half + xOff; x < w + spacing; x += spacing) {
          const d = Math.hypot(x - ox, y - oy) / R
          if (d >= 1) continue
          const f = 1 - d
          const fall = f * f * (3 - 2 * f) // smoothstep
          // Bandas diagonales que se cruzan y avanzan despacio (semitono ondulado)
          const u = x * frequency
          const v = y * frequency
          const wave =
            Math.sin(u * 1.1 + v * 0.7 + t * 0.32) * Math.sin(u * 0.45 - v * 1.05 - t * 0.21) +
            0.45 * Math.sin((u + v) * 1.6 + t * 0.45)
          const k = Math.min(1, Math.max(0, 0.5 + wave * 0.48))
          const r = maxRadius * Math.pow(k, 1.7) * fall // más contraste: bandas de puntos grandes y zonas casi vacías
          if (r < 0.4) continue
          ctx.moveTo(x + r, y)
          ctx.arc(x, y, r, 0, Math.PI * 2)
        }
      }
      ctx.fill()
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      draw(performance.now())
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || reduced()) return
      if (now - lastFrame < 33) return // ~30 fps
      lastFrame = now
      draw(now)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [spacing, maxRadius, reach, corner, frequency])

  return <canvas ref={ref} className="dot-field" aria-hidden />
}
