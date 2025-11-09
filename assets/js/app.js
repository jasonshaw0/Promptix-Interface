// app.js – wire up everything
import { $, $$, hide, show } from "./utils/dom.js";
import { state, stateAPI } from "./state.js";
import { PopupManager } from "./ui/popups.js";
import { openModal } from "./ui/modals.js";
import { confirmDialog, promptDialog } from "./ui/dialogs.js";
import { renderSidebar, initSidebar } from "./ui/sidebar.js";
import { ChatPane } from "./ui/chatPane.js";
import { initShortcuts } from "./ui/shortcuts.js";
import { exportChat } from "./features/export.js";
import { PresetManager } from "./features/presets.js";

const popup = new PopupManager();
const leftPane = new ChatPane("left");
const rightPane = new ChatPane("right");
let presetsMgr = null;

// Helpers for routing actions to the correct pane/chat
function getTargetSide() {
  return state.uiState.split ? (state.uiState.focusedSide || "left") : "left";
}
function ensureChatForSide(side) {
  let chatId = side === "left" ? state.uiState.activeLeft : state.uiState.activeRight;
  if (!chatId) {
    const chat = stateAPI.createChat("New Chat");
    stateAPI.setActive(side, chat.id);
    chatId = chat.id;
  }
  return chatId;
}
function insertPresetToActive(content) {
  const side = getTargetSide();
  const chatId = ensureChatForSide(side);
  stateAPI.addMessage(chatId, "user", content || "");
  renderPanes();
  renderSidebar();
}

function applySettingsToUI() {
  const app = $("#app");
  document.documentElement.style.setProperty("--accent", state.settings.accent);
  const accentRgb = hexToRgb(state.settings.accent) || "91,141,255";
  document.documentElement.style.setProperty("--accent-rgb", accentRgb);
  document.body.style.fontFamily =
    state.settings.fontBody || state.settings.fontFamily;

  // Icon family toggle
  const useRounded = state.settings.iconFamily === "rounded";
  $$(".material-symbols-outlined, .material-symbols-rounded").forEach(
    (icon) => {
      icon.className = useRounded
        ? "material-symbols-rounded"
        : "material-symbols-outlined";
    }
  );

  // Update model chips
  const modelName = (state.settings.model === 'custom' ? (state.settings.customModel || 'custom') : state.settings.model) || 'model';
  const short = (modelName.length > 18) ? (modelName.slice(0, 16) + '…') : modelName;
  $$(".model-link__label").forEach(el => { el.textContent = short; });

  // Apply theme colors if present
  if (state.settings.themeColors) {
    Object.entries(state.settings.themeColors).forEach(([k, v]) => {
      document.documentElement.style.setProperty(`--${k}`, v);
    });
  }
}

function hexToRgb(hx) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hx || "");
  if (!m) return null;
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

function ensureActiveChats() {
  if (!state.uiState.activeLeft) state.uiState.activeLeft = state.chats[0]?.id;
  if (!state.uiState.split) state.uiState.activeRight = null;
  else if (!state.uiState.activeRight)
    state.uiState.activeRight = state.chats[1]?.id || state.uiState.activeLeft;
  stateAPI.save();
}

function renderPanes() {
  const panes = $("#panes");
  panes.dataset.split = state.uiState.split ? "split" : "single";
  leftPane.render();
  if (state.uiState.split) rightPane.render();
}

function setupDragger() {
  const dragger = $("#pane-resizer");
  if (!dragger) return;
  let dragging = false;
  let startX = 0;
  let startLeftWidth = 0;
  dragger.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startLeftWidth = document
      .querySelector('.pane[data-side="left"]')
      .getBoundingClientRect().width;
    document.body.style.userSelect = "none";
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const total = $("#panes").getBoundingClientRect().width;
    let leftW = Math.max(240, Math.min(total - 240, startLeftWidth + dx));
    document.querySelector(
      '.pane[data-side="left"]'
    ).style.flex = `0 0 ${leftW}px`;
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    document.body.style.userSelect = "";
  });
}

