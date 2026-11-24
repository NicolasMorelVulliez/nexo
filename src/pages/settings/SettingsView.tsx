import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import { isTauri } from "../../device/transport"
import { checkForUpdate, installUpdate } from "../../device/updates"
import { useDeviceName, useStore, type FontPreset, type ThemeMode } from "../../device/store"
import type { SettingsSection, Wallpaper } from "../../mockup/params"
import { FONT_PRESET_LABEL, FONT_STACKS, isFontAvailable, loadCustomFont } from "../../lib/fonts"
import { cn, SPRING } from "../../lib/util"
import { glassBackground, WALLPAPERS } from "../../shells/Backdrop"
import { DotField } from "../../ui/DotField"
import { Button, Card, Segmented, Slider, Stepper, Toggle } from "../../ui/controls"
import {
  IconArrowUpRight,
  IconCheck,
  IconChevronLeft,
  IconGear,
  IconImage,
  IconInfo,
  IconMoon,
  IconPalette,
  IconPlus,
  IconSun,
  IconType,
  IconUpload,
  IconX,
} from "../../ui/icons"
import { LogoMark } from "../../ui/Logo"
import { TrayIcon } from "../../ui/TrayIcon"
import type { TrayIconState } from "../../ui/trayIconDraw"

const NAV: { group: string; items: { id: SettingsSection; label: string; Icon: ComponentType<{ size?: number }> }[] }[] = [
  {
    group: "Personalización",
    items: [
      { id: "wallpapers", label: "Fondos", Icon: IconImage },
      { id: "appearance", label: "Apariencia", Icon: IconPalette },
    ],
  },
  {
    group: "Aplicación",
    items: [
      { id: "general", label: "General", Icon: IconGear },
      { id: "about", label: "Acerca de", Icon: IconInfo },
    ],
  },
]

const ACCENTS = [
  { value: "#ff7a1a", name: "Naranja" },
  { value: "#3b82f6", name: "Azul" },
  { value: "#8b5cf6", name: "Violeta" },
  { value: "#2fcb64", name: "Verde" },
  { value: "#ff4d4f", name: "Rojo" },
  { value: "#22d3ee", name: "Cian" },
]

