# BEEF (Backend Execution & Evaluation Framework)

Minimal, fast, and pragmatic AI chat UI. Built with plain HTML/CSS/JS. No frameworks, no build step.

## Why this UI instead of yet another AI front end?
- **Keyboard-first flow**: zero-latency input, predictable shortcuts, no reactivity lag.
- **Split panes**: work on two chats side-by-side for compare/contrast or context transfer.
- **Persisted state**: localStorage with explicit backup/restore; no hidden sync or vendor lock-in.
- **Robust rendering**: Markdown, math (KaTeX), and code blocks with clean, readable defaults.
- **Extensible surface**: popovers and modals are simple DOM templates; easy to change without a component system.
- **Theming without entanglement**: CSS variables only. Swap palettes without refactoring UI code.

## Screenshots (placeholders)
- Main interface  
  `docs/screenshots/main.png`
- Split panes  
  `docs/screenshots/split.png`
- Settings → Styles  
  `docs/screenshots/styles.png`

## Quick start
1. Open `index.html` in a modern browser.
2. Open Settings → enter your API key (or run behind your own proxy).

No build step. All assets are local.

## Keyboard shortcuts
- Enter: send
- Shift+Enter: newline
- Ctrl/⌘ + \\: toggle split
- Ctrl/⌘ + ←/→: focus pane
- Esc: close popover/modal

## Project structure
- `index.html` — application shell and DOM templates
- `assets/css` — `base.css` (tokens/primitives) and `theme.css` (layout/components)
- `assets/js` — app wiring, state, sidebar, panes, features

## Theming
Edit CSS variables in `assets/css/base.css`, or choose a preset in Settings → Styles. Presets are defined in `assets/js/app.js`.

## Data and privacy
All chats and settings are stored in localStorage. Export/import JSON from Settings. Nothing is sent anywhere except to the API you configure.

## Notes
This UI is intentionally generic. That’s the point. It focuses on speed, clarity, and hackability rather than novelty. If you need to bend it, you can do so with a few lines of HTML/CSS/JS.
