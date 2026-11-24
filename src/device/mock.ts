import type { MouseState } from "./types"

/** Estado simulado del mouse (modo demo / mockup, sin hardware). */
export function createMockMouse(overrides: Partial<MouseState> = {}): MouseState {
  return {
    battery: 78,
    charging: false,
    connection: "dongle",
    dpi: [400, 800, 1600, 3200, 6400],
    dpiSlot: 2,
    dpiCount: 5,
    pollingIndex: 2,
    liftOff: "low",
    motionSync: true,
    angleSnap: false,
    ripple: true,
    esports: false,
    powerMode: 2,
    scrollForward: true,
    debounceMs: 4,
    sleepSec: 300,
    light: { mode: "breath", color: { r: 122, g: 92, b: 255 }, brightness: 200, speed: 150, autoOff: true },
    remaps: {
      left: "left-click",
      right: "right-click",
      middle: "middle-click",
      side1: "forward",
      side2: "back",
      dpi: "dpi-loop",
    },
    ...overrides,
  }
}

export const DEFAULT_REMAPS = createMockMouse().remaps
