import potrace from "potrace"
import fs from "node:fs"
const [,, input, output] = process.argv
potrace.trace(input, { threshold: 128, turdSize: 20, optTolerance: 0.2, alphaMax: 1, color: "#000", background: "transparent" }, (err, svg) => {
  if (err) throw err
  fs.writeFileSync(output, svg)
  const d = svg.match(/ d="([^"]+)"/)[1]
  console.log("path length:", d.length, "| viewBox:", svg.match(/width="(\d+)" height="(\d+)"/).slice(1).join("x"))
})
