# dsh-plugin-crosslens

Part of [dsh-pace-popups](../../README.md). A "cross-discipline draw" for the DeepSeek Harness (dsh) web UI.

Pick a few disciplines (presets, free input, or the 🎲 random-niche-field button), then draw a card: the model gives a hook that looks at your current topic through another discipline's eyes — a lateral prompt, not an answer. Off-list picks are labelled.

- **Channel:** in-memory Connection RPC `/crosslens` (endpoint `associate`). Never writes the session log.
- **LLM:** utility call at `reasoningEffort: 'off'` (classification/short-generation needs no reasoning). Provider/model configurable via the patch (`provider`, `model`).
- **UI:** now hosted in the [pace-hub](../pace-hub) floating bar (the in-dock version is kept but no longer registered).

Honors the shared `pace-popup:enabled:crosslens` flag.
