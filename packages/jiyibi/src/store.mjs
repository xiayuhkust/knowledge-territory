/**
 * store —— 「记一笔」的持久账本:一个插件自有的 append-only JSONL,跨会话、活过重启。
 *
 * 铁律:**绝不写会话日志**([[dsh-plugin-no-session-log-events]] 的教训)。意义要能回看 → 必须落盘,
 * 但落在插件自己的文件里(默认 ~/.dsh/jiyibi/marks.jsonl),不碰 session。
 * append-only + 软删除(tombstone):不重写文件,和 dsh 会话日志同哲学。
 *
 * 每条 mark:{ id, ts, sessionId, note(你的话), userAsked/aiSaid(标记时的原文快照), messageId(深链锚) }。
 * 快照在这里就是"电子书划线存下那段话"——躲过 compaction、连会话被删都还在。
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

const FILE = process.env.JIYIBI_FILE || join(homedir(), '.dsh', 'jiyibi', 'marks.jsonl')

function ensureDir() { const d = dirname(FILE); if (!existsSync(d)) mkdirSync(d, { recursive: true }) }

/** 追加一条 mark。返回落盘的完整记录(带 id/ts)。 */
export function addMark(mark) {
  ensureDir()
  const rec = { id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, ts: Date.now(), ...mark }
  appendFileSync(FILE, JSON.stringify(rec) + '\n', 'utf8')
  return rec
}

/** 读出所有有效 mark(应用 tombstone 软删除)。坏行跳过。 */
export function readMarks() {
  if (!existsSync(FILE)) return []
  const byId = new Map(); const deleted = new Set()
  for (const ln of readFileSync(FILE, 'utf8').split('\n')) {
    if (!ln.trim()) continue
    let o; try { o = JSON.parse(ln) } catch { continue }
    if (!o || !o.id) continue
    if (o.deleted) { deleted.add(o.id); continue }
    byId.set(o.id, o)
  }
  const out = []
  for (const [id, o] of byId) if (!deleted.has(id)) out.push(o)
  return out
}

/** 检索 + 按时间倒序(最新在前)。query 在 note/原文快照里做大小写不敏感子串匹配。 */
export function listMarks({ query = '', limit = 200 } = {}) {
  const q = String(query || '').trim().toLowerCase()
  // 带上文件顺序 index 作次级排序键:同一毫秒 ts 会打平,后写(index 大)= 更新 →
  // 以 (ts 降, index 降) 排序,保证"最新在前"稳定(否则同 ms 会退回文件顺序 = 最旧在前)。
  let marks = readMarks().map((m, i) => ({ m, i }))
  if (q) marks = marks.filter(({ m }) => `${m.note || ''} ${m.userAsked || ''} ${m.aiSaid || ''}`.toLowerCase().includes(q))
  marks.sort((a, b) => (b.m.ts || 0) - (a.m.ts || 0) || (b.i - a.i))
  return marks.slice(0, Math.max(1, Math.min(1000, limit || 200))).map(({ m }) => m)
}

/** 软删除:append 一条 tombstone(append-only,不重写文件)。 */
export function removeMark(id) {
  if (!id) return
  ensureDir()
  appendFileSync(FILE, JSON.stringify({ id, deleted: true, ts: Date.now() }) + '\n', 'utf8')
}

export const STORE_FILE = FILE
