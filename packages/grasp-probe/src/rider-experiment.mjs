/**
 * rider-experiment —— 拟真"持续坐车"案例 + 阈值敏感性扫描。
 *
 * 本会话(强掌舵)给不出 firing 那一侧的真实样本,这里构造一段可信的:
 * 用户委托搭一个待办网页,然后一路盖章放行一连串越来越大的自主 build,
 * 中间一个"加个筛选"的新需求(neutral,没验收前作),最后终于停下来核实(steer)。
 *
 * 用同一条流水验证:mode=prompt 出判官 prompt(真判官判 act,兼验判官在 ride 文本上的表现);
 * mode=score 吃标签,在 threshold 2/3/4 上跑累加器,看 firing 动态与拐点。
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { JUDGE_INSTRUCTION } from './judge.mjs'
import { scoreSession } from './grasp-score.mjs'

// 拟真 trace:交替 user / agent。weight 用真实会话量级(build w9-16),scale 后 out≈1.5-2.7。
const RIDER = [
  { role: 'user', uid: 'R1', expect: 'neutral', text: '帮我搭一个待办清单的小网页,纯前端就行,先跑起来', gist: '(会话开始)' },
  { role: 'agent', weight: 12, gist: '搭好待办清单脚手架:HTML+CSS+JS,能添加和显示待办项' },
  { role: 'user', uid: 'R2', expect: 'ride', text: '好,继续', gist: '' },
  { role: 'agent', weight: 10, gist: '加了勾选完成、删除单项,以及完成态划线样式' },
  { role: 'user', uid: 'R3', expect: 'ride', text: '可以,接着做', gist: '' },
  { role: 'agent', weight: 14, gist: '接了 localStorage 持久化刷新不丢,并加双击编辑' },
  { role: 'user', uid: 'R4', expect: 'ride', text: '嗯不错', gist: '' },
  { role: 'agent', weight: 11, gist: '重构成组件化结构,加清空已完成、计数显示' },
  { role: 'user', uid: 'R5', expect: 'neutral', text: '那再加一个按状态筛选的功能吧', gist: '' },
  { role: 'agent', weight: 13, gist: '加了按状态(全部/进行中/已完成)筛选标签栏' },
  { role: 'user', uid: 'R6', expect: 'ride', text: '好的', gist: '' },
  { role: 'agent', weight: 9, gist: '加了拖拽排序和键盘快捷键' },
  { role: 'user', uid: 'R7', expect: 'ride', text: '行,你看着办,继续完善', gist: '' },
  { role: 'agent', weight: 16, gist: '大重构:抽出状态管理模块,统一事件处理,顺手改了配色' },
  { role: 'user', uid: 'R8', expect: 'steer', text: '等一下,刚才删除按钮你放哪了?我怎么没看到', gist: '' },
  { role: 'agent', weight: 5, gist: '解释:删除按钮在每项 hover 时右侧出现;已改为常驻显示' },
  { role: 'user', uid: 'R9', expect: 'ride', text: '哦这样啊,那继续吧', gist: '' },
]

function pairsForJudge() {
  const pairs = []; let last = '(会话开始)'
  for (const t of RIDER) {
    if (t.role === 'agent') last = t.gist
    else pairs.push({ id: t.uid, aiDid: last, user: t.text })
  }
  return pairs
}
function buildPrompt() {
  const items = pairsForJudge().map((p) => `【${p.id}】\nAI 刚做了:${p.aiDid}\n用户回应:「${p.user}」`).join('\n\n')
  return `${JUDGE_INSTRUCTION}\n\n以下是 ${pairsForJudge().length} 个配对:\n\n${items}`
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, labelsPath] = process.argv.slice(2)
  if (mode === 'prompt') { process.stdout.write(buildPrompt()); process.exit(0) }
  if (mode !== 'score') { console.error('mode must be prompt|score'); process.exit(2) }

  const labels = JSON.parse(readFileSync(labelsPath, 'utf8'))
  const byId = Object.fromEntries(labels.map((l) => [l.id, l.label]))
  const scale = 0.166

  // 判官 vs 预期
  let hit = 0
  for (const t of RIDER) if (t.role === 'user') { if (byId[t.uid] === t.expect) hit++ }
  const users = RIDER.filter((t) => t.role === 'user').length
  console.log(`判官 vs 预期:${hit}/${users} 命中\n`)

  const turns = RIDER.map((t) => t.role === 'agent'
    ? { role: 'agent', output: t.weight * scale }
    : { role: 'user', act: byId[t.uid] || 'neutral' })

  // 阈值扫描
  console.log('阈值敏感性(scale=0.166):')
  for (const threshold of [2, 3, 4]) {
    const r = scoreSession(turns, { threshold })
    const fl = r.trace.filter((s) => s.flagged)
    const uids = fl.map((s) => RIDER[s.i].uid)
    console.log(`  threshold=${threshold}: 亮 ${fl.length} 次 [${uids.join(', ')}]  maxGap=${r.maxGap}`)
  }

  // threshold=3 详细轨迹
  console.log('\nthreshold=3 轨迹:')
  const r = scoreSession(turns, { threshold: 3 })
  for (let i = 0; i < RIDER.length; i++) {
    const t = RIDER[i], s = r.trace[i]
    if (t.role === 'agent') console.log(`   AI    w=${String(t.weight).padStart(3)} →out ${(t.weight * scale).toFixed(2)}  gap=${String(s.gap).padStart(5)}   ${t.gist.slice(0, 34)}`)
    else {
      const a = byId[t.uid], m = a === 'steer' ? '开车' : a === 'ride' ? '盖章' : '中性'
      console.log(`${t.uid} ${m}  gap=${String(s.gap).padStart(5)} ${s.flagged ? '⚠ 亮' : '   '}  「${t.text}」`)
    }
  }
}
