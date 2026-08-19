# dsh-plugin-pace-hub

Part of [dsh-pace-popups](../../README.md). The floating bar for the suite, for the DeepSeek Harness (dsh) web UI.

A small draggable bar that sits over the whole app (like an IME floating strip). It hosts the suite's user-driven tools and toggles each popup on or off. Collapsed it is a handle; drag to move (position persists), click to open.

- **Mount:** the app-global `shell.overlay` slot (always mounted, click-through, survives route/session changes). Gets the current session id from the injected `useSessions(s => s.current)` prop.
- **Tabs:** 🎲 cross-discipline draw · ✍ 记一笔 (mark + browse: by time / by session, and re-read a note's snapshotted Q&A) · ⚙ on/off toggles.
- **Toggles:** write a shared `pace-popup:enabled:<slug>` localStorage flag and broadcast a `pace-popup:changed` event; each popup honors it live (renders null when off), no reload.

Zero-build hand-written client. Calls the other plugins' existing RPC channels directly; adds no backend state of its own.
