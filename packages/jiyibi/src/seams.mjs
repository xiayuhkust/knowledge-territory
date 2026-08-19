/**
 * seams —— host 接缝:从 session 事件里取"当前这一刻"的锚点(标记时快照它)。
 *
 * 事件形状照 grasp/crosslens 标定:assistant 最终消息 = `assistant/message`,文本在
 * `data.message.content` 的 text 块、id 在 `data.message.id`;真人用户轮 = `user/message`,
 * 文本/来源在 `data` 顶层。(host 接缝件将来可抽成系列共享基座;现按 standalone 就地复制。)
 */

/** assistant 最终消息 → { text, id }。非文本/空则 text=''。 */
export function assistantOf(event) {
  const m = event?.data?.message
  const content = m?.content
  if (!Array.isArray(content)) return { text: '', id: '' }
  const text = content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('').trim()
  return { text, id: typeof m?.id === 'string' ? m.id : '' }
}

/** user/message 是否真人输入(排除 plugin/goal/inject 等合成来源)。 */
export function isHumanUserMessage(data) {
  const kind = data?.source?.kind
  if (!kind) return true
  return !['plugin', 'goal', 'agent', 'inject', 'compaction', 'system'].includes(kind)
}

/** 真人用户轮 → 纯文本;合成来源/空则 ''。 */
export function humanUserOf(event) {
  const data = event?.data
  if (!isHumanUserMessage(data)) return ''
  let text = ''
  if (typeof data?.text === 'string') text = data.text
  else if (Array.isArray(data?.content)) text = data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('')
  return text.trim()
}