// History stepper (prev/next) and open timeline
document.addEventListener('click', (evt) => {
  const prev = evt.target.closest('.js-history-prev');
  const next = evt.target.closest('.js-history-next');
  const open = evt.target.closest('.js-history-open');
  if (!prev && !next && !open) return;
  const side = (prev || next || open)?.dataset?.side || 'left';
  const pane = side === 'left' ? leftPane : rightPane;
  if (prev) {
    pane.cycleMessage(-1);
  } else if (next) {
    pane.cycleMessage(1);
  } else if (open) {
    const container = open.closest('.pane') || document.body;
    popup.showNear('#tmpl-popover-timeline', open, { x: 0, y: 8 }, 'top', { container });
  }
});

function setupSidebarResizer() {
  const resizer = $("#sidebar-resizer");
  const aside = document.querySelector('.sidebar');
  if (!resizer || !aside) return;
  // Clicking the handle toggles collapsed; no variable resize
  resizer.addEventListener('click', () => {
    const collapsed = aside.getAttribute('data-collapsed') === 'true';
    aside.setAttribute('data-collapsed', String(!collapsed));
  });
}

function bindGlobalUI() {
  // Populate font dropdowns
  const bodyFonts = ["Inter", "Roboto", "Space Grotesk", "Sora"];
  const monoFonts = ["IBM Plex Mono", "Fira Code"];
  const mathFonts = ["Lora", "Space Grotesk"];

  const bodySelect = $("#font-body-select");
  const monoSelect = $("#font-mono-select");
  const mathSelect = $("#font-math-select");

  if (bodySelect) {
    bodyFonts.forEach((font) => {
      const opt = document.createElement("option");
      opt.value = font;
      opt.textContent = font;
      bodySelect.appendChild(opt);
    });
  }

  if (monoSelect) {
    monoFonts.forEach((font) => {
      const opt = document.createElement("option");
      opt.value = font;
      opt.textContent = font;
      monoSelect.appendChild(opt);
    });
  }

  if (mathSelect) {
    mathFonts.forEach((font) => {
      const opt = document.createElement("option");
      opt.value = font;
      opt.textContent = font;
      mathSelect.appendChild(opt);
    });
  }

  // Settings modal tabs
  $$(".modal__tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetPanel = tab.dataset.tab;
      $$(".modal__tabs .tab").forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      $$(".tab-panel").forEach((p) => {
        p.classList.remove("is-active");
        p.setAttribute("aria-hidden", "true");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      const panel = $(`[data-tab-panel="${targetPanel}"]`);
      if (panel) {
        panel.classList.add("is-active");
        panel.setAttribute("aria-hidden", "false");
      }
    });
  });

  // Stepper buttons
  $$(".js-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSelector = btn.dataset.target;
      const delta = parseFloat(btn.dataset.delta);
      const input = $(targetSelector);
      if (input) {
        const current = parseFloat(input.value) || 0;
        const min = parseFloat(input.min) || -Infinity;
        const max = parseFloat(input.max) || Infinity;
        input.value = Math.max(min, Math.min(max, current + delta));
      }
    });
  });

  // Settings button
  $(".js-open-settings")?.addEventListener("click", () => {
    const close = openModal("settings-modal");
    // Populate fields
    $("#font-body-select").value = state.settings.fontBody || "Inter";
    $("#font-mono-select").value = state.settings.fontMono || "IBM Plex Mono";
    $("#font-math-select").value = state.settings.fontMath || "Lora";
    $("#icon-select").value = state.settings.iconFamily || "outlined";
    $("#accent-input").value = state.settings.accent || "#5b8dff";
    $("#accent-swatch") && ($("#accent-swatch").style.background = state.settings.accent || "#5b8dff");
    $("#font-body-size") && ($("#font-body-size").value = state.settings.fontBodySize || 14);
    $("#font-mono-size") && ($("#font-mono-size").value = state.settings.fontMonoSize || 13);
    $("#api-key-input").value = state.settings.apiKey || "";
    $("#default-model-select").value =
      state.settings.model || "gemini-2.5-flash";
    $("#default-model-input").value = state.settings.customModel || "";
    $("#settings-temp").value = state.settings.temperature || 1.0;
    $("#settings-maxtokens").value = state.settings.maxTokens || 2048;

    // Export tab
    const fmtSelect = $("#export-format-select");
    const tplArea = $("#export-template");
    if (fmtSelect && tplArea) {
      fmtSelect.value = state.settings.defaultExportFormat || "md";
      const syncTpl = () => {
        const key = fmtSelect.value;
        tplArea.value = (state.settings.exportTemplates && state.settings.exportTemplates[key]) || "";
      };
      syncTpl();
      fmtSelect.onchange = syncTpl;
    }

    // Data tab: reset chats to Test
    const resetBtn = $("#btn-reset-chats");
    if (resetBtn) {
      resetBtn.onclick = () => {
        confirmDialog('Delete all chats and seed a single Test chat?').then(ok => {
          if (!ok) return;
          stateAPI.resetChatsToTest();
          renderSidebar();
          renderPanes();
          close();
        });
      };
    }

    // Styles helpers
    $("#accent-swatch")?.addEventListener("click", () => $("#accent-input")?.click());
    $("#accent-input")?.addEventListener("input", (e) => {
      $("#accent-swatch").style.background = e.target.value;
    });

    // Build style presets - Ocean (original default) and Ocean Light
    const presets = [
      // Ocean Dark - original default theme
      {
        name: "Ocean", vars: {
          "bg-0": "#071018", "bg-1": "#0a1520", "bg-2": "#0f1d2b", "bg-3": "#152638", "bg-4": "#1d3145",
          "surface": "rgba(14,22,33,0.72)", "surface-strong": "rgba(16,26,38,0.86)",
          "border": "rgba(120,160,210,0.22)", "border-strong": "rgba(120,160,210,0.4)",
          "text-0": "#f1f6ff", "text-1": "#d4def0", "text-2": "#9ab0c9", "text-3": "#6b8098",
          "accent": "#5b8dff", "accent-rgb": "91, 141, 255",
          "danger": "#ff6b8a", "success": "#4fd6b7",
          "glow": "rgba(80,140,255,0.18)",
          "app-grad-1": "rgba(20,30,44,0.6)", "app-grad-2": "rgba(12,20,30,0.6)",
          "pane-bg-start": "rgba(18,28,42,0.78)", "pane-bg-end": "rgba(14,22,33,0.9)",
          "bubble-bg-start": "rgba(28,38,52,0.9)", "bubble-bg-end": "rgba(20,30,44,0.88)"
        }
      },
      // Ocean Light - light variant of Ocean
      {
        name: "Ocean Light", vars: {
          "bg-0": "#f0f5fa", "bg-1": "#ffffff", "bg-2": "#e6f0f9", "bg-3": "#d8e8f5", "bg-4": "#cce2f2",
          "surface": "rgba(255, 255, 255, 0.95)", "surface-strong": "rgba(255,255,255,1)",
          "border": "rgba(20,50,90,0.15)", "border-strong": "rgba(20,50,90,0.3)",
          "text-0": "#0a1828", "text-1": "#1a2e44", "text-2": "#4a6580", "text-3": "#7a92ac",
          "accent": "#5b8dff", "accent-rgb": "91, 141, 255",
          "danger": "#ff6b8a", "success": "#4fd6b7",
          "glow": "rgba(91,141,255,0.18)",
          "app-grad-1": "rgba(240,248,255,0.6)", "app-grad-2": "rgba(230,242,252,0.6)",
          "pane-bg-start": "rgba(255,255,255,0.98)", "pane-bg-end": "rgba(245,250,255,0.96)",
          "bubble-bg-start": "rgba(255,255,255,0.98)", "bubble-bg-end": "rgba(240,247,255,0.96)"
        }
      }
      /* -- Hidden presets (commented out to disable in UI) --------------------
      ,{
        name: "Paper", vars: { ... }
      },
      {
        name: "Sage", vars: { ... }
      },
      {
        name: "Cardinal", vars: { ... }
      }
      ----------------------------------------------------------------------- */
    ];
    const presetsRoot = $("#style-presets");
    if (presetsRoot) {
      presetsRoot.innerHTML = "";
      presets.forEach(p => {
        // Wrapper to hold the swatch button and a small label underneath
        const wrap = document.createElement("div");
        wrap.className = "style-preset-wrap";
        wrap.title = p.name;

        // Swatch button
        const btn = document.createElement("button");
        btn.className = "style-preset";
        btn.type = "button";
        const shades = [p.vars["bg-0"], p.vars["bg-2"], p.vars["bg-4"], p.vars["accent"]];
        btn.innerHTML = shades.map(c => `<div class="style-preset__sw" style="background:${c}"></div>`).join("");

        // Label
        const label = document.createElement("div");
        label.className = "style-preset__label";
        label.textContent = p.name;

        const applyPreset = () => {
          stateAPI.updateSettings({ themeColors: p.vars, accent: p.vars["accent"] });
          applySettingsToUI();
          $("#accent-input").value = p.vars["accent"];
          if ($("#accent-swatch")) $("#accent-swatch").style.background = p.vars["accent"];
        };

        btn.addEventListener("click", applyPreset);
        label.addEventListener("click", applyPreset);
        wrap.appendChild(btn);
        wrap.appendChild(label);
        presetsRoot.appendChild(wrap);
      });
    }

    // Save button
    $("#settings-save").onclick = () => {
      stateAPI.updateSettings({
        fontBody: $("#font-body-select").value,
        fontMono: $("#font-mono-select").value,
        fontMath: $("#font-math-select").value,
        fontBodySize: parseInt($("#font-body-size")?.value || "14", 10),
        fontMonoSize: parseInt($("#font-mono-size")?.value || "13", 10),
        iconFamily: $("#icon-select").value,
        accent: $("#accent-input").value,
        apiKey: $("#api-key-input")?.value?.trim() || state.settings.apiKey,
        model: $("#default-model-select").value,
        customModel: $("#default-model-input").value.trim(),
        temperature: parseFloat($("#settings-temp").value),
        maxTokens: parseInt($("#settings-maxtokens").value, 10),
        defaultExportFormat: ($("#export-format-select")?.value) || state.settings.defaultExportFormat,
        exportTemplates: {
          ...(state.settings.exportTemplates || {}),
          [$("#export-format-select")?.value || "md"]: $("#export-template")?.value || ""
        }
      });
      // expose templates to exporters
      window.__exportTemplates = state.settings.exportTemplates;
      applySettingsToUI();
      close();
    };
  });

  // Sidebar collapse (external subtle toggle)
  $(".js-toggle-sidebar")?.addEventListener("click", () => {
    const aside = document.querySelector(".sidebar");
    const collapsed = aside.getAttribute("data-collapsed") === "true";
    const nextCollapsed = !collapsed;
    aside.setAttribute("data-collapsed", String(nextCollapsed));
    // Update toggle icon to reflect current state
    const icon = document.querySelector(".sidebar-toggle .material-symbols-outlined");
    if (icon) {
      icon.textContent = nextCollapsed ? "chevron_right" : "chevron_left";
    }
  });

  // Sidebar presets panel (no tabs): render and wire interactions
  (function initSidebarPresetsPanel() {
    if (!presetsMgr) presetsMgr = new PresetManager(state, stateAPI);
    presetsMgr.render();
    // Add Preset button
    const addBtn = document.getElementById('add-preset-btn-sidebar');
    if (addBtn && !addBtn.dataset.wired) {
      addBtn.onclick = () => {
        const close = openModal('preset-modal');
        document.getElementById('preset-id').value = '';
        document.getElementById('preset-name-input').value = '';
        document.getElementById('preset-content-input').value = '';
        const save = document.getElementById('preset-save-btn');
        save.onclick = () => {
          const name = document.getElementById('preset-name-input').value.trim();
          const content = document.getElementById('preset-content-input').value;
          if (name) presetsMgr.add(name, content);
          close();
          presetsMgr.render();
        };
      };
      addBtn.dataset.wired = 'true';
    }
    // Click within list: insert/edit/delete preset
    const list = document.getElementById('presets-list-sidebar');
    if (list && !list.dataset.wired) {
      list.addEventListener('click', (evt) => {
        const row = evt.target.closest('.preset-item');
        if (!row) return;
        const id = row.dataset.id;
        // Action buttons
        const btn = evt.target.closest('button[data-action]');
        if (btn) {
          const action = btn.dataset.action;
          if (action === 'edit') {
            const p = presetsMgr.list.find(p => p.id === id);
            if (p) {
              const close = openModal('preset-modal');
              document.getElementById('preset-id').value = p.id;
              document.getElementById('preset-name-input').value = p.name;
              document.getElementById('preset-content-input').value = p.content || '';
              const save = document.getElementById('preset-save-btn');
              save.onclick = () => {
                presetsMgr.update(
                  document.getElementById('preset-id').value,
                  document.getElementById('preset-name-input').value.trim(),
                  document.getElementById('preset-content-input').value
                );
                close();
              };
            }
          } else if (action === 'delete') {
            confirmDialog('Delete preset?').then(ok => {
              if (ok) presetsMgr.delete(id);
            });
          } else {
            // Click anywhere else inserts preset into active/focused chat
            const p = presetsMgr.list.find(p => p.id === id);
            if (p) insertPresetToActive(p.content || '');
          }
        }
      });
      list.dataset.wired = 'true';
    }
  })();

  // Search button opens modal and wires live filtering (title + content)
  $(".js-open-search")?.addEventListener("click", () => {
    const close = openModal("search-modal");
    const input = $("#search-input");
    const results = $("#search-results");
    if (!input || !results) return;
    const doSearch = () => {
      const q = input.value.toLowerCase().trim();
      results.innerHTML = "";
      if (!q) return;
      state.chats.forEach(chat => {
        const inTitle = (chat.title || "").toLowerCase().includes(q);
        const hits = [];
        (chat.messages || []).forEach((m, idx) => {
          const t = String(m.text || "");
          if (inTitle || t.toLowerCase().includes(q)) {
            const snip = t.length > 160 ? (t.slice(0, 160) + "…") : t;
            hits.push({ idx, role: m.role, snip });
          }
        });
        if (inTitle || hits.length) {
          const item = document.createElement("div");
          item.className = "result-item";
          item.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">${chat.title || "Untitled chat"}</div>` +
            hits.map(h => `<div style="font-size:12px;opacity:.9;margin:6px 0;"><strong>${h.role}</strong> — ${h.snip.replace(/</g, "&lt;")}</div>`).join("");
          results.appendChild(item);
        }
      });
    };
    input.oninput = doSearch;
    doSearch();
  });

  // Close popups/modals on Esc
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      popup.hide();
      window.dispatchEvent(new CustomEvent("ui:escape"));
    }
  });

  $$(".js-model-btn, .js-attach, .js-export-btn").forEach(btn => {
    btn.addEventListener('click', () => {
      const templateId = `#tmpl-popover-${btn.classList.contains('js-model-btn') ? 'model' : (btn.classList.contains('js-attach') ? 'attach' : 'export')}`;
      const container = btn.closest('.pane') || document.body;
      popup.showNear(templateId, btn, { x: 0, y: 8 }, 'top', { container });
    });
  });

  $$(".js-presets-btn").forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.pane') || btn.closest('.sidebar')?.querySelector('.sidebar__inner') || btn.closest('.sidebar') || document.body;
      // Open above the button for presets in composer
      const placement = btn.closest('.pane') ? 'top' : 'top';
      popup.showNear('#tmpl-popover-presets', btn, { x: 0, y: 100 }, placement, { container });
    });
  });

  // Wire popup content interactions on open
  document.addEventListener('popup:open', (e) => {
    const { id, el, anchor } = e.detail || {};
    if (!id || !el) return;

    // Presets popup
    if (id === '#tmpl-popover-presets') {
      if (!presetsMgr) presetsMgr = new PresetManager(state, stateAPI);
      // Render inline inside the sidebar; otherwise, keep anchored within pane
      const sidebar = anchor.closest('.sidebar');
      if (sidebar) {
        const inner = sidebar?.querySelector('.sidebar__inner');
        const bottom = sidebar?.querySelector('.sidebar__bottom');
        if (inner && bottom) {
          try {
            inner.insertBefore(el, bottom);
            el.setAttribute('data-inline', 'true');
            el.style.left = '';
            el.style.top = '';
            el.style.width = '';
          } catch { /* noop */ }
        }
      } else {
        const pane = anchor.closest('.pane');
        if (pane) {
          const cr = pane.getBoundingClientRect();
          el.style.width = Math.min(360, cr.width - 16) + 'px';
          el.style.maxHeight = Math.floor(window.innerHeight * 0.6) + 'px';
          el.style.overflowY = 'auto';
        }
      }
      presetsMgr.render();
      const list = el.querySelector('.presets-list');
      list?.addEventListener('click', (evt) => {
        const row = evt.target.closest('.preset-item');
        if (!row) return;
        const id = row.dataset.id;
        const btn = evt.target.closest('button[data-action]');
        if (btn) {
          const action = btn.dataset.action;
          if (action === 'edit') {
            const p = presetsMgr.list.find(p => p.id === id);
            if (p) {
              const close = openModal('preset-modal');
              document.getElementById('preset-id').value = p.id;
              document.getElementById('preset-name-input').value = p.name;
              document.getElementById('preset-content-input').value = p.content || '';
              const save = document.getElementById('preset-save-btn');
              save.onclick = () => {
                presetsMgr.update(
                  document.getElementById('preset-id').value,
                  document.getElementById('preset-name-input').value.trim(),
                  document.getElementById('preset-content-input').value
                );
                close();
              };
            }
          } else if (action === 'delete') {
            confirmDialog('Delete preset?').then(ok => {
              if (ok) presetsMgr.delete(id);
            });
          }
        } else {
          const p = presetsMgr.list.find(p => p.id === id);
          if (p) {
            insertPresetToActive(p.content || '');
            popup.hide();
          }
        }
      });
      el.querySelector('#add-preset-btn')?.addEventListener('click', () => {
        const close = openModal('preset-modal');
        document.getElementById('preset-id').value = '';
        document.getElementById('preset-name-input').value = '';
        document.getElementById('preset-content-input').value = '';
        const save = document.getElementById('preset-save-btn');
        save.onclick = () => {
          const name = document.getElementById('preset-name-input').value.trim();
          const content = document.getElementById('preset-content-input').value;
          if (name) presetsMgr.add(name, content);
          close();
        };
      });
    }

    // Model selector
    if (id === '#tmpl-popover-model') {
      const customInput = el.querySelector('#popover-model-custom');
      // start hidden unless custom is chosen
      if (customInput) {
        customInput.style.display = 'none';
        customInput.value = state.settings.customModel || '';
        const commitCustom = () => {
          const v = customInput.value.trim();
          if (v) {
            stateAPI.updateSettings({ model: 'custom', customModel: v });
            applySettingsToUI();
            popup.hide();
          }
        };
        customInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') commitCustom();
        });
        customInput.addEventListener('blur', commitCustom);
      }
      el.addEventListener('click', (evt) => {
        const item = evt.target.closest('[data-model]');
        if (!item) return;
        const val = item.dataset.model;
        if (val === 'custom') {
          if (customInput) {
            customInput.style.display = 'block';
            customInput.focus();
          }
        } else {
          stateAPI.updateSettings({ model: val });
          applySettingsToUI();
          popup.hide();
        }
      });
    }

    // Export menu
    if (id === '#tmpl-popover-export') {
      el.addEventListener('click', (evt) => {
        const btn = evt.target.closest('[data-export]');
        if (!btn) return;
        const format = btn.dataset.export;
        const side = anchor?.dataset?.side || anchor?.closest('[data-side]')?.dataset?.side || 'left';
        const chatId = side === 'left' ? state.uiState.activeLeft : state.uiState.activeRight;
        const chat = stateAPI.getChat(chatId);
        if (chat) exportChat(chat, format, { templates: state.settings.exportTemplates });
        popup.hide();
      });
    }

    // Attach menu
    if (id === '#tmpl-popover-attach') {
      el.addEventListener('click', (evt) => {
        const btn = evt.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        const side = anchor?.dataset?.side || 'left';
        if (act === 'upload') {
          const input = document.querySelector(`#file-input-${side}`);
          input?.click();
          popup.hide();
        } else if (act === 'clear') {
          // If attachments are tracked in state, clear them here
          // For now, just close the menu
          popup.hide();
        }
      });
    }

    // (Timeline popover removed)
  });

  // History three-dots trigger → popup (do not select chat)
  document.addEventListener('click', (evt) => {
    const trigger = evt.target.closest('.history-actions-trigger');
    if (!trigger) return;
    evt.stopPropagation();
    const container = trigger.closest('.sidebar') || document.body;
    popup.showNear('#tmpl-popover-history', trigger, { x: 0, y: 8 }, 'top', { container });
  });

  // Handle history popup actions
  document.addEventListener('popup:open', (e) => {
    const { id, el, anchor } = e.detail || {};
    if (id !== '#tmpl-popover-history' || !el || !anchor) return;
    const chatId = anchor.dataset.id;
    // Update Pin label dynamically
    const chat = stateAPI.getChat(chatId);
    const pinBtn = el.querySelector('[data-action="pin"]');
    if (pinBtn && chat) {
      pinBtn.textContent = chat.pinned ? 'Unpin' : 'Pin';
    }
    el.addEventListener('click', (evt) => {
      const btn = evt.target.closest('.menu-item');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'pin') {
        stateAPI.togglePin(chatId);
      } else if (action === 'rename') {
        const c = stateAPI.getChat(chatId);
        promptDialog({ title: 'Rename chat', label: 'Title', value: c?.title || '', okText: 'Save' })
          .then(val => { if (val) stateAPI.renameChat(chatId, val); });
      } else if (action === 'delete') {
        confirmDialog('Delete chat?').then(ok => {
          if (ok) {
            stateAPI.deleteChat(chatId);
            if (state.uiState.activeLeft === chatId) {
              state.uiState.activeLeft = state.chats[0]?.id || null;
            }
            if (state.uiState.activeRight === chatId) {
              state.uiState.activeRight = state.chats[1]?.id || state.uiState.activeLeft || null;
            }
            stateAPI.save();
            renderSidebar();
            renderPanes();
          }
        });
      } else if (action === 'split-left' || action === 'split-right') {
        const side = action.endsWith('left') ? 'left' : 'right';
        window.dispatchEvent(new CustomEvent('chat:split', { detail: { side, chatId } }));
      }
      popup.hide();
      renderSidebar();
    });
  });
}

