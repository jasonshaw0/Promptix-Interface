// Content script to capture the element the user right-clicked and provide details
let lastContext = { x: 0, y: 0, target: null };
let selecting = false;
let hoverEl = null;
let pickedEls = new Set();
let selections = [];
let styleEl = null;

function ensureStyle() {
	if (styleEl) return;
	styleEl = document.createElement("style");
	styleEl.textContent = `
.cursor-pick-hover { outline: 2px dashed #4e8bff !important; outline-offset: 2px !important; cursor: crosshair !important; }
.cursor-picked { outline: 2px solid #4e8bff !important; outline-offset: 2px !important; }
/* Floating UI */
#cursor-fab { all: initial; position: fixed; right: 8px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; background:rgba(78, 140, 255, 0.68); color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.5); cursor: pointer; z-index: 2147483647; font: 16px/1 sans-serif; opacity: 0.6; transition: opacity .15s ease, filter .15s ease; }
#cursor-fab:hover { filter: brightness(0.95); opacity: 1; }
#cursor-panel { all: initial; position: fixed; right: 46px; top: 80%; transform: translateY(-50%); width: 320px; background: #ffffff56; color: #fff; border: 1px solid #d0d6e0; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 2147483647; padding: 10px; font: 13px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Arial, sans-serif; display: none; }
#cursor-panel.open { display: block; }
#cursor-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
#cursor-toggle { all: initial; padding: 6px 10px; border: 1px solid #d0d6e0; background: #ffffff46; border-radius: 6px; cursor: pointer; font: 13px/1 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Arial, sans-serif; }
#cursor-count { margin-left: auto; font-size: 12px; color: #fff; }
#cursor-chat { all: initial; width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #ddd; border-radius: 6px; min-height: 72px; white-space: pre-wrap; color: #fff; font: 13px/1.3 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Arial, sans-serif; display: block; }
#cursor-actions { display: flex; gap: 8px; margin-top: 8px; }
.cursor-btn { all: initial; padding: 6px 10px; border: 1px solid #d0d6e0; background: #ffffff46; border-radius: 6px; cursor: pointer; font: 13px/1 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Arial, sans-serif; }
.cursor-btn.primary { background: #4e8bff; color: #fff; border-color: #4e8bff; }
.cursor-btn.danger { background: #ffecec; border-color: #ffb3b3; }
#cursor-notice { margin-top: 6px; font-size: 12px; color: #4e8bff; min-height: 16px; }
/* During select mode, make UI click-through so it isn't picked */
.cursor-selecting #cursor-fab, .cursor-selecting #cursor-panel { pointer-events: none !important; }
`;
	document.documentElement.appendChild(styleEl);
}

