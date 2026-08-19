/**
 * probe-loop.test —— 用假 host 验证插件编排核心 createSessionProbe。
 *
 * 不需要真 dsh、真模型:注入一个确定性判官(按 RIDER 剧本给标签),按真实事件顺序
 * (agent 推进 → 人类用户轮)喂 probe,断言每个用户轮 append 出的投影 view 与 live-sim 一致。
 * 证明「观察→判官→累加→发布」这条链在编排层是对的;真 ctx.llm 判官只是判官函数的一个实现。
 */

import { createSessionProbe, agentWeightOfEvent, isHumanUserMessage, parseLabels, cleanQuestion, parseQA } from './probe-core.mjs'

// 剧本:(agent 推进权重, 用户文本, 该轮判官标签)。量级同 rider-experiment。
const SCRIPT = [
  { w: 12, gist: '搭好脚手架', text: '帮我搭一个待办清单', label: 'neutral' },
  { w: 10, gist: '加勾选/删除', text: '好,继续', label: 'ride' },
  { w: 14, gist: '持久化+编辑', text: '可以,接着做', label: 'ride' },
  { w: 11, gist: '组件化重构', text: '嗯不错', label: 'ride' },
  { w: 13, gist: '状态筛选', text: '再加一个按状态筛选', label: 'neutral' },
  { w: 9, gist: '拖拽+快捷键', text: '好的', label: 'ride' },
  { w: 16, gist: '大重构+改配色', text: '行,你看着办', label: 'ride' },
  { w: 5, gist: '解释删除按钮', text: '等一下,删除按钮呢?', label: 'steer' },
  { w: 0, gist: '', text: '哦这样啊,继续吧', label: 'ride' },
]

// 确定性判官:按 aiDid 对应剧本行返回预置标签(生产里这步是 LLM)。
let cursor = 0
const fakeJudge = async () => [{ id: 'u', label: SCRIPT[cursor++].label }]
// 确定性提问器:回固定的{问题,答案},并记下收到的 recentGists(验证喂进去的是漂移段)。
let lastGists = null
const fakeAsker = async (gists) => { lastGists = gists; return { question: '删除按钮最后放在哪、为什么这么放?', answer: '放在每项常驻显示,便于一眼看到。' } }

// 真实会话是「用户先、agent 后」:某个用户轮之前累积的 agent 跨度,是上一条 prompt 的回应产出。
// 所以先 onUserMessage(结算已累积跨度),再 noteAgent(本轮之后、下一条 prompt 之前的推进)。
// 把 threshold 显式钉在 3.0:本测试只验编排机制(观察→判官→累加→发布→节流→清零),
// 期望序列按此阈值硬编码,与产品默认(现为 1.6「三振」)解耦——调参不该动这条链的断言。
const probe = createSessionProbe({ judge: fakeJudge, asker: fakeAsker, opts: { threshold: 3.0 } })
const seen = []
for (const step of SCRIPT) {
  const view = await probe.onUserMessage(step.text) // 人类用户轮 → 结算并发布 view
  seen.push(view)
  probe.noteAgent(step.w, step.gist)                // 本轮之后 agent 的自主推进
}

// 期望:与 live-sim 同一条流——静默起步、第2次盖章亮一次、节流、steer 清零、末轮静默。
const flags = seen.map((v) => v.shouldPrompt)
const expectedFlags = [false, false, true, false, false, false, false, false, false]
const gaps = seen.map((v) => v.gap)

let ok = JSON.stringify(flags) === JSON.stringify(expectedFlags)
console.log('每个用户轮发布的投影:')
for (let i = 0; i < seen.length; i++) {
  const v = seen[i]
  console.log(`  U${i + 1} 「${SCRIPT[i].text}」 → gap=${v.gap} shouldPrompt=${v.shouldPrompt}${v.reason ? ` (${v.reason})` : ''}`)
}
console.log(`\n亮灯序列 = [${flags.map((f) => (f ? '亮' : '·')).join(' ')}]`)
console.log(`期望序列 = [${expectedFlags.map((f) => (f ? '亮' : '·')).join(' ')}]`)
console.log(`共亮 ${flags.filter(Boolean).length} 次(期望 1)`)

