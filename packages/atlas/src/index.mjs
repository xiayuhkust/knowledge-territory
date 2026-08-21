/**
 * dsh-plugin-atlas —— 知识疆域（知识地图）后端接线层。
 *
 * 定位:脑,不是脸。持有并持久化"地图"这份数据(概念城 / 学科大陆 / 有类型的航路 / 用户自建的桥),
 * 经通用 Connection RPC 通道 `/atlas` 对前端(lib/client.js)提供读写;绝不 session.append。
 *
 * 三层数据(见下 STORE 注释):
 *   discipline 学科 = 一块大陆(分类 + 地色)
 *   node       概念 = 一座城(可选归属某细分学科 sub)
 *   edge       航路 = 两座城之间"有类型 + 你写的一句为什么"的连线(AI 提候选、你点亮)
 *   bridge     桥   = 一个"小容器",里头可有很多词条(entries):你的笔记、抽的卡、随手的词。
 *                     桥锚在若干城之间(anchors);跨≥2 学科 = 跨学科桥。这是最"你"的一层。
 *
 * 联动(同套件的 crosslens / jiyibi 前端直接 call 本通道):
 *   crosslens 抽的卡  → addCard  → 落成某大陆里一条待安置的词条(收进该学科的"抽卡收件"桥)
 *   jiyibi   记的笔记 → addNote  → 架成一座桥(笔记原文 = 词条,anchors = 笔记触及的概念)
 *
 * 存储:当前为进程内内存 + JSON 落盘的接缝(loadState/saveState);
 *   路线图是把它落成 Karpathy/Obsidian 式的 `[[互链]]` markdown 笔记夹(见 store.mjs TODO)。
 */

import { loadState, saveState, LIB_NAMES } from './store.mjs'

export const name = 'atlas'
// llm:会话→候选概念/连线的抽取(compileSession,现为桩);connection:注册 RPC 通道(不碰会话日志)。
export const inject = ['llm', 'connection']

