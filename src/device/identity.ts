// Identidad del dispositivo: de dónde sale el nombre que muestra la app.
//
// Con WebHID (HIDDevice.productName) o hidapi (product_string / manufacturer_string)
// se lee el nombre que reporta el firmware:
//   - Por cable, el X6 se presenta con su fabricante y modelo reales
//     (según el autor del protocolo: "MOTOSPEED" - "X6"; un X6 Max reporta su variante).
//   - Por el dongle 2.4 GHz se presenta como el receptor ("Dongle 8K"), que no dice el modelo.
// Por eso el nombre real se recuerda la primera vez que el mouse se conecta por cable y
// se reutiliza cuando se usa con el dongle. Si nunca se conectó por cable, se usa el
// nombre por defecto y el usuario puede corregirlo.

export interface DeviceIdentity {
  vendor: string
  product: string
  vid: number
  pid: number
  /** de dónde salió el nombre */
  source: "cable" | "recordado" | "por defecto"
}

/** Nombres genéricos de receptores que no identifican el modelo. */
const GENERIC_PRODUCTS = [/dongle/i, /receiver/i, /receptor/i, /^usb/i, /wireless/i]

const titleCase = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/(^|\s|-)\p{L}/gu, (m) => m.toUpperCase())

/** Normaliza lo que reporta el firmware ("MOTOSPEED" / "X6 MAX") a algo presentable. */
export function normalizeIdentity(manufacturer: string, product: string) {
  const vendor = titleCase(manufacturer || "Motospeed")
  const prod = product.trim().replace(new RegExp(`^${vendor}\\s*`, "i"), "")
  const pretty = prod.replace(/\b(x\d+)\b/gi, (m) => m.toUpperCase()).replace(/\bmax\b/gi, "Max").replace(/\bpro\b/gi, "Pro")
  return { vendor, product: pretty || "X6" }
}

export function isGenericProduct(product: string) {
  return GENERIC_PRODUCTS.some((re) => re.test(product))
}

export function displayName(id: Pick<DeviceIdentity, "vendor" | "product">) {
  return `${id.vendor} ${id.product}`
}
