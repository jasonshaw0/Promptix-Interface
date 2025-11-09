// popups.js – small anchored popups manager
import { $, hide, show, portalTo } from "../utils/dom.js";

function withinViewport(x, y, w, h) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const nx = Math.min(Math.max(8, x), vw - w - 8);
  const ny = Math.min(Math.max(8, y), vh - h - 8);
  return { x: nx, y: ny };
}

export class PopupManager {
  constructor() {
    this.current = null;
    this.onDocClick = this.onDocClick.bind(this);
  }

  // options: { container?: Element }
  showNear(id, anchor, offset = { x: 0, y: 8 }, placement = 'bottom', options = {}) {
    if (this.current && this.current.anchor === anchor) {
      this.hide();
      return;
    }
    this.hide();

    const el = document.querySelector(id);
    if (!el || !anchor) return;

    const content = el.content.cloneNode(true);
    const popupEl = content.querySelector('.popover');
    if (!popupEl) return;

    // Append to target container or body
    const container = options.container || document.body;
    container.appendChild(popupEl);

    // Compute position relative to container
    const anchorRect = anchor.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Temporarily show to measure
    popupEl.style.visibility = 'hidden';
    popupEl.style.display = 'block';
    const popupRect = popupEl.getBoundingClientRect();

    // Center horizontally above/below the anchor
    let left = anchorRect.left - containerRect.left + (anchorRect.width - popupRect.width) / 2 + offset.x;
    let top;
    if (placement === 'top') {
      top = anchorRect.top - containerRect.top - popupRect.height - offset.y;
    } else {
      top = anchorRect.bottom - containerRect.top + offset.y;
    }

    // Constrain within container bounds with small padding
    const pad = 8;
    const maxLeft = containerRect.width - popupRect.width - pad;
    const maxTop = containerRect.height - popupRect.height - pad;
    left = Math.max(pad, Math.min(maxLeft, left));
    top = Math.max(pad, Math.min(maxTop, top));

    popupEl.style.left = `${left}px`;
    popupEl.style.top = `${top}px`;
    popupEl.dataset.placement = placement;
    popupEl.dataset.open = 'true';
    popupEl.style.visibility = '';
    popupEl.style.display = '';

    this.current = { el: popupEl, anchor };
    // Notify listeners so they can wire up interactions for this popup
    document.dispatchEvent(new CustomEvent('popup:open', { detail: { id, el: popupEl, anchor, placement, container } }));
    setTimeout(() => document.addEventListener('mousedown', this.onDocClick), 0);
  }

  onDocClick(e) {
    if (!this.current) return;
    if (!this.current.el.contains(e.target) && !this.current.anchor.contains(e.target)) {
      this.hide();
    }
  }

  hide() {
    if (this.current) {
      hide(this.current.el);
      this.current.el.remove();
    }
    this.current = null;
    document.removeEventListener('mousedown', this.onDocClick);
  }
}
