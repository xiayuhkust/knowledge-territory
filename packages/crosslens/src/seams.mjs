/**
 * seams —— host 接缝:原始 session 事件 → 上下文 gist(喂给联想器的"最近在聊什么")。
 *
 * 事件形状照 grasp-probe 在 dev profile(2026-08-17)标定的:
 * - assistant 最终消息 = `assistant/message`,文本在 `data.message.content` 的 text 块里,来源 `data.message.source`;
 * - 真人用户轮 = `user/message`,文本/来源在 `data` 顶层(`data.content` / `data.source`)。
 * (这几个 host 接缝件将来可能抽成系列共享基座;现按 standalone 决定就地复制。)
 */

/** assistant 最终消息 → 一条上下文 gist("AI:…");非文本/空则 ''。 */
export function assistantGist(event) {
  const content = event?.data?.message?.content
  if (!Array.isArray(content)) return ''
  let last = ''
  for (const b of content) if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) last = b.text
  return last ? `AI:${last.trim().replace(/\s+/g, ' ').slice(0, 160)}` : ''
}

/** user/message 是否真人输入(排除 plugin/goal/inject 等合成来源)。 */
export function isHumanUserMessage(data) {
  const kind = data?.source?.kind
  if (!kind) return true
  return !['plugin', 'goal', 'agent', 'inject', 'compaction', 'system'].includes(kind)
}

/** 真人用户轮 → 一条上下文 gist("用户:…");合成来源/空则 ''。 */
export function humanUserText(event) {
  const data = event?.data
  if (!isHumanUserMessage(data)) return ''
  let text = ''
  if (typeof data?.text === 'string') text = data.text
  else if (Array.isArray(data?.content)) text = data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('')
  text = text.trim().replace(/\s+/g, ' ')
  return text ? `用户:${text.slice(0, 160)}` : ''
}
