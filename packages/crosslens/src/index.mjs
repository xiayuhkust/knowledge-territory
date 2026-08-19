/**
 * dsh-plugin-crosslens —— 跨学科联想弹窗的后端(dsh 接线层)。
 *
 * 定位:脑,不是脸。观察对话攒一段"最近在聊什么"的上下文;客户端点"🎲 抽卡"时,
 * 经通用 Connection RPC 通道 `/crosslens` 的 associate({sessionId, disciplines}) 现算一张卡,
 * 淡淡地摆到 composer 上方(client.js)。全程内存态,绝不 session.append(见 grasp 的教训)。
 *
 * 比 grasp 轻:没有判官/累加器,只有 recent 缓冲 + 一个请求/响应端点。
 * 参照:RPC 通道照 dsh-client-connection,LLM 调用照 grasp-probe 的 judge-llm。
 */

import { assistantGist, humanUserText } from './seams.mjs'

// 松散匹配用户所选学科 vs 模型声明的学科:去空白/去尾缀(学/学科/领域),再双向子串包含。
// "生态"≈"生态学"、"心理学"≈"心理"。用于判卡是否"列表外"。
const normDisc = (s) => String(s || '').trim().replace(/\s+/g, '').replace(/(学科|领域|学)$/, '')
function discMatch(a, b) {
  const x = normDisc(a), y = normDisc(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

export const name = 'crosslens'
// llm:联想器;connection:注册 RPC 通道(UI 同源拉取,不碰会话日志);session/event 是环境事件不需 inject。
export const inject = ['llm', 'connection']

// provider/model 仅兜底:从 assistant/message.source 探会话真实模型并覆盖(跟随用户所选模型)。
// reasoningEffort 'off':抽卡是短生成,思维链纯浪费——实测 off 质量不掉、快 6×、省 ~5/6 推理 token。
export const DEFAULTS = { provider: 'deepseek-official', model: 'deepseek-v4-flash', bufferSize: 8, reasoningEffort: 'off' }

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config }
  let observed = null // {provider, model}:从 assistant/message.source 探到的会话真实模型
  const modelCfg = () => ({ ...cfg, ...(observed || {}) })

  // 懒加载:associate-llm 顶层 import 了 @deepseek-ai/dsh-llm,只在真正抽卡时才需要。
  let assocModP = null
  const assocMod = () => (assocModP ||= import('./associate-llm.mjs'))
  const associator = config.associator || (async (gists, disc, effort) => (await assocMod()).makeAssociator(ctx, { ...modelCfg(), ...(effort ? { reasoningEffort: effort } : {}) })(gists, disc))

  const recents = new Map() // sessionId -> [gist strings](最近在聊什么;纯内存)
  const pushGist = (id, s) => {
    if (!s) return
    let buf = recents.get(id)
    if (!buf) { buf = []; recents.set(id, buf) }
    buf.push(s)
    if (buf.length > cfg.bufferSize) buf.shift()
  }

  // 通道 /crosslens:端点 associate({sessionId, disciplines}) → 现算一张卡 {hook, expand}(空卡=null)。
  // handler 只读内存 + 发一次 LLM,永不写持久层。返回既有 RpcResult 形状。
  ctx.effect(() => ctx.connection.rpc.handle('/crosslens', async (endpoint, payload) => {
    if (endpoint === 'associate') {
      const sid = payload && payload.sessionId
      const disciplines = Array.isArray(payload?.disciplines)
        ? payload.disciplines.filter((x) => typeof x === 'string' && x.trim()).slice(0, 8)
        : []
      // 上下文:正常取会话内存缓冲;payload.gists 是调 prompt 用的覆盖口(客户端不传)。
      const gists = Array.isArray(payload?.gists) && payload.gists.length
        ? payload.gists.filter((x) => typeof x === 'string').slice(0, 12)
        : ((sid != null && recents.get(sid)) ? recents.get(sid).slice() : [])
      try {
        const effort = typeof payload?.effort === 'string' ? payload.effort : cfg.reasoningEffort // 调试/配置:'off' 省 token
        const card = await associator(gists, disciplines, effort)
        if (!card || !card.hook) return { ok: true, value: null } // null = 这次没抽到
        // 软种子:优先用户所选学科;模型声明的学科不在列表里 → 标 offlist,前端透明标"(列表外:X)"。
        const declared = card.discipline || ''
        const offlist = disciplines.length > 0 && declared.length > 0 && !disciplines.some((d) => discMatch(d, declared))
        return { ok: true, value: { hook: card.hook, expand: card.expand || '', discipline: declared, offlist } }
      } catch (e) {
        ctx.logger?.warn?.(`crosslens: ${e?.message || e}`)
        return { ok: false, error: { code: 'internal', message: String(e?.message || e), details: {} } }
      }
    }
    return { ok: false, error: { code: 'internal', message: `crosslens: unknown endpoint ${endpoint}`, details: {} } }
  }, { authority: 'loopback' }), 'crosslens rpc channel')

  // 观察对话:攒最近上下文(assistant 最终消息 + 真人用户轮);顺便探会话真实模型。
  ctx.on('session/event', (session, event) => {
    if (event.type === 'assistant/message') {
      const src = event.data?.message?.source
      if (src?.provider) observed = { provider: src.provider, model: src.model }
      pushGist(session.id, assistantGist(event))
    } else if (event.type === 'user/message') {
      pushGist(session.id, humanUserText(event))
    }
  })

  ctx.on('session/disposed', (session) => { recents.delete(session.id) })
}
