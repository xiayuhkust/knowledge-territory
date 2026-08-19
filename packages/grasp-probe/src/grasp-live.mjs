/**
 * grasp-live —— 累加器的「增量」形态。
 *
 * grasp-score.mjs 的 scoreSession 是批处理:一次吃整段轮次。真实会话里轮次是一轮一轮来的,
 * 后端插件必须维护跨轮状态、每来一轮更新一次。这里就是那个有状态的 stepper——
 * 逐轮喂,返回当前 { gap, shouldPrompt, reason },语义与批处理逐字一致(见文件末自测)。
 *
 * 状态就是批处理里那四个跨轮变量:gap / sinceSteer / ridesInStreak / shown。
 * 权重常量共用 grasp-score 的 DEFAULTS,单一事实源。
 */

import { DEFAULTS } from './grasp-score.mjs'

/** 新建一个会话的累加器状态。opts 覆盖权重/阈值。 */
export function createGraspState(opts = {}) {
  return {
    opts: { ...DEFAULTS, ...opts },
    gap: 0,
    sinceSteer: 0,     // 自上次 steer 以来的 agent 推进轮数(=连续成功流)
    ridesInStreak: 0,
    shown: false,      // 呈现节流:一段漂移里提示只亮一次;steer 归零时重新武装
  }
}

/**
 * 喂一个 agent 轮。turn: { output?:number=1, complexity?:number=1 }。
 * 返回当前视图(agent 轮不呈现提示,shouldPrompt 恒 false)。
 */
export function stepAgent(state, turn = {}) {
  const { wStreak } = state.opts
  const base = (turn.output ?? 1) * (turn.complexity ?? 1)
  state.gap += base + wStreak * state.sinceSteer
  state.sinceSteer++
  return view(state, false)
}

/**
 * 喂一个 user 轮。act: 'steer' | 'ride' | 'neutral'。
 * 返回当前视图,含 shouldPrompt(此刻是否该亮淡提示,已过呈现节流)。
 */
export function stepUser(state, act) {
  const { wRide, neutralRelief, threshold } = state.opts
  if (act === 'steer') {
    state.gap = 0; state.sinceSteer = 0; state.ridesInStreak = 0; state.shown = false
  } else if (act === 'ride') {
    state.gap += wRide; state.ridesInStreak++
  } else { // neutral
    state.gap *= neutralRelief
  }
  const drifting = state.gap >= threshold          // 状态:是否已漂出验收范围
  const shouldPrompt = drifting && !state.shown    // 呈现:此刻是否真弹(节流后)
  if (shouldPrompt) state.shown = true
  return view(state, shouldPrompt)
}

/** 把内部状态投成对外视图(即 graspProbe 投影的值)。 */
function view(state, shouldPrompt) {
  return {
    gap: +state.gap.toFixed(2),
    shouldPrompt,
    reason: shouldPrompt ? reasonFor(state.sinceSteer, state.ridesInStreak) : '',
    questions: [], // 触发时由 asker 填 1 问
    answer: '',    // 那 1 问的参考答案(闪卡背面);点"看看答案"才显示
  }
}

function reasonFor(sinceSteer, rides) {
  const parts = []
  if (sinceSteer >= 3) parts.push(`连续 ${sinceSteer} 轮自主推进未被验收`)
  if (rides >= 2) parts.push(`${rides} 次盖章式回应`)
  return parts.length ? parts.join('、') : '累计推进已超验收'
}

// —— 自测:逐轮增量必须与批处理 scoreSession 逐轮一致(flagged 序列 + 每轮 gap) ——
import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { scoreSession } = await import('./grasp-score.mjs')
  const A = (output = 1, complexity = 1) => ({ role: 'agent', output, complexity })
  const steer = { role: 'user', act: 'steer' }
  const ride = { role: 'user', act: 'ride' }
  const neutral = { role: 'user', act: 'neutral' }

  const cases = {
    steering: [A(), steer, A(), steer, A(1.5), steer, A(), steer, A(1.2), steer],
    riding: [A(), ride, A(), ride, A(), ride, A(), ride, A(), ride],
    mixed: [A(), ride, A(), ride, A(), ride, A(1.5), steer, A(), steer, A(), ride],
    rider: [ // 拟真持续坐车(rider-experiment 的量级)
      A(2.0), ride, A(1.66), ride, A(2.32), ride, A(1.83), neutral,
      A(2.16), ride, A(1.49), ride, A(2.66), steer, A(0.83), ride,
    ],
  }

  let allOk = true
  for (const [name, turns] of Object.entries(cases)) {
    const batch = scoreSession(turns)
    const st = createGraspState()
    const liveFlags = []
    const liveGaps = []
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i]
      const v = t.role === 'agent' ? stepAgent(st, t) : stepUser(st, t.act)
      liveGaps.push(v.gap)
      if (v.shouldPrompt) liveFlags.push(i)
    }
    const batchFlags = batch.trace.filter((r) => r.flagged).map((r) => r.i)
    const batchGaps = batch.trace.map((r) => r.gap)
    const flagsOk = JSON.stringify(liveFlags) === JSON.stringify(batchFlags)
    const gapsOk = JSON.stringify(liveGaps) === JSON.stringify(batchGaps)
    const ok = flagsOk && gapsOk
    allOk &&= ok
    console.log(`${ok ? '✓' : '✗'} ${name.padEnd(9)} flagged live=[${liveFlags}] batch=[${batchFlags}] ${gapsOk ? '' : '⚠GAP MISMATCH'}`)
  }
  console.log(allOk ? '\n全部一致:增量 = 批处理' : '\n✗ 不一致')
  process.exit(allOk ? 0 : 1)
}
