// Pruebas del protocolo RAWM con paquetes reales capturados del receptor RAWM (1915:233C).
// Ejecutar: node --test src/protocol/rawm.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { infoToState, rawmCaps, recordsWithRemaps, remapsFromRecords, stateToParams } from "../devices/rawm.ts"
import { DEFAULT_RAWM_MODEL } from "../devices/rawm-models.ts"
import type { MouseState } from "../device/types.ts"
import {
  applyNotify,
  applyQueryResult,
  CHANNEL_MOUSE,
  CHANNEL_NONE,
  CMD_QUERY_RESULT,
  CONFIG_TYPE_CRC,
  CONFIG_TYPE_MOUSE_PARAM,
  crc16,
  Deframer,
  defaultInfo,
  encodeMouseParam,
  encodeQuery,
  encodeSaveKeyProfile,
  encodeSleepTime,
  finishEvent,
  hex,
  KeyConfigCollector,
  NOTIFY,
  packetize,
  parseInputReport,
  parseKeyRecord,
  queryResultText,
} from "./rawm.ts"

const bytes = (s: string) => Uint8Array.from(s.trim().split(/\s+/).map((h) => parseInt(h, 16)))

test("CRC-16/CCITT-FALSE como crc16_compute del firmware", () => {
  assert.equal(crc16(new TextEncoder().encode("123456789")), 0x29b1)
})

test("CMD_QUERY: mismo paquete que se envió al receptor real", () => {
  // tx capturado: 8d 01 0d 03 00 00 0d dc 04 6b 00 00 00 00 (timestamp 0x6B04DC0D)
  const ev = encodeQuery(false, 0x6b04dc0d * 1000)
  assert.equal(hex(ev), "01 0d 03 00 00 0d dc 04 6b 00 00 00 00")
  const [pkt] = packetize(ev, CHANNEL_NONE)
  assert.equal(pkt.length, 64)
  assert.equal(hex(pkt.subarray(0, 14)), "8d 01 0d 03 00 00 0d dc 04 6b 00 00 00 00")
  // hacia el mouse por el receptor: prefijo C0|canal
  const [toMouse] = packetize(ev, CHANNEL_MOUSE)
  assert.equal(hex(toMouse.subarray(0, 4)), "c0 8d 01 0d")
})

test("Respuesta real del receptor: JSON partido en dos reportes", () => {
  const json = '{"r":"1.0.2","rc":3,"hw":3,"dn":"RAWM Receiver","pi":9020,"vi":6421,"esb_addr":"2f4c0153304400000000000000000000"}'
  const stream = [0xff, 0xff, 0xff, 0xff, 0x02, 0x75, ...new TextEncoder().encode(json), 0x00]
  const r1 = Uint8Array.from([0x80 | 63, ...stream.slice(0, 63)])
  const r2 = Uint8Array.from([0x80 | (stream.length - 63), ...stream.slice(63)])
  // prefijos tal cual llegaron del hardware
  assert.equal(hex(r1.subarray(0, 8)), "bf ff ff ff ff 02 75 7b")
  assert.equal(hex(r2.subarray(0, 4)), "ba 2c 22 76")

  const d = new Deframer()
  const p1 = parseInputReport(r1)
  const p2 = parseInputReport(r2)
  assert.ok(p1?.kind === "data" && p2?.kind === "data")
  assert.equal(p1.channel, CHANNEL_NONE)
  assert.deepEqual(d.push(p1.bytes), [])
  const [msg] = d.push(p2.bytes)
  assert.equal(msg.cmd, CMD_QUERY_RESULT)
  assert.equal(queryResultText(msg.payload), json)
  const info = applyQueryResult(defaultInfo(), queryResultText(msg.payload))
  assert.equal(info.deviceName, "RAWM Receiver")
  assert.equal(info.productId, 0x233c)
})

test("Aviso de buffer libre del receptor (canal 0)", () => {
  const p = parseInputReport(bytes("c0 52 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"))
  assert.deepEqual(p, { kind: "buffer", channel: 0, free: 0 })
  const q = parseInputReport(bytes("c0 52 e0 01 00 00"))
  assert.deepEqual(q, { kind: "buffer", channel: 0, free: 480 })
})

