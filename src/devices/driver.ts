// Contrato de un driver de mouse. Para sumar un modelo nuevo: implementar `DeviceDriver`
// en src/devices/<familia>.ts y agregarlo a registry.ts (y a la tabla de Rust en hid.rs).

import type { Transport } from "../device/transport"
import type { Capabilities, MouseState } from "../device/types"

export interface DriverIdentity {
  vendor: string
  product: string
  /** true si el nombre viene del firmware (no hace falta recordarlo ni editarlo) */
  fromDevice: boolean
}

export interface DeviceSession {
  readonly caps: Capabilities
  /** Nombre del mouse si el driver lo conoce (por ejemplo, porque el firmware lo informa). */
  identity(): DriverIdentity | null
  /** Lee el estado del mouse. Devuelve solo lo que el mouse informa. */
  read(): Promise<Partial<MouseState>>
  /** Escribe en el mouse lo que cambió entre `prev` y `next`. */
  apply(next: MouseState, prev: MouseState): Promise<void>
}

export interface DeviceDriver {
  readonly family: Capabilities["family"]
  /** Filtros para el selector de WebHID. */
  readonly webhidFilters: HIDDeviceFilter[]
  /** ¿Este driver maneja el dispositivo? (vid, pid y usagePages de sus colecciones) */
  matches(vid: number, pid: number, usagePages: number[]): boolean
  open(transport: Transport): Promise<DeviceSession>
}
