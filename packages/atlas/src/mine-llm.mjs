/**
 * mine-llm —— 从最近的对话摘要里提炼候选桥(拉式:用户点了「从对话找桥」才跑)。
 *
 * 红线:只产出**提议**,进前端预备桥队列,安置永远由用户点;失败/没料一律返回空数组,不打断任何流程。
 * 调用方式同 classify-llm(复用其 runLlm):一次短生成、解析一行 JSON。
 */

import { runLlm } from './classify-llm.mjs'

function buildMinePrompt(gists, disciplines) {
  const list = (disciplines || []).map((d) => `「${d}」`).join('、') || '（暂无）'
  return [
    '你是知识地图的助手。下面是用户和 AI 最近的对话片段(按时间顺序,可能被截断)。',
    '请从中提炼最多 3 个"跨学科连接":对话里真实出现过的、能把两门**不同**学科连起来的想法。',
    '',
    '学科候选(两端优先从中选;都不贴切才提新学科名):' + list,
    '',
    '规则:',
    '1. 只提炼对话里**确实谈到**的连接,不要凭空发挥;一个都没有就输出空数组。',
    '2. why 用一句话概括,尽量贴近对话的原话/原意。',
    '3. 两端必须是不同学科。',
    '',
    '对话片段:',
    ...gists.map((g, i) => `[${i + 1}] ${g}`),
    '',
    '只输出一行 JSON,不要解释或代码块:{"bridges":[{"a":"学科名","b":"学科名","why":"一句话"}]}',
  ].join('\n')
}

function parseMine(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return []
  try {
    const o = JSON.parse(m[0])
    const arr = Array.isArray(o?.bridges) ? o.bridges : []
    return arr
      .map((b) => ({ a: String(b?.a || '').trim(), b: String(b?.b || '').trim(), why: String(b?.why || '').trim() }))
      .filter((b) => b.a && b.b && b.a !== b.b)
      .slice(0, 3)
  } catch (e) { return [] }
}

export function makeMiner(ctx, opts = {}) {
  return async function mine(gists, disciplines) {
    return parseMine(await runLlm(ctx, buildMinePrompt(gists, disciplines), { maxTokens: 700, ...opts }))
  }
}
