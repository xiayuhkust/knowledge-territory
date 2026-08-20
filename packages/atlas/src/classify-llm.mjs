/**
 * classify-llm —— 用 dsh 的 LLM 服务，把一条笔记判成"它连接了哪两门学科"。
 *
 * 定位:桥的两端由 AI 先猜（红线:AI 提议、用户点亮/改）。写法照 crosslens 的 associate-llm：
 * createUserMessage → 排干 ctx.llm.stream → 取 text 块 → 解析一行 JSON。
 * reasoningEffort 'none':短结构化判断不需思维链（'off' 已被 DeepSeek API 弃用会 400）。
 */

import { createUserMessage, BlockAssembler } from '@deepseek-ai/dsh-llm'

async function runLlm(ctx, prompt, opts = {}) {
  const { provider = 'deepseek-official', model = 'deepseek-v4-flash', maxTokens = 512, attempts = 2, reasoningEffort = 'none' } = opts
  const messages = [createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'plugin', plugin: 'atlas' } })]
  const options = { provider, model, messages, maxTokens, reasoningEffort, ...(opts.signal ? { signal: opts.signal } : {}) }
  let lastErr
  for (let i = 0; i < Math.max(1, attempts); i++) {
    try {
      const asm = new BlockAssembler()
      for await (const chunk of ctx.llm.stream(options)) asm.push(chunk)
      const f = asm.finish
      if (f?.kind === 'error') throw new Error(`llm ${f.failure?.code || 'error'}: ${f.failure?.message || 'stream error'}`)
      if (f?.kind === 'aborted') throw new Error('llm aborted')
      return asm.blocks().filter((b) => b.type === 'text').map((b) => b.text).join('')
    } catch (e) { lastErr = e }
  }
  throw lastErr
}

function buildClassifyPrompt(text, disciplines) {
  const list = (disciplines || []).map((d) => `「${d}」`).join('、') || '（暂无）'
  return [
    '你是知识地图的分类助手。用户写了一条读书/思考笔记，要把它作为一座"桥"架在两块学科大陆之间。',
    '请判断这条笔记最能连接哪两门**不同**的学科。',
    '',
    '现有学科（优先从中选）：' + list,
    '',
    '规则：',
    '1. 尽量从"现有学科"里选出两门最相关、且彼此不同的学科。',
    '2. 只有当现有学科明显都不贴切时，才提出新的学科名（简洁规范的学科名，如"神经科学"）。',
    '3. 若笔记其实主要落在一门学科里，第二个就给一门能与它对话的相关学科。',
    '',
    '笔记：',
    text,
    '',
    '只输出一行 JSON，不要任何解释或代码块：{"a":"学科名","b":"学科名","why":"一句话:为什么这条笔记把它们连起来"}',
  ].join('\n')
}

function parseClassify(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0])
    if (o && o.a && o.b) return { a: String(o.a).trim(), b: String(o.b).trim(), why: String(o.why || '').trim() }
  } catch (e) { /* ignore */ }
  return null
}

export function makeClassifier(ctx, opts = {}) {
  return async function classify(text, disciplines) {
    return parseClassify(await runLlm(ctx, buildClassifyPrompt(text, disciplines), opts))
  }
}
