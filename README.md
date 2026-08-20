# 知识疆域 · Knowledge Territory

English | [中文](README.zh.md)

A living knowledge map for DeepSeek Harness (dsh). Disciplines are continents, sub-disciplines are states, and the connections you confirm become bridges between them. The map starts as an empty white sea and grows only from what you actually connect — the AI proposes two ends, you place the bridge.

<p align="center">
  <img src="docs/atlas.png" width="860" alt="知识疆域: vivid discipline continents on a white sea; dashed bridges with a diamond link-counter; the left rail holds the discipline overview and the connections waiting to be placed">
</p>

## How the territory grows

- **A shared discipline library.** One catalog of 14 level-1 disciplines (each with its level-2 sub-disciplines) is shared between the map and the card-draw tool. The *学科总览* (discipline overview) panel shows the whole library as color blocks; unopened ones are dimmed — click one to open it as a continent, click a sub-discipline to open it as a state inside its continent. You can also add your own.
- **Bridges and links.** A bridge is one line between two disciplines. A link is one piece of evidence on that bridge — a card's hook sentence, a note, or a line you type by hand. The diamond on a bridge shows its link count; click it to read the links, edit them, or re-point either end (the two ends are clickable chips).
- **Feeders.** Draw a cross-discipline card (跨学科抽卡) or jot a note (记一笔) and send it to the territory. It lands in the left rail as a pending connection; the AI guesses the two ends, you confirm or change them, then place it. Cards keep their one-line hook on the bridge; notes keep a back-reference, so a link can jump back to the original note.
- **The header readout** counts the links you've lit, the discipline pairs you've bridged, and the connections still waiting for you.

The last step — deciding that two things connect — always stays with you. Nothing lands on the map until you place it.

## What's inside

| Package | Role |
|---|---|
| [`dsh-plugin-atlas`](packages/atlas) | **知识疆域** — the map itself. Discipline continents, sub-discipline states, bridges carrying links. Full-screen, opened from the floating bar. |
| [`dsh-plugin-crosslens`](packages/crosslens) | 跨学科抽卡 — draw a cross-discipline hook on your current topic, from the same discipline library as the map. A drawn card can be sent to the territory. |
| [`dsh-plugin-jiyibi`](packages/jiyibi) | 记一笔 — jot, in your own words, what a moment meant. A note can be sent to the territory; the jotting stays a searchable personal ledger, and its bridge link can jump back to it. |
| [`dsh-plugin-pace-hub`](packages/pace-hub) | The draggable floating bar (titled 知识疆域): opens the map, hosts 跨学科抽卡 and 记一笔, and toggles each tool. |
| [`dsh-plugin-pace-skin`](packages/pace-skin) | The shared skin: one set of `--pp-*` tokens so the whole set looks like one thing. |
| [`dsh-pace-popups`](packages/suite) | The bundle. Its `cordis.patch.yml` is the canonical mount list. |
| [`dsh-plugin-grasp-probe`](packages/grasp-probe) | 停一下 — a quiet nudge above the composer when a session may have run past what you can vouch for. Auxiliary; **off by default**, switch it on in the bar if you want it. |

## Design rules

- **AI proposes, you connect.** AI-guessed bridge ends are proposals; nothing lands on the map until you confirm it.
- **The session log is never written.** Every plugin moves data over its own in-memory Connection RPC channel.
- **Zero build.** Hand-written client factories; `react` / `slots` / `connection` are platform externals.

## Install

`dsh` resolves plugins by installed package identity, so install the plugins from this repo into your profile.

```sh
# 1. clone
git clone https://github.com/xiayuhkust/dsh-pace-popups
cd dsh-pace-popups

# 2. add the plugins to your dsh profile (run from this repo root)
dsh plugin --profile web add \
  ./packages/pace-skin \
  ./packages/atlas \
  ./packages/crosslens \
  ./packages/jiyibi \
  ./packages/pace-hub \
  ./packages/grasp-probe
```

3. Mount them: copy the `- insert:` rows from [`packages/suite/cordis.patch.yml`](packages/suite/cordis.patch.yml) into your profile's `cordis.patch.yml` (keep `pace-skin` first).

Restart `dsh web`. A floating bar appears; open it, pin **🗺️ 打开知识疆域** to enter the map, or draw a card / mark a note and send it in. `dsh --profile web --dump-config` confirms the rows.

Want just the map? Add `pace-skin`, `atlas`, and `pace-hub` and their rows — the feeders are optional, and `grasp-probe` is off by default either way.

## Conventions

- One package per plugin, prefixed `dsh-plugin-*`; the `dsh-pace-popups` bundle collects them. The repo carries the `dsh-plugin` GitHub topic.
- Plugins are zero-build, hand-written client factories; `react` / `slots` / `connection` are platform externals.
- Backend LLM work (card draws, bridge classification) goes through the host's `ctx.llm`; the session log is never written.

## License

[MIT](LICENSE)
