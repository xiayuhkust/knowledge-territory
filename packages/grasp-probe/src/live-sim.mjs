/**
 * live-sim —— 把「信号流」演示出来:一轮一轮喂,打印每个用户轮之后 graspProbe 投影的实际取值。
 *
 * 这是逻辑层的 headless 验证:证明增量 stepper 接上判官标签后,能产出 UI 会订阅到的
 * { gap, shouldPrompt, reason, questions } 值流——该静默时静默、该亮时亮一次、盖章升 steer 清零。
 * 与「dsh 投影/事件 API 有没有接对」解耦(那部分在 index.mjs 里对着真源码写)。
 *
 * 语料:rider-experiment 的拟真持续坐车,判官标签已在实验里验证(9/9 命中)。
 * 每个用户轮 = 生产版里「跑完判官、拿到 act」的时刻;这里直接用离线标签,专验累加+呈现。
 */

import { createGraspState, stepAgent, stepUser } from './grasp-live.mjs'

const scale = 0.166

// (act, 权重) 交替流。act 为该用户轮判官的输出;agent 轮的 w 是 adapt 出的推进量。
const STREAM = [
  { role: 'user', act: 'neutral', text: '帮我搭一个待办清单的小网页,先跑起来' },
  { role: 'agent', w: 12, gist: '搭好脚手架:能添加/显示待办' },
  { role: 'user', act: 'ride', text: '好,继续' },
  { role: 'agent', w: 10, gist: '加勾选完成/删除/划线样式' },
  { role: 'user', act: 'ride', text: '可以,接着做' },
  { role: 'agent', w: 14, gist: 'localStorage 持久化 + 双击编辑' },
  { role: 'user', act: 'ride', text: '嗯不错' },
  { role: 'agent', w: 11, gist: '组件化重构 + 清空已完成 + 计数' },
  { role: 'user', act: 'neutral', text: '再加一个按状态筛选' },
  { role: 'agent', w: 13, gist: '加了状态筛选标签栏' },
  { role: 'user', act: 'ride', text: '好的' },
  { role: 'agent', w: 9, gist: '拖拽排序 + 键盘快捷键' },
  { role: 'user', act: 'ride', text: '行,你看着办,继续完善' },
  { role: 'agent', w: 16, gist: '大重构:抽状态管理 + 顺手改配色' },
  { role: 'user', act: 'steer', text: '等一下,删除按钮你放哪了?我没看到' },
  { role: 'agent', w: 5, gist: '解释删除按钮位置,改为常驻' },
  { role: 'user', act: 'ride', text: '哦这样啊,那继续吧' },
]

const st = createGraspState()
let projection = null   // UI 通过 useProjection('graspProbe') 看到的值,初始 null
let promptCount = 0

console.log('每个用户轮之后,UI 订阅到的 graspProbe 投影值:\n')
for (const t of STREAM) {
  if (t.role === 'agent') { stepAgent(st, { output: t.w * scale }); continue }
  // 用户轮:生产版此刻已跑完判官拿到 act;喂累加器,得到新投影值
  projection = stepUser(st, t.act)
  const tag = t.act === 'steer' ? '开车' : t.act === 'ride' ? '盖章' : '中性'
  const bar = projection.shouldPrompt ? '  ⚠ 淡提示亮' : ''
  console.log(`[${tag}] 「${t.text}」`)
  console.log(`   → graspProbe = { gap:${projection.gap}, shouldPrompt:${projection.shouldPrompt}${projection.reason ? `, reason:"${projection.reason}"` : ''} }${bar}`)
  if (projection.shouldPrompt) promptCount++
}

console.log(`\n整段共亮 ${promptCount} 次提示(期望:1;盖章漂移期只提醒一次,steer 后重新武装)。`)
console.log(`末值 shouldPrompt=${projection.shouldPrompt}(steer 已把状态清零,末轮 ride 未再越阈)。`)
