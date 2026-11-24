// Prueba rápida de interacción del mockup (Edge instalado + puppeteer-core).
// Uso: node scripts/smoke.mjs [base_url]
import puppeteer from "puppeteer-core"

const BASE = process.argv[2] ?? "http://localhost:4173"
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
let failed = 0
const check = (name, ok) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`)
  if (!ok) failed++
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true })
try {
  const page = await browser.newPage()
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  await page.setViewport({ width: 1440, height: 900 })

  const clickText = async (sel, text) => {
    const ok = await page.evaluate(
      (sel, text) => {
        const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(text))
        if (el) el.click()
        return !!el
      },
      sel,
      text,
    )
    await wait(450)
    return ok
  }
  const bodyHas = (t) => page.evaluate((t) => document.body.textContent.includes(t), t)

  // 1) Arranque sin mouse → Inicio con "Conectar mouse"
  await page.goto(`${BASE}/?mockup=1&view=conectar`, { waitUntil: "networkidle0" })
  check("arranca en Inicio sin mouse", await bodyHas("Conectar mouse"))

  // 2) Conectar → tarjeta con batería; abrir dispositivo
  await clickText("button", "Conectar mouse")
  check("tarjeta muestra la batería", await bodyHas("78 %"))
  check("nombre real del modelo (Motospeed X6 Max)", await bodyHas("Motospeed X6 Max"))
  check("sin texto gigante de fondo en Inicio", !(await page.evaluate(() => [...document.querySelectorAll("div")].some((d) => d.textContent === "Motospeed X6" && parseFloat(getComputedStyle(d).fontSize) > 60))))
  check("fondo de puntos animado (canvas)", await page.evaluate(() => !!document.querySelector("canvas.dot-field")))
  await page.click('button[aria-label^="Abrir configuración del"]')
  await wait(500)
  check("abre la pestaña del dispositivo", await bodyHas("Configuración del mouse"))

  // 3) Botones: reasignar "Lateral delantero" a "Copiar" (categoría Sistema)
  await clickText("button.seg-item", "Sistema")
  await clickText("button.mode", "Copiar")
  const label = await page.evaluate(
    () => [...document.querySelectorAll("button.key-label")].find((b) => b.textContent.startsWith("Lateral delantero"))?.textContent,
  )
  check(`etiqueta del lateral = Copiar (${label})`, label?.endsWith("Copiar"))
  check("aviso 'Guardado en el mouse'", await bodyHas("Guardado en el mouse"))

  // 4) Rendimiento: polling 4K + modo eSports
  await clickText("nav button", "Rendimiento")
  await clickText("button.seg-item", "4K")
  check("polling 4K muestra 0,25 ms", await bodyHas("0,25 ms"))
  await clickText("button.option", "Modo eSports")
  check("modo eSports activo", await page.evaluate(() => [...document.querySelectorAll("button.option")].find((b) => b.textContent.includes("eSports"))?.getAttribute("aria-pressed") === "true"))

  // 5) DPI: elegir nivel 5 → DPI actual 6.400
  await clickText("nav button", "DPI")
  await clickText("button", "Nivel 5")
  await wait(1500)
  check("DPI actual pasa a 6.400", await bodyHas("Nivel 5 de 5"))

  // 6) Ajustes → Apariencia: color de tema azul y tema claro
  await page.click('button[aria-label="Ajustes"]')
  await wait(500)
  await clickText("nav button, aside button", "Apariencia")
  await page.click('button[aria-label="Azul"]')
  await wait(200)
  const accent = await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent"))
  check(`color de tema aplicado (${accent})`, accent.trim() === "#3b82f6")
  await clickText("button.seg-item", "Claro")
  check("tema claro", (await page.evaluate(() => document.documentElement.dataset.theme)) === "light")

  // 7) Fuentes: abrir panel y elegir "Fuente del sistema"
  await clickText("button", "Configurar")
  await clickText("aside button", "Fuente del sistema")
  const font = await page.evaluate(() => document.documentElement.style.getPropertyValue("--font-ui"))
  check("preset de fuente aplicado", font.includes("Segoe UI Variable Text") && !font.includes("OPPO"))

  // 8) Fondos: vidrio color liso + color azul noche
  await page.keyboard.press("Escape")
  await page.goto(`${BASE}/?mockup=1&view=fondos`, { waitUntil: "networkidle0" })
  await clickText("button", "Vidrio · color liso")
  check("fondo vidrio activo", (await page.evaluate(() => document.documentElement.dataset.wallpaper)) === "glass")
  await page.click('button[aria-label="Vidrio Azul noche"]')
  await wait(200)
  const glass = await page.evaluate(() => document.documentElement.style.getPropertyValue("--glass-color"))
  check(`color del vidrio aplicado (${glass})`, glass.trim() === "#0b1326")

  // 9) Escritorio: flyout de bandeja
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto(`${BASE}/?mockup=1&shell=desktop&view=rendimiento`, { waitUntil: "networkidle0" })
  await page.click('button[aria-label="Batería del mouse (bandeja)"]')
  await wait(500)
  check("flyout de bandeja abre", await bodyHas("Cambio rápido de DPI"))

  // 10) RAWM ES21 simulado: la UI se arma con sus capacidades
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${BASE}/?mockup=1&device=es21&view=rendimiento`, { waitUntil: "networkidle0" })
  check("ES21: modos de energía RAWM", (await bodyHas("Modo de energía")) && (await bodyHas("Alto rendimiento")))
  check("ES21: sin modo eSports del X6", !(await bodyHas("Modo eSports")))
  check("ES21: polling hasta 1K (sin 8K)", (await bodyHas("1K")) && !(await bodyHas("8K")))
  await clickText("button.option", "Oficina")
  check("ES21: elegir modo Oficina", await bodyHas("limitado a 125 Hz"))
  await page.goto(`${BASE}/?mockup=1&device=es21&view=dpi`, { waitUntil: "networkidle0" })
  check("ES21: 8 niveles de DPI", await bodyHas("Nivel 8"))
  await page.goto(`${BASE}/?mockup=1&device=es21&view=parametros`, { waitUntil: "networkidle0" })
  check("ES21: sin inversión de scroll", !(await bodyHas("Invertir dirección del scroll")))
  check("ES21: suspensión en segundos", await bodyHas("30 s"))
  check("ES21: memoria del ES21", await bodyHas("memoria del ES21"))
  await page.goto(`${BASE}/?mockup=1&device=es21&view=iluminacion`, { waitUntil: "networkidle0" })
  check("ES21: luz según DPI y apagado en reposo", (await bodyHas("Según DPI")) && (await bodyHas("Apagar en reposo")))
  check("ES21: sin velocidad de efecto", !(await bodyHas("Velocidad")))
  await page.goto(`${BASE}/?mockup=1&device=es21&view=botones`, { waitUntil: "networkidle0" })
  check("ES21: botón de DPI remapeable", await page.evaluate(() => [...document.querySelectorAll("button.key-label")].some((b) => b.textContent.startsWith("Botón de DPI"))))
  await clickText("button.seg-item", "DPI")
  check("ES21: acciones RAWM (Mostrar batería)", await bodyHas("Mostrar batería"))
  await clickText("button.seg-item", "Multimedia")
  check("ES21: sin acciones solo-X6 (Abrir reproductor)", !(await bodyHas("Abrir reproductor")))
  await page.goto(`${BASE}/?mockup=1&device=es21&view=acerca`, { waitUntil: "networkidle0" })
  check("ES21: VID:PID real en Acerca de", await bodyHas("1915:233C"))

  check(`sin errores en consola (${errors.length})`, errors.length === 0)
  if (errors.length) console.log(errors.join("\n"))
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