export const DEFAULTS = {
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  reasoningEffort: 'off',  // 结构化短生成,不需思维链;dsh-llm-deepseek 只认 off/high/max，'off'=关思维链
  bufferSize: 12,
}

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config }

  // ── STORE:启动时从 ~/.dsh/atlas/territory.json 读回疆域;每次变更防抖落盘 ──
  const state = loadState()            // { disciplines, nodes, edges, bridges }
  let seq = state._seq || 1000
  const nid = () => ++seq
  let saveT = null
  const persist = () => { state._seq = seq; clearTimeout(saveT); saveT = setTimeout(() => saveState(state), 250) }
  ctx.effect(() => () => { clearTimeout(saveT); state._seq = seq; saveState(state) }, 'atlas persist flush')  // 卸载/重启前兜底刷盘

  const serialize = () => ({
    disciplines: state.disciplines,
    nodes: state.nodes,
    edges: state.edges,
    bridges: state.bridges,
  })

  const nodeByLabel = (label) => state.nodes.find((n) => n.label === label || (n.aliases || []).includes(label))
  const ensureDiscipline = (nameOrKey) => {
    let d = state.disciplines.find((x) => x.key === nameOrKey || x.name === nameOrKey)
    if (d) return d
    d = { key: 'u' + nid(), name: nameOrKey, land: null, city: null } // 颜色由前端分配(或后续在此分配)
    state.disciplines.push(d)
    return d
  }

  // 懒加载:classify-llm 顶层 import 了 @deepseek-ai/dsh-llm(该包在插件加载期不可解析，
  // 故照 crosslens 的做法只在真正分类时才 import，交由运行时上下文解析)。
  let classifyModP = null
  const classifyMod = () => (classifyModP ||= import('./classify-llm.mjs'))
  let mineModP = null
  const mineMod = () => (mineModP ||= import('./mine-llm.mjs'))
  let ponderModP = null
  const ponderMod = () => (ponderModP ||= import('./ponder-llm.mjs'))

  // 最近对话缓冲(留给 compileSession 的抽取用;纯内存)
  const recents = new Map()
  const pushGist = (id, s) => {
    if (!s) return
    let buf = recents.get(id); if (!buf) { buf = []; recents.set(id, buf) }
    buf.push(s); if (buf.length > cfg.bufferSize) buf.shift()
  }

  // ── RPC 通道 /atlas ──
  ctx.effect(() => ctx.connection.rpc.handle('/atlas', async (endpoint, payload) => {
    try {
      switch (endpoint) {
        case 'getMap':
          return ok(serialize())

        // 会话 → 候选桥(拉式:前端「从对话找桥」按钮触发,方案 a)。LLM 从最近对话摘要里提炼 ≤3 座,
        // 只作提议进前端预备桥队列——安置永远在用户手里。太短/失败都返回 ok(空),不打断任何流程。
        case 'compileSession': {
          const sid = payload && payload.sessionId
          const gists = (sid != null && recents.get(sid)) ? recents.get(sid).filter(Boolean) : []
          if (gists.length < 2) return ok({ bridges: [], gistCount: gists.length, note: 'too-short' })
          const names = Array.isArray(payload?.disciplines) && payload.disciplines.length ? payload.disciplines
            : (state.disciplines.length ? state.disciplines.map((d) => d.name) : LIB_NAMES)
          try {
            const mine = config.miner || (await mineMod()).makeMiner(ctx, { ...cfg })
            const found = await mine(gists, names)
            ctx.logger?.info?.(`atlas compileSession: ${gists.length} gists → ${found.length} bridges`)
            return ok({ bridges: found, gistCount: gists.length })
          } catch (e) {
            ctx.logger?.warn?.(`atlas compileSession failed: ${e?.message || e}`)
            return ok({ bridges: [], gistCount: gists.length, note: 'llm-failed' })
          }
        }

        // 探索模式:用户选好两端,请 LLM 想 3 条连接理由(B1 第三种玩法)。只出提议,收不收在用户。
        case 'ponderBridge': {
          const { discA, discB, subA, subB } = payload || {}
          if (!discA || !discB) return err('ponderBridge 需要 discA + discB')
          try {
            const ponder = config.ponderer || (await ponderMod()).makePonderer(ctx, { ...cfg })
            const ideas = await ponder({ discA, discB, subA, subB })
            ctx.logger?.info?.(`atlas ponderBridge: ${discA}⟷${discB} → ${ideas.length} ideas`)
            return ok({ ideas })
          } catch (e) {
            ctx.logger?.warn?.(`atlas ponderBridge failed: ${e?.message || e}`)
            return ok({ ideas: [], note: 'llm-failed' })
          }
        }

        // 笔记 → 桥两端学科的 AI 判定(前端把它做成"带连上的桥",用户可改两端)。
        case 'classifyNote': {
          const { text, disciplines } = payload || {}
          if (!text) return err('classifyNote 需要 text')
          const names = Array.isArray(disciplines) && disciplines.length ? disciplines
            : (state.disciplines.length ? state.disciplines.map((d) => d.name) : LIB_NAMES)
          try {
            const classify = config.classifier || (await classifyMod()).makeClassifier(ctx, { ...cfg })
            const guess = await classify(text, names)
            return ok({ guess: guess || null })
          } catch (e) {
            ctx.logger?.warn?.(`atlas classifyNote: ${e?.message || e}`)
            return ok({ guess: null, note: 'classify 失败:' + String(e?.message || e) })  // 失败也返回 ok，前端仍可手动选两端
          }
        }

        case 'addConcept': {
          const { label, disc, sub, mastery, src } = payload || {}
          if (!label || !disc) return err('addConcept 需要 label + disc')
          const d = ensureDiscipline(disc)
          // 幂等:同学科同名同细分的城已在 → 直接返回(前端恢复/重复开辟不落重复数据)
          const exist = state.nodes.find((n) => n.label === label && n.disc === d.key && (n.sub || '') === (sub || ''))
          if (exist) return ok({ node: exist, disciplines: state.disciplines })
          const n = { id: nid(), label, disc: d.key, sub: sub || '', mastery: typeof mastery === 'number' ? mastery : 0.45, src: src || '手动新建', aliases: [] }
          state.nodes.push(n)
          persist()
          return ok({ node: n, disciplines: state.disciplines })
        }

        case 'createDiscipline': {
          const { name: dn } = payload || {}
          if (!dn) return err('createDiscipline 需要 name')
          const d = ensureDiscipline(dn)
          persist()
          return ok({ discipline: d, disciplines: state.disciplines })
        }

        // 点亮一条航路(你确认的连线):type + 你写的一句 why
        case 'connect': {
          const { a, b, type, why } = payload || {}
          const na = typeof a === 'number' ? state.nodes.find((n) => n.id === a) : nodeByLabel(a)
          const nb = typeof b === 'number' ? state.nodes.find((n) => n.id === b) : nodeByLabel(b)
          if (!na || !nb) return err('connect: 找不到端点概念')
          const e = { id: nid(), a: na.id, b: nb.id, type: type || '相关', why: why || '', ts: nowTs(payload) }
          state.edges.push(e)
          // 连线让两端更"懂"一点 → 疆域涨一圈(与前端一致)
          na.mastery = Math.min(1, (na.mastery || 0) + 0.05)
          nb.mastery = Math.min(1, (nb.mastery || 0) + 0.05)
          persist()
          return ok({ edge: e, nodes: [na, nb] })
        }

        // ── 桥:小容器 + 词条 ──
        case 'createBridge': {
          const { title, anchors, origin } = payload || {}
          const anchorIds = (anchors || []).map((x) => (typeof x === 'number' ? x : (nodeByLabel(x) || {}).id)).filter(Boolean)
          const bridge = { id: nid(), title: title || '未命名桥', origin: origin || 'manual', anchors: anchorIds, entries: [], ts: nowTs(payload) }
          state.bridges.push(bridge)
          persist()
          return ok({ bridge })
        }
        case 'addEntry': {
          const { bridgeId, entry } = payload || {}
          const bridge = state.bridges.find((x) => x.id === bridgeId)
          if (!bridge) return err('addEntry: 找不到桥')
          const e = { id: nid(), kind: (entry && entry.kind) || 'term', text: (entry && entry.text) || '', src: (entry && entry.src) || '', ts: nowTs(payload) }
          bridge.entries.push(e)
          persist()
          return ok({ bridge, entry: e })
        }

        // ── 联动:crosslens 抽的卡 → 落进某大陆的"抽卡收件"桥 ──
        case 'addCard': {
          const { hook, expand, discipline } = payload || {}
          if (!hook) return err('addCard 需要 hook')
          const d = discipline ? ensureDiscipline(discipline) : null
          const title = d ? d.name + ' · 抽卡收件' : '抽卡收件'
          let inbox = state.bridges.find((x) => x.origin === 'card' && x.title === title)
          // discName:给前端按学科名把桥放到对应大陆边(前端按名字匹配自己的 mock 世界)
          if (!inbox) { inbox = { id: nid(), title, origin: 'card', discName: d ? d.name : '', anchors: [], entries: [], ts: nowTs(payload) }; state.bridges.push(inbox) }
          const e = { id: nid(), kind: 'card', text: hook + (expand ? '\n' + expand : ''), src: 'crosslens', ts: nowTs(payload) }
          inbox.entries.push(e)
          persist()
          return ok({ bridge: inbox, entry: e })
        }

        // ── 联动:jiyibi 的笔记 → 架成一座桥(笔记原文=词条,anchors=触及的概念)──
        case 'addNote': {
          const { text, concepts, title, discA, discB, subA, subB, origin, kind, ref } = payload || {}
          if (!text) return err('addNote 需要 text')
          const anchorIds = (concepts || []).map((x) => (nodeByLabel(x) || {}).id).filter(Boolean)
          const lk = kind || (origin === 'card' ? 'card' : 'note')   // 链接种类:card/note/manual
          // discA/discB:桥两端学科名(subA/subB=细到的 2 级学科);每条 addNote = 桥上的一条链接(entry)，带 kind + ref(记一笔回链)
          const bridge = { id: nid(), title: title || firstLine(text), origin: origin === 'card' ? 'card' : 'note', status: 'placed', conceptNames: concepts || [], discA: discA || '', discB: discB || '', subA: subA || '', subB: subB || '', anchors: anchorIds, entries: [{ id: nid(), kind: lk, text, ref: ref || null, src: lk === 'card' ? 'crosslens' : 'jiyibi', ts: nowTs(payload) }], ts: nowTs(payload) }
          state.bridges.push(bridge)
          persist()
          return ok({ bridge })
        }

        // ── 删除:前端桥是"同两端并成一座",故按学科对删;链接按 (学科对, 原文) 删 ──
        case 'removeBridgePair': {
          const { discA, discB } = payload || {}
          if (!discA || !discB) return err('removeBridgePair 需要 discA + discB')
          const same = (b) => (b.discA === discA && b.discB === discB) || (b.discA === discB && b.discB === discA)
          const before = state.bridges.length
          state.bridges = state.bridges.filter((b) => !same(b))
          persist()
          return ok({ removed: before - state.bridges.length })
        }
        case 'removeLink': {
          const { discA, discB, text } = payload || {}
          if (!discA || !discB || !text) return err('removeLink 需要 discA + discB + text')
          const same = (b) => (b.discA === discA && b.discB === discB) || (b.discA === discB && b.discB === discA)
          let removed = 0
          state.bridges.forEach((b) => {
            if (!same(b) || !Array.isArray(b.entries)) return
            const n = b.entries.length
            b.entries = b.entries.filter((e) => e.text !== text)
            removed += n - b.entries.length
          })
          state.bridges = state.bridges.filter((b) => !same(b) || (b.entries && b.entries.length))  // 链接删光的空桥一并清
          persist()
          return ok({ removed })
        }

        default:
          return err(`atlas: unknown endpoint ${endpoint}`)
      }
    } catch (e) {
      ctx.logger?.warn?.(`atlas: ${e?.message || e}`)
      return { ok: false, error: { code: 'internal', message: String(e?.message || e), details: {} } }
    }
  }, { authority: 'loopback' }), 'atlas rpc channel')

  // 观察对话:攒最近上下文,供 compileSession 抽取(事件形状照 crosslens/seams 标定)
  ctx.on('session/event', (session, event) => {
    if (event.type === 'assistant/message') { const s = gistOf(event); if (s) pushGist(session.id, 'AI:' + s) }
    else if (event.type === 'user/message') { const s = userTextOf(event); if (s) pushGist(session.id, '用户:' + s) }
  })
  ctx.on('session/disposed', (session) => { recents.delete(session.id) })
}

