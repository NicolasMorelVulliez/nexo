import { animate } from "motion/react"
import { useEffect, useRef, type CSSProperties } from "react"
import { batteryColor, cn } from "../lib/util"
import { IconBolt } from "./icons"

/** Número que "rueda" hasta el valor nuevo (solo toca textContent, sin re-render). */
export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString("es-AR"),
  className,
  style,
}: {
  value: number
  format?: (v: number) => string
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(value)
  const formatRef = useRef(format)
  formatRef.current = format

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const controls = animate(from.current, value, {
      type: "spring",
      stiffness: 140,
      damping: 24,
      onUpdate: (v) => {
        from.current = v
        el.textContent = formatRef.current(v)
      },
    })
    return () => controls.stop()
  }, [value])

  return (
    <span ref={ref} className={cn("num", className)} style={style}>
      {format(value)}
    </span>
  )
}

/** Ícono de batería (como el de ATK / G Hub). */
export function BatteryGlyph({
  level,
  charging,
  width = 20,
  color,
}: {
  level: number
  charging?: boolean
  width?: number
  color?: string
}) {
  const h = width * 0.5
  const fill = color ?? (level <= 20 && !charging ? "var(--danger)" : "currentColor")
  return (
    <span className="relative inline-flex items-center" style={{ width: width + 3, height: h }}>
      <span
        className="absolute inset-y-0 left-0 rounded-[3px]"
        style={{ width, boxShadow: "inset 0 0 0 1.4px currentColor", opacity: 0.85 }}
      />
      <span
        className="absolute rounded-[1.5px]"
        style={{
          left: 2.6,
          top: 2.6,
          bottom: 2.6,
          width: `calc((${width}px - 5.2px) * ${Math.max(0.06, level / 100)})`,
          background: fill,
        }}
      />
      <span className="absolute right-0 rounded-r-[1px]" style={{ width: 2, height: h * 0.45, background: "currentColor", opacity: 0.85 }} />
      {charging && (
        <IconBolt
          size={h + 2}
          className="absolute"
          style={{ left: width / 2 - (h + 2) / 2, color: "var(--fg)", filter: "drop-shadow(0 0 1px var(--bg))" }}
        />
      )}
    </span>
  )
}

/** "78 % 🔋" estilo G Hub. */
export function BatteryReadout({
  level,
  charging,
  className,
}: {
  level: number
  charging: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 tnum", className)}>
      {level} %
      <BatteryGlyph level={level} charging={charging} />
    </span>
  )
}

/** Barra de batería (tarjeta de rendimiento). */
export function BatteryBar({ level, charging }: { level: number; charging: boolean }) {
  return (
    <div className="h-[8px] w-full overflow-hidden rounded-full bg-[var(--track)]">
      <div
        className="h-full rounded-full"
        style={{
          width: `${level}%`,
          background: charging ? "var(--gradient)" : level <= 20 ? "var(--danger)" : "var(--primary)",
          transition: "width 800ms cubic-bezier(.2,.8,.2,1)",
        }}
      />
    </div>
  )
}

export { batteryColor }
