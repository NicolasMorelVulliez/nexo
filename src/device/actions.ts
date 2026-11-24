// Catálogo de acciones asignables a los botones.
// X6: códigos de función tomados de webhid/src/components/ui/button-remap-dropdown.tsx
// del repo original (jchu634/X6-Utilities, MIT).
// RAWM: registros MOUSE_KEY / MOUSE_FUNCTION del configurador oficial (ver docs/protocolo-rawm.md).

import type { RawmBinding } from "../protocol/rawm"
import type { Capabilities } from "./types"

export type ActionCategory = "mouse" | "media" | "system" | "dpi" | "rgb" | "other"

export interface ButtonAction {
  id: string
  label: string
  category: ActionCategory
  /** X6: byte de "feature" del comando 0x52 (sin valor = no disponible en el X6) */
  feature?: number
  /** X6: código de 24 bits */
  code?: number
  /** RAWM: qué registro se guarda (sin valor = no disponible en RAWM) */
  rawm?: RawmBinding
}

const F = {
  MOUSE: 0x01,
  MULTIMEDIA: 0x03,
  DPI: 0x05,
  RGB: 0x06,
  SYSTEM: 0x08,
  DISABLE: 0x09,
} as const

// RAWM: tipos de MOUSE_KEY y usages HID de teclado
const mkey = (code: number): RawmBinding => ({ kind: "key", type: 0x1, code, mod: 0, mod2: 0 })
const wheel = (code: number): RawmBinding => ({ kind: "key", type: 0x3, code, mod: 0, mod2: 0 })
const pan = (code: number): RawmBinding => ({ kind: "key", type: 0x5, code, mod: 0, mod2: 0 })
const media = (code: number): RawmBinding => ({ kind: "key", type: 0x4, code, mod: 0, mod2: 0 })
const kbd = (code: number, mod = 0): RawmBinding => ({ kind: "key", type: 0x0, code, mod, mod2: 0 })
const fn = (f: number): RawmBinding => ({ kind: "fn", touch: 0x2, fn: f, data: 0 })
const CTRL = 0xe0
const ALT = 0xe2

