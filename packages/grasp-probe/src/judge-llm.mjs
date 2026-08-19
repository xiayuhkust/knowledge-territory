/**
 * judge-llm —— 用 dsh 的 LLM 服务把判官 + 提问器跑起来的适配层(唯一碰 dsh 内部的文件)。
 *
 * prompt 本体在 judge.mjs / ask.mjs;这里只负责「用 ctx.llm 发一次性补全、拿回文本」。
 * 写法逐字照 packages/session/session-title-llm 的 generateSessionTitleWithLlm:
 * createUserMessage 组消息 → GenerateOptions → 排干 ctx.llm.stream 到 BlockAssembler → 取 text 块。
 *
 * 便宜快模型异步跑,不阻塞主循环(调用方 fire-and-forget / await 但不卡渲染)。
 */

import { createUserMessage, BlockAssembler } from '@deepseek-ai/dsh-llm'
import { JUDGE_INSTRUCTION } from './judge.mjs'
import { buildAskPrompt } from './ask.mjs'
import { parseLabels, parseQA } from './probe-core.mjs'

/** 发一次性补全,返回拼好的纯文本。共享给判官与提问器。失败重试一次(DeepSeek 流偶发 TRANSPORT 抖动)。 */
async function runLlm(ctx, prompt, opts = {}) {
  const { provider = 'deepseek-official', model = 'deepseek-v4-flash', maxTokens = 1024, attempts = 2 } = opts
  const messages = [createUserMessage({
    content: [{ type: 'text', text: prompt }],
    source: { kind: 'plugin', plugin: 'grasp-probe' },
  })]
  const options = {
    provider, model, messages, maxTokens,
    ...(opts.reasoningEffort ? { reasoningEffort: opts.reasoningEffort } : {}), // 'off' 省 token:判官/提问器只出短结构,思维链纯浪费(DeepSeek 支持)
    ...(opts.signal ? { signal: opts.signal } : {}),
  }
  let lastErr
  for (let i = 0; i < Math.max(1, attempts); i++) {
    try {
      const assembler = new BlockAssembler()
      for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
      // 显式暴露失败:流以 error/aborted 收尾时抛出(否则只会静默返回空 → 判官默认 neutral、提问器空,
      // 正是 NO_ADAPTER 那次 bug 的隐身方式)。
      const finish = assembler.finish
      if (finish?.kind === 'error') throw new Error(`llm ${finish.failure?.code || 'error'}: ${finish.failure?.message || 'stream error'}`)
      if (finish?.kind === 'aborted') throw new Error('llm aborted')
      return assembler.blocks().filter((b) => b.type === 'text').map((b) => b.text).join('')
    } catch (e) { lastErr = e /* 抖动 → 再试一次;仍失败则抛给调用方(会被 onError 记录、优雅降级) */ }
  }
  throw lastErr
}

/**
 * 造一个判官函数。ctx 需能取到 ctx.llm(inject 'llm')。
 * 返回 async (pairs) => labels,pairs=[{id,aiDid,user}],labels=[{id,label,confidence?,why?}]。
 */
export function makeJudge(ctx, opts = {}) {
  return async function judge(pairs) {
    if (!pairs.length) return []
    const items = pairs
      .map((p) => `【${p.id}】\nAI 刚做了:${String(p.aiDid).replace(/\s+/g, ' ').slice(0, 160)}\n用户回应:「${String(p.user).replace(/\s+/g, ' ').slice(0, 220)}」`)
      .join('\n\n')
    const prompt = `${JUDGE_INSTRUCTION}\n\n以下是 ${pairs.length} 个配对:\n\n${items}`
    // reasoningEffort 'off' + 小 maxTokens:三分类不需思维链,每轮都省(off 时小预算不会被推理吃光)
    return parseLabels(await runLlm(ctx, prompt, { maxTokens: 256, reasoningEffort: 'off', ...opts }))
  }
}

/**
 * 造一个提问器。返回 async (recentGists) => { question, answer }(闪卡:问题 + 参考答案)。
 * 只在 shouldPrompt 触发那一刻调用(节流后很稀)。
 */
export function makeAsker(ctx, opts = {}) {
  return async function ask(recentGists = []) {
    // reasoningEffort 'off':问题+答案是短生成,思维链非必需(联想器实测 off 质量不掉、快 6×)。
    // off 时无推理吃预算,maxTokens 1024 足够容下问题+两三句答案。
    return parseQA(await runLlm(ctx, buildAskPrompt(recentGists), { maxTokens: 1024, reasoningEffort: 'off', ...opts }))
  }
}
