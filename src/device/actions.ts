// Catálogo de acciones asignables a los botones.
// Códigos de función tomados de webhid/src/components/ui/button-remap-dropdown.tsx
// del repo original (jchu634/X6-Utilities, MIT).

export type ActionCategory = "mouse" | "media" | "system" | "dpi" | "rgb" | "other"

export interface ButtonAction {
  id: string
  label: string
  category: ActionCategory
  /** byte de "feature" del comando 0x52 */
  feature: number
  /** código de 24 bits */
  code: number
}

const F = {
  MOUSE: 0x01,
  MULTIMEDIA: 0x03,
  DPI: 0x05,
  RGB: 0x06,
  SYSTEM: 0x08,
  DISABLE: 0x09,
} as const

export const ACTIONS: ButtonAction[] = [
  { id: "left-click", label: "Clic izquierdo", category: "mouse", feature: F.MOUSE, code: 0x010000 },
  { id: "right-click", label: "Clic derecho", category: "mouse", feature: F.MOUSE, code: 0x020000 },
  { id: "middle-click", label: "Clic medio", category: "mouse", feature: F.MOUSE, code: 0x040000 },
  { id: "double-click", label: "Doble clic", category: "mouse", feature: F.MOUSE, code: 0x800000 },
  { id: "forward", label: "Adelante", category: "mouse", feature: F.MOUSE, code: 0x080000 },
  { id: "back", label: "Atrás", category: "mouse", feature: F.MOUSE, code: 0x100000 },
  { id: "scroll-up", label: "Scroll arriba", category: "mouse", feature: F.MOUSE, code: 0x000200 },
  { id: "scroll-down", label: "Scroll abajo", category: "mouse", feature: F.MOUSE, code: 0x00fe00 },
  { id: "scroll-left", label: "Scroll izquierda", category: "mouse", feature: F.MOUSE, code: 0x0000fe },
  { id: "scroll-right", label: "Scroll derecha", category: "mouse", feature: F.MOUSE, code: 0x000002 },

  { id: "vol-up", label: "Volumen +", category: "media", feature: F.MULTIMEDIA, code: 0xe90000 },
  { id: "vol-down", label: "Volumen −", category: "media", feature: F.MULTIMEDIA, code: 0xea0000 },
  { id: "mute", label: "Silenciar", category: "media", feature: F.MULTIMEDIA, code: 0xe20000 },
  { id: "play-pause", label: "Play / Pausa", category: "media", feature: F.MULTIMEDIA, code: 0xcd0000 },
  { id: "next", label: "Siguiente", category: "media", feature: F.MULTIMEDIA, code: 0xb50000 },
  { id: "prev", label: "Anterior", category: "media", feature: F.MULTIMEDIA, code: 0xb60000 },
  { id: "stop", label: "Detener", category: "media", feature: F.MULTIMEDIA, code: 0xb70000 },
  { id: "player", label: "Abrir reproductor", category: "media", feature: F.MULTIMEDIA, code: 0x830100 },

  { id: "bright-up", label: "Brillo pantalla +", category: "system", feature: F.SYSTEM, code: 0x0c6f00 },
  { id: "bright-down", label: "Brillo pantalla −", category: "system", feature: F.SYSTEM, code: 0x0c7000 },
  { id: "switch-app", label: "Cambiar de app", category: "system", feature: F.SYSTEM, code: 0x07042b },
  { id: "refresh", label: "Actualizar (F5)", category: "system", feature: F.SYSTEM, code: 0x07003e },
  { id: "cut", label: "Cortar", category: "system", feature: F.SYSTEM, code: 0x07011b },
  { id: "copy", label: "Copiar", category: "system", feature: F.SYSTEM, code: 0x070106 },
  { id: "paste", label: "Pegar", category: "system", feature: F.SYSTEM, code: 0x070119 },

  { id: "dpi-loop", label: "Ciclar DPI", category: "dpi", feature: F.DPI, code: 0x010000 },
  { id: "dpi-up", label: "DPI +", category: "dpi", feature: F.DPI, code: 0x020000 },
  { id: "dpi-down", label: "DPI −", category: "dpi", feature: F.DPI, code: 0x030000 },

  { id: "rgb-effect", label: "Cambiar efecto", category: "rgb", feature: F.RGB, code: 0x010000 },
  { id: "rgb-speed", label: "Velocidad luz", category: "rgb", feature: F.RGB, code: 0x020000 },
  { id: "rgb-color", label: "Cambiar color", category: "rgb", feature: F.RGB, code: 0x030000 },
  { id: "rgb-up", label: "Brillo luz +", category: "rgb", feature: F.RGB, code: 0x040000 },
  { id: "rgb-down", label: "Brillo luz −", category: "rgb", feature: F.RGB, code: 0x050000 },

  { id: "disable", label: "Desactivar botón", category: "other", feature: F.DISABLE, code: 0x000000 },
]

export const ACTION_BY_ID: Record<string, ButtonAction> = Object.fromEntries(
  ACTIONS.map((a) => [a.id, a]),
)

export const CATEGORY_LABEL: Record<ActionCategory, string> = {
  mouse: "Mouse",
  media: "Multimedia",
  system: "Sistema",
  dpi: "DPI",
  rgb: "Iluminación",
  other: "Otros",
}

export function actionsIn(category: ActionCategory) {
  return ACTIONS.filter((a) => a.category === category)
}