// (Timeline rendering removed)

function hookHistorySelection() {
  // Normal click
  window.addEventListener("chat:select", (e) => {
    const { chatId } = e.detail;
    const side = state.uiState.split
      ? (state.uiState.focusedSide || "left")
      : "left";
    stateAPI.setActive(side, chatId);
    renderPanes();
    renderSidebar();
  });

  // Explicit split
  window.addEventListener("chat:split", (e) => {
    const { chatId, side } = e.detail;
    stateAPI.setSplit(true);
    stateAPI.setActive(side, chatId);
    if (side === "left" && !state.uiState.activeRight)
      state.uiState.activeRight = state.uiState.activeLeft;
    if (side === "right" && !state.uiState.activeLeft)
      state.uiState.activeLeft = chatId;
    stateAPI.save();
    renderPanes();
  });

  // Split toggle from shortcuts
  window.addEventListener("ui:split-changed", () => {
    renderPanes();
    renderSidebarTimeline();
  });
}

function bindPaneCloseButtons() {
  $$(".js-close-pane").forEach((btn) =>
    btn.addEventListener("click", () => {
      const side = btn.dataset.side;
      if (side === "right") {
        stateAPI.setSplit(false);
      } else {
        // closing left: promote right to single
        if (state.uiState.split) {
          stateAPI.setActive("left", state.uiState.activeRight);
          stateAPI.setSplit(false);
        }
      }
      renderPanes();
    })
  );
}

