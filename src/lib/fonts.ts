import type { FontPreset } from "../device/store"

/** Pilas de fuentes por preset (como el selector de fuentes de ATK). */
export const FONT_STACKS: Record<FontPreset, string> = {
  default: `"OPPO Sans 4.0", "OPPOSans", "HarmonyOS Sans SC", "HarmonyOS Sans", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`,
  harmony: `"HarmonyOS Sans SC", "HarmonyOS Sans", "OPPO Sans 4.0", "OPPOSans", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`,
  system: `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif`,
  custom: `"X6 Custom Font", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`,
}

export const FONT_PRESET_LABEL: Record<FontPreset, string> = {
  default: "Predeterminada (OPPO Sans + HarmonyOS)",
  harmony: "Prioridad HarmonyOS",
  system: "Fuente del sistema",
  custom: "Fuente personalizada subida",
}

/** ¿Está disponible esta familia (instalada en el sistema o cargada)? */
export async function isFontAvailable(family: string): Promise<boolean> {
  try {
    const faces = await document.fonts.load(`16px "${family}"`)
    return faces.some((f) => f.status === "loaded")
  } catch {
    return false
  }
}

const MAX_BYTES = 15 * 1024 * 1024

/** Carga una fuente subida por el usuario y la registra como "X6 Custom Font". */
export async function loadCustomFont(file: File): Promise<string> {
  if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) throw new Error("Formato no admitido. Usá .woff2, .woff, .ttf u .otf.")
  if (file.size > MAX_BYTES) throw new Error("El archivo supera los 15 MB.")
  const face = new FontFace("X6 Custom Font", await file.arrayBuffer())
  await face.load()
  for (const f of [...document.fonts]) if (f.family.replace(/"/g, "") === "X6 Custom Font") document.fonts.delete(f)
  document.fonts.add(face)
  return file.name.replace(/\.[^.]+$/, "")
}