// ── 小工具 ──
const ok = (value) => ({ ok: true, value })
const err = (message) => ({ ok: false, error: { code: 'internal', message, details: {} } })
// 时间戳由前端传入(payload.ts);后端不自造时钟以便可测/可复现。
const nowTs = (payload) => (payload && typeof payload.ts === 'number' ? payload.ts : 0)
const firstLine = (s) => String(s || '').split(/\r?\n/)[0].slice(0, 24) || '笔记'
const gistOf = (event) => {
  const m = event.data?.message
  const t = typeof m?.content === 'string' ? m.content : (m?.content?.map?.((p) => p.text || '').join('') || '')
  return String(t || '').slice(0, 240)
}
// user/message 的文本在 data **顶层**(data.text / data.content),不是 data.message——
// 形状照 crosslens/seams(2026-08-17 dev profile 标定);合成来源(plugin/goal 等)不算对话。
const userTextOf = (event) => {
  const d = event.data
  const kind = d?.source?.kind
  if (kind && ['plugin', 'goal', 'agent', 'inject', 'compaction', 'system'].includes(kind)) return ''
  let t = ''
  if (typeof d?.text === 'string') t = d.text
  else if (Array.isArray(d?.content)) t = d.content.filter((b) => b?.type === 'text').map((b) => b.text || '').join('')
  return String(t || '').trim().replace(/\s+/g, ' ').slice(0, 240)
}
