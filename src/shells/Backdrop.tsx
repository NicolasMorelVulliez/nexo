import type { ReactNode } from "react"
import { useStore } from "../device/store"
import type { Wallpaper } from "../mockup/params"
import { DotField } from "../ui/DotField"

/** Fondos disponibles (Ajustes → Fondos). */
export const WALLPAPERS: { id: Exclude<Wallpaper, "custom">; name: string; desc: string }[] = [
  { id: "dots", name: "Puntos animados", desc: "Estilo ATK · predeterminado" },
  { id: "glass", name: "Vidrio · color liso", desc: "Elegís el color" },
  { id: "plain", name: "Sólido", desc: "Sin animación" },
]

/** Fondo liso "medio difuminado": el color elegido con una luz muy suave en las esquinas. */
export const glassBackground = (c: string) =>
  `radial-gradient(90% 75% at 88% 0%, color-mix(in srgb, ${c} 88%, #fff 12%), transparent 70%), ` +
  `radial-gradient(70% 60% at 8% 100%, color-mix(in srgb, ${c} 94%, #fff 6%), transparent 70%), ${c}`

export const GLASS_BACKGROUND = glassBackground("var(--bg)")

/**
 * Capa de fondo de la app.
 * - Puntos animados (ATK, predeterminado): semitono en movimiento desde una esquina.
 * - Vidrio: color liso elegido por el usuario; las tarjetas se vuelven translúcidas.
 * - Sólido: color de fondo plano, sin animación.
 * - Imagen propia: cualquier imagen (también GIF animado).
 */
export function Backdrop() {
  const { wallpaper, customWallpaper } = useStore((s) => s.appearance)

  let content: ReactNode = null
  if (wallpaper === "dots") {
    content = (
      <div className="wall">
        <DotField />
      </div>
    )
  } else if (wallpaper === "glass") {
    content = <div className="wall" style={{ background: GLASS_BACKGROUND }} />
  } else if (wallpaper === "custom" && customWallpaper) {
    content = <div className="wall" style={{ background: `center / cover no-repeat url("${customWallpaper}")` }} />
  }

  return (
    <div className="backdrop" aria-hidden>
      {content}
    </div>
  )
}
