import type { DeviceDriver } from "../devices/driver"
import { RAWM_RECEIVER_PIDS } from "../devices/rawm-models"
import { findDriver, WEBHID_FILTERS } from "../devices/registry"
import { InputQueue, type Transport } from "./transport"

const pagesOf = (d: HIDDevice) => d.collections.map((c) => c.usagePage ?? 0)
const driverOf = (d: HIDDevice) => findDriver(d.vendorId, d.productId, pagesOf(d))
const isReceiver = (d: HIDDevice) => d.vendorId === 0x1915 && RAWM_RECEIVER_PIDS.includes(d.productId)

/** Mouses compatibles con permiso ya otorgado en este navegador. */
export async function grantedDevices() {
  if (!("hid" in navigator)) return []
  return (await navigator.hid.getDevices()).filter((d) => driverOf(d))
}

/**
 * Conecta por WebHID. Con `interactive` muestra el selector del navegador (requiere un clic);
 * sin él, solo reutiliza un permiso ya otorgado (reconexión automática).
 * `prefer` elige la familia si hay más de un mouse compatible conectado.
 */
export async function connectWebHid(interactive: boolean, prefer?: string): Promise<{ transport: Transport; driver: DeviceDriver }> {
  if (!("hid" in navigator)) throw new Error("Este navegador no soporta WebHID. Usá Chrome o Edge.")
  let devices = interactive ? [] : await grantedDevices()
  if (interactive) devices = (await navigator.hid.requestDevice({ filters: WEBHID_FILTERS })).filter((d) => driverOf(d))
  // si el mouse está por cable y además está el receptor, el que responde es el cable
  devices.sort((a, b) => Number(isReceiver(a)) - Number(isReceiver(b)))
  const dev = devices.find((d) => driverOf(d)?.family === prefer) ?? devices[0]
  if (!dev) throw new Error(interactive ? "No se eligió el mouse." : "Sin permiso guardado.")
  const driver = driverOf(dev)!
  if (!dev.opened) await dev.open()

  const disconnectCbs: Array<() => void> = []
  navigator.hid.addEventListener("disconnect", (e) => {
    if (e.device === dev) disconnectCbs.forEach((cb) => cb())
  })

  const queue = new InputQueue()
  const copy = (v: DataView) => new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))
  dev.addEventListener("inputreport", (e) => {
    if (e.reportId === 0) queue.push(copy(e.data))
  })

  const transport: Transport = {
    kind: "webhid",
    info: {
      vid: dev.vendorId,
      pid: dev.productId,
      product: dev.productName ?? "",
      manufacturer: "",
      cable: driver.family === "x6" && dev.productId === 0xfff1,
      usagePage: pagesOf(dev).find((p) => p >= 0xff00) ?? 0,
    },
    send: (reportId, data) => {
      queue.mark()
      return dev.sendReport(reportId, data as BufferSource)
    },
    request: (reportId, data, expect, timeoutMs = 1500) =>
      new Promise<Uint8Array>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          dev.removeEventListener("inputreport", onReport)
          reject(new Error("El mouse no respondió (¿está dormido o apagado?)"))
        }, timeoutMs)
        function onReport(e: HIDInputReportEvent) {
          if (e.reportId !== expect) return
          window.clearTimeout(timer)
          dev.removeEventListener("inputreport", onReport)
          resolve(copy(e.data))
        }
        dev.addEventListener("inputreport", onReport)
        dev.sendReport(reportId, data as BufferSource).catch((err) => {
          window.clearTimeout(timer)
          dev.removeEventListener("inputreport", onReport)
          reject(err)
        })
      }),
    read: (timeoutMs) => queue.take(timeoutMs),
    close: () => dev.close(),
    onDisconnect: (cb) => disconnectCbs.push(cb),
  }
  return { transport, driver }
}
