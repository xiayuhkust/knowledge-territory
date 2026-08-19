# dsh-plugin-jiyibi

Part of [dsh-pace-popups](../../README.md). "Mark a note" (记一笔) for the DeepSeek Harness (dsh) web UI — like e-book marginalia, for an AI conversation.

Jot, in your own words, what a moment meant to you. Marking snapshots that moment's question-and-answer into a searchable personal ledger that outlives the session (immune to context compaction — the snapshot is frozen at mark time). Browse by time or by session; expand any note to re-read the exact exchange it was made on. The AI keeps the full log; you keep what mattered — it never writes the note for you.

- **Channel:** in-memory Connection RPC `/jiyibi` (`add` / `latest` / `list` / `remove`). No LLM.
- **Ledger:** a plugin-owned append-only JSONL at `~/.dsh/jiyibi/marks.jsonl` (override with `JIYIBI_FILE`). **Never** the session log.
- **UI:** now hosted in the [pace-hub](../pace-hub) floating bar (write + browse + by-session index + re-read the moment's Q&A).

Honors the shared `pace-popup:enabled:jiyibi` flag.
