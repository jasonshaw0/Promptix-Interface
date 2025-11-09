You are Copilot. Produce a **polished, working front-end** for a **minimal, dark, grid-aesthetic AI chat UI**. Fix all broken interactions noted below and ship a coherent, keyboard-friendly experience.

We are steering aesthetics from the **provided reference images** (curved strands, dot/line grids, tilted cube grid) and the **example snippet (devtools/snippet1.html)** (corner-orbit button, click effect, animated tile grid). Use creative, dynamic, gridlike motifs—not generic ones.


## Visual language (use these)
- **Dark, understated** palette with a single **accent** and shades.
- **Google Fonts**: Add a handful of fonts to select for normal text, code, and even LaTeX. Switchable in **Settings**.
- **Material Symbols** (Outlined & Rounded) via webfont; configurable family in **Settings**.
- **Grid aesthetics** from references:
  - **Dot grid** & **line grid** via CSS gradients.
  - **Curved strands** overlay as an **SVG** layer, very low opacity.
  - **Tilted cube grid** (subtle) using repeating conic/linear gradients or an SVG pattern.
  - Provide a **Settings → General → Animated grid** toggle; animation must be **slow and subtle**.
- **No top bar**. Maximize vertical space. **Composer overlays the chat area** (floats within it).
- **Elevation**: soft, large-radius cards (12–16px), very light inner/outer shadows. Use CSS variables.


## Layout
- **Sidebar (collapsible + resizable)** on the left.
  - Add a **drag handle** (8–10px) to resize; min 220px, max 420px.
  - When **collapsed**, **no inner elements may overlap** the chat area—hide them and show only icons.
  - **Settings button is fixed at the bottom** of the sidebar, not floating over the chat.
  - **Chats** live inside a collapsible **“History”** section (closed by default when collapsed, open by default when expanded).
- **Main** shows either **single chat** or **split (2 panes)** with a **dragger** between them.
  - Each pane: Title, message list, **X** close icon (top-right) that exits split and keeps the other pane.
  - **Composer overlay** docks to the bottom of each pane, not outside.

## Popups & modals (fix all interaction issues)
- **Large modals**: **Settings** and **Search/History**.
  - Centered, block background, **focus trap**, close on **Esc** and **backdrop click**.
  - Tabs **must work**: “General”, “Gemini”, “Data”, “About”, etc.
  - **Gemini tab** must accept and save **API key**, **Model**, **Temperature**, **Max tokens**. 
  - Temperature, max tokens should only be adjustable via **settings**, not the in-chat model popup. The only thing in the in-chat model popup is the model selector.
- **Small anchored popups**: **Model select**, **Export**, **File attach**, **History hover menu**, **Split choices**.
  - Position with a robust **viewport clamp** so they never render off-screen.
  - Close on outside click or **Esc**.
- **Click areas**: all buttons and icons must have proper hit-areas (min 36×36 CSS px).

**Implement a unified popover API (in `ui/popups.js`)**:
- `openPopover(anchor, templateId, {placement, offset})`
- `closePopover(id)`
- Auto-register **outside click** and **Esc** handlers.
- Keep only one small popover open at a time.

## Split behavior (dialed back, reliable)
- **Not default**. Enable by:
  1) Hover a **History item** → inline popup with **pin / rename / delete / split-left / split-right** (two split buttons on that same line).
  2) Hover **New Chat** → after a **short delay (250–300ms)** show a tiny **Left/Right** popup **immediately** (no extra “options” click). The popup must **stay long enough** to click; dismiss on mouseleave or Esc.
- In **single** mode:
  - Choosing a split puts the chosen chat on that side and the current chat (or blank) on the other.
- In **split** mode:
  - Clicking a **history item** **normally** shows a **confirm mini dialog** (Left/Right).
  - Using **explicit** split buttons in the hover popup **replaces** that side immediately, **no confirm**.
- **Drag-to-split** (Windows-style):
  - Drag a history item toward left/right edges; after a brief dwell, show a **side highlight**; drop to split/replace.

**Resizing**:
- Show a vertical handle between panes. Dragging left expands right, and vice versa. Persist the split ratio to state.

**Close**:
- A small **X** in each pane returns to single-pane with the remaining chat.

---

## Composer overlay (clean arrangement)
- **Right side**: **Send** only.
- **Left side**: **Model select** (opens small popover), **Attach**, **Export**.
- **Character count** lives inside/under the textarea at bottom-right. Show ~tokens as well if possible.
- **↑/↓** cycles per-pane **prompt history**. **Enter** sends (unless Shift). **Shift+Enter** newline.

---

