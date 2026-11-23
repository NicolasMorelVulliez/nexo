import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { ACTION_BY_ID, actionsIn, type ActionCategory } from "../device/actions"
import { useStore } from "../device/store"
import { BUTTON_LABEL, BUTTON_ORDER, type ButtonId } from "../device/types"
import { Button, Card, OptionButton, Segmented } from "../ui/controls"
import { IconBan, IconHand, IconUndo } from "../ui/icons"
import { MouseBox } from "../ui/MouseBox"
import { fitMouse, MouseStage } from "../ui/MouseStage"

const CATEGORIES: { value: ActionCategory; label: string }[] = [
  { value: "mouse", label: "Mouse" },
  { value: "media", label: "Multimedia" },
  { value: "system", label: "Sistema" },
  { value: "dpi", label: "DPI" },
  { value: "rgb", label: "Luz" },
]

export function ButtonsPage() {
  const mouse = useStore((s) => s.mouse)
  const selected = useStore((s) => s.selectedButton)
  const selectButton = useStore((s) => s.selectButton)
  const setRemap = useStore((s) => s.setRemap)
  const resetRemaps = useStore((s) => s.resetRemaps)
  const current = ACTION_BY_ID[mouse.remaps[selected]]
  const [category, setCategory] = useState<ActionCategory>(
    current && current.category !== "other" ? current.category : "mouse",
  )

  const labels = Object.fromEntries(
    BUTTON_ORDER.map((b) => [b, ACTION_BY_ID[mouse.remaps[b]]?.label ?? "—"]),
  ) as Record<ButtonId, string>

  return (
    <div className="grid h-full grid-cols-[1fr_360px] gap-5">
      <div className="flex min-h-0 flex-col">
        <MouseBox
          className="flex-1"
          render={(box) => (
            <MouseStage
              height={fitMouse(box, true, 560)}
              labels={labels}
              selected={selected}
              onSelect={(b) => {
                selectButton(b)
                const cat = ACTION_BY_ID[mouse.remaps[b]]?.category
                if (cat && cat !== "other") setCategory(cat)
              }}
            />
          )}
        />
        <div className="flex justify-center pb-2 pt-3">
          <Button onClick={resetRemaps}>
            <IconUndo size={14} /> Restaurar predeterminado
          </Button>
        </div>
      </div>

      <Card
        icon={IconHand}
        title={
          <span>
            Asignar a <span className="text-[var(--accent)]">{BUTTON_LABEL[selected]}</span>
          </span>
        }
        desc={`Acción actual: ${current?.label ?? "—"}`}
        className="h-full"
      >
        <Segmented
          ariaLabel="Categoría"
          value={category}
          onChange={setCategory}
          options={CATEGORIES}
          className="mb-3"
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={category}
            className="scroll -mr-2 grid min-h-0 flex-1 auto-rows-[38px] grid-cols-2 content-start gap-2 pr-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {actionsIn(category).map((a) => (
              <OptionButton
                key={a.id}
                variant="mode"
                group="remap"
                pressed={mouse.remaps[selected] === a.id}
                onClick={() => setRemap(selected, a.id)}
                className="h-[38px]"
              >
                <span className="truncate">{a.label}</span>
              </OptionButton>
            ))}
          </motion.div>
        </AnimatePresence>
        <div className="divider my-3" />
        <OptionButton
          variant="mode"
          group="remap"
          pressed={mouse.remaps[selected] === "disable"}
          onClick={() => setRemap(selected, "disable")}
          className="h-[38px] justify-center text-[var(--danger)]"
        >
          <IconBan size={15} />
          <span>Desactivar botón</span>
        </OptionButton>
      </Card>
    </div>
  )
}
