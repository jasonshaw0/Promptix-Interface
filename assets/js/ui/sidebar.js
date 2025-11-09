// sidebar.js – manage chat history list & hover menu
import { $, $$, el } from "../utils/dom.js";
import { state, stateAPI } from "../state.js";

function sortChats(chats) {
  return [...chats].sort(
    (a, b) => b.pinned - a.pinned || b.messages.length - a.messages.length
  );
}

export function renderSidebar() {
  const list = $("#history-list");
  list.innerHTML = "";
  const term = $("#sidebar-search")?.value?.toLowerCase().trim() || "";
  const items = sortChats(state.chats).filter(
    (c) => !term || c.title.toLowerCase().includes(term)
  );
  const activeLeft = state.uiState.activeLeft;
  const activeRight = state.uiState.activeRight;
  items.forEach((chat) => {
    const el = chatItem(chat);
    if (chat.id === activeLeft || chat.id === activeRight) el.classList.add('is-active');
    list.appendChild(el);
  });
}

function chatItem(chat) {
  const li = el("div", "history-item");
  li.dataset.id = chat.id;
  li.dataset.pinned = chat.pinned ? "true" : "false";
  li.innerHTML = `
    <span class="history-title">${escapeHtml(chat.title)}</span>
    <button class="icon-btn history-actions-trigger" data-id="${chat.id}" title="Chat options">
      <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
    </button>`;

  li.addEventListener("click", (e) => {
    if (e.target.closest(".history-actions-trigger")) return; // ignore three-dots menu
    // normal click: choose replace side if split else open in single
    window.dispatchEvent(
      new CustomEvent("chat:select", { detail: { chatId: chat.id } })
    );
  });

  // Actions now handled via global popup in app.js
  return li;
}

function actionBtn(action, icon) {
  return `<button data-action="${action}" title="${action}"><span class="material-symbols-outlined" style="font-size:16px;">${icon}</span></button>`;
}

function escapeHtml(str = "") {
  return str.replace(
    /[&<>]/g,
    (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[s])
  );
}

export function initSidebar() {
  const searchInput = $("#sidebar-search");
  if (searchInput) {
    searchInput.addEventListener("input", renderSidebar);
  }

  // Collapsible sections
  $$(".sidebar-section__header").forEach((header) => {
    // initialize chevron icon to reflect current state
    const chev = header.querySelector(".sidebar-section__chevron");
    const initExpanded = header.getAttribute("aria-expanded") === "true";
    if (chev) chev.textContent = initExpanded ? "expand_more" : "chevron_right";
    header.addEventListener("click", () => {
      const aside = header.closest('.sidebar');
      const collapsed = aside?.getAttribute('data-collapsed') === 'true';
      if (collapsed) {
        aside.setAttribute('data-collapsed', 'false');
        return;
      }
      const isExpanded = header.getAttribute("aria-expanded") === "true";
      header.setAttribute("aria-expanded", String(!isExpanded));
      const section = header.closest(".sidebar-section");
      const content = section?.querySelector(".sidebar-section__content");
      if (content) {
        content.style.display = isExpanded ? "none" : "flex";
      }
      const chevron = header.querySelector(".sidebar-section__chevron");
      if (chevron) chevron.textContent = isExpanded ? "chevron_right" : "expand_more";
    });
  });

  const newChatBtn = $(".js-new-chat");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const aside = newChatBtn.closest('.sidebar');
      if (aside?.getAttribute('data-collapsed') === 'true') {
        aside.setAttribute('data-collapsed','false');
      }
      // If split mode, show popover to choose side
      if (state.uiState.split) {
        const rect = newChatBtn.getBoundingClientRect();
        showNewChatPopover(rect);
      } else {
        // Single pane: just create new chat
        const chat = stateAPI.createChat("New Chat");
        stateAPI.setActive("left", chat.id);
        window.dispatchEvent(
          new CustomEvent("chat:select", { detail: { chatId: chat.id } })
        );
        renderSidebar();
      }
    });
  }
}

function showNewChatPopover(anchorRect) {
  const root = $("#popover-root");
  const tmpl = $("#tmpl-popover-newchat");
  if (!tmpl) return;

  const popover = tmpl.content.cloneNode(true).querySelector(".popover");
  popover.style.position = "absolute";
  popover.style.left = anchorRect.left + "px";
  popover.style.top = anchorRect.bottom + 8 + "px";
  popover.dataset.open = "true";

  popover.addEventListener("click", (e) => {
    const btn = e.target.closest(".menu-item");
    if (!btn) return;
    const side = btn.dataset.side;
    if (side) {
      const chat = stateAPI.createChat("New Chat");
      stateAPI.setActive(side, chat.id);
      window.dispatchEvent(
        new CustomEvent("chat:split", { detail: { side, chatId: chat.id } })
      );
      renderSidebar();
      popover.remove();
    }
  });

  root.appendChild(popover);

  setTimeout(() => {
    const clickAway = (e) => {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener("mousedown", clickAway);
      }
    };
    document.addEventListener("mousedown", clickAway);
  }, 0);
}
