// Drivers disponibles. El orden importa solo si dos drivers reclamaran el mismo dispositivo.

import type { DeviceDriver } from "./driver"
import { rawmDriver } from "./rawm"
import { x6Driver } from "./x6"

export const DRIVERS: DeviceDriver[] = [x6Driver, rawmDriver]

export const WEBHID_FILTERS: HIDDeviceFilter[] = DRIVERS.flatMap((d) => d.webhidFilters)

export function findDriver(vid: number, pid: number, usagePages: number[]) {
  return DRIVERS.find((d) => d.matches(vid, pid, usagePages))
}

export function driverByFamily(family: string) {
  return DRIVERS.find((d) => d.family === family)
}
