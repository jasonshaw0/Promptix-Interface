// dom.js – DOM utility helpers

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) =>
  Array.from(root.querySelectorAll(sel));

export function el(tag, cls, attrs) {
  const e = document.createElement(tag);
  if (cls) {
    if (Array.isArray(cls)) e.classList.add(...cls);
    else e.classList.add(cls);
  }
  if (attrs)
    Object.entries(attrs).forEach(([k, v]) => {
      if (v != null) e.setAttribute(k, v);
    });
  return e;
}

export function show(node) {
  node?.setAttribute("aria-hidden", "false");
}
export function hide(node) {
  node?.setAttribute("aria-hidden", "true");
}

export function portalTo(node, x, y) {
  if (!node) return;
  node.style.left = x + "px";
  node.style.top = y + "px";
}

export function focusTrap(modal) {
  const FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  const nodes = $$(FOCUSABLE, modal);
  if (!nodes.length) return () => { };
  function handler(e) {
    if (e.key === "Tab") {
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  modal.addEventListener("keydown", handler);
  return () => modal.removeEventListener("keydown", handler);
}