export const ACTIONS: ButtonAction[] = [
  { id: "left-click", label: "Clic izquierdo", category: "mouse", feature: F.MOUSE, code: 0x010000, rawm: mkey(1) },
  { id: "right-click", label: "Clic derecho", category: "mouse", feature: F.MOUSE, code: 0x020000, rawm: mkey(2) },
  { id: "middle-click", label: "Clic medio", category: "mouse", feature: F.MOUSE, code: 0x040000, rawm: mkey(3) },
  { id: "double-click", label: "Doble clic", category: "mouse", feature: F.MOUSE, code: 0x800000 },
  { id: "forward", label: "Adelante", category: "mouse", feature: F.MOUSE, code: 0x080000, rawm: mkey(5) },
  { id: "back", label: "Atrás", category: "mouse", feature: F.MOUSE, code: 0x100000, rawm: mkey(4) },
  { id: "scroll-up", label: "Scroll arriba", category: "mouse", feature: F.MOUSE, code: 0x000200, rawm: wheel(0x41) },
  { id: "scroll-down", label: "Scroll abajo", category: "mouse", feature: F.MOUSE, code: 0x00fe00, rawm: wheel(0x3f) },
  { id: "scroll-left", label: "Scroll izquierda", category: "mouse", feature: F.MOUSE, code: 0x0000fe, rawm: pan(0x3f) },
  { id: "scroll-right", label: "Scroll derecha", category: "mouse", feature: F.MOUSE, code: 0x000002, rawm: pan(0x41) },

  { id: "vol-up", label: "Volumen +", category: "media", feature: F.MULTIMEDIA, code: 0xe90000, rawm: media(2) },
  { id: "vol-down", label: "Volumen −", category: "media", feature: F.MULTIMEDIA, code: 0xea0000, rawm: media(3) },
  { id: "mute", label: "Silenciar", category: "media", feature: F.MULTIMEDIA, code: 0xe20000, rawm: media(1) },
  { id: "play-pause", label: "Play / Pausa", category: "media", feature: F.MULTIMEDIA, code: 0xcd0000, rawm: media(4) },
  { id: "next", label: "Siguiente", category: "media", feature: F.MULTIMEDIA, code: 0xb50000, rawm: media(7) },
  { id: "prev", label: "Anterior", category: "media", feature: F.MULTIMEDIA, code: 0xb60000, rawm: media(6) },
  { id: "stop", label: "Detener", category: "media", feature: F.MULTIMEDIA, code: 0xb70000, rawm: media(5) },
  { id: "player", label: "Abrir reproductor", category: "media", feature: F.MULTIMEDIA, code: 0x830100 },
  { id: "calculator", label: "Calculadora", category: "media", rawm: media(9) },
  { id: "mail", label: "Correo", category: "media", rawm: media(8) },

  { id: "bright-up", label: "Brillo pantalla +", category: "system", feature: F.SYSTEM, code: 0x0c6f00 },
  { id: "bright-down", label: "Brillo pantalla −", category: "system", feature: F.SYSTEM, code: 0x0c7000 },
  { id: "switch-app", label: "Cambiar de app", category: "system", feature: F.SYSTEM, code: 0x07042b, rawm: kbd(0x2b, ALT) },
  { id: "refresh", label: "Actualizar (F5)", category: "system", feature: F.SYSTEM, code: 0x07003e, rawm: kbd(0x3e) },
  { id: "cut", label: "Cortar", category: "system", feature: F.SYSTEM, code: 0x07011b, rawm: kbd(0x1b, CTRL) },
  { id: "copy", label: "Copiar", category: "system", feature: F.SYSTEM, code: 0x070106, rawm: kbd(0x06, CTRL) },
  { id: "paste", label: "Pegar", category: "system", feature: F.SYSTEM, code: 0x070119, rawm: kbd(0x19, CTRL) },
  { id: "undo", label: "Deshacer", category: "system", rawm: kbd(0x1d, CTRL) },

  { id: "dpi-loop", label: "Ciclar DPI", category: "dpi", feature: F.DPI, code: 0x010000, rawm: fn(0x1) },
  { id: "dpi-up", label: "DPI +", category: "dpi", feature: F.DPI, code: 0x020000, rawm: fn(0x2) },
  { id: "dpi-down", label: "DPI −", category: "dpi", feature: F.DPI, code: 0x030000, rawm: fn(0x3) },
  { id: "show-battery", label: "Mostrar batería", category: "dpi", rawm: fn(0xe) },

  { id: "rgb-effect", label: "Cambiar efecto", category: "rgb", feature: F.RGB, code: 0x010000 },
  { id: "rgb-speed", label: "Velocidad luz", category: "rgb", feature: F.RGB, code: 0x020000 },
  { id: "rgb-color", label: "Cambiar color", category: "rgb", feature: F.RGB, code: 0x030000 },
  { id: "rgb-up", label: "Brillo luz +", category: "rgb", feature: F.RGB, code: 0x040000 },
  { id: "rgb-down", label: "Brillo luz −", category: "rgb", feature: F.RGB, code: 0x050000 },

  { id: "disable", label: "Desactivar botón", category: "other", feature: F.DISABLE, code: 0x000000 },
  /** RAWM: el mouse tiene algo que Nexo no sabe mostrar (macro, otra tecla…); se conserva tal cual */
  { id: "custom", label: "Otra acción", category: "other" },
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

/** ¿El mouse de esta familia puede hacer esta acción? */
export const supports = (family: Capabilities["family"], a: ButtonAction) =>
  a.id === "disable" || (family === "x6" ? a.feature !== undefined : a.rawm !== undefined)

export function actionsIn(category: ActionCategory, family: Capabilities["family"] = "x6") {
  return ACTIONS.filter((a) => a.category === category && supports(family, a))
}

const sameBinding = (a: RawmBinding, b: RawmBinding) =>
  a.kind === "key" && b.kind === "key"
    ? a.type === b.type && a.code === b.code && a.mod === b.mod && a.mod2 === b.mod2
    : a.kind === "fn" && b.kind === "fn" && a.fn === b.fn

/** RAWM: id de acción que corresponde a un registro leído del mouse. */
export function actionForRawm(b: RawmBinding | null): string {
  if (!b) return "custom"
  return ACTIONS.find((a) => a.rawm && sameBinding(a.rawm, b))?.id ?? "custom"
}
