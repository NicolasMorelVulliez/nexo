import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import { startLive } from "./device/live"
import { startPanel } from "./device/panel"
import { isTauri } from "./device/transport"
import { params } from "./mockup/params"
import "./styles/app.css"

if (params.panel) {
  if (isTauri()) void startPanel()
} else startLive()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