test("Cabecera de eventos largos y envoltura CRC", () => {
  const ev = finishEvent([3, 0, CONFIG_TYPE_MOUSE_PARAM, ...new Array(297).fill(0)], false)
  // 300 bytes: nibble alto del byte 0 = bits 8-11 de la longitud
  assert.equal(ev[0], 0x13)
  assert.equal(ev[1], 300 & 0xff)
  const wrapped = encodeSleepTime(60, true)
  assert.equal(wrapped[0] & 0xf, 3)
  assert.equal(wrapped[1], wrapped.length)
  assert.equal(wrapped[2], CONFIG_TYPE_CRC)
  const inner = wrapped.subarray(5)
  const c = crc16(inner)
  assert.equal(wrapped[3] | (wrapped[4] << 8), c)
  assert.equal(hex(inner), "03 05 21 3c 00")
})

test("MOUSE_PARAM: orden de campos de send_event_mouse_param", () => {
  const info = defaultInfo()
  const p = { ...info, resolution: 1600, pollingRate: 1000 }
  const ev = encodeMouseParam(p, false)
  const b = Array.from(ev)
  assert.equal(b[2], CONFIG_TYPE_MOUSE_PARAM)
  assert.deepEqual(b.slice(3, 5), [0x40, 0x06]) // 1600
  assert.deepEqual(b.slice(5, 7), [0xe8, 0x03]) // 1000 Hz
  assert.equal(b[7], info.light)
  assert.equal(b[8], 8) // cantidad de niveles
  assert.deepEqual(b.slice(9, 11), [0x90, 0x01]) // 400
  const after = 9 + 16
  assert.equal(b[after], info.onboard)
  assert.equal(b[after + 1], info.powerMode)
  assert.deepEqual(b.slice(after + 2, after + 6), [0, 0, 0, 0]) // resolución de 32 bits sin usar
  assert.equal(b[after + 6], 0) // niveles de 32 bits sin usar
  assert.equal(b[after + 7], info.lod)
  assert.equal(b[after + 8], 7) // debounce de 7 botones
  assert.equal(b.length, ev[1] | ((ev[0] & 0xf0) << 4))
  assert.equal(b[b.length - 1], info.glassModeEnabled)
})

test("CPI X/Y distintos usan los campos de 32 bits", () => {
  const info = defaultInfo()
  const xy = 800 | (1600 << 16)
  const ev = Array.from(encodeMouseParam({ ...info, resolution: xy, cpiLevels: [xy, 0, 0, 0, 0, 0, 0, 0] }, false))
  assert.deepEqual(ev.slice(3, 5), [0, 0])
  assert.equal(ev[8], 0) // sin niveles de 16 bits
  const at32 = 9 + 2
  assert.deepEqual(ev.slice(at32, at32 + 4), [0x20, 0x03, 0x40, 0x06])
  assert.equal(ev[at32 + 4], 8)
})

test("NOTIFY: batería y CPI cambiados desde el mouse", () => {
  let info = applyNotify(defaultInfo(), Uint8Array.from([NOTIFY.BATTERY, 57, 1]))
  assert.equal(info.battery, 57)
  assert.equal(info.charging, true)
  info = applyNotify(info, Uint8Array.from([NOTIFY.CPI, 0x80, 0x0c]))
  assert.equal(info.resolution, 3200)
})

test("Estado de Nexo ↔ estado RAWM (ida y vuelta)", () => {
  const caps = rawmCaps(DEFAULT_RAWM_MODEL)
  const info = applyQueryResult(
    defaultInfo(),
    JSON.stringify({ dn: "ES21", pi: 0x2333, cpi: 1600, polling: 1000, cpi_l: [400, 800, 1600, 3200, 0, 0, 0, 0], lod: 2, kd: [4, 4, 4, 4, 4, 4, 4], ms: 1, as: 0, rctrl: 1, pm: 2, st: 60, battery: 88, chr: 0, light: 0x10 | 0x20 | 0x07, lbn: 200 }),
  )
  const st = infoToState(info, caps)
  assert.deepEqual(st.dpi?.slice(0, 4), [400, 800, 1600, 3200])
  assert.equal(st.dpiCount, 4)
  assert.equal(st.dpiSlot, 2)
  assert.equal(caps.polling[st.pollingIndex!], 1000)
  assert.equal(st.liftOff, "high")
  assert.equal(st.debounceMs, 4)
  assert.equal(st.light?.mode, "dpi")
  assert.equal(st.light?.autoOff, true)
  assert.equal(st.battery, 88)

  const m = { ...st, dpiSlot: 3, debounceMs: 2, liftOff: "low", ripple: false } as MouseState
  const p = stateToParams(m, info, DEFAULT_RAWM_MODEL)
  assert.equal(p.resolution, 3200)
  assert.deepEqual(p.cpiLevels, [400, 800, 1600, 3200, 0, 0, 0, 0])
  assert.equal(p.lod, 1)
  assert.deepEqual(p.keyDelay, [2, 2, 2, 2, 2, 2, 2])
  assert.equal(p.rippleControl, 0)
  assert.equal(p.pollingRate, 1000)
  assert.equal(p.light & 0x08, 0x08) // LED_FLAG al escribir
})