export function SettingsView() {
  const s = useStore()
  return (
    <div className="relative flex h-full min-h-0 gap-5 px-4 pb-4 pt-1">
      <aside className="card sidebar w-[204px] shrink-0 p-2.5">
        <button
          type="button"
          onClick={s.closeSettings}
          className="flex items-center gap-1.5 rounded-[8px] border-0 bg-transparent px-3 py-2 text-[15px] text-[var(--fg-2)] hover:text-[var(--fg)]"
        >
          <IconChevronLeft size={16} /> Volver
        </button>
        {NAV.map((g) => (
          <div key={g.group} className="mt-4">
            <div className="px-3 pb-1.5 text-[12px] text-[var(--fg-3)]">{g.group}</div>
            {g.items.map(({ id, label, Icon }) => {
              const active = s.settingsSection === id
              return (
                <button
                  key={id}
                  type="button"
                  className="nav-item h-[40px] text-[14px]"
                  aria-current={active ? "page" : undefined}
                  onClick={() => s.setSettingsSection(id)}
                >
                  {active && <motion.span layoutId="settings-pill" className="nav-pill" transition={SPRING} />}
                  <span className="relative">
                    <Icon size={16} />
                  </span>
                  <span className="relative">{label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </aside>

      <div className="scroll relative min-w-0 flex-1 px-3 py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={s.settingsSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {s.settingsSection === "appearance" && <AppearancePage />}
            {s.settingsSection === "wallpapers" && <WallpapersPage />}
            {s.settingsSection === "general" && <GeneralPage />}
            {s.settingsSection === "about" && <AboutPage />}
          </motion.div>
        </AnimatePresence>
      </div>

      <FontDrawer />
    </div>
  )
}

function PageHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <header className="mb-6">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-1.5 text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
      <p className="mt-1 text-[13.5px] text-[var(--fg-3)]">{desc}</p>
    </header>
  )
}

function SettingRow({ label, desc, children }: { label: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[14px]">{label}</div>
        {desc && <div className="text-[12.5px] text-[var(--fg-3)]">{desc}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/* ───────────── Apariencia ───────────── */

function AppearancePage() {
  const s = useStore()
  const a = s.appearance
  const wpName = a.wallpaper === "custom" ? "Imagen propia" : (WALLPAPERS.find((w) => w.id === a.wallpaper)?.name ?? "Puntos animados")

  return (
    <>
      <PageHeader
        eyebrow="Un espacio que se siente tuyo"
        title="Apariencia"
        desc="Colores, fuentes y detalles de la interfaz de Nexo."
      />
      <div className="grid grid-cols-[1.55fr_1fr] gap-4">
        <Card>
          <Preview />
          <div className="mt-5 flex items-center justify-between">
            <div>
              <div className="text-[12px] text-[var(--fg-3)]">Fondo actual</div>
              <div className="text-[14.5px]">{wpName}</div>
            </div>
            <Button variant="ghost" onClick={() => s.setSettingsSection("wallpapers")}>
              Cambiar fondo <IconArrowUpRight size={14} />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SliderBox
              label="Desenfoque del fondo"
              value={a.wallBlur}
              disabled={a.wallpaper === "plain" || a.wallpaper === "glass"}
              onChange={(v) => s.setAppearance({ wallBlur: v })}
            />
            <SliderBox
              label="Brillo del fondo"
              value={a.wallBrightness}
              disabled={a.wallpaper === "plain"}
              onChange={(v) => s.setAppearance({ wallBrightness: v })}
            />
          </div>
          <button
            type="button"
            className="mt-4 self-start border-0 bg-transparent p-0 text-[13px] text-[var(--fg-3)] hover:text-[var(--fg)]"
            onClick={() => s.setAppearance({ wallpaper: "dots", wallBlur: 3, wallBrightness: 100 })}
          >
            Usar fondo predeterminado
          </button>
        </Card>

        <div className="flex flex-col gap-4">
          <Card icon={IconPalette} title="Modo de tema">
            <Segmented<ThemeMode>
              ariaLabel="Modo de tema"
              value={a.themeMode}
              onChange={(v) => s.setAppearance({ themeMode: v })}
              options={[
                { value: "light", label: <span className="flex items-center justify-center gap-1.5"><IconSun size={14} /> Claro</span> },
                { value: "dark", label: <span className="flex items-center justify-center gap-1.5"><IconMoon size={14} /> Oscuro</span> },
                { value: "system", label: "Sistema" },
              ]}
            />
          </Card>

          <Card title="Color de tema" desc="Se usa en los puntos de los botones, el degradé del polling y los destacados.">
            <div className="flex gap-2.5">
              {ACCENTS.map((c) => {
                const active = a.accent === c.value
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.name}
                    title={c.name}
                    onClick={() => s.setAppearance({ accent: c.value })}
                    className="grid h-8 w-8 place-items-center rounded-full border-0"
                    style={{
                      background: c.value,
                      boxShadow: active ? "0 0 0 2px var(--bg), 0 0 0 3.5px var(--fg)" : undefined,
                    }}
                  >
                    {active && <IconCheck size={14} style={{ color: "#fff" }} />}
                  </button>
                )
              })}
            </div>
          </Card>

          <Card
            icon={IconType}
            title="Fuente"
            actions={
              <Button size="sm" onClick={() => s.setFontDrawer(true)}>
                Configurar
              </Button>
            }
          >
            <FontSample />
            <div className="mt-3 text-[12.5px] text-[var(--fg-3)]">{FONT_PRESET_LABEL[a.font]}</div>
          </Card>
        </div>
      </div>
    </>
  )
}

function SliderBox({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-[10px] bg-[var(--surface-2)] px-4 py-3.5" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="flex justify-between text-[13px]">
        <span className="text-[var(--fg-2)]">{label}</span>
        <span className="tnum text-[var(--fg-3)]">{value}%</span>
      </div>
      <Slider ariaLabel={label} value={value} min={0} max={100} onChange={onChange} disabled={disabled} className="mt-3" />
    </div>
  )
}

function FontSample({ big }: { big?: boolean }) {
  return (
    <div className="grid place-items-center rounded-[10px] bg-[var(--surface-2)] py-5 text-center">
      <div className={cn("font-bold uppercase tracking-tight", big ? "text-[26px]" : "text-[22px]")}>Todo para jugar</div>
      <div className="text-[14px] text-[var(--fg-2)]">Hecho para tu mouse · 0123456789</div>
    </div>
  )
}

/** Fondo de muestra para un tipo de fondo (vista previa y tarjetas de Fondos). */
function WallpaperSample({ id, glassColor, image }: { id: Wallpaper; glassColor: string; image: string | null }) {
  if (id === "dots") return <div className="absolute inset-0 bg-[#0f0f0f]"><DotField spacing={11} maxRadius={2} reach={1.1} frequency={0.03} /></div>
  if (id === "glass") return <div className="absolute inset-0" style={{ background: glassBackground(glassColor) }} />
  if (id === "custom" && image)
    return <div className="absolute inset-0" style={{ background: `center / cover url("${image}")` }} />
  return <div className="absolute inset-0 bg-[var(--bg)]" />
}

/** Mini vista previa de la interfaz con el fondo y el tema actuales. */
function Preview() {
  const a = useStore((s) => s.appearance)
  const glassy = a.wallpaper === "glass" || a.wallpaper === "custom"
  return (
    <div className="relative h-[250px] overflow-hidden rounded-[12px] border border-[var(--border)]">
      <div
        className="absolute -inset-6"
        style={{ filter: `blur(${(a.wallBlur / 100) * 16}px) brightness(${0.25 + (a.wallBrightness / 100) * 0.75})` }}
      >
        <WallpaperSample id={a.wallpaper} glassColor={a.glassColor} image={a.customWallpaper} />
      </div>
      <div
        className="absolute left-1/2 top-1/2 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[var(--border)] p-4"
        style={{ background: glassy ? "rgb(255 255 255 / .06)" : "var(--surface)", backdropFilter: glassy ? "blur(14px)" : undefined }}
      >
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-[0.12em]">
            <LogoMark height={11} /> Nexo
          </span>
          <span className="text-[var(--fg-3)]">Ajustes</span>
        </div>
        <div className="mt-3 flex items-center gap-2.5 rounded-[8px] bg-[var(--surface-2)] px-3 py-3">
          <IconPalette size={16} />
          <span className="text-[13px] font-bold uppercase">Todo para jugar</span>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="h-2 flex-1 rounded-full bg-[var(--surface-3)]" />
          <span className="h-2 flex-1 rounded-full" style={{ background: "var(--gradient)" }} />
          <span className="h-2 flex-1 rounded-full bg-[var(--surface-3)]" />
        </div>
      </div>
    </div>
  )
}

/* ───────────── Selector de fuentes (panel lateral) ───────────── */

function FontDrawer() {
  const s = useStore()
  const open = s.fontDrawer
  const a = s.appearance
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<{ oppo: boolean; harmony: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    Promise.all([isFontAvailable("OPPO Sans 4.0"), isFontAvailable("HarmonyOS Sans SC")]).then(([oppo, harmony]) =>
      setInstalled({ oppo, harmony }),
    )
  }, [open])

  const choose = (font: FontPreset) => s.setAppearance({ font })

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-scrim z-[5]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => s.setFontDrawer(false)}
          />
          <motion.aside
            className="scroll absolute bottom-0 right-0 top-0 z-[6] w-[430px] border-l border-[var(--border)] bg-[var(--modal)] px-6 py-5"
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <button type="button" className="icon-btn -ml-2" aria-label="Cerrar" onClick={() => s.setFontDrawer(false)}>
              <IconX size={18} />
            </button>
            <h2 className="mt-2 text-[22px] font-bold">Fuente</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fg-2)]">
              Se aplica al instante en toda la interfaz. Las fuentes subidas se guardan solo en este dispositivo.
            </p>

            <div className="mt-5 text-[14px]">Preset</div>
            <div className="mt-2.5 flex flex-col gap-2">
              {(Object.keys(FONT_PRESET_LABEL) as FontPreset[]).map((p) => {
                const active = a.font === p
                const disabled = p === "custom" && !a.customFontName
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(p)}
                    className={cn(
                      "flex h-[48px] items-center justify-between rounded-[10px] border px-4 text-left text-[14px] transition-colors",
                      active ? "border-[var(--fg-3)] bg-[var(--surface-3)]" : "border-[var(--border)] bg-transparent hover:bg-[var(--surface-hover)]",
                      disabled && "opacity-45",
                    )}
                    style={{ fontFamily: FONT_STACKS[p] }}
                  >
                    <span>
                      {FONT_PRESET_LABEL[p]}
                      {p === "custom" && a.customFontName ? ` · ${a.customFontName}` : ""}
                    </span>
                    {active && <span className="text-[12px] text-[var(--fg-2)]">Seleccionada</span>}
                  </button>
                )
              })}
            </div>

            {installed && (
              <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                <FontStatus name="OPPO Sans 4.0" ok={installed.oppo} />
                <FontStatus name="HarmonyOS Sans" ok={installed.harmony} />
              </div>
            )}

            <div className="mt-5 rounded-[12px] bg-[var(--surface-2)] p-4">
              <div className="text-[14px]">Fuentes personalizadas</div>
              <input
                ref={input}
                type="file"
                accept=".woff2,.woff,.ttf,.otf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (!file) return
                  try {
                    setError(null)
                    const name = await loadCustomFont(file)
                    s.setAppearance({ customFontName: name, font: "custom" })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "No se pudo cargar la fuente.")
                  }
                }}
              />
              <Button variant="primary" className="mt-3" onClick={() => input.current?.click()}>
                <IconUpload size={15} /> Subir archivo de fuente
              </Button>
              <p className="mt-2.5 text-[12.5px] text-[var(--fg-3)]">Admite .woff2, .woff, .ttf y .otf, hasta 15 MB.</p>
              {error && <p className="mt-1.5 text-[12.5px] text-[var(--danger)]">{error}</p>}
            </div>

            <div className="divider my-5" />
            <p className="text-[13px] leading-relaxed text-[var(--fg-2)]">
              Asegurate de tener derecho a usar la fuente que subís. OPPO Sans y HarmonyOS Sans son gratuitas: si las
              instalás en Windows desde sus sitios oficiales, Nexo las usa automáticamente.
            </p>
            <div className="mt-5">
              <FontSample big />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function FontStatus({ name, ok }: { name: string; ok: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: "var(--surface-2)", color: ok ? "var(--success)" : "var(--fg-3)" }}
    >
      {ok ? <IconCheck size={12} /> : <span className="dot" />}
      {name}: {ok ? "instalada" : "no instalada (usando alternativa)"}
    </span>
  )
}

