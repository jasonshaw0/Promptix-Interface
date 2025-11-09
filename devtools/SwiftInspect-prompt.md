## SwiftInspect — Lightweight DevTools + Cursor Chat (Build Prompt for New Workspace)

You are an expert engineer building a production‑quality, cross‑browser extension and companion MCP server that together deliver a fast, lightweight alternative to Chrome DevTools with an integrated Cursor-powered chat and automation layer. Build this in a fresh workspace from scratch.

Deliver a complete, shippable implementation with excellent DX/UX, typed APIs, tests, and docs.

---

### Objectives
- Build “SwiftInspect”: a multi-purpose developer assistant that feels instant compared to stock DevTools.
- Two primary entry points:
  - Quick Inspect HUD: hold Alt to enter an ultra-fast element picker with a rich details tooltip, Alt+Click to pin.
  - Popup App: a compact, full-featured UI with tabs (Elements, Console, Network, Storage, Accessibility, Events, Performance-lite, Tools) plus an integrated Cursor Chat panel.
- Deep, first-class Cursor MCP integration. Rework the bridge from the ground up for reliability, streaming, and tool richness.
- Run great on Chromium (Chrome, Edge), with a compatibility path for Firefox.

---

### High-Level Architecture
- MV3 browser extension written in TypeScript, bundled with Vite.
- Content scripts:
  - `overlay` for Quick Inspect HUD and element highlighting
  - `page-agent` injected in the page world for safe DOM access + framework detection hooks
- Background service worker:
  - message router, network events capture (webRequest where possible), storage access, long-lived ports
  - optional offscreen document for screenshots/clipboard
- Popup UI:
  - SvelteKit or React + Vite (pick one; prefer Svelte for size/perf). Zero-lag interactions.
  - Tabs: Elements, Console, Network, Storage, Accessibility, Events, Performance, Tools, Chat
- MCP Bridge 2.0:
  - A Node-based MCP server (`swiftinspect-mcp`) that exposes high-level “browser” tools by speaking JSON-RPC over WebSocket to the extension
  - Optional “CDP mode”: attach directly to Chrome’s DevTools Protocol when `--remote-debugging-port=9222` is available, mirroring the same tool surface
  - Robust reconnect, backpressure, request dedupe, and event streaming
- Message Bus:
  - JSON-RPC 2.0 over `chrome.runtime.Port` between popup/content/background; unified schema for both MCP and extension internals

---

### Repository Layout (new workspace)
```
swiftinspect/
  packages/
    extension/
      src/
        background/
          index.ts
          bus.ts
        content/
          overlay.ts
          overlay.css
          page-agent.ts
          dom-utils.ts
        popup/
          app.ts
          index.html
          global.css
          components/
            Tabs.svelte
            Elements.svelte
            Console.svelte
            Network.svelte
            Storage.svelte
            Accessibility.svelte
            Events.svelte
            PerformanceLite.svelte
            Tools.svelte
            Chat.svelte
          state/
            store.ts
        shared/
          rpc.ts
          schema.ts
          types.ts
        manifest.json
      vite.config.ts
      tsconfig.json
      package.json
    mcp/
      src/
        server.ts
        tools/
          dom.ts
          console.ts
          network.ts
          storage.ts
          page.ts
          perf.ts
          utils.ts
        rpc/
          client.ts
          schema.ts
      package.json
      tsconfig.json
  packages/
    e2e/
      tests/
        quick-inspect.spec.ts
        popup-ui.spec.ts
        mcp-tools.spec.ts
      playwright.config.ts
      package.json
  package.json
  pnpm-workspace.yaml
  README.md
  LICENSE
```

---

### UX Requirements

#### Quick Inspect HUD (Alt to inspect)
- Hold Alt: show crosshair cursor, highlight DOM element under pointer with translucent overlay and bounding box.
- Tooltip near cursor with:
  - tag, id, class summary; accessible name and role
  - unique CSS selector, XPath, index path (copy buttons)
  - size (content + padding/border/margin), position, z-index, stacking context info
  - color/typography preview (effective font family, weight, size, line-height), computed color with contrast
  - top 20 computed styles differing from UA defaults; custom properties in scope with resolved values
  - data-attributes and other notable attributes
  - framework metadata (React fiber key/name, Vue component name, Svelte component if detectable)
  - event listeners summary detected via `getEventListeners` or monkey-patching addEventListener in page-agent
  - buttons: copy selector/xpath/html, open in Elements tab, screenshot element, scroll into view, lock overlay
- Interactions:
  - Alt+Scroll to move up/down the ancestor chain
  - Alt+Click to pin the tooltip (sticky); Esc to unpin
  - Shift while pinned enables multi-select compare mode (diff box model/contrast)
  - Ctrl+C while HUD is visible copies the best unique selector

