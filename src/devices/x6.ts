// Driver del Motospeed X6 / X6 Max (protocolo en src/protocol/x6.ts).

import { ACTION_BY_ID } from "../device/actions"
import type { Transport } from "../device/transport"
import { BUTTON_KEY_ID, BUTTON_ORDER, type Capabilities, type MouseState } from "../device/types"
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
  POLLING_HZ,
  PRODUCT_CABLE,
  PRODUCT_DONGLE,
  REPORT_STATE,
  VENDOR_ID,
  VENDOR_USAGE_PAGE,
} from "../protocol/x6"
import type { DeviceDriver, DeviceSession } from "./driver"

export const X6_CAPS: Capabilities = {
  family: "x6",
  shortName: "X6",
  dpi: { min: 100, max: 26000, step: 100, slots: 5 },
  polling: [...POLLING_HZ],
  lod: true,
  motionSync: true,
  angleSnap: true,
  ripple: true,
  scrollDirection: true,
  esports: true,
  powerModes: [],
  debounce: [0, 1, 2, 4, 8, 15, 20],
  sleep: [1, 2, 3, 5, 10, 20, 30, 60].map((m) => m * 60),
  light: { modes: ["off", "static", "breath", "rainbow"], palette: "rgb", speed: true, brightness: true, autoOff: false, readable: false },
  remap: true,
  buttons: ["left", "right", "middle", "side1", "side2"],
  battery: true,
}

type Packet = { reportId: number; data: Uint8Array }
const sensorKeys: (keyof MouseState)[] = ["liftOff", "motionSync", "angleSnap", "ripple", "scrollForward", "esports"]

class X6Session implements DeviceSession {
  readonly caps = X6_CAPS
  private readonly t: Transport
  constructor(t: Transport) {
    this.t = t
  }

  identity() {
    return null
  }

  async read(): Promise<Partial<MouseState>> {
    const req = encodeStateRequest()
    const st = decodeState(await this.t.request(req.reportId, req.data, REPORT_STATE, 2000))
    const cable = this.t.info.cable
    const { sleepMin, battery, charging, ...rest } = st
    return {
      ...rest,
      sleepSec: sleepMin * 60,
      // por cable la batería no es confiable
      ...(cable ? { charging: false } : { battery, charging }),
      connection: cable ? "cable" : "dongle",
    }
  }

  async apply(m: MouseState, prev: MouseState) {
    const out: Packet[] = []
    if (m.dpi !== prev.dpi || m.dpiSlot !== prev.dpiSlot || m.dpiCount !== prev.dpiCount)
      out.push(encodeDpi(m.dpi, m.dpiSlot, m.dpiCount))
    if (m.pollingIndex !== prev.pollingIndex) out.push(encodePolling(m.pollingIndex))
    if (sensorKeys.some((k) => m[k] !== prev[k])) out.push(encodeSensor(m))
    if (m.debounceMs !== prev.debounceMs) out.push(encodeDebounce(m.debounceMs))
    if (m.sleepSec !== prev.sleepSec) out.push(encodeSleep(Math.max(1, Math.round(m.sleepSec / 60))))
    if (m.light !== prev.light) out.push(encodeLight({ ...m.light, mode: m.light.mode === "dpi" ? "static" : m.light.mode }))
    if (m.remaps !== prev.remaps)
      for (const b of BUTTON_ORDER) {
        const key = BUTTON_KEY_ID[b]
        if (key === undefined || m.remaps[b] === prev.remaps[b]) continue
        const a = ACTION_BY_ID[m.remaps[b]]
        if (a && a.feature !== undefined) out.push(encodeRemap(key, a.feature, a.code ?? 0))
      }
    for (const p of out) await this.t.send(p.reportId, p.data)
  }
}

export const x6Driver: DeviceDriver = {
  family: "x6",
  webhidFilters: [
    { vendorId: VENDOR_ID, productId: PRODUCT_DONGLE, usagePage: VENDOR_USAGE_PAGE },
    { vendorId: VENDOR_ID, productId: PRODUCT_CABLE, usagePage: VENDOR_USAGE_PAGE },
  ],
  matches: (vid, pid, pages) =>
    vid === VENDOR_ID && (pid === PRODUCT_DONGLE || pid === PRODUCT_CABLE) && pages.includes(VENDOR_USAGE_PAGE),
  open: async (t) => new X6Session(t),
}
