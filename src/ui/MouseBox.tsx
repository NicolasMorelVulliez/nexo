import type { ReactNode } from "react"
import { cn, useElementSize } from "../lib/util"

/** Caja que mide su tamaño y renderiza el mouse a la medida. */
export function MouseBox({
  className,
  render,
}: {
  className?: string
  render: (box: { width: number; height: number }) => ReactNode
}) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className={cn("relative flex min-h-0 min-w-0 items-center justify-center", className)}>
      {size.height > 0 && size.width > 0 && render(size)}
    </div>
  )
}
