/**
 * associate-llm —— 用 dsh 的 LLM 服务把联想器跑起来的适配层(唯一碰 dsh 内部的文件)。
 *
 * prompt 本体在 associate.mjs;这里只负责「用 ctx.llm 发一次性补全、拿回文本」。
 * 写法照 grasp-probe 的 judge-llm:createUserMessage → GenerateOptions → 排干 ctx.llm.stream
 * 到 BlockAssembler → 取 text 块。显式检查 finish(否则失败会静默返回空卡)。
 */

import { createUserMessage, BlockAssembler } from '@deepseek-ai/dsh-llm'
import { buildAssociatePrompt, parseAssociation } from './associate.mjs'

/** 发一次性补全,返回拼好的纯文本。失败重试一次(DeepSeek 流偶发 TRANSPORT 抖动)。 */
async function runLlm(ctx, prompt, opts = {}) {
  const { provider = 'deepseek-official', model = 'deepseek-v4-flash', maxTokens = 4096, attempts = 2 } = opts
  const messages = [createUserMessage({
    content: [{ type: 'text', text: prompt }],
    source: { kind: 'plugin', plugin: 'crosslens' },
  })]
  const options = {
    provider, model, messages, maxTokens,
    ...(opts.reasoningEffort ? { reasoningEffort: opts.reasoningEffort } : {}), // 'off' 省 token(DeepSeek 支持)
    ...(opts.signal ? { signal: opts.signal } : {}),
  }
  let lastErr
  for (let i = 0; i < Math.max(1, attempts); i++) {
    try {
      const assembler = new BlockAssembler()
      for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
      const finish = assembler.finish
      if (finish?.kind === 'error') throw new Error(`llm ${finish.failure?.code || 'error'}: ${finish.failure?.message || 'stream error'}`)
      if (finish?.kind === 'aborted') throw new Error('llm aborted')
      return assembler.blocks().filter((b) => b.type === 'text').map((b) => b.text).join('')
    } catch (e) { lastErr = e }
  }
  throw lastErr
}

/**
 * 造一个联想器。ctx 需能取到 ctx.llm(inject 'llm')。
 * 返回 async (recentGists, disciplines) => { hook, expand }(空卡 = {hook:'',expand:''})。
 * maxTokens 4096:推理型模型(V4-Flash)先思考再出文本,预算太小会被推理吃光、text 块为空。
 */
export function makeAssociator(ctx, opts = {}) {
  return async function associate(recentGists = [], disciplines = []) {
    // maxTokens 1024:reasoningEffort 'off' 时无推理吃预算,一张卡(线头+展开)千把 token 足够。
    return parseAssociation(await runLlm(ctx, buildAssociatePrompt(recentGists, disciplines), { maxTokens: 1024, ...opts }))
  }
}
