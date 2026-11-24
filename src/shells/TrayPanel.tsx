// Panel rápido de la bandeja: se abre con clic izquierdo en el ícono de batería (ventana "panel").
// Batería, DPI, polling y modo del mouse conectado, para cambiarlos sin abrir Nexo.
import { motion } from "motion/react"
import { useEffect } from "react"
import { panelUpdate } from "../device/panel"
import { useDeviceName, useStore } from "../device/store"
import { isTauri } from "../device/transport"
import { SPRING } from "../lib/util"
import { Button, Segmented } from "../ui/controls"
import { BatteryBar, BatteryGlyph } from "../ui/display"
import { AppIcon } from "../ui/Logo"

const kLabel = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("es-AR")}k` : String(v))
const hz = (r: number) => (r >= 1000 ? `${r / 1000}K` : String(r))

async function closePanel() {
  if (!isTauri()) return
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  getCurrentWindow().close()
}

async function openMain() {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  invoke("open_main").catch(() => {})
}

export function TrayPanel() {
  const name = useDeviceName()
  const mouse = useStore((s) => s.mouse)
  const caps = useStore((s) => s.caps)
  const connected = useStore((s) => s.connected)
  const status = useStore((s) => s.status)
  const error = useStore((s) => s.error)
  const wireless = caps.family === "x6" ? "Dongle 2.4 GHz" : "Receptor 2.4 GHz"
  const cable = mouse.connection === "cable"

  // ventana sin fondo: solo se ve la tarjeta
  useEffect(() => {
    document.documentElement.style.background = "transparent"
    document.body.style.background = "transparent"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && void closePanel()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="flex h-screen flex-col justify-end">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="m-2 flex flex-col rounded-[14px] border border-[var(--border)] bg-[var(--modal)] p-4"
        style={{ boxShadow: "0 12px 40px rgb(0 0 0 / .45)" }}
      >
        <div className="flex items-center gap-3">
          <AppIcon size={30} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14.5px] font-semibold">{name}</div>
            <div className="text-[12px] text-[var(--fg-3)]">
              {connected ? (cable ? "Cable USB" : wireless) : status === "connecting" ? "Conectando…" : "Sin mouse"}
            </div>
          </div>
          {connected && (
            <span className="ml-auto flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
              <span className="dot live" /> En línea
            </span>
          )}
        </div>

        {connected ? (
          <>
            <div className="mt-4 rounded-[10px] bg-[var(--surface-2)] px-4 py-3">
              <div className="flex items-end justify-between">
                {cable && !mouse.charging ? (
                  <span className="num text-[30px] leading-none">Cable</span>
                ) : (
                  <span className="num text-[38px] leading-none">
                    {mouse.battery}
                    <span className="text-[20px] text-[var(--fg-2)]">%</span>
                  </span>
                )}
                <span className="mb-1 flex items-center gap-2 text-[12.5px] text-[var(--fg-2)]">
                  {mouse.charging ? "Cargando" : "En uso"}
                  <BatteryGlyph level={mouse.battery} charging={mouse.charging} />
                </span>
              </div>
              <div className="mt-3">
                <BatteryBar level={cable ? 100 : mouse.battery} charging={mouse.charging} />
              </div>
            </div>

            <div className="mb-1.5 mt-4 text-[12.5px] text-[var(--fg-3)]">DPI</div>
            {mouse.dpiCount > 1 ? (
              <Segmented
                ariaLabel="Nivel de DPI"
                value={mouse.dpiSlot}
                onChange={(i) => panelUpdate({ dpiSlot: i })}
                options={mouse.dpi.slice(0, mouse.dpiCount).map((v, i) => ({ value: i, label: kLabel(v) }))}
              />
            ) : (
              <div className="text-[13px] text-[var(--fg-2)]">
                {mouse.dpi[0].toLocaleString("es-AR")} DPI · un solo nivel (agregá más desde Nexo)
              </div>
            )}

            <div className="mb-1.5 mt-4 text-[12.5px] text-[var(--fg-3)]">Polling rate</div>
            <Segmented
              ariaLabel="Polling rate"
              value={mouse.pollingIndex}
              onChange={(i) => panelUpdate({ pollingIndex: i })}
              options={caps.polling.map((r, i) => ({ value: i, label: hz(r) }))}
            />

            {(caps.powerModes.length > 0 || caps.esports) && (
              <>
                <div className="mb-1.5 mt-4 text-[12.5px] text-[var(--fg-3)]">Modo</div>
                {caps.powerModes.length > 0 ? (
                  <Segmented
                    ariaLabel="Modo de energía"
                    value={mouse.powerMode}
                    onChange={(i) => panelUpdate({ powerMode: i })}
                    options={caps.powerModes.map((p, i) => ({ value: i, label: p.label }))}
                  />
                ) : (
                  <Segmented
                    ariaLabel="Modo de rendimiento"
                    value={mouse.esports ? 1 : 0}
                    onChange={(i) => panelUpdate({ esports: i === 1 })}
                    options={[
                      { value: 0, label: "Básico" },
                      { value: 1, label: "eSports" },
                    ]}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--fg-2)]">
            {error ?? "Conectá el receptor 2.4 GHz o el cable USB del mouse."}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => void openMain()}>
            Abrir Nexo
          </Button>
          <Button onClick={() => void closePanel()}>Cerrar</Button>
        </div>
      </motion.div>
    </div>
  )
}
