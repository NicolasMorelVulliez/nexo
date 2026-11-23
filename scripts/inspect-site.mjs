// Inspección de referencia de un sitio público (solo lectura): captura de pantalla,
// variables CSS, @font-face y estilos computados clave. No descarga ni ejecuta nada local.
// Uso: node scripts/inspect-site.mjs <url> <carpeta_salida>
import fs from "node:fs"
import path from "node:path"
import puppeteer from "puppeteer-core"

const url = process.argv[2]
const out = path.resolve(process.argv[3] ?? "inspect-out")
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
fs.mkdirSync(out, { recursive: true })

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 900 })
  const requests = []
  page.on("response", (r) => requests.push(`${r.status()} ${r.request().resourceType()} ${r.url()}`))
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 })
  await new Promise((r) => setTimeout(r, 2500))
  await page.screenshot({ path: path.join(out, "home.png") })

  const info = await page.evaluate(() => {
    const vars = {}
    const fontFaces = []
    const sheets = []
    for (const sheet of document.styleSheets) {
      sheets.push(sheet.href ?? "(inline)")
      let rules
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of rules) {
        if (rule instanceof CSSFontFaceRule) fontFaces.push(rule.cssText.slice(0, 300))
        if (rule instanceof CSSStyleRule && /^(:root|html|body|\.dark|\[data-theme|html\.dark)/.test(rule.selectorText)) {
          for (const prop of rule.style) {
            if (prop.startsWith("--")) vars[`${rule.selectorText} ${prop}`] = rule.style.getPropertyValue(prop).trim()
          }
        }
      }
    }
    const cs = getComputedStyle(document.body)
    const pick = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        tag: el.tagName,
        cls: String(el.className).slice(0, 120),
        text: el.textContent.trim().slice(0, 60),
        font: s.fontFamily,
        size: s.fontSize,
        weight: s.fontWeight,
        color: s.color,
        bg: s.backgroundColor,
        radius: s.borderRadius,
        border: s.border,
      }
    }
    const samples = [...document.querySelectorAll("button, h1, h2, h3, [class*=card], [class*=Card], header, nav, aside")]
      .slice(0, 40)
      .map(pick)
    return {
      title: document.title,
      body: { font: cs.fontFamily, color: cs.color, bg: cs.backgroundColor, size: cs.fontSize },
      html: { bg: getComputedStyle(document.documentElement).backgroundColor, cls: document.documentElement.className },
      sheets,
      fontFaces,
      vars,
      samples,
      text: document.body.innerText.slice(0, 1500),
    }
  })
  fs.writeFileSync(path.join(out, "info.json"), JSON.stringify(info, null, 2))
  fs.writeFileSync(path.join(out, "requests.txt"), requests.join("\n"))
  console.log("título:", info.title)
  console.log("body:", JSON.stringify(info.body))
  console.log("html:", JSON.stringify(info.html))
  console.log("hojas:", info.sheets.length, "| @font-face:", info.fontFaces.length, "| variables:", Object.keys(info.vars).length)
} finally {
  await browser.close()
}