HUD performance: target <4ms hover update budget. Use RAF for painting and a shadow DOM root to avoid clobbering page styles. No layout thrashing.

#### Popup App (compact, all-in-one)
- Tabs and core features (each must be fast and keyboard-first):
  - Elements:
    - DOM tree view with incremental rendering, search, and “reveal selected” from HUD
    - Right sidebar shows: attributes editor, styles editor (author|computed|inherited), cascade/specificity view, box model, variables viewer
    - Inline style editing with CSS autocomplete and color picker; live updates via page-agent
  - Console:
    - Full console with levels, filters, multiline input, history, object previews, async/await, `$0` for selected element, `$i()` for last hovered, `copy()` helper
    - Captures page `console.*`, errors, unhandled rejections; can persist logs
  - Network:
    - Lightweight XHR/fetch logger via service worker proxy or content hooks; show method, status, timing, size; preview JSON/HTML; copy cURL
  - Storage:
    - localStorage, sessionStorage, cookies, IndexedDB list/browse; edit & export
  - Accessibility:
    - role/name tree, landmarks, contrast checks, tab order issues; quick fixes suggestions
  - Events:
    - list event listeners per node; enable “monitor events” and count fires; timeline dots
  - Performance-lite:
    - simple FPS meter, layout/thrash counter, long-task detector, paint flashing toggle
  - Tools:
    - selector tester, CSS variable search, screenshot (element|viewport|full page), eyedropper, viewport presets
  - Chat:
    - Cursor-integrated chat panel; see “MCP Bridge 2.0” below. Chat can run tools to act on the current page context.

Popup should open via the extension action button; remember last tab; support Ctrl/Cmd+K command palette to run any action or MCP tool by name.

---

### MCP Bridge 2.0 (Rebuilt)
Goals: reliability, streaming, rich tool surface, low coupling to extension internals, easy to test headless.

Components:
- `swiftinspect-mcp` (Node). Registers in Cursor via `.cursor/mcp.json` as `swiftinspect`.
- Transport:
  - Default: WebSocket `ws://127.0.0.1:9752` with auth token from env or file
  - Extension connects outbound to MCP; MCP maintains per-tab “sessions”
  - Optional CDP mode (no extension): MCP connects to Chrome DevTools Protocol and implements the same tools
- Protocol: JSON-RPC 2.0 with server push via `event/*` notifications.
- Core tools and signatures (implement all; examples below are TypeScript type hints):

```ts
// dom.ts
inspectHovered(): Promise<{
  tabId: number
  selector: string
  xpath: string
  role?: string
  name?: string
  box: { x: number; y: number; width: number; height: number }
  styles: Record<string, string>
  variables: Record<string, string>
  attributes: Record<string, string>
}>

getElementDetails(params: { selector: string }): Promise<{
  outerHTML: string
  listeners: Array<{ type: string; useCapture: boolean; passive?: boolean; once?: boolean }>
  frameworks?: { react?: any; vue?: any; svelte?: any }
}>

query(params: { selector: string }): Promise<{ count: number }>
click(params: { selector: string }): Promise<{ ok: true }>
type(params: { selector: string; text: string; delayMs?: number }): Promise<{ ok: true }>
scrollIntoView(params: { selector: string; block?: 'start'|'center'|'end' }): Promise<{ ok: true }>
setStyle(params: { selector: string; property: string; value: string }): Promise<{ ok: true }>
```

```ts
// console.ts
evaluate(params: { expression: string; context?: 'page'|'isolated' }): Promise<{ result: any }>
subscribeLogs(): Promise<{ ok: true }> // emits event/console with {level, args, time}
clear(): Promise<{ ok: true }>
```

```ts
// network.ts
subscribe(): Promise<{ ok: true }> // emits event/network/*: requestWillBeSent, responseReceived, finished
getRequests(params?: { filter?: string }): Promise<{ items: Array<NetworkEntry> }>
getResponseBody(params: { requestId: string }): Promise<{ body: string; base64?: boolean }>
```

```ts
// storage.ts
getLocalStorage(): Promise<Record<string, string>>
setLocalStorage(params: { key: string; value: string }): Promise<{ ok: true }>
cookies(): Promise<Array<{ name: string; value: string; domain: string; path: string }>>
```

```ts
// page.ts
screenshot(params?: { fullPage?: boolean; selector?: string }): Promise<{ dataUrl: string }>
getInfo(): Promise<{ url: string; title: string; viewport: { width: number; height: number } }>
```

Events (server -> client):
- `event/hover` with current selector and box for HUD-follow features
- `event/console` with page console payloads
- `event/network/request|response|finished` items

