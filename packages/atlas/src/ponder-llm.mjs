/**
 * ponder-llm —— 探索模式:用户选好桥的两端,请 LLM 想连接理由(B1 定义的第三种玩法)。
 *
 * 红线同 mine-llm:只出**提议**,收哪条、收不收都在用户;失败返回空数组。
 * 一次给 3 条不同角度的理由,要求落在具体概念/机制/案例上,反空泛。
 */

import { runLlm } from './classify-llm.mjs'

function buildPonderPrompt({ discA, discB, subA, subB }) {
  const a = subA ? `${discA}·${subA}` : discA
  const b = subB ? `${discB}·${subB}` : discB
  return [
    `你是知识地图的助手。用户想在「${a}」和「${b}」两门学科之间架一座桥,请你想出 3 个具体的连接理由供挑选。`,
    '',
    '要求:',
    '1. 每条落在具体概念/机制/案例上(如"最小作用量原理与经济学的最优化同构"),不要空泛的"两者都研究复杂系统"。',
    '2. 一句话一条,≤60 字。',
    '3. 三条角度尽量不同(方法迁移/共同结构/历史渊源/具体案例…)。',
    '',
    '只输出一行 JSON,不要解释或代码块:{"ideas":["…","…","…"]}',
  ].join('\n')
}

function parsePonder(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return []
  try {
    const o = JSON.parse(m[0])
    const arr = Array.isArray(o?.ideas) ? o.ideas : []
    return arr.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3)
  } catch (e) { return [] }
}

export function makePonderer(ctx, opts = {}) {
  return async function ponder(ends) {
    return parsePonder(await runLlm(ctx, buildPonderPrompt(ends || {}), { maxTokens: 600, ...opts }))
  }
}