/* ───────────── Fondos ───────────── */

const GLASS_COLORS = [
  { value: "#050506", name: "Negro" },
  { value: "#18181b", name: "Grafito" },
  { value: "#0b1326", name: "Azul noche" },
  { value: "#170f26", name: "Violeta" },
  { value: "#0a1c17", name: "Verde" },
  { value: "#220b11", name: "Bordó" },
]

function WallpapersPage() {
  const s = useStore()
  const a = s.appearance
  const input = useRef<HTMLInputElement>(null)
  const pick = (id: Wallpaper) =>
    s.setAppearance({ wallpaper: id, wallBlur: id === "dots" ? 3 : id === "custom" ? Math.max(a.wallBlur, 20) : 0 })

  const tile = (id: Wallpaper, name: string, desc: string, onClick: () => void, extra?: ReactNode) => {
    const active = a.wallpaper === id
    return (
      <button key={id} type="button" onClick={onClick} className="group flex flex-col gap-2 border-0 bg-transparent p-0 text-left">
        <span
          className="relative block aspect-[16/10] w-full overflow-hidden rounded-[12px] border border-[var(--border)] transition-transform duration-300 group-hover:scale-[1.02]"
          style={{ boxShadow: active ? "0 0 0 2px var(--bg), 0 0 0 4px var(--fg)" : undefined }}
        >
          <WallpaperSample id={id} glassColor={a.glassColor} image={a.customWallpaper} />
          {extra}
          {active && (
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
              <IconCheck size={13} />
            </span>
          )}
        </span>
        <span className="leading-tight">
          <span className="block text-[14px]">{name}</span>
          <span className="block text-[12px] text-[var(--fg-3)]">{desc}</span>
        </span>
      </button>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Personalización"
        title="Fondos"
        desc="Puntos animados como en ATK, vidrio sobre un color liso a elección, o tu propia imagen (también GIF)."
      />
      <div className="grid grid-cols-4 gap-4">
        {WALLPAPERS.map((w) => tile(w.id, w.name, w.desc, () => pick(w.id)))}
        {tile(
          "custom",
          "Imagen propia",
          "JPG, PNG, WebP o GIF animado",
          () => (a.customWallpaper ? pick("custom") : input.current?.click()),
          !a.customWallpaper && (
            <span className="absolute inset-0 grid place-items-center border-2 border-dashed border-[var(--border-2)] text-[13px] text-[var(--fg-2)]" style={{ borderRadius: 12 }}>
              <span className="flex flex-col items-center gap-1.5">
                <IconUpload size={20} /> Subir imagen
              </span>
            </span>
          ),
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            if (a.customWallpaper) URL.revokeObjectURL(a.customWallpaper)
            s.setAppearance({ wallpaper: "custom", customWallpaper: URL.createObjectURL(file), wallBlur: Math.max(a.wallBlur, 20) })
          }}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Card
          title="Color del vidrio"
          desc="Fondo de un solo color, apenas difuminado. Las tarjetas se vuelven de vidrio encima."
        >
          <div className="flex flex-wrap items-center gap-2.5">
            {GLASS_COLORS.map((c) => {
              const active = a.glassColor.toLowerCase() === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  aria-label={`Vidrio ${c.name}`}
                  onClick={() => s.setAppearance({ glassColor: c.value, wallpaper: "glass", wallBlur: 0 })}
                  className="h-9 w-9 rounded-full border-0"
                  style={{
                    background: glassBackground(c.value),
                    boxShadow: active
                      ? "0 0 0 2px var(--bg), 0 0 0 3.5px var(--fg)"
                      : "inset 0 0 0 1px var(--border-2)",
                  }}
                />
              )
            })}
            <label
              className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full"
              title="Color personalizado"
              style={{ background: "conic-gradient(#ff4d4f, #f5b334, #2fcb64, #22d3ee, #3d6bd6, #b05cff, #ff4d4f)" }}
            >
              <IconPlus size={15} style={{ color: "#fff", filter: "drop-shadow(0 0 2px #000)" }} />
              <input
                type="color"
                aria-label="Color personalizado del vidrio"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={a.glassColor}
                onChange={(e) => s.setAppearance({ glassColor: e.target.value, wallpaper: "glass", wallBlur: 0 })}
              />
            </label>
            <input
              aria-label="Color HEX del vidrio"
              className="field ml-1 w-[104px] uppercase"
              defaultValue={a.glassColor}
              key={a.glassColor}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (/^#?[0-9a-f]{6}$/i.test(v)) s.setAppearance({ glassColor: v.startsWith("#") ? v : `#${v}`, wallpaper: "glass", wallBlur: 0 })
              }}
            />
          </div>
        </Card>
        <Card
          title="Puntos animados"
          desc="Semitono en movimiento desde una esquina. Se pausa solo cuando la ventana no está visible y queda quieto con «Reducir animaciones»."
        >
          <div className="flex items-center justify-between text-[13px] text-[var(--fg-2)]">
            <span>Ajustá el desenfoque y el brillo en Apariencia.</span>
            <Button size="sm" onClick={() => s.setSettingsSection("appearance")}>
              Apariencia <IconArrowUpRight size={13} />
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}