function restoreFromState() {
  ensureActiveChats();
  applySettingsToUI();
  renderSidebar();
  renderPanes();
  // Initialize sidebar toggle icon to match state
  const icon = document.querySelector(".sidebar-toggle .material-symbols-outlined");
  const aside = document.querySelector(".sidebar");
  if (icon && aside) {
    const collapsed = aside.getAttribute("data-collapsed") === "true";
    icon.textContent = collapsed ? "chevron_right" : "chevron_left";
  }
  // Ensure presets manager exists and render lists (sidebar + popovers)
  if (!presetsMgr) presetsMgr = new PresetManager(state, stateAPI);
  presetsMgr.render();
  // Wire sidebar Add Preset if present
  const addBtn = document.getElementById('add-preset-btn-sidebar');
  if (addBtn) {
    addBtn.onclick = () => {
      const close = openModal('preset-modal');
      document.getElementById('preset-id').value = '';
      document.getElementById('preset-name-input').value = '';
      document.getElementById('preset-content-input').value = '';
      const save = document.getElementById('preset-save-btn');
      save.onclick = () => {
        const name = document.getElementById('preset-name-input').value.trim();
        const content = document.getElementById('preset-content-input').value;
        if (name) presetsMgr.add(name, content);
        close();
        presetsMgr.render();
      };
    };
  }
  // Wire sidebar presets list item interactions if present
  const list = document.getElementById('presets-list-sidebar');
  if (list && !list.dataset.wired) {
    list.addEventListener('click', (evt) => {
      const row = evt.target.closest('.preset-item');
      if (!row) return;
      const id = row.dataset.id;
      // Insert on title click
      const title = evt.target.closest('.preset-name');
      if (title) {
        const p = presetsMgr.list.find(p => p.id === id);
        if (p) {
          const chatId = state.uiState.activeLeft || state.uiState.activeRight;
          if (chatId) stateAPI.addMessage(chatId, 'user', p.content || '');
        }
        return;
      }
      // Action buttons
      const btn = evt.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'edit') {
        const p = presetsMgr.list.find(p => p.id === id);
        if (p) {
          const close = openModal('preset-modal');
          document.getElementById('preset-id').value = p.id;
          document.getElementById('preset-name-input').value = p.name;
          document.getElementById('preset-content-input').value = p.content || '';
          const save = document.getElementById('preset-save-btn');
          save.onclick = () => {
            presetsMgr.update(
              document.getElementById('preset-id').value,
              document.getElementById('preset-name-input').value.trim(),
              document.getElementById('preset-content-input').value
            );
            close();
          };
        }
      } else if (action === 'delete') {
        confirmDialog('Delete preset?').then(ok => {
          if (ok) presetsMgr.delete(id);
        });
      }
    });
    list.dataset.wired = 'true';
  }
  // timeline removed
}

// Init
console.log("Initializing...");
stateAPI.load();
console.log("State loaded:", state);
initSidebar();
console.log("Sidebar initialized");
initShortcuts();
console.log("Shortcuts initialized");
bindGlobalUI();
console.log("Global UI bound");
hookHistorySelection();
console.log("History selection hooked");
setupDragger();
console.log("Dragger setup");
// Sidebar resizer removed
bindPaneCloseButtons();
console.log("Pane close buttons bound");
restoreFromState();
console.log("State restored, app ready");
