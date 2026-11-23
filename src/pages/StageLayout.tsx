import type { ReactNode } from "react"
import { useStore } from "../device/store"
import { MouseBox } from "../ui/MouseBox"
import { fitMouse, MouseStage } from "../ui/MouseStage"

/** Estructura de ATK: mouse al centro, tarjeta abajo y columna de tarjetas a la derecha. */
export function StageLayout({
  bottom,
  right,
  rightWidth = 380,
  maxMouse = 520,
  showLight = false,
}: {
  bottom?: ReactNode
  right?: ReactNode
  rightWidth?: number
  maxMouse?: number
  showLight?: boolean
}) {
  const light = useStore((s) => s.mouse.light)
  return (
    <div className="grid h-full gap-5" style={{ gridTemplateColumns: right ? `1fr ${rightWidth}px` : "1fr" }}>
      <div className="flex min-h-0 min-w-0 flex-col gap-5">
        <MouseBox
          className="flex-1"
          render={(box) => <MouseStage height={fitMouse(box, false, maxMouse)} light={showLight ? light : undefined} />}
        />
        {bottom}
      </div>
      {right && <div className="scroll flex min-h-0 flex-col gap-4">{right}</div>}
    </div>
  )
}
