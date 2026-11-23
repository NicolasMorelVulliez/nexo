// Pruebas del protocolo con los paquetes documentados por el autor (keshuac.com).
// Ejecutar: node --test src/protocol/x6.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  decodeState,
  encodeDebounce,
  encodeDpi,
  encodeLight,
  encodePolling,
  encodeRemap,
  encodeSensor,
  encodeSleep,
  encodeStateRequest,
  hex,
} from "./x6.ts"

/** "b5 40 ff …" → bytes sin el report ID, rellenados a `len`. */
function packet(s: string, len = 20) {
  const bytes = s.trim().split(/\s+/).slice(1).map((h) => parseInt(h, 16))
  const out = new Uint8Array(len)
  out.set(bytes)
  return hex(out)
}

test("pedido de estado: 0xB3 [06 …] de 60 bytes", () => {
  const r = encodeStateRequest()
  assert.equal(r.reportId, 0xb3)
  assert.equal(r.data.length, 60)
  assert.equal(r.data[0], 0x06)
})

test("estado 0xB4: ejemplo del blog (53 %, sin cargar)", () => {
  // B4 06 00 22 22 02 90 01 20 03 B0 04 80 0C C0 12 15 05 04 01 35
  const data = Uint8Array.from(
    "06 00 22 22 02 90 01 20 03 B0 04 80 0C C0 12 15 05 04 01 35".split(" ").map((h) => parseInt(h, 16)),
  )
  const s = decodeState(data)
  assert.deepEqual(s.dpi, [400, 800, 1200, 3200, 4800])
  assert.equal(s.dpiSlot, 2)
  assert.equal(s.dpiCount, 5)
  assert.equal(s.pollingIndex, 2) // 1000 Hz
  assert.equal(s.debounceMs, 4)
  assert.equal(s.sleepMin, 1)
  assert.equal(s.battery, 53)
  assert.equal(s.charging, false)
  // flags 0x15 = 0001 0101 → lift bajo, motion sync sí, angle snap no, ripple sí
  assert.equal(s.liftOff, "low")
  assert.equal(s.motionSync, true)
  assert.equal(s.angleSnap, false)
  assert.equal(s.ripple, true)
  assert.equal(s.scrollForward, true)
  assert.equal(s.esports, false)
})

test("estado 0xB4: cargando (bit 7) → 62 %", () => {
  const data = new Uint8Array(20)
  data[19] = 0xbe
  const s = decodeState(data)
  assert.equal(s.battery, 62)
  assert.equal(s.charging, true)
})

test("DPI: ejemplo del blog (slot 4; 400/800/1200/3200/26000; 5 niveles)", () => {
  const r = encodeDpi([400, 800, 1200, 3200, 26000], 4, 5)
  assert.equal(r.reportId, 0xb5)
  assert.equal(hex(r.data), packet("b5 40 ff 04 ff 90 01 20 03 b0 04 80 0c 90 65 05"))
})

test("polling: ejemplo del blog (índice 3 = 2000 Hz)", () => {
  assert.equal(
    hex(encodePolling(3).data),
    packet("b5 41 ff 03 ff 7d 00 f4 01 e8 03 d0 07 a0 0f 40 1f"),
  )
})

test("sensor: ejemplo del blog (lift alto, motion sync sí, angle snap no, ripple sí, eSports no)", () => {
  const r = encodeSensor({
    liftOff: "high",
    motionSync: true,
    angleSnap: false,
    ripple: true,
    scrollForward: true,
    esports: false,
  })
  assert.equal(hex(r.data), packet("b5 42 02 01 02 01 00 01 01"))
})

test("debounce 7 ms y suspensión 1 min", () => {
  assert.equal(hex(encodeDebounce(7).data), packet("b5 43 07"))
  assert.equal(hex(encodeSleep(1).data), packet("b5 0a 01 01"))
})

test("luz: apagada, respiración y arcoíris (ejemplos del blog)", () => {
  const base = { brightness: 255, speed: 204, color: { r: 0, g: 255, b: 6 } }
  assert.equal(hex(encodeLight({ ...base, mode: "off" }).data), packet("b5 24 00"))
  assert.equal(hex(encodeLight({ ...base, mode: "breath" }).data), packet("b5 24 02 ff cc 00 ff 06"))
  assert.equal(
    hex(encodeLight({ mode: "rainbow", brightness: 0x79, speed: 0xff, color: base.color }).data),
    packet("b5 24 03 79 ff ff"),
  )
})

test("remapeo: lateral delantero → Copiar (0x52, 60 bytes)", () => {
  const r = encodeRemap(0x03, 0x08, 0x070106)
  assert.equal(r.reportId, 0xb3)
  assert.equal(r.data.length, 60)
  assert.deepEqual(Array.from(r.data.slice(0, 7)), [0x52, 0x03, 0x00, 0x08, 0x07, 0x01, 0x06])
})
