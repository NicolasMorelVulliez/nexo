// Quita el fondo blanco de la foto del mouse y genera un WebP con transparencia.
//
// Uso: node scripts/remove-bg.mjs <entrada> [salida]
//
// Método:
//  1. Flood-fill desde los bordes sobre píxeles claros: así se marca el fondo
//     "exterior" y los brillos internos (p. ej. la ruedita plateada) no se tocan,
//     porque están rodeados por el cuerpo negro del mouse.
//  2. En el fondo y en una franja de unos px alrededor, el alpha sale de la
//     luminancia ("des-mateado" sobre blanco), para que los bordes queden suaves.
//  3. Se recorta al contenido, se deja un margen y se exporta en WebP con alpha.
import sharp from "sharp"
import path from "node:path"

const input = process.argv[2]
const output = process.argv[3] ?? "src/assets/x6-top.webp"
if (!input) {
  console.error("Uso: node scripts/remove-bg.mjs <entrada> [salida]")
  process.exit(1)
}

const BG_FLOOD_MIN_LUMA = 200 // píxeles >= a esto, conectados al borde, son fondo
const EDGE_BAND_PX = 3 // franja de borde suave alrededor del fondo
const OBJECT_LUMA = 28 // luminancia típica del plástico negro del mouse

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width: W, height: H } = info
const N = W * H
const luma = new Float32Array(N)
for (let i = 0; i < N; i++) {
  const r = data[i * 4]
  const g = data[i * 4 + 1]
  const b = data[i * 4 + 2]
  luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// 1) Flood-fill del fondo exterior (BFS con 4 vecinos).
const outer = new Uint8Array(N)
const queue = new Int32Array(N)
let head = 0
let tail = 0
const pushIfBg = (i) => {
  if (!outer[i] && luma[i] >= BG_FLOOD_MIN_LUMA) {
    outer[i] = 1
    queue[tail++] = i
  }
}
for (let x = 0; x < W; x++) {
  pushIfBg(x)
  pushIfBg((H - 1) * W + x)
}
for (let y = 0; y < H; y++) {
  pushIfBg(y * W)
  pushIfBg(y * W + W - 1)
}
while (head < tail) {
  const i = queue[head++]
  const x = i % W
  const y = (i / W) | 0
  if (x > 0) pushIfBg(i - 1)
  if (x < W - 1) pushIfBg(i + 1)
  if (y > 0) pushIfBg(i - W)
  if (y < H - 1) pushIfBg(i + W)
}

// 2) Franja de borde: dilatar la máscara exterior EDGE_BAND_PX veces.
let band = outer.slice()
for (let step = 0; step < EDGE_BAND_PX; step++) {
  const next = band.slice()
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (band[i]) continue
      if (
        (x > 0 && band[i - 1]) ||
        (x < W - 1 && band[i + 1]) ||
        (y > 0 && band[i - W]) ||
        (y < H - 1 && band[i + W])
      ) {
        next[i] = 1
      }
    }
  }
  band = next
}

const out = Buffer.alloc(N * 4)
let minX = W
let minY = H
let maxX = 0
let maxY = 0
for (let i = 0; i < N; i++) {
  let a = 1
  if (band[i]) {
    a = (255 - luma[i]) / (255 - OBJECT_LUMA)
    a = Math.min(1, Math.max(0, a))
    if (luma[i] >= 250) a = 0
  }
  const o = i * 4
  if (a <= 0) {
    out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0
    continue
  }
  // Des-mateado sobre blanco: C = a*F + (1-a)*255  →  F = (C - (1-a)*255) / a
  for (let c = 0; c < 3; c++) {
    const C = data[o + c]
    const F = (C - (1 - a) * 255) / a
    out[o + c] = Math.max(0, Math.min(255, Math.round(F)))
  }
  out[o + 3] = Math.round(a * 255)
  if (a > 0.04) {
    const x = i % W
    const y = (i / W) | 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
}

const pad = 12
const left = Math.max(0, minX - pad)
const top = Math.max(0, minY - pad)
const cropW = Math.min(W, maxX + pad + 1) - left
const cropH = Math.min(H, maxY + pad + 1) - top

await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left, top, width: cropW, height: cropH })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(output)

const removed = outer.reduce((s, v) => s + v, 0)
console.log(
  `OK → ${path.resolve(output)}  (${cropW}×${cropH}, fondo removido: ${((removed / N) * 100).toFixed(1)}%)`
)
