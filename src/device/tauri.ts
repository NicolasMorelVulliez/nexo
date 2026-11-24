import { invoke } from "@tauri-apps/api/core"
import type { DeviceDriver } from "../devices/driver"
import { driverByFamily } from "../devices/registry"
import type { DeviceInfo, Transport } from "./transport"

type Found = { transport: Transport; driver: DeviceDriver }

/** Transporte hacia un mouse abierto por el núcleo de Rust (hidapi). Cada comando indica la familia. */
function tauriTransport(info: DeviceInfo & { family: string }): Transport {
  const family = info.family
  return {
    kind: "tauri",
    info,
    send: (reportId, data) => invoke("hid_send", { family, reportId, data: Array.from(data) }),
    request: async (reportId, data, expect, timeoutMs = 1500) =>
      Uint8Array.from(await invoke<number[]>("hid_request", { family, reportId, data: Array.from(data), expect, timeoutMs })),
    read: async (timeoutMs) =>
      (await invoke<number[][]>("hid_read", { family, timeoutMs: Math.max(0, Math.round(timeoutMs)) })).map((r) => Uint8Array.from(r)),
    close: async () => {},
    onDisconnect: () => {},
  }
}

/** Abre todos los mouses conectados (uno por familia). */
export async function connectTauriAll(): Promise<Found[]> {
  const infos = await invoke<(DeviceInfo & { family: string })[]>("hid_open_all")
  return infos.flatMap((info) => {
    const driver = driverByFamily(info.family)
    return driver ? [{ transport: tauriTransport(info), driver }] : []
  })
}

export interface AppInfo {
  portable: boolean
  version: string
}

export interface BatteryEvent {
  family: string
  connected: boolean
  level: number | null
  charging: boolean
  cable: boolean
}
