/**
 * mine-llm —— 从最近的对话摘要里提炼候选桥(拉式:用户点了「从对话找桥」才跑)。
 *
 * 红线:只产出**提议**,进前端预备桥队列,安置永远由用户点;失败/没料一律返回空数组,不打断任何流程。
 * 调用方式同 classify-llm(复用其 runLlm):一次短生成、解析一行 JSON。
 */

import { runLlm } from './classify-llm.mjs'

function buildMinePrompt(gists, disciplines) {
  const list = (disciplines || []).map((d) => `「${d}」`).join('、') || '（暂无）'
  // 刻度经真实对话标定(2026-08-21):最初"只提炼确实谈到的、不要发挥"过紧——
  // 一段悬疑小说史闲聊被判成"文学内部话题"返回空;放宽为"触及另一领域的侧面也算",
  // 同段对话即稳定产出 文学⟷传播学/历史学/心理学。宁可给出候选让用户挑,过滤权在安置那一步。
  return [
    '你是知识地图的助手。下面是用户和 AI 最近的对话片段(按时间顺序,可能被截断)。',
    '请从中提炼最多 3 个"跨学科连接":能把两门**不同**学科连起来的想法,作为候选桥交给用户挑选。',
    '',
    '学科候选(两端优先从中选;都不贴切才提新学科名):' + list,
    '',
    '什么算跨学科连接(两种都行):',
    '- 对话直接讨论了两个领域的关系;',
    '- 对话主要在一个领域内,但触及了另一个领域的侧面——历史演变→历史学、产业与市场→经济学、媒介与出版→传播学、人的动机→心理学、方法与形式→数学/统计学等。',
    '',
    '规则:',
    '1. why 必须锚在对话实际谈到的内容上,一句话概括;不确定的候选也可以给,由用户决定去留。',
    '2. 对话有实质内容就尽量给出 1–3 个候选;只有纯寒暄、闲聊无实质时才输出空数组。',
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
