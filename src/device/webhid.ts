import { PRODUCT_CABLE, PRODUCT_DONGLE, VENDOR_ID, VENDOR_USAGE_PAGE } from "../protocol/x6"
import type { Transport } from "./transport"

const FILTERS: HIDDeviceFilter[] = [
  { vendorId: VENDOR_ID, productId: PRODUCT_DONGLE, usagePage: VENDOR_USAGE_PAGE },
  { vendorId: VENDOR_ID, productId: PRODUCT_CABLE, usagePage: VENDOR_USAGE_PAGE },
]

const matches = (d: HIDDevice) =>
  d.vendorId === VENDOR_ID &&
  (d.productId === PRODUCT_DONGLE || d.productId === PRODUCT_CABLE) &&
  d.collections.some((c) => c.usagePage === VENDOR_USAGE_PAGE)

/**
 * Conecta por WebHID. Con `interactive` muestra el selector del navegador (requiere un clic);
 * sin él, solo reutiliza un permiso ya otorgado (reconexión automática).
 */
export async function connectWebHid(interactive: boolean): Promise<Transport> {
  if (!("hid" in navigator)) throw new Error("Este navegador no soporta WebHID. Usá Chrome o Edge.")
  let devices = (await navigator.hid.getDevices()).filter(matches)
  if (!devices.length && interactive) devices = (await navigator.hid.requestDevice({ filters: FILTERS })).filter(matches)
  const dev = devices[0]
  if (!dev) throw new Error(interactive ? "No se eligió el mouse." : "Sin permiso guardado.")
  if (!dev.opened) await dev.open()

  const disconnectCbs: Array<() => void> = []
  navigator.hid.addEventListener("disconnect", (e) => {
    if (e.device === dev) disconnectCbs.forEach((cb) => cb())
  })

  return {
    kind: "webhid",
    info: {
      vid: dev.vendorId,
      pid: dev.productId,
      product: dev.productName ?? "",
      manufacturer: "",
      cable: dev.productId === PRODUCT_CABLE,
    },
    send: (reportId, data) => dev.sendReport(reportId, data as BufferSource),
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
          resolve(new Uint8Array(e.data.buffer.slice(e.data.byteOffset, e.data.byteOffset + e.data.byteLength)))
        }
        dev.addEventListener("inputreport", onReport)
        dev.sendReport(reportId, data as BufferSource).catch((err) => {
          window.clearTimeout(timer)
          dev.removeEventListener("inputreport", onReport)
          reject(err)
        })
      }),
    close: () => dev.close(),
    onDisconnect: (cb) => disconnectCbs.push(cb),
  }
}
