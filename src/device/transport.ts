// Transporte HID: WebHID (navegador) o comandos de Rust (app de escritorio).
// Los datos van siempre SIN el byte de report ID (los dispositivos sin IDs usan reportId 0).

export interface DeviceInfo {
  vid: number
  pid: number
  product: string
  manufacturer: string
  cable: boolean
  /** usagePage de la colección abierta */
  usagePage: number
}

export interface Transport {
  kind: "webhid" | "tauri"
  info: DeviceInfo
  send(reportId: number, data: Uint8Array): Promise<void>
  /** Envía un reporte y espera la respuesta con `expect` como report ID. */
  request(reportId: number, data: Uint8Array, expect: number, timeoutMs?: number): Promise<Uint8Array>
  /**
   * Devuelve los reportes de entrada que llegaron desde la última lectura o el último envío,
   * esperando hasta `timeoutMs` si todavía no llegó ninguno. Los reportes idénticos seguidos se
   * descartan (algunos receptores repiten el mismo estado cientos de veces por segundo).
   */
  read(timeoutMs: number): Promise<Uint8Array[]>
  close(): Promise<void>
  /** Se llama si el dispositivo se desconecta (solo WebHID lo detecta al instante). */
  onDisconnect(cb: () => void): void
}

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
export const hasWebHid = () => typeof navigator !== "undefined" && "hid" in navigator

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Cola de reportes de entrada con descarte de repetidos (para implementar `read` sobre eventos).
 * `mark()` se llama en cada envío: el primer reporte posterior siempre pasa, aunque sea igual.
 */
export class InputQueue {
  private items: Uint8Array[] = []
  private last: Uint8Array | null = null
  private waiters: Array<() => void> = []
  private readonly max: number

  constructor(max = 512) {
    this.max = max
  }

  push(r: Uint8Array) {
    if (this.last && sameBytes(this.last, r)) return
    this.last = r
    this.items.push(r)
    if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max)
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f())
  }

  mark() {
    this.last = null
  }

  async take(timeoutMs: number): Promise<Uint8Array[]> {
    if (!this.items.length && timeoutMs > 0) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(done, timeoutMs)
        function done() {
          clearTimeout(t)
          resolve()
        }
        this.waiters.push(done)
      })
    }
    const out = this.items
    this.items = []
    return out
  }
}
