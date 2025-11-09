// chatPane.js – chat pane rendering, composer, send logic per side
import { $, el } from "../utils/dom.js";
import { state, stateAPI } from "../state.js";
import { geminiRequest, simulateStream } from "../api/gemini.js";
import { renderMarkdown, enhanceCodeBlocks } from "../render/markdown.js";
import { renderLatex } from "../render/latex.js";
import { exportChat } from "../features/export.js";

export class ChatPane {
  constructor(side) {
    this.side = side; // 'left' | 'right'
    this.ids = {
      messages: `#messages-${side}`,
      input: `#input-${side}`,
      count: `#count-${side}`,
      title: `#pane-${side}-title`,
    };
    this.abort = null;
    this.promptHistory = [];
    this.promptIndex = -1;
    this.bind();
  }

  get activeChat() {
    const id =
      this.side === "left"
        ? state.uiState.activeLeft
        : state.uiState.activeRight;
    return stateAPI.getChat(id);
  }

  bind() {
    const input = $(this.ids.input);
    const sendBtn = $(`.js-send[data-side="${this.side}"]`);
    const count = $(this.ids.count);
    const messages = $(this.ids.messages);

    if (!input || !sendBtn) {
      console.warn(`ChatPane (${this.side}): missing required elements`);
      return;
    }

    // bind refs for counter
    this.input = input;
    this.charCount = count;

    // Mark focused pane when interacting
    input?.addEventListener("focus", () => stateAPI.setFocusedSide(this.side));
    messages?.addEventListener("mousedown", () => stateAPI.setFocusedSide(this.side));

    input.addEventListener("input", () => {
      this.updateCharCount();
      // autosize
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 280) + "px";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
        return;
      }
      if (e.key === "ArrowUp" && !e.shiftKey && input.selectionStart === 0) {
        e.preventDefault();
        this.cycleHistory(-1);
        return;
      }
      if (
        e.key === "ArrowDown" &&
        !e.shiftKey &&
        input.selectionStart === input.value.length
      ) {
        e.preventDefault();
        this.cycleHistory(1);
        return;
      }
    });

    sendBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      if (count) count.textContent = "0 chars • ~0 tokens";
      input.style.height = "auto";
      this.promptHistory.push(text);
      this.promptIndex = this.promptHistory.length;
      this.send(text);
    });
  }

  cycleHistory(delta) {
    if (!this.promptHistory.length) return;
    this.promptIndex = Math.max(
      0,
      Math.min(this.promptHistory.length - 1, this.promptIndex + delta)
    );
    $(this.ids.input).value = this.promptHistory[this.promptIndex] || "";
  }

  render() {
    const chat = this.activeChat;
    $(this.ids.title).textContent = chat?.title || "Chat";
    const container = $(this.ids.messages);
    container.innerHTML = "";
    if (!chat) return;
    chat.messages.forEach((m) => container.appendChild(this.messageEl(m)));
    this.selectedMsgIndex = chat.messages.length - 1;
    container.scrollTop = container.scrollHeight;
  }

  messageEl(m) {
    const div = el(
      "div",
      ["msg", `msg--${m.role}`, m.error ? "msg--error" : ""].filter(Boolean)
    );
    div.id = `mid-${m.id}`;
    div.dataset.mid = m.id;

    const meta = el("div", "msg__meta");
    const role = el("span", "msg__role");
    role.textContent = m.role;
    role.setAttribute("tabindex", "0");
    role.setAttribute("role", "button");
    const time = el("span", "msg__time");
    time.textContent = new Date(m.ts).toLocaleTimeString();
    const metaActions = el("div", "msg__meta-actions");
    const editBtn = el("button", ["msg__icon-btn"], {
      type: "button",
      title: "Edit message",
      "aria-label": "Edit message",
      "data-act": "edit",
    });
    editBtn.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">edit</span>';
    const deleteBtn = el("button", ["msg__icon-btn"], {
      type: "button",
      title: "Delete message",
      "aria-label": "Delete message",
      "data-act": "delete",
    });
    deleteBtn.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">delete</span>';
    metaActions.append(editBtn, deleteBtn);
    meta.append(role, time, metaActions);

    const bubble = el("div", "msg__bubble");
    bubble.innerHTML = renderMarkdown(m.text);

    const copyBtn = el("button", ["msg__icon-btn", "msg__copy-btn"], {
      type: "button",
      title: "Copy message",
      "aria-label": "Copy message",
    });
    copyBtn.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">content_copy</span>';

    const contentRow = el("div", "msg__content");
    contentRow.append(bubble, copyBtn);

    div.append(meta, contentRow);

    div.addEventListener("mouseenter", () => div.classList.add("is-hover"));
    div.addEventListener("mouseleave", () => div.classList.remove("is-hover"));
    role.addEventListener("mouseenter", () =>
      div.classList.add("is-role-hover")
    );
    role.addEventListener("mouseleave", () =>
      div.classList.remove("is-role-hover")
    );
    role.addEventListener("focus", () => div.classList.add("is-role-hover"));
    role.addEventListener("blur", () => {
      if (!metaActions.contains(document.activeElement)) {
        div.classList.remove("is-role-hover");
      }
    });
    role.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        metaActions.querySelector("button")?.focus();
      }
    });
    metaActions.addEventListener("mouseenter", () =>
      div.classList.add("is-role-hover")
    );
    metaActions.addEventListener("mouseleave", () =>
      div.classList.remove("is-role-hover")
    );
    metaActions.addEventListener("focusin", () =>
      div.classList.add("is-role-hover")
    );
    metaActions.addEventListener("focusout", (e) => {
      if (!metaActions.contains(e.relatedTarget || document.activeElement)) {
        div.classList.remove("is-role-hover");
      }
    });

    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(m.text).then(() => {
        const icon = copyBtn.querySelector("span");
        if (icon) {
          const orig = icon.textContent;
          icon.textContent = "check";
          setTimeout(() => (icon.textContent = orig), 1200);
        }
      });
    });

    metaActions.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset?.act;
      if (!act) return;
      e.stopPropagation();
      if (act === "delete") this.deleteMessage(m.id);
      if (act === "edit") this.editMessage(m.id);
    });
    enhanceCodeBlocks(bubble);
    renderLatex(bubble);
    return div;
  }

  deleteMessage(messageId) {
    const chat = this.activeChat;
    if (!chat) return;
    chat.messages = chat.messages.filter((mm) => mm.id !== messageId);
    stateAPI.save();
    this.render();
  }

  editMessage(messageId) {
    const chat = this.activeChat;
    if (!chat) return;
    const message = chat.messages.find((mm) => mm.id === messageId);
    if (!message) return;
    const updated = window.prompt("Edit message", message.text);
    if (updated == null) return;
    message.text = updated.trim();
    delete message.error;
    stateAPI.save();
    this.render();
  }

  async send(text) {
    const chat = this.activeChat;
    if (!chat) return;
    stateAPI.addMessage(chat.id, "user", text);
    this.render();
    const assistant = stateAPI.addMessage(chat.id, "assistant", "");
    this.render();
    const container = $(this.ids.messages);
    const node = container?.lastElementChild; // assistant node
    const bubble = node?.querySelector(".msg__bubble");
    if (!bubble) return;

    const controller = new AbortController();
    this.abort = () => controller.abort();
    try {
      const out = await geminiRequest(text, state.settings, controller.signal);
      // simulate streaming for feel
      bubble.innerHTML = "";
      await simulateStream(
        out,
        (chunk) => {
          bubble.innerHTML += chunk;
          container.scrollTop = container.scrollHeight;
        },
        10
      );
      assistant.text = out;
    } catch (e) {
      assistant.text = String(e.message || e);
      assistant.error = true;
    } finally {
      stateAPI.save();
      this.render();
      container.scrollTop = container.scrollHeight;
      this.abort = null;
    }
  }

  updateCharCount() {
    const len = this.input.value.length;
    const tokens = Math.round(len / 4);
    if (len > 0) {
      this.charCount.textContent = `${len} chars • ~${tokens} tokens`;
    } else {
      this.charCount.textContent = '0 chars • ~0 tokens';
    }
  }

  getMessageNodes() {
    const container = $(this.ids.messages);
    return Array.from(container?.querySelectorAll('.msg') || []);
  }

  scrollToMessageIndex(index) {
    const nodes = this.getMessageNodes();
    if (!nodes.length) return;
    const i = Math.max(0, Math.min(nodes.length - 1, index));
    this.selectedMsgIndex = i;
    const node = nodes[i];
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  cycleMessage(delta) {
    const nodes = this.getMessageNodes();
    if (!nodes.length) return;
    if (typeof this.selectedMsgIndex !== 'number') this.selectedMsgIndex = nodes.length - 1;
    this.scrollToMessageIndex(this.selectedMsgIndex + delta);
  }
}

