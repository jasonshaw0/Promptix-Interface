You are Copilot. Build a **minimal, dark, grid-aesthetic AI chat UI** in **plain HTML/CSS/JS** (no frameworks or build tools. Libraries or similar solutions allowed as needed.). Make heavy use of **Google Material fonts & icons** and other free, open source elements, UI components, etc. **First build must include a working Google Gemini text chat** using an API key the user enters in Settings (including model selector). Keep code organized and modular for future expansion. You do not need to use just a single file for each HTML, CSS, and JS, and should break things into multiple organized files as appropriate.

---

## Visual & Aesthetic
- Dark, understated look with **subtle dynamic gridlines** like the reference images in /devtools/reference images/ (curved lines, dot grid, tilted cube grid). They should be **present but quiet**—usable as:
  - A faint animated background layer, and
  - Occasional **UI framing** (e.g., grid dividers/overlays on chats/panels).
  - Some grid styles should slowly animate (e.g., shifting curves). But keep animations subtle.
- No persistent top bar; **maximize chat height**. Composer and controls are **overlay elements** sitting within the chat area.
- Use **Google Material Symbols** and **Google Fonts** (customizable via Settings):
  - Include default font (e.g., Inter/Roboto) + Material Symbols Outlined/Rounded.
  - Make the font and icon set **switchable** in Settings.
- Color: dark neutrals with an **accent** (and shades/variants used liberally); allow quick accent change in Settings.

---

## Layout (single page)
- **Left Sidebar** (collapsible):
  - Search input, **History** list of chats.
  - Hovering a chat shows a small **inline popup** with: **pin, rename, delete, (two buttons on the same item line) split-left/split-right**.
- **Main Chat Area**:
  - Default: **single chat** view.
  - Optional **split**: at most **2 panes** (left/right) with:
    - A small, subtle, but visible **dragger handle** between panes (pointer events to resize horizontally).
    - Each pane shows title, messages, and an overlay composer.
    - Each split pane has a small **X** button near the top; clicking it closes that pane and returns to single-chat with the remaining pane.
- **Popups & Modals**:
  - **Large modals** (centered, take focus, block until closed) for: **Settings**, **Search/History dialog**.
  - **Small anchored popups** for: **file upload**, **in-chat model select**, **export**, the **history hover menu**, **split choices**, and anything else added either now or later.
  - Use Material motion cues (scale/fade) but keep subtle; trap focus and close on `Esc`.
- **Composer Overlay** (per pane):
  - Multiline `<textarea>`, **character counter**, **↑/↓ prompt history**.
  - Buttons: **Send**, **Stop**, **Regenerate**, **Attach file**, **Export** (icon near composer, not in a top bar).
  - **Model select** (Gemini dropdown) lives as a small anchored popup near the composer.

---

## Split Behavior (precise)
- **Not default**. Split is introduced through:
  1) History item hover popup **Split ▸ Left / Right**, or  
  2) **New Chat** button hover which immediately shows a tiny **Left/Right** popup (with a short delay so it doesn’t get in the way). No extra click to open its popup—appears while hovered.
- In **single** mode and a split is chosen:
  - The selected chat becomes the chosen side; the **other side** becomes the **currently open chat** (or a blank new chat if none).
- In **split** mode:
  - Clicking a history item **normally** (not the split option) shows a **small Left/Right confirm dialog**; user must pick which side to replace.
  - Using explicit **Split Left/Right** from the history hover popup replaces that side immediately **without** the confirm dialog.
- **Drag to split**:
  - Clicking and holding a history item lets the user **drag** toward left/right edges of the main area.
  - Hovering near an edge briefly shows a **side highlight**; releasing drops the chat into that side (create split if single; replace side if already split).

---

## Gemini Integration (first build)
- **Settings modal** includes:
  - **API key** input (stored in `localStorage`), with a warning that client-side keys are exposed.
  - **Model dropdown** (e.g., `gemini-2.5-flash` `gemini-2.5-pro` `gemini-2.5-flash-lite`; allow custom models to be entered as text).
  - **Temperature / max tokens** buttons on either side of the value displayed between them. Buttons increase/decrease by sensible increments, or click on the value to type specific value directly. Going forward, this way of handling numeric options should be reusable for anything that needs it.
  - Font & icon family selectors; Accent color picker.
- Implement a **real text call** to Gemini via **REST**:
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}`
  - Body: `{"contents":[{"role":"user","parts":[{"text": "<prompt>"}]}]}`
  - Handle errors gracefully and show them as assistant error messages.
- **Streaming optional**: you can simulate streaming locally; actual streaming is not required in this build.

> Keep all Gemini calls in one small module (`geminiRequest(prompt, opts)`) so later model/tool features can plug in.

---

## Messages & Rendering
- Message types: `user`, `assistant`, `system`, `tool` (style them subtly).
- Markdown: support code fences with `<pre><code>…</code></pre>` and a **Copy** button. Use 3rd-party libraries as needed.
- LaTeX: fully render math blocks and inline math. You may use libraries like KaTeX, MathJax, or something similar. 
- Long messages: collapsed by default with **Show more / Show less**.
- Each message: timestamp, quick actions (copy, delete).
- **Export** current chat to **.md** or **.txt** via `Blob` download (front-matter with `title` and `date` for .md).

---

## Interactions & Shortcuts
- **Enter** = send (unless `Shift` held). **Shift+Enter** = newline.
- **↑ / ↓** cycles previous prompts in the composer (per pane).
- **Ctrl/Cmd+\\** toggles split mode; **Ctrl/Cmd+Left/Right** focuses pane.
- **Esc** as well as clicking outside the popups/modals (on the blurred background) closes them;

---

## State & Persistence (vanilla)
- `localStorage` keys for: `chats[]`, `settings`, `presets[]`, `uiState`.
- Chat shape: `{ id, title, messages:[{ id, role, text, ts }], pinned?:bool, color?:string }`.
- Seed with a few example presets using the prompt presets feature (include code, “LaTeX-looking” text, JSON/tool-like output, etc.).
- Keep state minimal and readable; modularize with small IIFEs.

---

## Required Popups (examples)
- **Settings** (large modal): General (theme, fonts, icons, accent), Gemini (key, model, temp, max tokens), Data (backup/restore `localStorage`), ... [more categories as needed/in the future], ..., About.
- **Search/History** (large modal): query box and results; open or split left/right.
- **History hover** (small anchored): pin, rename, delete, split-left, split-right.
- **Composer adjacent** (small anchored): model select, export (.md/.txt), file upload.
- **Split confirm** (small dialog) when already split and user chooses a non-split history click.

---

## Grid Aesthetic Implementation
- Create CSS **grid overlays** using repeating-linear-gradient and/or SVG `<pattern>`; apply with low opacity and blend (`mix-blend-mode: screen`/`overlay`).
- Include **one gentle animated** variant (e.g., slowly shifting curves) that can be toggled in Settings.
- Use gridlines for separators and hover states (e.g., pane boundaries, focus rings).
- Use effects and animations for buttons that align with Material motion principles but keep them subtle to maintain the understated aesthetic.

---

## Notes
- Keep code self-documented with clear `// TODO: integrate tools/streaming here` markers.
- Use inline SVG Material icons or the Material Symbols webfont; ensure icons are crisp on dark backgrounds.
- Favor clarity and simplicity over cleverness. The goal is a lean, extensible baseline with a professional feel that echoes the attached grid aesthetics.