// 附带单测 host 接缝映射(真实事件形状,dev profile 标定过)
const wA = agentWeightOfEvent({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'x'.repeat(2000) }] } } })
const wChunk = agentWeightOfEvent({ type: 'assistant/chunk', data: { delta: 'x'.repeat(2000) } }) // 流式增量必须忽略
const wT = agentWeightOfEvent({ type: 'tool/call', data: {} })
const wNone = agentWeightOfEvent({ type: 'turn/start', data: {} })
const seamOk = wA.weight === 2 && wChunk.weight === 0 && wT.weight === 0.6 && wNone.weight === 0
const humanOk = isHumanUserMessage({ source: { kind: 'user' } }) === true
  && isHumanUserMessage({ source: { kind: 'plugin' } }) === false
  && isHumanUserMessage({}) === true
console.log(`\n接缝映射:agentWeightOfEvent ${seamOk ? '✓' : '✗'}  isHumanUserMessage ${humanOk ? '✓' : '✗'}`)

// parseLabels:容忍围栏/噪声/脏 label
const pl1 = parseLabels('```json\n[{"id":"u","label":"ride","confidence":0.9}]\n```')
const pl2 = parseLabels('随便说点\n[{"id":"a","label":"steer"},{"id":"b","label":"???"}]\n结束')
const pl3 = parseLabels('模型没给JSON')
const parseOk = pl1[0]?.label === 'ride'
  && pl2[0]?.label === 'steer' && pl2[1]?.label === 'neutral' // 脏 label 兜底 neutral
  && Array.isArray(pl3) && pl3.length === 0
console.log(`parseLabels(围栏/噪声/脏) ${parseOk ? '✓' : '✗'}`)

// 提问器:触发那一轮(且仅那一轮)带出 1 问 + 答案;非触发轮为空
const firing = seen[2] // U3 = 亮的那轮
const askOk = firing.questions.length === 1 && firing.questions[0].includes('删除按钮') && firing.answer.includes('常驻')
  && seen[0].questions.length === 0 && !seen[0].answer
  && seen[3].questions.length === 0
  && Array.isArray(lastGists) && lastGists.length > 0 // 喂了漂移段的 gist
console.log(`提问器(触发轮出 1 问+答案、喂了漂移段) ${askOk ? '✓' : '✗'}`)

// cleanQuestion:去围栏/引号/取首行
const cq = cleanQuestion('```\n「你刚才为什么改了配色?」\n附注:随便问问\n```')
const cqOk = cq === '你刚才为什么改了配色?'
// parseQA:拆问题+答案(容忍围栏/前缀/变体)
const qa1 = parseQA('问题：你为什么把删除按钮改成常驻?\n答案：hover 时容易漏看,常驻更稳。')
const qa2 = parseQA('```\n问：失环是什么?\n参考答案：人从主动决策退成被动放行。\n```')
const qa3 = parseQA('就一个问题没有答案标记')
const qaOk = qa1.question.includes('删除按钮') && qa1.answer.includes('hover')
  && qa2.question === '失环是什么?' && qa2.answer.includes('被动放行')
  && qa3.question.includes('没有答案标记') && qa3.answer === ''
console.log(`cleanQuestion ${cqOk ? '✓' : '✗'}  parseQA(问题+答案/变体/缺答案) ${qaOk ? '✓' : '✗'}`)

ok = ok && seamOk && humanOk && parseOk && askOk && cqOk && qaOk
console.log(ok ? '\n✓ 编排核心通过' : '\n✗ 编排核心失败')
process.exit(ok ? 0 : 1)
