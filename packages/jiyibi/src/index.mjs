/**
 * dsh-plugin-jiyibi —— 「记一笔」的后端(dsh 接线层)。
 *
 * 定位:体验/在场族的第一个落点(见 BRAINSTORM)。像电子书批注:你在对话某处写下"它对你意味着什么",
 * 标记那一刻把原文**快照**进一个可检索的私人账本(store.mjs,插件自有 JSONL,绝不碰会话日志)。
 * AI 有全部日志(内容),只有你能写下它为什么对你要紧——所以 AI 绝不替你写这条。
 *
 * 不调 LLM(纯记录/检索),故 inject 只要 connection。观察对话攒"当前这一刻"的锚点;
 * RPC 通道 /jiyibi:add / latest / list / remove。
 */

import { addMark, listMarks, removeMark } from './store.mjs'
import { assistantOf, humanUserOf } from './seams.mjs'

export const name = 'jiyibi'
export const inject = ['connection'] // 只要 RPC 通道;不调 LLM;session/event 是环境事件

export const DEFAULTS = { aiSaidMax: 2000, userAskedMax: 500 }

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config }
  const anchors = new Map()     // sessionId -> { userAsked, aiSaid, messageId }(标记时快照它)
  const pendingUser = new Map() // sessionId -> 最近一条真人用户文本(配给下一条 assistant 当"问")

  ctx.on('session/event', (session, event) => {
    if (event.type === 'user/message') {
      const t = humanUserOf(event); if (t) pendingUser.set(session.id, t)
    } else if (event.type === 'assistant/message') {
      const a = assistantOf(event)
      if (a.text) anchors.set(session.id, {
        userAsked: (pendingUser.get(session.id) || '').slice(0, cfg.userAskedMax),
        aiSaid: a.text.slice(0, cfg.aiSaidMax),
        messageId: a.id || '',
      })
    }
  })

  // 通道 /jiyibi:add({sessionId,note}) 快照当前锚点+你的话落盘;list({query}) 检索账本;remove({id}) 软删。
  // handler 只读内存 + 读写插件自有文件,**永不碰会话日志**。返回既有 RpcResult 形状。
  ctx.effect(() => ctx.connection.rpc.handle('/jiyibi', async (endpoint, payload) => {
    try {
      if (endpoint === 'add') {
        const sid = payload?.sessionId
        const note = typeof payload?.note === 'string' ? payload.note.trim() : ''
        if (!note) return { ok: true, value: null } // 空的不记
        const anchor = (sid != null && anchors.get(sid)) || {}
        const rec = addMark({
          sessionId: sid || '', note,
          userAsked: anchor.userAsked || '', aiSaid: anchor.aiSaid || '', messageId: anchor.messageId || '',
        })
        return { ok: true, value: rec }
      }
      if (endpoint === 'latest') {
        const sid = payload?.sessionId
        return { ok: true, value: (sid != null && anchors.get(sid)) || null }
      }
      if (endpoint === 'list') {
        return { ok: true, value: listMarks({ query: payload?.query, limit: payload?.limit }) }
      }
      if (endpoint === 'remove') {
        if (payload?.id) removeMark(String(payload.id))
        return { ok: true, value: true }
      }
      return { ok: false, error: { code: 'internal', message: `jiyibi: unknown endpoint ${endpoint}`, details: {} } }
    } catch (e) {
      ctx.logger?.warn?.(`jiyibi: ${e?.message || e}`)
      return { ok: false, error: { code: 'internal', message: String(e?.message || e), details: {} } }
    }
  }, { authority: 'loopback' }), 'jiyibi rpc channel')

  ctx.on('session/disposed', (session) => { anchors.delete(session.id); pendingUser.delete(session.id) })
}
