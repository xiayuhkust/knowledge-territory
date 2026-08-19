/**
 * dsh-plugin-grasp-probe —— 「验收落差」探针的后端投影插件(dsh 接线层)。
 *
 * 定位:脑,不是脸。后端算 gap / 是否该提示,存进插件内存(每会话最近一次 view);
 * 通过通用 Connection RPC 通道 `/grasp-probe` 暴露给客户端拉取——不碰会话日志/投影/Typert。
 * 那条淡提示的 React 在 lib/client.js(挂 conversation.input.dock,轮询该通道)。
 * 编排逻辑在 probe-core.mjs(可脱离 host 单测);这里只做 dsh 特定的注册与订阅。
 *
 * 每来一个「人类用户轮」:喂上一段 agent 推进 → 跑判官(异步) → 累加器出新 view →
 * lastViews.set(session.id, view)(纯内存)。客户端同源 fetch 该会话的 view。
 *
 * 参照真源码:RPC 通道照 dsh-client-connection(rpc.handle),判官调用照 session-title-llm,
 * 轮次观察用 session/event 火龙。绝不 session.append 自定义事件(见 no-session-log-events)。
 */

import { appendFileSync } from 'node:fs'
import { createSessionProbe, agentWeightOfEvent, isHumanUserMessage, textOfUserMessage, SCALE } from './probe-core.mjs'

// 临时可观测性:GRASP_DEBUG=<path> 时,把每个观察到的事件类型 + 每次发布的 view 落成 JSONL。
// 用于 dev profile 上标定三处 host 接缝(真人轮/assistant 事件形状/event type)。校准完删除。
const DBG = process.env.GRASP_DEBUG || ''
function dbg(rec) { if (DBG) { try { appendFileSync(DBG, JSON.stringify(rec) + '\n') } catch { /* ignore */ } } }

export const name = 'grasp-probe'
// 判官要 ctx.llm;connection 用来注册通用 RPC 通道(UI 同源拉取,不碰会话日志/投影/Typert);
// session/event 是环境事件不需 inject。
export const inject = ['llm', 'connection']

// provider/model 仅作兜底:插件会从 assistant 消息里探到会话真实所用模型并覆盖它(见下 observed),
// 于是判官/提问器自动跟随用户当前选的模型,不写死某个部署的 provider 名。
export const DEFAULTS = { scale: SCALE, provider: 'deepseek-official', model: 'deepseek-v4-flash' }

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config }
  let observed = null // {provider, model}:从 assistant/message.source 探到的会话真实模型;判官/提问器优先用它

  // judge-llm.mjs 顶层 import 了 @deepseek-ai/dsh-llm;外部 link 插件加载期解析该 dsh 内部包可能失败,
  // 而它只在真正发起判官/提问请求时才需要。故懒加载:插件加载/投影注册永不依赖它,首次调用才拉。
  let llmModP = null
  const llmMod = () => (llmModP ||= import('./judge-llm.mjs'))
  const modelCfg = () => ({ ...cfg, ...(observed || {}) }) // 每次调用现取,自动跟随 observed 变化

  const judge = config.judge || (async (pairs) => (await llmMod()).makeJudge(ctx, modelCfg())(pairs))
  const asker = config.asker || (async (g) => (await llmMod()).makeAsker(ctx, modelCfg())(g))

  // UI 通道:不再用 session projection(会往日志写自定义事件、污染历史——见 no-session-log-events 教训),
  // 改走通用 Connection RPC 通道:后端把每会话最近一次算出的 view 存内存,客户端同源拉取。
  // 全程零构建、不碰会话日志/投影/Typert/事件白名单;loopback 信任围栏由 Connection 提供。
  const probes = new Map()    // sessionId -> probe(脑子:每会话一份累加器状态)
  const lastViews = new Map() // sessionId -> 最近一次算出的 view(纯内存态,经 RPC 喂 UI)

  // 通道 /grasp-probe:端点 get({sessionId}) → 该会话最近一次 view(无则 null)。
  // handler 只读内存 Map,永不写任何持久层。返回既有 RpcResult 形状 {ok,value}|{ok,error}。
  ctx.effect(() => ctx.connection.rpc.handle('/grasp-probe', async (endpoint, payload) => {
    if (endpoint === 'get') {
      const sid = payload && payload.sessionId
      const view = (sid != null && lastViews.has(sid)) ? lastViews.get(sid) : null
      return { ok: true, value: view ?? null }
    }
    return { ok: false, error: { code: 'internal', message: `grasp-probe: unknown endpoint ${endpoint}`, details: {} } }
  }, { authority: 'loopback' }), 'grasp-probe rpc channel')

  const probeFor = (id) => {
    let p = probes.get(id)
    if (!p) {
      const onError = (stage, e) => { const m = `grasp-probe ${stage}: ${e?.message || e}`; dbg({ err: m }); ctx.logger?.warn?.(m) }
      const onJudge = (label, userText, aiDid) => dbg({ label, user: String(userText).slice(0, 80), aiDid: String(aiDid).slice(0, 60) }) // 标定
      p = createSessionProbe({ judge, asker, onError, onJudge, scale: cfg.scale, opts: config.score || {} })
      probes.set(id, p)
    }
    return p
  }

  ctx.on('session/event', (session, event) => {
    const probe = probeFor(session.id)
    if (DBG) dbg({ ev: event.type, kind: event.data?.source?.kind, sid: String(session.id).slice(-6) })
    if (event.type === 'user/message') {
      if (!isHumanUserMessage(event.data)) return
      const userText = textOfUserMessage(event.data)
      if (!userText) return
      // fire-and-forget:判官异步跑完算出 view。
      // 注意:绝不 session.append 自定义事件——novel event 会污染会话日志、让历史加载失败
      // (known-event-types.ts:out-of-repo 插件事件无注册面)。只存内存,UI 通道改走 remote(待建)。
      probe.onUserMessage(userText)
        .then((view) => {
          lastViews.set(session.id, view)
          dbg({ view, sid: String(session.id).slice(-6) })
          ctx.logger?.info?.(`grasp-probe: gap=${view.gap} shouldPrompt=${view.shouldPrompt}${view.reason ? ` (${view.reason})` : ''}`)
        })
        .catch((err) => { dbg({ err: String(err?.message || err) }); ctx.logger?.warn?.(`grasp-probe: ${err?.message || err}`) })
    } else {
      if (event.type === 'assistant/message') {
        const src = event.data?.message?.source // 跟随会话真实模型:让判官/提问器用用户当前所选模型
        if (src?.provider) observed = { provider: src.provider, model: src.model }
      }
      const { weight, gist } = agentWeightOfEvent(event)
      if (weight > 0) { probe.noteAgent(weight, gist); if (DBG) dbg({ note: +weight.toFixed(2), ev: event.type }) }
    }
  })

  ctx.on('session/disposed', (session) => { probes.delete(session.id); lastViews.delete(session.id) })
}