function truncateText(text, max = 1000) {
  const t = String(text || "");
  if (t.length <= max) return { text: t, truncated: false };
  const slice = t.slice(0, max) + "\n\n…";
  return { text: slice, truncated: true };
}

function showModelPopover(anchor, side) {
  const root = $("#popover-root");
  const tmpl = $("#tmpl-popover-model");
  if (!tmpl || !root) return;

  const popover = tmpl.content.cloneNode(true).querySelector(".popover");
  const rect = anchor.getBoundingClientRect();
  popover.style.position = "absolute";
  popover.style.left = rect.left + "px";
  popover.style.top = rect.bottom + 8 + "px";
  popover.dataset.open = "true";

  const select = popover.querySelector("#popover-model-select");
  const customInput = popover.querySelector("#popover-model-custom");

  if (select) {
    select.value = state.settings.model || "gemini-2.5-flash";
    select.addEventListener("change", () => {
      if (select.value === "custom") {
        customInput.style.display = "block";
      } else {
        customInput.style.display = "none";
        stateAPI.updateSettings({ model: select.value });
      }
    });
  }

  if (customInput) {
    customInput.style.display = select?.value === "custom" ? "block" : "none";
    customInput.value = state.settings.customModel || "";
    customInput.addEventListener("input", () => {
      stateAPI.updateSettings({ customModel: customInput.value });
    });
  }

  root.appendChild(popover);

  setTimeout(() => {
    const clickAway = (e) => {
      if (!popover.contains(e.target) && !anchor.contains(e.target)) {
        popover.remove();
        document.removeEventListener("mousedown", clickAway);
      }
    };
    document.addEventListener("mousedown", clickAway);
  }, 0);
}

function showExportPopover(anchor, side) {
  const root = $("#popover-root");
  const tmpl = $("#tmpl-popover-export");
  if (!tmpl || !root) return;

  const popover = tmpl.content.cloneNode(true).querySelector(".popover");
  const rect = anchor.getBoundingClientRect();
  popover.style.position = "absolute";
  popover.style.left = rect.left + "px";
  popover.style.top = rect.bottom + 8 + "px";
  popover.dataset.open = "true";

  popover.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-export]");
    if (!btn) return;
    const format = btn.dataset.export;
    const chatId =
      side === "left" ? state.uiState.activeLeft : state.uiState.activeRight;
    const chat = stateAPI.getChat(chatId);
    if (chat) {
      exportChat(chat, format);
    }
    popover.remove();
  });

  root.appendChild(popover);

  setTimeout(() => {
    const clickAway = (e) => {
      if (!popover.contains(e.target) && !anchor.contains(e.target)) {
        popover.remove();
        document.removeEventListener("mousedown", clickAway);
      }
    };
    document.addEventListener("mousedown", clickAway);
  }, 0);
}
