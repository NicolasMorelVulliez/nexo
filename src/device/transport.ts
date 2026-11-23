// Transporte HID: WebHID (navegador) o comandos de Rust (app de escritorio).
// Los datos van siempre SIN el byte de report ID.

export interface DeviceInfo {
  vid: number
  pid: number
  product: string
  manufacturer: string
  cable: boolean
}

export interface Transport {
  kind: "webhid" | "tauri"
  info: DeviceInfo
  send(reportId: number, data: Uint8Array): Promise<void>
  /** Envía un reporte y espera la respuesta con `expect` como report ID. */
  request(reportId: number, data: Uint8Array, expect: number, timeoutMs?: number): Promise<Uint8Array>
  close(): Promise<void>
  /** Se llama si el dispositivo se desconecta (solo WebHID lo detecta al instante). */
  onDisconnect(cb: () => void): void
}

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
export const hasWebHid = () => typeof navigator !== "undefined" && "hid" in navigator
