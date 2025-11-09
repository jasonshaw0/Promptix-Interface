// modals.js – large modal open/close with focus trap and Esc
import { $, $$, hide, show, focusTrap } from "../utils/dom.js";

let trapCleanup = null;

export function openModal(id) {
  const modal = $(id.startsWith("#") ? id : `#${id}`);
  if (!modal) return () => { };

  modal.setAttribute("aria-hidden", "false");
  const dialog = $(".modal__dialog", modal);
  const closeBtns = $$(".js-close-modal", modal);
  const backdrop = $(".modal__backdrop", modal);

  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  function close() {
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKey);
    closeBtns.forEach((b) => b.removeEventListener("click", close));
    if (backdrop) backdrop.removeEventListener("click", close);
    trapCleanup && trapCleanup();
  }

  closeBtns.forEach((b) => b.addEventListener("click", close));
  if (backdrop) {
    backdrop.addEventListener("click", close);
  }
  document.addEventListener("keydown", onKey);
  trapCleanup = focusTrap(dialog);

  // Focus first focusable element
  setTimeout(() => {
    const first = dialog?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, 0);

  return close;
}
