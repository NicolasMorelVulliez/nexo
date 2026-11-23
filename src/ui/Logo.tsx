import logoSvg from "../assets/logo.svg?raw"

// Logo de la app, vectorizado desde la imagen original (scripts/trace-logo.mjs).
const VIEWBOX = /viewBox="([^"]+)"/.exec(logoSvg)![1]
const PATH = /\sd="([^"]+)"/.exec(logoSvg)![1]
const [, , VW, VH] = VIEWBOX.split(" ").map(Number)

/** Marca sola. Toma el color del texto (currentColor). */
export function LogoMark({ height = 20, className }: { height?: number; className?: string }) {
  return (
    <svg
      viewBox={VIEWBOX}
      height={height}
      width={(height * VW) / VH}
      className={className}
      aria-hidden
      style={{ display: "block", flex: "none" }}
    >
      <path fill="currentColor" fillRule="evenodd" d={PATH} />
    </svg>
  )
}

/** Marca + nombre (barra superior). */
export function LogoWordmark({ height = 16 }: { height?: number }) {
  return (
    <span className="flex items-center gap-2" aria-label="Nexo">
      <LogoMark height={height} />
      <span className="text-[13px] font-bold uppercase tracking-[0.22em]">Nexo</span>
    </span>
  )
}

/** Ícono de app (cuadrado redondeado), para barra de tareas, flyout, etc. */
export function AppIcon({ size = 24 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: "#0f0f0f",
        color: "#fff",
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / .14)",
      }}
    >
      <LogoMark height={size * 0.44} />
    </span>
  )
}