/* ───────────── Botones ───────────── */

// Perfil 0 tal como lo informó el ES21 real (NOTIFY 0x14 después del estado)
const ES21_PROFILE0 = [
  "03 08 16 01 0a 00 01 01", // M1 → botón 1 (izquierdo)
  "03 08 16 01 0b 00 01 02", // M2 → botón 2 (derecho)
  "03 08 16 01 0c 00 01 03", // M3 → botón 3 (medio)
  "03 08 18 01 0d 02 0e 00", // M4 (oculto) → función 0x0E mostrar batería
  "03 08 16 01 0e 00 01 04", // M5 → botón 4 (atrás)
  "03 08 16 01 0f 00 01 05", // M6 → botón 5 (adelante)
  "03 08 18 01 10 02 01 00", // M7 → función 0x01 ciclar DPI
].map((s) => Array.from(bytes(s)))

test("Botones: perfiles de los NOTIFY 0x14 del ES21 real", () => {
  const c = new KeyConfigCollector()
  c.feed(Uint8Array.from([0x00]))
  for (const r of ES21_PROFILE0) c.feed(Uint8Array.from(r))
  c.feed(Uint8Array.from([0x01]))
  c.feed(bytes("03 08 16 01 0a 00 01 01"))
  assert.equal(c.done, false)
  c.feed(Uint8Array.from([0xff]))
  assert.equal(c.done, true)
  assert.equal(c.profiles[0].length, 7)
  assert.equal(c.profiles[1].length, 1)
  assert.deepEqual(remapsFromRecords(c.profiles[0]), {
    left: "left-click",
    right: "right-click",
    middle: "middle-click",
    side1: "forward",
    side2: "back",
    dpi: "dpi-loop",
  })
  // perfil sin registros para el medio y los laterales: quedan desactivados
  assert.equal(remapsFromRecords(c.profiles[1]).middle, "disable")
})

test("Botones: cambiar un botón reemplaza solo su registro y conserva el resto", () => {
  const prev = remapsFromRecords(ES21_PROFILE0)
  const next = { ...prev, side1: "copy", dpi: "disable" }
  const recs = recordsWithRemaps(ES21_PROFILE0, next, prev)
  assert.equal(recs.length, 6) // M7 desactivado = sin registro
  assert.equal(hex(Uint8Array.from(recs[5])), "03 0a 16 01 0f e0 00 06 00 00") // M6 → Ctrl + C, en su lugar
  assert.deepEqual(recs[3], ES21_PROFILE0[3]) // M4 (batería) intacto
  assert.deepEqual(remapsFromRecords(recs), { ...next })
  // volver atrás deja el perfil igual al original (salvo el orden de M7, que se agrega al final)
  const back = recordsWithRemaps(recs, prev, next)
  assert.deepEqual(remapsFromRecords(back), prev)
})

test("Botones: secuencia de guardado del configurador oficial", () => {
  const evs = encodeSaveKeyProfile(0, ES21_PROFILE0.slice(0, 1), false)
  assert.deepEqual(evs.map((e) => hex(e)), [
    "03 03 03", // CONFIG_TYPE_RESET
    "06 07 34 01 00 00 00", // ACTION_SAVE_CONFIG_TO_FDS 1 | perfil 0
    "03 08 16 01 0a 00 01 01", // registro reenviado igual
    "06 07 34 00 00 00 00", // ACTION_SAVE_CONFIG_TO_FDS 0
  ])
  assert.equal(hex(encodeSaveKeyProfile(2, [], false)[1]), "06 07 34 01 02 00 00")
  const p = parseKeyRecord(bytes("03 0c 18 01 10 02 01 00 00 00 00 00"))
  assert.deepEqual(p?.binding, { kind: "fn", touch: 2, fn: 1, data: 0 })
})
