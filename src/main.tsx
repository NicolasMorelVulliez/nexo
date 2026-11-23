import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import { startLive } from "./device/live"
import "./styles/app.css"

startLive()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
