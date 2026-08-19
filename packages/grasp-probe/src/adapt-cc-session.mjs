/**
 * adapt-cc-session —— 把一段 Claude Code 会话 jsonl 抽成 grasp-probe 的规范化 trace。
 *
 * grasp-probe 本身不绑任何 harness 的日志格式;规范化 trace 才是它的输入:
 *   [{ role:'agent', weight:number, gist:string }, { role:'user', text:string }, ...]
 * 这个适配器只做"抽取"这一薄层。生产版会读 dsh 的 session log,换个适配器即可。
 *
 * 抽取规则:
 *  - assistant 消息 → 累进当前 agent 跨度权重(文本量/1000 + 0.6×工具调用数),gist 收工具名+末段文本。
 *  - 真实人类轮次 = type==='user' 且 message.content 是字符串(工具结果的 content 是数组,排除)。
 *    命中即:先吐出累计的 agent 跨度(weight>0),再吐出 user 轮;重置跨度。
 *  - 系统提醒/本地命令/元信息 一律跳过。
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const isNoise = (s) =>
  s.startsWith('<') ||                       // system-reminder / caveat
  s.includes('<local-command') ||
  s.includes('<command-name') ||
  s.startsWith('[SYSTEM') ||
  s.includes('local-command-stdout') ||
  s.startsWith('[Your previous response') ||  // harness 自动续写,非人类
  s.includes('no visible output') ||
  s.includes('failed to produce a valid tool call') || // 工具重试提示,非人类
  s.includes('This session is being continued') ||     // /compact 续接摘要
  s.includes('The summary below covers')

export function adaptCcSession(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  const out = []
  let span = { weight: 0, tools: new Set(), lastText: '' }

  const flushSpan = () => {
    if (span.weight > 0) {
      const tools = [...span.tools]
      const gist = (tools.length ? `用了工具[${tools.join(',')}];` : '') + (span.lastText || '').slice(0, 140)
      out.push({ role: 'agent', weight: +span.weight.toFixed(2), gist })
    }
    span = { weight: 0, tools: new Set(), lastText: '' }
  }

  for (const l of lines) {
    let o
    try { o = JSON.parse(l) } catch { continue }
    if (o.type === 'assistant') {
      const c = o.message?.content
      if (Array.isArray(c)) {
        for (const b of c) {
          if (b.type === 'text' && b.text) { span.weight += b.text.length / 1000; span.lastText = b.text }
          else if (b.type === 'tool_use') { span.weight += 0.6; if (b.name) span.tools.add(b.name) }
        }
      }
    } else if (o.type === 'user') {
      const c = o.message?.content
      if (typeof c === 'string') {
        const text = c.trim()
        if (!text || isNoise(text)) continue
        flushSpan()
        out.push({ role: 'user', text })
      }
      // 数组 content = 工具结果,忽略
    }
  }
  flushSpan()
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2]
  if (!path) { console.error('usage: adapt-cc-session.mjs <session.jsonl>'); process.exit(2) }
  const trace = adaptCcSession(path)
  const users = trace.filter((t) => t.role === 'user').length
  const agents = trace.filter((t) => t.role === 'agent').length
  console.error(`[trace] ${trace.length} turns: ${users} user, ${agents} agent`)
  if (process.argv.includes('--preview')) {
    let ui = 0
    for (const t of trace) {
      if (t.role === 'agent') console.error(`   AI   w=${String(t.weight).padStart(6)}  ${t.gist.replace(/\s+/g, ' ').slice(0, 70)}`)
      else console.error(`U${String(++ui).padStart(2)}  「${t.text.replace(/\s+/g, ' ').slice(0, 60)}」`)
    }
  } else {
    process.stdout.write(JSON.stringify(trace))
  }
}
