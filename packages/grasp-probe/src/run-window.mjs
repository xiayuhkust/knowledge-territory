/**
 * run-window —— 端到端在真实 trace 的一个窗口上跑 grasp-probe:
 *   适配会话 → 取窗口(按 user 轮序号)→ 为每个 user 轮配"AI 刚做了什么"gist
 *   → 出判官批量 prompt(mode=prompt)/ 或吃判官标签跑累加器出轨迹(mode=score)。
 *
 * 用法:
 *   node run-window.mjs <jsonl> <startU> <endU> prompt              # 生成判官 prompt 到 stdout
 *   node run-window.mjs <jsonl> <startU> <endU> score <labels.json> [scale=0.166] [threshold=3]
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { adaptCcSession } from './adapt-cc-session.mjs'
import { JUDGE_INSTRUCTION } from './judge.mjs'
import { scoreSession } from './grasp-score.mjs'

/** 取窗口:含 startU..endU 的 user 轮,以及它们之间与之前一个 agent 跨度(首个 user 的上下文)。 */
function sliceWindow(trace, startU, endU) {
  let u = 0, iStart = -1, iEnd = -1
  for (let i = 0; i < trace.length; i++) {
    if (trace[i].role === 'user') { u++; if (u === startU && iStart < 0) iStart = i; if (u === endU) iEnd = i }
  }
  if (iStart < 0 || iEnd < 0) throw new Error(`window ${startU}..${endU} not found (max U=${u})`)
  const lead = iStart > 0 && trace[iStart - 1].role === 'agent' ? iStart - 1 : iStart
  // 给窗口内 user 轮标序号
  const win = trace.slice(lead, iEnd + 1)
  let uu = startU - (lead < iStart ? 0 : 0)
  let counter = startU
  for (const t of win) if (t.role === 'user') t.uid = `U${counter++}`
  return win
}

/** 为窗口内每个 user 轮找紧邻的前一个 agent gist 当 aiDid。 */
function pairsForJudge(win) {
  const pairs = []
  let lastGist = '(会话此前的推进)'
  for (const t of win) {
    if (t.role === 'agent') lastGist = t.gist
    else pairs.push({ id: t.uid, aiDid: lastGist, user: t.text })
  }
  return pairs
}

function buildPrompt(pairs) {
  const items = pairs.map((p) => `【${p.id}】\nAI 刚做了:${p.aiDid.replace(/\s+/g, ' ').slice(0, 160)}\n用户回应:「${p.user.replace(/\s+/g, ' ').slice(0, 220)}」`).join('\n\n')
  return `${JUDGE_INSTRUCTION}\n\n以下是 ${pairs.length} 个配对:\n\n${items}`
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [path, startU, endU, mode, labelsPath, scaleArg, threshArg] = process.argv.slice(2)
  const trace = adaptCcSession(path)
  const win = sliceWindow(trace, +startU, +endU)

  if (mode === 'prompt') {
    process.stdout.write(buildPrompt(pairsForJudge(win)))
  } else if (mode === 'score') {
    const scale = scaleArg ? +scaleArg : 0.166
    const threshold = threshArg ? +threshArg : 3
    const labels = JSON.parse(readFileSync(labelsPath, 'utf8'))
    const byId = Object.fromEntries(labels.map((l) => [l.id, l.label]))
    // 构造累加器输入
    const turns = win.map((t) => t.role === 'agent'
      ? { role: 'agent', output: t.weight * scale }
      : { role: 'user', act: byId[t.uid] || 'neutral' })
    const r = scoreSession(turns, { threshold })
    console.log(`window U${startU}..U${endU}  scale=${scale} threshold=${threshold}`)
    console.log(`maxGap=${r.maxGap}  firstFlagAt=${r.firstFlagAt}  flaggedCount=${r.flaggedCount}\n`)
    let wi = 0
    for (let i = 0; i < win.length; i++) {
      const t = win[i], s = r.trace[i]
      if (t.role === 'agent') {
        console.log(`   AI     w=${String(t.weight).padStart(6)} →out ${String((t.weight * scale).toFixed(2)).padStart(5)}  gap=${String(s.gap).padStart(5)} ${s.flagged ? '⚠' : ' '}  ${t.gist.replace(/\s+/g, ' ').slice(0, 46)}`)
      } else {
        const act = byId[t.uid] || 'neutral'
        const mark = act === 'steer' ? '开车' : act === 'ride' ? '盖章' : '中性'
        console.log(`${t.uid.padEnd(4)} ${mark}  gap=${String(s.gap).padStart(5)} ${s.flagged ? '⚠ 亮' : '   '}  「${t.text.replace(/\s+/g, ' ').slice(0, 42)}」`)
      }
    }
  } else {
    console.error('mode must be prompt|score')
    process.exit(2)
  }
}
