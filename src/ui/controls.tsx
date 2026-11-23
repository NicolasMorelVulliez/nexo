import { motion } from "motion/react"
import {
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import { clamp, cn, SPRING } from "../lib/util"
import { IconMinus, IconPlus } from "./icons"

/* ───────────── Tarjeta ───────────── */

export function Card({
  icon: Icon,
  title,
  desc,
  actions,
  children,
  className,
  style,
}: {
  icon?: ComponentType<{ size?: number }>
  title?: ReactNode
  desc?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <section className={cn("card card-pad flex min-h-0 flex-col", className)} style={style}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="card-title">
                {Icon && <Icon size={16} />}
                {title}
              </h3>
            )}
            {desc && <p className="card-desc">{desc}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/* ───────────── Botón ───────────── */

export function Button({
  variant,
  size,
  icon,
  pill,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost"
  size?: "sm" | "lg"
  icon?: boolean
  pill?: boolean
}) {
  return (
    <button
      type="button"
      className={cn("btn", variant, size, icon && "icon", pill && "pill", className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ───────────── Segmentado ───────────── */

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  gradient,
  size,
  className,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  /** opción elegida con el degradé del tema (como el polling rate de ATK) */
  gradient?: boolean
  size?: "lg"
  className?: string
  ariaLabel?: string
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("seg", gradient && "gradient", size, className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            className="seg-item"
            onClick={() => onChange(o.value)}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={SPRING} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ───────────── Opciones apiladas / grilla de modos ───────────── */

export function OptionButton({
  pressed,
  onClick,
  group,
  children,
  className,
  variant = "option",
}: {
  pressed: boolean
  onClick: () => void
  /** id compartido para que la selección se deslice entre opciones */
  group: string
  children: ReactNode
  className?: string
  variant?: "option" | "mode"
}) {
  return (
    <button type="button" aria-pressed={pressed} className={cn(variant, className)} onClick={onClick}>
      {pressed && <motion.span layoutId={group} className="option-pill" transition={SPRING} />}
      {children}
    </button>
  )
}

/* ───────────── Switch ───────────── */

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  )
}

/** Fila con ícono, título, descripción y switch (como "Parameter Settings" de ATK). */
export function ToggleRow({
  icon: Icon,
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  icon?: ComponentType<{ size?: number }>
  title: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-6 rounded-[10px] bg-[var(--surface-2)] px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="card-title text-[15.5px]">
          {Icon && <Icon size={16} />}
          {title}
        </div>
        <p className="card-desc text-[13px]">{desc}</p>
      </div>
      <Toggle label={title} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

/* ───────────── Slider ───────────── */

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  marks,
  ariaLabel,
  fillStyle,
  trackStyle,
  className,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  disabled?: boolean
  marks?: number[]
  ariaLabel: string
  fillStyle?: CSSProperties
  trackStyle?: CSSProperties
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const pct = (v: number) => (clamp(v, min, max) - min) / (max - min)
  const quantize = (v: number) => clamp(Math.round((v - min) / step) * step + min, min, max)

  const setFromX = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const next = quantize(min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min))
    if (next !== value) onChange(next)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setFromX(e.clientX)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const big = step * 10
    const map: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    }
    if (e.key in map) {
      e.preventDefault()
      onChange(quantize(map[e.key]))
    }
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled || undefined}
      className={cn("slider", dragging && "dragging", className)}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => dragging && setFromX(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKeyDown}
    >
      <div className="track" style={trackStyle}>
        <div className="fill" style={{ transform: `scaleX(${pct(value)})`, ...fillStyle }} />
      </div>
      {marks?.map((m) => (
        <span key={m} className="mark" style={{ left: `${pct(m) * 100}%` }} />
      ))}
      <div className="rail" style={{ transform: `translateX(${pct(value) * 100}%)` }}>
        <div className="thumb" />
      </div>
    </div>
  )
}

/* ───────────── Stepper ───────────── */

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  ariaLabel,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => ReactNode
  ariaLabel: string
}) {
  return (
    <div className="stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        aria-label="Disminuir"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step, min, max))}
      >
        <IconMinus size={13} />
      </button>
      <span className="value">{format ? format(value) : value}</span>
      <button
        type="button"
        aria-label="Aumentar"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step, min, max))}
      >
        <IconPlus size={13} />
      </button>
    </div>
  )
}