let ui = null;
function createUI() {
	if (ui) return ui;
	ensureStyle();
	const fab = document.createElement("button");
	fab.id = "cursor-fab";
	fab.textContent = "◦";
	const panel = document.createElement("div");
	panel.id = "cursor-panel";
	panel.innerHTML = `
		< div id = "cursor-row" >
			<button id="cursor-toggle">Enable Select</button>
			<span id="cursor-count">0 selected</span>
		</div >
		<textarea id="cursor-chat" placeholder="Type a message..."></textarea>
		<div id="cursor-actions">
			<button id="cursor-refresh" class="cursor-btn">Refresh</button>
			<button id="cursor-clear" class="cursor-btn danger">Clear</button>
			<button id="cursor-send" class="cursor-btn primary">Send All</button>
		</div>
		<div id="cursor-notice"></div>
	`;
	document.documentElement.appendChild(fab);
	document.documentElement.appendChild(panel);

	const toggle = panel.querySelector("#cursor-toggle");
	const count = panel.querySelector("#cursor-count");
	const chat = panel.querySelector("#cursor-chat");
	const refresh = panel.querySelector("#cursor-refresh");
	const clear = panel.querySelector("#cursor-clear");
	const send = panel.querySelector("#cursor-send");
	const notice = panel.querySelector("#cursor-notice");

	function setNotice(msg, isError = false) {
		notice.textContent = msg || "";
		notice.style.color = isError ? "#d33" : "#4e8bff";
	}
	function updateCount() { count.textContent = `${selections.length} selected`; }

	fab.addEventListener("click", () => {
		panel.classList.toggle("open");
	});
	toggle.addEventListener("click", () => {
		if (!selecting) {
			startSelect();
			toggle.textContent = "Disable Select";
			setNotice("Click elements to add. Click again to stop.");
		} else {
			stopSelect();
			toggle.textContent = "Enable Select";
			setNotice("");
		}
		updateCount();
	});
	refresh.addEventListener("click", updateCount);
	clear.addEventListener("click", () => {
		clearSelections();
		updateCount();
		setNotice("Cleared selections.");
	});
	send.addEventListener("click", async () => {
		try {
			const payload = { chat: chat.value || "", picks: selections.slice() };
			if (!payload.chat && !payload.picks.length) { setNotice("Nothing to send.", true); return; }
			await fetch("http://127.0.0.1:9000/bundle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
			setNotice("Sent to Cursor.");
		} catch (e) { setNotice("Failed to send. Is Cursor running?", true); }
	});

	ui = { fab, panel, toggle, count, chat, refresh, clear, send, setNotice, updateCount };
	return ui;
}

function onMouseMove(e) {
	if (!selecting) return;
	ensureStyle();
	const el = document.elementFromPoint(e.clientX, e.clientY);
	// Skip UI elements if somehow hit
	if (el && (el.closest("#cursor-panel") || el.closest("#cursor-fab"))) return;
	if (el === hoverEl) return;
	if (hoverEl && !pickedEls.has(hoverEl)) hoverEl.classList.remove("cursor-pick-hover");
	hoverEl = el;
	if (hoverEl && !pickedEls.has(hoverEl)) hoverEl.classList.add("cursor-pick-hover");
}

function serializeElement(el) {
	const selector = cssPath(el);
	const html = el.outerHTML;
	const keep = [
		"display", "position", "top", "left", "right", "bottom", "width", "height", "margin", "padding",
		"border", "border-radius", "background", "color", "font", "font-family", "font-size", "font-weight",
		"line-height", "gap", "align-items", "justify-content", "grid", "grid-template", "flex", "flex-direction"
	];
	const cs = getComputedStyle(el);
	const styles = {};
	keep.forEach(k => { const v = cs.getPropertyValue(k); if (v) styles[k] = v; });
	const rect = el.getBoundingClientRect();
	return {
		url: location.href,
		title: document.title,
		selector,
		bbox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
		html,
		styles
	};
}

function onClickCapture(e) {
	if (!selecting) return;
	e.preventDefault();
	e.stopPropagation();
	const el = document.elementFromPoint(e.clientX, e.clientY) || e.target || document.body;
	// Ignore clicks on our UI
	if (el && (el.closest("#cursor-panel") || el.closest("#cursor-fab"))) return;
	if (!el) return;
	pickedEls.add(el);
	el.classList.add("cursor-picked");
	el.classList.remove("cursor-pick-hover");
	selections.push(serializeElement(el));
	// Append a short token like <div> to the chat field
	const u = ui || createUI();
	try {
		const token = `< ${el.tagName.toLowerCase()}> `;
		const sep = u.chat.value && !u.chat.value.endsWith("\n") ? " " : "";
		u.chat.value = `${u.chat.value}${sep}${token} `;
	} catch (_) { }
	(ui || createUI()).updateCount();
}

function startSelect() {
	ensureStyle();
	createUI();
	selecting = true;
	// Make UI click-through
	document.documentElement.classList.add("cursor-selecting");
	document.addEventListener("mousemove", onMouseMove, true);
	document.addEventListener("click", onClickCapture, true);
	document.addEventListener("keydown", onKeyDown, true);
}

function stopSelect() {
	selecting = false;
	if (hoverEl && !pickedEls.has(hoverEl)) hoverEl.classList.remove("cursor-pick-hover");
	document.removeEventListener("mousemove", onMouseMove, true);
	document.removeEventListener("click", onClickCapture, true);
	document.removeEventListener("keydown", onKeyDown, true);
	document.documentElement.classList.remove("cursor-selecting");
}

function clearSelections() {
	pickedEls.forEach(el => el.classList.remove("cursor-picked"));
	pickedEls.clear();
	selections = [];
}

function onKeyDown(e) {
	if (!selecting) return;
	if (e.key === "Escape" || e.key === "Esc") {
		stopSelect();
		try {
			const u = ui || createUI();
			u.toggle.textContent = "Enable Select";
			u.setNotice("");
		} catch (_) { }
	}
}

window.addEventListener("contextmenu", (e) => {
	lastContext = { x: e.clientX, y: e.clientY, target: e.target };
}, { capture: true });

function cssPath(node) {
	if (!node || node.nodeType !== 1) return "";
	if (node.id) {
		const escape = (window.CSS && CSS.escape) ? CSS.escape : (s) => s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
		return `#${escape(node.id)} `;
	}
	const seg = (n) => {
		let i = 1, sib = n;
		while ((sib = sib.previousElementSibling) && sib.tagName === n.tagName) i++;
		const tag = n.tagName.toLowerCase();
		return `${tag}: nth - of - type(${i})`;
	};
	const parts = [];
	let cur = node;
	while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
		parts.unshift(seg(cur));
		cur = cur.parentElement;
	}
	return parts.join(" > ");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg && msg.type === "get-last-pick") {
		const el = lastContext.target || document.elementFromPoint(lastContext.x, lastContext.y) || document.body;
		const selector = cssPath(el);
		const html = el.outerHTML;
		const keep = [
			"display", "position", "top", "left", "right", "bottom", "width", "height", "margin", "padding",
			"border", "border-radius", "background", "color", "font", "font-family", "font-size", "font-weight",
			"line-height", "gap", "align-items", "justify-content", "grid", "grid-template", "flex", "flex-direction"
		];
		const cs = getComputedStyle(el);
		const styles = {};
		keep.forEach(k => { const v = cs.getPropertyValue(k); if (v) styles[k] = v; });
		const rect = el.getBoundingClientRect();
		sendResponse({
			url: location.href,
			title: document.title,
			selector,
			bbox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
			html,
			styles
		});
		return true;
	}
	if (msg && msg.type === "start-select-mode") {
		startSelect();
		sendResponse({ ok: true });
		return true;
	}
	if (msg && msg.type === "stop-select-mode") {
		stopSelect();
		sendResponse({ ok: true });
		return true;
	}
	if (msg && msg.type === "get-selections") {
		sendResponse(selections.slice());
		return true;
	}
	if (msg && msg.type === "get-selections-count") {
		sendResponse(selections.length);
		return true;
	}
	if (msg && msg.type === "clear-selections") {
		clearSelections();
		sendResponse({ ok: true });
		return true;
	}
});

// Ensure the floating UI is created as soon as the script loads
try {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => { try { createUI(); } catch (_) { } }, { once: true });
	} else {
		createUI();
	}
} catch (_) { }


