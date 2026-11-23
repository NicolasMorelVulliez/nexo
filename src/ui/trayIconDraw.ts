// Ícono de bandeja dibujado por código sobre una grilla de 16×16.
// Se escala por múltiplos (16 → 100 %, 32 → 200 %). El algoritmo es
// deliberadamente simple (rectángulos sobre una grilla) para portarlo 1:1 a Rust
// y generar el ícono en runtime, sin los 404 .ico del proyecto original.

export interface TrayIconState {
  /** 0–100, o null si no hay dispositivo */
  level: number | null
  charging: boolean
  cable: boolean
  style: "bg" | "nobg"
  /** color de los dígitos sin fondo (depende del tema de la barra de tareas) */
  ink?: string
  /** cuadro de animación al cargar (0–3) */
  frame?: number
}

// Fuente de 3×5 píxeles.
const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "011", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "-": ["000", "000", "111", "000", "000"],
}

const COLORS = {
  ok: "#34d399",
  mid: "#fbbf24",
  low: "#f87171",
  charge: "#4cc2ff",
  off: "#8b90a0",
  bg: "#15171f",
  bgBorder: "rgba(255,255,255,0.22)",
  trackDark: "rgba(255,255,255,0.22)",
}

export function levelColor(level: number | null, charging: boolean) {
  if (level === null) return COLORS.off
  if (charging) return COLORS.charge
  if (level <= 20) return COLORS.low
  if (level <= 50) return COLORS.mid
  return COLORS.ok
}

export function drawTrayIcon(ctx: CanvasRenderingContext2D, size: number, st: TrayIconState) {
  const u = size / 16 // tamaño de un "píxel" de la grilla
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u))
  }

  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = false

  const hasBg = st.style === "bg"
  const ink = hasBg ? "#ffffff" : (st.ink ?? "#ffffff")
  const color = levelColor(st.level, st.charging)

  if (hasBg) {
    ctx.fillStyle = COLORS.bg
    roundRect(ctx, 0.5 * u, 0.5 * u, 15 * u, 15 * u, 3.5 * u)
    ctx.fill()
    ctx.strokeStyle = COLORS.bgBorder
    ctx.lineWidth = Math.max(1, u * 0.75)
    ctx.stroke()
  }

  // Zona superior (y 1..11): dígitos, glifo de cable o batería llena.
  if (st.cable) {
    drawPlug(px, ink)
  } else if (st.level === null) {
    drawText(px, "--", COLORS.off)
  } else if (st.level >= 100) {
    drawFull(px, ink, COLORS.ok)
  } else {
    const digitsColor = !st.charging && st.level <= 20 ? COLORS.low : ink
    drawText(px, String(Math.max(0, Math.round(st.level))).padStart(2, "0"), digitsColor)
  }

  // Barra inferior (y 13..14).
  const track = hasBg ? COLORS.trackDark : "rgba(128,128,128,0.45)"
  if (st.cable) {
    px(2, 13, 12, 2, COLORS.charge)
  } else {
    px(2, 13, 12, 2, track)
    const lvl = st.level ?? 0
    if (st.charging) {
      // Relleno con segmentos que avanzan (4 cuadros).
      const w = Math.max(2, Math.round((12 * lvl) / 100))
      px(2, 13, w, 2, color)
      const f = (st.frame ?? 0) % 4
      for (let x = 2 + f * 3; x < 2 + w; x += 12) px(x, 13, 1, 2, "#ffffff")
    } else if (lvl > 0) {
      px(2, 13, Math.max(1, Math.round((12 * lvl) / 100)), 2, color)
    }
  }
}

type Px = (x: number, y: number, w: number, h: number, color: string) => void

/** Dos caracteres de 3×5 escalados ×2 → 6×10 cada uno, en x=1 y x=9, y=1. */
function drawText(px: Px, text: string, color: string) {
  const chars = text.slice(0, 2).split("")
  chars.forEach((ch, i) => {
    const glyph = FONT[ch] ?? FONT["-"]
    const ox = 1 + i * 8
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < 3; gx++) {
        if (row[gx] === "1") px(ox + gx * 2, 1 + gy * 2, 2, 2, color)
      }
    })
  })
}

function drawPlug(px: Px, color: string) {
  px(5, 1, 2, 3, color)
  px(9, 1, 2, 3, color)
  px(3, 4, 10, 2, color)
  px(4, 6, 8, 2, color)
  px(5, 8, 6, 1, color)
  px(7, 9, 2, 3, color)
}

function drawFull(px: Px, ink: string, fill: string) {
  // contorno de batería
  px(1, 3, 13, 1, ink)
  px(1, 10, 13, 1, ink)
  px(1, 3, 1, 8, ink)
  px(13, 3, 1, 8, ink)
  px(14, 5, 1, 4, ink)
  // relleno completo
  px(3, 5, 9, 4, fill)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function trayTooltip(level: number | null, charging: boolean, cable: boolean) {
  if (cable) return "X6 — Conectado por cable"
  if (level === null) return "X6 — Sin dispositivo"
  return `X6 — ${level}%${charging ? " · Cargando" : ""}`
}
