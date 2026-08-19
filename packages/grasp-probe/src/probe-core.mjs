/**
 * probe-core —— grasp-probe 后端的纯编排核心,零外部依赖(只用 grasp-live)。
 *
 * 拆出来是为了能脱离 dsh/模型单测:index.mjs 那层只做 dsh 接线(RPC 通道 + 事件订阅),
 * 真正的「观察→判官→累加→发布」编排逻辑全在这里,可用假 host + 假判官验证(见 probe-loop.test.mjs)。
 */

import { createGraspState, stepAgent, stepUser } from './grasp-live.mjs'

export const SCALE = 0.166 // 把 adapt 出的推进权重压到累加器量级(在真 trace 上标定)

/**
 * 造一个会话的探针。
 *   judge: async (pairs)=>labels(必需,判 steer/ride/neutral)。
 *   asker: async (recentGists)=>问题字符串(可选,shouldPrompt 触发时生成 1 问)。
 * 每个人类用户轮返回要发布的投影 view { gap, shouldPrompt, reason, questions }。
 */
export function createSessionProbe({ judge, asker, onError, onJudge, scale = SCALE, opts = {} } = {}) {
  const state = createGraspState(opts)
  let span = { weight: 0, gist: '(会话开始)' }
  let recent = [] // 自上次 steer 以来各 agent 跨度做了什么,喂给提问器

  const isRealGist = (g) => g && g !== '(会话开始)' && g !== '(上一轮推进)'
  const note = (stage, e) => { try { onError?.(stage, e) } catch { /* ignore */ } }

  return {
    /** agent 在本轮产出了推进(文本/工具);累进到当前跨度。 */
    noteAgent(weight, gist) {
      if (weight > 0) span.weight += weight
      if (gist) span.gist = gist
    },
    /** 人类用户轮到达。返回该轮之后的投影 view(供 append)。 */
    async onUserMessage(userText) {
      if (span.weight > 0) stepAgent(state, { output: span.weight * scale })
      let label = 'neutral'
      try {
        const labels = await judge([{ id: 'u', aiDid: span.gist, user: userText }])
        if (labels[0]?.label) label = labels[0].label
      } catch (e) { note('judge', e) } // 判官失败 → 保守当 neutral,但不再无声
      try { onJudge?.(label, userText, span.gist) } catch { /* ignore */ } // 标定用:看判官把这句判成了啥
      if (isRealGist(span.gist)) { recent.push(span.gist); if (recent.length > 6) recent.shift() }
      const view = stepUser(state, label)
      if (label === 'steer') recent = [] // 重新入环 → 忘掉这段漂移
      span = { weight: 0, gist: '(上一轮推进)' }
      // 只在真正触发那一刻生成 1 问 + 参考答案(节流后很稀;失败则留空,前端显示占位)
      if (view.shouldPrompt && asker) {
        try {
          const qa = await asker(recent.slice())
          if (qa?.question) { view.questions = [qa.question]; view.answer = qa.answer || '' }
        } catch (e) { note('ask', e) }
      }
      return view
    },
  }
}

/** 收一个干净的单问:去围栏/引号,取首个非空行。纯函数,判官适配层复用。 */
export function cleanQuestion(text) {
  if (!text) return ''
  const s = String(text).trim().replace(/^```[\s\S]*?\n|```$/g, '').trim()
  const line = s.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || ''
  return line.replace(/^["'「『]|["'」』]$/g, '').trim()
}

/**
 * 解析提问器输出的「问题 + 答案」。期望格式:
 *   问题：xxx
 *   答案：yyy
 * 容忍围栏、问/答/参考答案变体、缺答案(答案回退空)。返回 { question, answer }。
 */
export function parseQA(text) {
  const s = String(text || '').trim().replace(/^```[\s\S]*?\n|```$/g, '').trim()
  // 答案标记:另起一行的 答案/参考答案/答
  const m = s.match(/\n\s*(?:参考答案|答案|答)\s*[:：]\s*([\s\S]*)$/)
  let qPart = s, answer = ''
  if (m) { answer = m[1].trim(); qPart = s.slice(0, m.index).trim() }
  // 问题部分:去掉"问题："前缀,取首个非空行
  qPart = qPart.replace(/^\s*(?:问题|问)\s*[:：]\s*/, '')
  const question = cleanQuestion(qPart)
  return { question, answer: answer.replace(/^["'「『]|["'」』]$/g, '').trim() }
}

// —— host 接缝:原始 session 事件 → agent 推进量。已在 dev profile(2026-08-17)标定真实事件形状:
// 最终 assistant 消息 = `assistant/message`,文本在 `data.message.content` 的 text 块里;
// 流式增量 `assistant/chunk`(每轮数千条)一律忽略;工具调用是独立的 `tool/call` 事件。
export function agentWeightOfEvent(event) {
  const t = event.type || ''
  const d = event.data || {}
  if (t === 'assistant/message') {
    const content = d.message?.content
    if (Array.isArray(content)) {
      let len = 0, last = ''
      for (const b of content) if (b?.type === 'text' && typeof b.text === 'string') { len += b.text.length; last = b.text }
      if (len > 0) return { weight: len / 1000, gist: last.slice(0, 140) } // 推进量 = 文本长度/1000(同 adapt-cc)
    }
  }
  if (t === 'tool/call') return { weight: 0.6, gist: '' } // 每次工具调用 +0.6
  return { weight: 0, gist: '' }
}

/** 判断 user/message 是否真人输入(排除 plugin/goal/inject 等合成来源)。dev profile 待校准。 */
export function isHumanUserMessage(data) {
  const kind = data?.source?.kind
  if (!kind) return true
  return !['plugin', 'goal', 'agent', 'inject', 'compaction', 'system'].includes(kind)
}

/** 从判官输出里抠出 JSON 数组;容忍前后噪声与 ```json 围栏。纯函数,判官适配层复用。 */
export function parseLabels(text) {
  if (!text) return []
  let s = String(text).trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const lb = s.indexOf('['), rb = s.lastIndexOf(']')
  if (lb >= 0 && rb > lb) s = s.slice(lb, rb + 1)
  try {
    const arr = JSON.parse(s)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x) => x && typeof x.id === 'string')
      .map((x) => ({
        id: x.id,
        label: ['steer', 'ride', 'neutral'].includes(x.label) ? x.label : 'neutral',
        confidence: typeof x.confidence === 'number' ? x.confidence : undefined,
        why: typeof x.why === 'string' ? x.why : undefined,
      }))
  } catch {
    return []
  }
}

/** 从 UserMessage 里取纯文本。兼容 data.text 或 content=[{type:'text',text}]。 */
export function textOfUserMessage(data) {
  if (typeof data?.text === 'string') return data.text.trim()
  if (Array.isArray(data?.content)) {
    return data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('').trim()
  }
  return ''
}