## Gemini integration (working)
- **Settings → Gemini**:
  - `API key` (persist to localStorage, warn it’s client-side).
  - `Model` select with defaults: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite` + **Custom** input.
  - Temperature (-/value/+), Max tokens (-/value/+).
- REST call (`api/gemini.js`):
  - `POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}`
  - Body: `{"contents":[{"role":"user","parts":[{"text": "<prompt>"}]}]}`
  - Map errors to friendly messages. If **missing key**, show a single assistant error with **“Open Settings”** action; don’t spam repeated errors.
- **Streaming** optional; local simulated streaming is OK.
- Keep all model calls behind `geminiRequest(prompt, opts)` so we can swap later.

---

## Messages & rendering
- Roles: `user`, `assistant`, `system`, `tool`.
- Markdown (use a lightweight renderer or roll minimal rules):
  - Code fences render in `<pre><code>` with **Copy** button and monospace font.
  - LaTeX **fully rendered** with **KaTeX** or **MathJax** (your choice) for inline `$…$` and block `$$…$$`.
- **Long messages** collapse with **Show more**. Maintain scroll position.
- Per message actions: **Copy** and **Delete**.
- **Export** current chat to `.md` and `.txt` (front-matter: `title`, `date`).

---

## Fix these reported problems (explicit acceptance)
1) **Attach file**, **New chat**, **Settings tabs**, **Presets access**, **Close (X)** — all must perform their action.
2) **Split new chat** popup must **not disappear prematurely**; it must be clickable and work.
3) All inputs must be **dark-themed** (no default white fields).
4) **Settings button** is **not** a floating overlay—**dock it to bottom** of sidebar.
5) **Composer right** shows **Send only**; all other actions on the **left** of the composer.
6) **Sidebar resizer** works; collapsing hides **all** inner content (no overlap).
7) **Popups** (e.g., model selector) **never render off-screen**; always clamp.
8) **All modals/popovers** close on outside click & **Esc** (and trap focus when open).
9) **Tabs**: history items can be **dragged** to reorder; dragging **toward main area** triggers split preview and drop.
10) **Animated grid** actually appears when toggled; dot/line/cube/curves styles are selectable.
11) **Chats History** is a **collapsible category**.
12) **Composer visually connected** to the chat pane (no separate bar look).
13) **Export popup** closes correctly without refresh.

---

## Sidebar content
- **Search** input.
- **Presets** section (collapsible) with quick insert (click to insert at cursor).
- **History** (collapsible) list with hover actions:
  - **Pin**, **Rename**, **Delete**, **Split-Left**, **Split-Right**.
- **Settings** button pinned to bottom.

---

## Accessibility & keyboard shortcuts
- Hit-area ≥ 36×36 CSS px; visible focus rings.
- **Shortcuts (tab in settings to customize)**:
  - Enter / Shift+Enter — send / newline
  - ↑ / ↓ — previous/next prompt in composer
  - Ctrl/Cmd+\\ — toggle split
  - Ctrl/Cmd+Left / Right — focus left/right pane
  - Ctrl/Cmd+B — toggle sidebar
  - Esc — close popover/modal
- **ARIA**:
  - `role="dialog"` with labelledby for modals, `aria-modal="true"`
  - Popovers labelled and anchored with `aria-controls` & `aria-expanded`

---

## Background grids (integrate from example in devtools/snippet1.html)
Create a grid gallery in **Settings → General → Grid style**:
- **Dot grid** (static) using two radial-gradient layers.
- **Line grid** (static) using two linear-gradient layers.
- **Iso / tilted cube** (subtle) via repeating conic/linear gradients or SVG pattern tile.
- **Animated tile grid** (from the base64 tiny PNG example) — slow diagonal motion.
- **Curved lines** overlay using a dedicated **SVG layer** (built programmatically—no CDATA scripts).
  - Provide a function `renderCurves(svgGroup, count, amplitude, spacing)` and call it at mount.

All grid overlays must be **low opacity** and **masked** at edges so they don’t dominate content.

---

## State & persistence
- LocalStorage keys:
  - `ui.settings` (theme, fonts, icons, accent, grid style, animation on/off)
  - `ui.sidebar` (width, collapsed)
  - `chat.activeId`, `chat.split` (boolean), `chat.splitRatio`
  - `chats` (array of { id, title, messages[], pinned, color })
  - `presets` (array)
- Provide **seed data**: 3 example chats and 6 presets (code, LaTeX, JSON/tool result, long message). These should be shown in the presets popup like any other preset, as a sort of demo that presets work too.
- Migrate gracefully if keys are missing.

---

## Utilities you must include
Delegate click helper for list actions.

Focus trap for modals (loop Tab/Shift+Tab).

Drag-to-split highlighter (a semi-transparent overlay snapping to left/right with a label).

QA checklist (Copilot must self-verify)
 New chat creates a chat; hover New Chat shows split L/R popup and is clickable.

 History hover popup shows pin, rename, delete, split L/R; all actions work.

 Dragging a history item toward left/right edges shows highlight; dropping splits or replaces correctly.

 Split resizer persists ratio; clicking X on one pane exits to single pane.

 Sidebar resizer works; collapsed state hides internal UI (no overlap).

 Model popover, Export, File attach popovers open near composer and never offscreen; all close on outside click and Esc.

 Settings modal: tabs switch; Gemini tab saves key/model/values; General tab changes fonts/icons/accent/grid.

 Gemini call returns an assistant message when key is set; missing key shows a single error with an Open Settings action.

 Composer shows char count; ↑/↓ prompt history works; Enter/Shift+Enter behave correctly.

 Animated grid toggle visibly changes the background; curved SVG overlay renders.

 Presets section exists and inserts text into composer.

 All interactive elements have visible focus and 36×36 hit areas.


 

## Final notes 
Build for reliability over flourish. The look should echo the provided grid references; animations must be restrained. Prioritize robust popovers, modals, clamped positioning, and clean keyboard control. If any behavior conflicts, choose the option that keeps the UI predictable and quiet, but not sterile.