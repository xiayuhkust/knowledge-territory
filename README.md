# dsh-pace-popups

English | [中文](README.zh.md)

Small, user-facing "pace-control" popups for the DeepSeek Harness (dsh). Each does one thing to help *you* keep a hand on the pace of an AI session, then gets out of the way. They live on a draggable floating bar that sits over the app; install once and you get the set, and you can switch any of them off in the bar. Zero build, no extra runtime dependencies, and none of them write to the session log. Targets the dsh 0.1.x developer preview; interfaces may shift with dsh.

## What's inside

| Package | What it does |
|---|---|
| [`dsh-plugin-grasp-probe`](packages/grasp-probe) | A quiet nudge above the composer when a session's progress may have run past what you can still vouch for, with a one-question self-check. Reactive and ignorable. |
| [`dsh-plugin-crosslens`](packages/crosslens) | A cross-discipline draw: pick or randomize a field, and get a hook that looks at your current topic through another discipline's eyes. |
| [`dsh-plugin-jiyibi`](packages/jiyibi) | "Mark a note" (记一笔): jot, in your own words, what a moment meant to you. It snapshots that moment's question-and-answer into a searchable personal ledger that outlives the session. |
| [`dsh-plugin-pace-hub`](packages/pace-hub) | The floating bar that hosts the tools above and toggles each on or off. Mounts on the app-global `shell.overlay` slot. |
| [`dsh-pace-popups`](packages/suite) | The bundle — add this one package to mount the whole set. |

## Install

```sh
dsh plugin --profile web add dsh-pace-popups
```

Restart `dsh web`. A floating bar appears; open it for the tools, or switch any off. `dsh --profile web --dump-config` confirms the rows.

> Status: not yet published to npm. Until then, install from source (below).

## From source

This is a pnpm workspace. Clone it, then point your dsh profile at the packages you want — either add the bundle, or add the four plugins individually — and mount them in the profile's `cordis.patch.yml`. Each package is an independent `dsh-plugin-*` unit, so you can also take just one.

## Conventions

- One npm package per plugin, prefixed `dsh-plugin-*`; the `dsh-pace-popups` bundle mounts the set. The repo carries the `dsh-plugin` GitHub topic.
- Plugins are zero-build, hand-written client factories; `react` / `slots` / `connection` are platform externals, and they take no `@deepseek-ai/dsh-*` imports.
- Data flows over each plugin's in-memory Connection RPC channel; the session log is never written.

## License

[MIT](LICENSE)
