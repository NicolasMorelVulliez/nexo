// Imagen del mouse según la familia: foto propia del X6; silueta genérica para el resto
// (no se usan imágenes oficiales de otras marcas).
import x6Url from "../assets/x6-top.webp"
import genericUrl from "../assets/mouse-generic-top.svg"
import type { Capabilities } from "../device/types"

export const mouseImageFor = (family: Capabilities["family"]) => (family === "x6" ? x6Url : genericUrl)
