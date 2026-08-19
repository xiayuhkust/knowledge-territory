# dsh-plugin-grasp-probe

Part of [dsh-pace-popups](../../README.md). A quiet, ignorable nudge for the DeepSeek Harness (dsh) web UI.

When a session's progress may have run past what you can still vouch for — e.g. several rubber-stamp "continue" replies in a row — a faint line appears above the composer suggesting you pause, with a one-question self-check (flashcard style). It is reactive (it watches conversation state, it is not a timer) and always ignorable.

- **Channel:** in-memory Connection RPC `/grasp-probe`. Never writes the session log.
- **Config** (via the profile / bundle patch):
  - `scale` — progress weight (default `0.166`).
  - `score.threshold` — prompt threshold; `1.6` ≈ three rubber-stamp replies in a row.
- **Client:** zero-build hand-written factory in `lib/client.js`; renders in `conversation.input.dock`.

Honors the shared `pace-popup:enabled:grasp` flag so the pace-hub bar can switch it off.
