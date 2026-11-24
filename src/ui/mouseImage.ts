// Imagen de cada mouse: foto recortada, proporción, posición de los botones (hotspots, en % del
// ancho/alto) y dónde se dibuja el brillo de la luz.
import es21Url from "../assets/es21-top.webp"
import genericUrl from "../assets/mouse-generic-top.svg"
import x6Url from "../assets/x6-top.webp"
import type { ButtonId, Capabilities } from "../device/types"

export type Spot = { x: number; y: number; side: "l" | "r" }

export interface MouseImage {
  url: string
  /** ancho / alto */
  aspect: number
  hotspots: Partial<Record<ButtonId, Spot>>
  /** centro y tamaño (% del ancho) del brillo de la luz */
  glow: { x: number; y: number; size: number }
}

export const MOUSE_IMAGES: Record<Capabilities["image"], MouseImage> = {
  x6: {
    url: x6Url,
    aspect: 422 / 767,
    hotspots: {
      left: { x: 27, y: 13, side: "l" },
      middle: { x: 50, y: 21, side: "r" },
      right: { x: 74, y: 33, side: "r" },
      side1: { x: 4.6, y: 34.5, side: "l" },
      side2: { x: 4.6, y: 51, side: "r" },
    },
    glow: { x: 50, y: 17.5, size: 18 },
  },
  // foto del ES21 blanco (recortada de la imagen que pasó el usuario)
  es21: {
    url: es21Url,
    aspect: 362 / 685,
    hotspots: {
      left: { x: 27, y: 12, side: "l" },
      middle: { x: 50, y: 18, side: "r" },
      right: { x: 75, y: 31, side: "r" },
      // el botón de DPI del ES21 está abajo; se marca en el LED indicador
      dpi: { x: 50, y: 49.6, side: "r" },
      side1: { x: 4.5, y: 36.5, side: "l" },
      side2: { x: 4.5, y: 52.5, side: "l" },
    },
    glow: { x: 50, y: 49.6, size: 9 },
  },
  generic: {
    url: genericUrl,
    aspect: 422 / 767,
    hotspots: {
      left: { x: 28, y: 12, side: "l" },
      middle: { x: 50, y: 15.5, side: "r" },
      right: { x: 72, y: 26, side: "r" },
      dpi: { x: 50, y: 28.5, side: "l" },
      side1: { x: 5.5, y: 41.5, side: "l" },
      side2: { x: 5.5, y: 51.5, side: "l" },
    },
    glow: { x: 50, y: 16, size: 18 },
  },
}

export const mouseImageFor = (image: Capabilities["image"]) => MOUSE_IMAGES[image] ?? MOUSE_IMAGES.generic
