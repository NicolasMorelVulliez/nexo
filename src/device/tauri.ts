import { invoke } from "@tauri-apps/api/core"
import type { DeviceInfo, Transport } from "./transport"

/** Conecta a través del núcleo de Rust (hidapi). */
export async function connectTauri(): Promise<Transport> {
  const info = await invoke<DeviceInfo>("hid_open")
  return {
    kind: "tauri",
    info,
    send: (reportId, data) => invoke("hid_send", { reportId, data: Array.from(data) }),
    request: async (reportId, data, expect, timeoutMs = 1500) =>
      Uint8Array.from(await invoke<number[]>("hid_request", { reportId, data: Array.from(data), expect, timeoutMs })),
    close: async () => {},
    onDisconnect: () => {},
  }
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
