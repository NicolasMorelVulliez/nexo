// Capturas del mockup con el Edge instalado (puppeteer-core, sin descargar Chromium).
// Uso: node scripts/shots.mjs [carpeta_salida] [base_url] [filtro]
// Requiere el preview corriendo: npx vite preview --port 4173
import fs from "node:fs"
import path from "node:path"
import puppeteer from "puppeteer-core"

const OUT = path.resolve(process.argv[2] ?? "../mockups")
const BASE = process.argv[3] ?? "http://localhost:4173"
const FILTER = process.argv[4] ?? ""
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

const WEB = { width: 1440, height: 900 }
const DESK = { width: 1600, height: 1000 }

const SHOTS = [
  ["web-01-inicio", WEB, "shell=web&view=inicio"],
  ["web-02-conectar", WEB, "shell=web&view=conectar"],
  ["web-03-botones", WEB, "shell=web&view=botones"],
  ["web-04-dpi", WEB, "shell=web&view=dpi"],
  ["web-05-rendimiento", WEB, "shell=web&view=rendimiento"],
  ["web-06-parametros", WEB, "shell=web&view=parametros"],
  ["web-07-iluminacion", WEB, "shell=web&view=iluminacion"],
  ["web-08-apariencia", WEB, "shell=web&view=apariencia"],
  ["web-09-fuentes", WEB, "shell=web&view=fuentes"],
  ["web-10-fondos", WEB, "shell=web&view=fondos"],
  ["web-11-general", WEB, "shell=web&view=general"],
  ["desk-01-inicio", DESK, "shell=desktop&view=inicio"],
  ["desk-02-rendimiento-flyout", DESK, "shell=desktop&view=rendimiento&flyout=1"],
  ["desk-03-botones-tooltip", DESK, "shell=desktop&view=botones&tooltip=1&charging=1"],
  ["desk-04-botones-chico", { width: 1426, height: 900 }, "shell=desktop&view=botones"],
  ["vidrio-web-inicio", WEB, "shell=web&view=inicio&wallpaper=glass"],
  ["vidrio-web-parametros", WEB, "shell=web&view=parametros&wallpaper=glass"],
  ["vidrio-azul-web-botones", WEB, "shell=web&view=botones&wallpaper=glass&glass=0b1326"],
  ["vidrio-desk-rendimiento", DESK, "shell=desktop&view=rendimiento&wallpaper=glass&glass=170f26"],
  ["claro-web-iluminacion", WEB, "shell=web&view=iluminacion&theme=light"],
]

fs.mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true })
try {
  const page = await browser.newPage()
  for (const [name, vp, q] of SHOTS) {
    if (FILTER && !name.includes(FILTER)) continue
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    await page.goto(`${BASE}/?mockup=1&shot=1&${q}`, { waitUntil: "networkidle0" })
    await new Promise((r) => setTimeout(r, 900)) // dejar que asienten springs y medidas
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
    console.log("ok ", name)
  }
} finally {
  await browser.close()
}