Cursor Chat Integration:
- Provide a ready-to-drop `.cursor/mcp.json` snippet and setup guide.
- In the Popup’s Chat tab, use the MCP server directly (WebSocket client) so chat can call the same tools.
- Provide “context providers” that attach current selection, last screenshot, and recent network entries to the chat.

---

### Extension Internals
- `page-agent.ts` runs in page realm to:
  - instrument add/removeEventListener
  - probe for frameworks: React (window.__REACT_DEVTOOLS_GLOBAL_HOOK__), Vue (Vue devtools hook), Svelte heuristics
  - expose safe, minimal commands via window.postMessage
- `overlay.ts`:
  - draws highlight using <div> and shadow root; reads layout via `getBoundingClientRect`
  - keeps a small LRU cache of computed styles for recently hovered nodes
  - emits hover events to background (throttled)
- `background/index.ts`:
  - central bus: ports from popup, content scripts; WebSocket to MCP
  - webRequest listeners for request metadata when permissions allow
  - screenshot via `tabs.captureVisibleTab`

Performance guardrails:
- Minimize forced reflow; batch read/write; RAF scheduling; zero setInterval tickers.
- Avoid heavy libraries; no jQuery; only small utilities.

---

### Manifest (MV3) Requirements
- Permissions: `activeTab`, `scripting`, `storage`, `clipboardWrite`, `tabs`, `webRequest`, host permissions: `<all_urls>`
- Background: service_worker
- Action with `default_popup` (Popup App)
- Content scripts: `overlay` and `page-agent` with `run_at: document_idle`
- Optional offscreen document for screenshot utilities

---

### Keyboard Shortcuts
- Alt: enter/hold Quick Inspect HUD
- Alt+Scroll: traverse ancestors; Alt+Click: pin/unpin
- Esc: exit HUD or unpin
- Ctrl/Cmd+K: command palette in Popup
- Ctrl+Shift+Y: toggle Popup from keyboard (define in commands)

---

### Testing & Quality
- Playwright e2e to validate:
  - HUD highlight correctness, keyboard behavior, copy actions
  - Popup Elements edits reflect on page
  - Console evaluation and log subscription
  - Network capture and response body fetch
  - MCP tool calls from chat trigger page actions
- Unit tests for RPC schema and message bus
- ESLint + Prettier + TypeScript strict

---

### Security & Privacy
- Never exfiltrate page content; everything runs locally.
- Explicitly request permissions via UX prompts; enable network logging only when toggled.
- Sanitize console and network previews to avoid executing page HTML.

---

### Deliverables
- Complete monorepo with packages: `extension`, `mcp`, `e2e`
- Build scripts: `pnpm -r build`, `pnpm -r dev`
- Packed extension `.zip` and MCP NPM package `swiftinspect-mcp`
- Docs:
  - Setup (Chrome/Edge/Firefox), dev workflow, publishing
  - Cursor integration instructions with ready `.cursor/mcp.json`
  - Keyboard map, troubleshooting

---

### Cursor Integration Snippets
Provide these files in the new workspace’s `docs/` folder:

`docs/cursor-mcp.json`:
```json
{
  "mcpServers": {
    "swiftinspect": {
      "command": "node",
      "args": ["./packages/mcp/dist/server.js"],
      "env": {
        "MCP_MODE": "stdio",
        "SWIFTINSPECT_WS_URL": "ws://127.0.0.1:9752",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Chat tool examples for the model (describe in README) so it can:
- “Select the element matching `.sidebar .item:nth-child(3)` and screenshot it.”
- “Find color contrast issues on the current page and propose fixes.”
- “Show requests to `/api/*` in the last 60s and copy the cURL for the latest POST.”

---

### Stretch Goals
- Source maps and pretty-print for inline scripts
- Lighthouse-lite checks run in a web worker
- Recorder: generate Playwright steps from interactions
- Live Tailwind/Bootstrap token explorer

---

### Acceptance Criteria
- Alt HUD is instantaneous and stable; tooltip provides the outlined data and copy actions.
- Popup covers all listed tabs; Console and Elements are reliable and latency-free.
- MCP tools work from both Cursor and the Popup Chat; event streaming verified.
- Works on latest Chrome and Edge; Firefox path wraps missing APIs where feasible.
- Codebase is clean, typed, documented, and tested; one-command dev and build.

---

### Implementation Notes for You (the builder)
- Favor Svelte for the popup unless you have a strong reason to pick React; performance matters.
- Build the JSON-RPC types once (`shared/schema.ts`) and reuse across extension and MCP.
- Keep dependency bloat minimal; avoid large UI kits; write focused components.
- Ensure the overlay/tooltip visually echoes Chrome’s box-model card (colors, spacing) but keep it lighter.


