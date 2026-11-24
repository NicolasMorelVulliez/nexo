import { invoke } from "@tauri-apps/api/core"
import type { DeviceDriver } from "../devices/driver"
import { driverByFamily } from "../devices/registry"
import type { DeviceInfo, Transport } from "./transport"

/** Conecta a través del núcleo de Rust (hidapi). `prefer` elige la familia si hay varios mouses. */
export async function connectTauri(prefer?: string): Promise<{ transport: Transport; driver: DeviceDriver }> {
  const info = await invoke<DeviceInfo & { family: string }>("hid_open", { prefer: prefer ?? null })
  const driver = driverByFamily(info.family)
  if (!driver) throw new Error(`Mouse no soportado (${info.family})`)
  const transport: Transport = {
    kind: "tauri",
    info,
    send: (reportId, data) => invoke("hid_send", { reportId, data: Array.from(data) }),
    request: async (reportId, data, expect, timeoutMs = 1500) =>
      Uint8Array.from(await invoke<number[]>("hid_request", { reportId, data: Array.from(data), expect, timeoutMs })),
    read: async (timeoutMs) =>
      (await invoke<number[][]>("hid_read", { timeoutMs: Math.max(0, Math.round(timeoutMs)) })).map((r) => Uint8Array.from(r)),
    close: async () => {},
    onDisconnect: () => {},
  }
  return { transport, driver }
}

export interface AppInfo {
  portable: boolean
  version: string
}

export interface BatteryEvent {
  connected: boolean
  level: number | null
  charging: boolean
  cable: boolean
}