/* ───────────── General ───────────── */

function GeneralPage() {
  const s = useStore()
  const app = s.app
  // Estado real de "Iniciar con Windows" en la app de escritorio
  useEffect(() => {
    if (!isTauri() || app.installMode === "portable") return
    import("@tauri-apps/plugin-autostart").then(({ isEnabled }) => isEnabled()).then((on) => s.setApp({ autostart: on })).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const setAutostart = async (v: boolean) => {
    s.setApp({ autostart: v })
    if (!isTauri()) return
    const { enable, disable } = await import("@tauri-apps/plugin-autostart")
    await (v ? enable() : disable()).catch(() => s.setApp({ autostart: !v }))
  }
  const desktop = s.shell === "desktop"
  const cable = s.mouse.connection === "cable"
  const wireless = s.caps.family === "x6" ? "Dongle 2.4 GHz" : "Receptor 2.4 GHz"
  const gallery: { label: string; st: Omit<TrayIconState, "style"> }[] = [
    { label: "100%", st: { level: 100, charging: false, cable: false } },
    { label: "78%", st: { level: 78, charging: false, cable: false } },
    { label: "45%", st: { level: 45, charging: false, cable: false } },
    { label: "12%", st: { level: 12, charging: false, cable: false } },
    { label: "Carga", st: { level: 64, charging: true, cable: false } },
    { label: "Cable", st: { level: null, charging: false, cable: true } },
    { label: "Sin mouse", st: { level: null, charging: false, cable: false } },
  ]
  return (
    <>
      <PageHeader eyebrow="Aplicación" title="General" desc="Bandeja del sistema, inicio con Windows y avisos." />
      <div className="grid grid-cols-2 gap-4">
        <Card title="Ícono de batería en la barra de tareas" desc={desktop ? undefined : "Disponible en la app de escritorio."}>
          <SettingRow label="Estilo">
            <Segmented
              ariaLabel="Estilo del ícono"
              value={app.trayStyle}
              onChange={(v) => s.setApp({ trayStyle: v })}
              options={[
                { value: "bg", label: "Con fondo" },
                { value: "nobg", label: "Sin fondo" },
              ]}
            />
          </SettingRow>
          <div className="mt-3 grid grid-cols-7 gap-1 rounded-[10px] bg-[#1c1c1e] px-2 py-3">
            {gallery.map((g) => (
              <div key={g.label} className="flex flex-col items-center gap-1.5">
                <TrayIcon size={32} state={{ ...g.st, style: app.trayStyle }} />
                <TrayIcon size={16} state={{ ...g.st, style: app.trayStyle }} />
                <span className="text-[10.5px] text-white/50">{g.label}</span>
              </div>
            ))}
          </div>
          <SettingRow label="Consultar batería cada">
            <Segmented
              ariaLabel="Intervalo"
              value={app.pollSeconds}
              onChange={(v) => s.setApp({ pollSeconds: v })}
              options={[
                { value: 30, label: "30 s" },
                { value: 60, label: "1 min" },
                { value: 300, label: "5 min" },
              ]}
            />
          </SettingRow>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Inicio y cierre">
            <SettingRow label="Iniciar con Windows" desc={desktop ? "Arranca minimizada en la bandeja." : "Solo en la app de escritorio."}>
              <Toggle
                label="Iniciar con Windows"
                checked={desktop && app.autostart}
                disabled={!desktop || app.installMode === "portable"}
                onChange={(v) => void setAutostart(v)}
              />
            </SettingRow>
            <SettingRow label="Cerrar a la bandeja" desc="La ventana se cierra y la batería sigue visible.">
              <Toggle label="Cerrar a la bandeja" checked={desktop && app.closeToTray} disabled={!desktop} onChange={(v) => s.setApp({ closeToTray: v })} />
            </SettingRow>
          </Card>
          <Card title="Avisos y accesibilidad">
            <SettingRow label="Aviso de batería baja">
              <Stepper
                ariaLabel="Aviso de batería baja"
                value={app.lowBattery}
                min={5}
                max={50}
                step={5}
                onChange={(v) => s.setApp({ lowBattery: v })}
                format={(v) => `${v}%`}
              />
            </SettingRow>
            <SettingRow label="Reducir animaciones">
              <Toggle label="Reducir animaciones" checked={app.reduceMotion} onChange={(v) => s.setApp({ reduceMotion: v })} />
            </SettingRow>
            <SettingRow label="Estado del dispositivo">
              <span className="text-[13px] text-[var(--fg-2)]">{cable ? "Cable USB" : wireless}</span>
            </SettingRow>
          </Card>
        </div>
      </div>
    </>
  )
}

/* ───────────── Acerca de ───────────── */

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, "0")

function AboutPage() {
  const s = useStore()
  const name = useDeviceName()
  const desktop = s.shell === "desktop"
  const cable = s.mouse.connection === "cable"
  const wireless = s.caps.family === "x6" ? "Dongle 2.4 GHz" : "Receptor 2.4 GHz"
  return (
    <>
      <PageHeader eyebrow="Aplicación" title="Acerca de" desc="Versión, dispositivo y créditos." />
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <Card>
          <div className="flex items-center gap-5">
            <span className="grid h-[84px] w-[84px] place-items-center rounded-[22px] bg-[#0f0f0f] text-white ring-1 ring-white/10">
              <LogoMark height={36} />
            </span>
            <div>
              <div className="text-[24px] font-bold">Nexo</div>
              <div className="text-[13.5px] text-[var(--fg-2)]">
                Versión 0.3.0 · {desktop ? (s.app.installMode === "installed" ? "Instalada" : "Portable") : "Web"}
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            {!desktop ? (
              <span className="text-[13px] text-[var(--fg-2)]">La versión web se actualiza sola.</span>
            ) : s.appUpdate ? (
              <Button variant="primary" disabled={s.updateState === "installing"} onClick={() => void installUpdate()}>
                {s.updateState === "installing" ? "Actualizando…" : `Instalar la versión ${s.appUpdate.version}`}
              </Button>
            ) : (
              <Button variant="primary" disabled={s.updateState === "checking"} onClick={() => void checkForUpdate()}>
                {s.updateState === "checking" ? "Buscando…" : "Buscar actualizaciones"}
              </Button>
            )}
            {desktop && s.updateState === "uptodate" && !s.appUpdate && (
              <span className="text-[13px] text-[var(--fg-2)]">Estás en la última versión.</span>
            )}
            {desktop && s.updateState === "error" && (
              <span className="text-[13px] text-[var(--danger)]">No se pudo consultar GitHub.</span>
            )}
          </div>
        </Card>
        <Card title="Dispositivo">
          <SettingRow
            label="Modelo"
            desc={
              s.identity.source === "firmware"
                ? "Informado por el mouse"
                : s.identity.source === "cable"
                ? "Leído del mouse (cable USB)"
                : s.identity.source === "recordado"
                  ? "Guardado · podés corregirlo"
                  : "Por el dongle no se lee el modelo: escribilo o conectalo una vez por cable"
            }
          >
            <input
              aria-label="Nombre del modelo"
              readOnly={s.identity.source === "firmware"}
              className="field w-[190px] text-left"
              defaultValue={name}
              key={name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (!v || v === name) return
                const [vendor, ...rest] = v.split(/\s+/)
                if (rest.length) s.setIdentityName(vendor, rest.join(" "))
                else s.setIdentityName(s.identity.vendor, vendor)
              }}
            />
          </SettingRow>
          <SettingRow label="USB">
            <span className="tnum text-[var(--fg-2)]">{hex4(s.identity.vid)}:{hex4(s.identity.pid)}</span>
          </SettingRow>
          <SettingRow label="Conexión">
            <span className="text-[var(--fg-2)]">{cable ? "Cable USB" : wireless}</span>
          </SettingRow>
        </Card>
        <Card title="Créditos" className="col-span-2">
          <p className="text-[13px] leading-relaxed text-[var(--fg-2)]">
            Protocolo del X6 basado en X6-Utilities de jchu634 (MIT) y la documentación de keshuac.com (CC BY 4.0).
            Protocolo RAWM obtenido por ingeniería inversa del configurador web oficial, por interoperabilidad. Números en
            D-DIN (Datto, SIL OFL 1.1). Proyecto no oficial, sin relación con Motospeed, RAWM ni ATK.
          </p>
        </Card>
      </div>
    </>
  )
}
