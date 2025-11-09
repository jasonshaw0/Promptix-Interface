// state.js – manage chats, settings, uiState
import { getJSON, setJSON } from "./utils/storage.js";
import { uid } from "./utils/id.js";

const DEFAULT_SETTINGS = {
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  fontBody: "Inter",
  fontMono: "IBM Plex Mono",
  fontMath: "Lora",
  fontBodySize: 14,
  fontMonoSize: 13,
  iconFamily: "outlined",
  accent: "#4e8bff",
  animatedGrid: true,
  apiKey: "",
  model: "gemini-2.5-flash",
  temperature: 0.8,
  maxTokens: 2048,
  defaultExportFormat: "md",
  exportTemplates: {
    html: "<!doctype html><html><head><meta charset=\"utf-8\"/><title>{{title}}</title></head><body><h1>{{title}}</h1><div class=\"messages\">{{messages_html}}</div></body></html>",
    md: "",
    txt: "",
    json: ""
  },
  themeColors: null
};

const PRESETS = [
  {
    id: uid("preset"),
    name: "Math & Code",
    content: "You can render LaTeX like $E=mc^2$ and code blocks.\n\nShow example of Python loop and LaTeX integral: $$\\int_0^1 x^2 dx$$",
  },
  {
    id: uid("preset"),
    name: "JSON Tool",
    content: "Return structured JSON when asked for data summary.\n\nProduce a JSON object with keys: name, version, timestamp.",
  },
];

const STATE = {
  chats: [],
  settings: {},
  uiState: { split: false, activeLeft: null, activeRight: null, focusedSide: "left" },
  presets: [],
};

function load() {
  STATE.chats = getJSON("chats", []);
  STATE.settings = { ...DEFAULT_SETTINGS, ...getJSON("settings", {}) };
  STATE.presets = getJSON("presets", PRESETS);
  STATE.uiState = { ...STATE.uiState, ...getJSON("uiState", STATE.uiState) };
  if (!STATE.uiState.focusedSide) STATE.uiState.focusedSide = "left";
  // seed if empty
  if (STATE.chats.length === 0) {
    resetChatsToTest();
  }
}

function save() {
  setJSON("chats", STATE.chats);
  setJSON("settings", STATE.settings);
  setJSON("presets", STATE.presets);
  setJSON("uiState", STATE.uiState);
}

function createChat(title = "Untitled") {
  const chat = { id: uid("chat"), title, messages: [], pinned: false };
  STATE.chats.push(chat);
  save();
  return chat;
}

function getChat(id) {
  return STATE.chats.find((c) => c.id === id);
}
function addMessage(chatId, role, text, extra = {}) {
  const chat = getChat(chatId);
  if (!chat) return;
  const message = { id: uid("m"), role, text, ts: Date.now(), ...extra };
  chat.messages.push(message);
  save();
  return message;
}

function updateSettings(patch) {
  STATE.settings = { ...STATE.settings, ...patch };
  save();
}

function renameChat(id, newTitle) {
  const c = getChat(id);
  if (c) {
    c.title = newTitle;
    save();
  }
}
function deleteChat(id) {
  STATE.chats = STATE.chats.filter((c) => c.id !== id);
  save();
}
function togglePin(id) {
  const c = getChat(id);
  if (c) {
    c.pinned = !c.pinned;
    save();
  }
}

function setActive(side, chatId) {
  if (side === "left") STATE.uiState.activeLeft = chatId;
  else STATE.uiState.activeRight = chatId;
  save();
}

function setSplit(on) {
  STATE.uiState.split = on;
  save();
}

function setFocusedSide(side) {
  STATE.uiState.focusedSide = side === "right" ? "right" : "left";
  save();
}

// Replace all chats with a single 'Test' chat showcasing features
function resetChatsToTest() {
  STATE.chats = [];
  const test = createChat("Test");
  const now = Date.now();
  test.messages.push(
    { id: uid("m"), role: "assistant", ts: now, text:
`# BEEF Test Chat

This chat demonstrates rendering and interactions:

- Bullet list
- Inline code like \`console.log("hi")\`
- Robust Markdown

Code:
\`\`\`js
function add(a, b) {
  return a + b;
}
console.log(add(2, 3));
\`\`\`

Inline math: $E=mc^2$.

Block math:

$$\\int_0^1 x^2\\,dx = \\tfrac{1}{3}$$

Table:

| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |` }
  );
  STATE.uiState.activeLeft = test.id;
  STATE.uiState.activeRight = null;
  STATE.uiState.split = false;
  STATE.uiState.focusedSide = "left";
  save();
  return test.id;
}

export const state = STATE;
export const stateAPI = {
  load,
  save,
  createChat,
  getChat,
  addMessage,
  updateSettings,
  renameChat,
  deleteChat,
  togglePin,
  setActive,
  setSplit,
  setFocusedSide,
  resetChatsToTest,
};
