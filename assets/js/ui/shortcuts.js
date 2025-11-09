// shortcuts.js – global keyboard shortcuts
import { state, stateAPI } from "../state.js";

export function initShortcuts() {
  document.addEventListener("keydown", (e) => {
    const cmd = e.ctrlKey || e.metaKey;
    if (cmd && e.key === "\\") {
      e.preventDefault();
      stateAPI.setSplit(!state.uiState.split);
      window.dispatchEvent(new CustomEvent("ui:split-changed"));
    }
    if (cmd && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const side = e.key === "ArrowLeft" ? "left" : "right";
      const el = document.querySelector(`#input-${side}`);
      if (el) el.focus();
    }
    if (e.key === "Escape") {
      // close popups/modals via custom events
      window.dispatchEvent(new CustomEvent("ui:escape"));
    }
  });
}
