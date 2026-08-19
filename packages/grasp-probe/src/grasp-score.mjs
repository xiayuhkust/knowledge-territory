/**
 * grasp-score 核心:吃一段会话的轮次序列,逐轮算「验收落差」——
 * AI 已提交的 减去 用户真正验收/掌握的。落差过阈 → 该给一个淡提示。
 *
 * 信号与权重来自文献(见 BRAINSTORM.md 第 1-3 节),不是拍脑袋:
 *  - 主动→被动切换 = 失环头号标志(Endsley & Kiris 1995):橡皮图章涨落差、steer 归零。
 *  - 自满随可靠性增长(Parasuraman):连续未被纠正的自主推进 = 复利放大器,不是"没事"。
 *  - 流畅性错觉(Bjork):用户无法自我察觉 → 必须外部触发。
 *
 * 阈值/权重是可调常量,须在真实 trace 上标定(同 flicker 阈值当初)。
 *
 * 输入 turn(MVP 阶段特征已标注;把原始文本分成 steer/ride 的分类器是后续):
 *   agent 轮:{ role:'agent', output?:number=1, complexity?:number=1 }
 *             output=这轮自主推进的量(改动/决策/长度的代理),complexity=复杂度/后果放大。
 *   user  轮:{ role:'user', act:'steer'|'ride'|'neutral' }
 *             steer=提问/纠正/引用细节/跑验证(重新入环);ride=橡皮图章("好/继续");
 *             neutral=有参与但没在验收。
 */

export const DEFAULTS = {
  wStreak: 0.15,   // 每多一轮"未被纠正的自主推进",落差额外加(自满复利)
  wRide: 0.4,      // 一次橡皮图章加多少(被动标志)
  neutralRelief: 0.7, // neutral 轮把落差乘这个(部分缓解)
  // 「三振出局」校准(2026-08-17):自上次真掌控(steer)以来连续盖章满 3 次即亮提示。
  // 盖章 +0.4、复利 +0.15×轮 均不受 scale 影响 → 纯"继续"下第 3 轮累到 ~1.65 越阈;
  // AI 交付越多(长回复/工具)越早(2 轮),真追问(steer)当场归零永不亮。
  threshold: 1.6,  // 落差达到即亮提示
}

export function scoreSession(turns, opts = {}) {
  const { wStreak, wRide, neutralRelief, threshold } = { ...DEFAULTS, ...opts }
  let gap = 0
  let sinceSteer = 0   // 自上次 steer 以来的 agent 推进轮数(=连续成功流)
  let ridesInStreak = 0
  let shown = false    // 呈现节流:一段漂移里提示只亮一次;steer 归零时重新武装
  const trace = []

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]
    let note = ''
    if (t.role === 'agent') {
      const base = (t.output ?? 1) * (t.complexity ?? 1)
      const streakAmp = wStreak * sinceSteer
      gap += base + streakAmp
      sinceSteer++
      note = `+推进${base.toFixed(2)}${streakAmp ? ` +自满${streakAmp.toFixed(2)}(连${sinceSteer - 1})` : ''}`
    } else { // user
      if (t.act === 'steer') {
        gap = 0; sinceSteer = 0; ridesInStreak = 0; shown = false // 响应→归零并重新武装
        note = '重新入环 → 落差归零'
      } else if (t.act === 'ride') {
        gap += wRide; ridesInStreak++
        note = `橡皮图章 +${wRide}(本流第${ridesInStreak}次)`
      } else { // neutral
        gap *= neutralRelief
        note = `部分参与 ×${neutralRelief}`
      }
    }
    // 提示只在"用户轮"呈现(agent 跨度中间用户看不见),且经节流:一段漂移只亮一次。
    const drifting = gap >= threshold && t.role === 'user'  // 状态:是否已漂出验收范围
    const flagged = drifting && !shown                       // 呈现:是否此刻真弹提示
    if (flagged) shown = true
    trace.push({
      i, role: t.role, act: t.act, output: t.output,
      gap: +gap.toFixed(2), sinceSteer, drifting, flagged,
      reason: flagged ? reasonFor(sinceSteer, ridesInStreak) : '', note,
    })
  }

  const flaggedTurns = trace.filter((r) => r.flagged).map((r) => r.i)
  return {
    trace,
    maxGap: Math.max(0, ...trace.map((r) => r.gap)),
    firstFlagAt: flaggedTurns.length ? flaggedTurns[0] : null,
    flaggedCount: flaggedTurns.length,
  }
}

function reasonFor(sinceSteer, rides) {
  const parts = []
  if (sinceSteer >= 3) parts.push(`连续 ${sinceSteer} 轮自主推进未被验收`)
  if (rides >= 2) parts.push(`${rides} 次盖章式回应`)
  return parts.length ? parts.join('、') : '累计推进已超验收'
}

// —— CLI:跑三档合成对照,验证能否区分 开车/坐车,并在重新参与时回落 ——
import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const A = (output = 1, complexity = 1) => ({ role: 'agent', output, complexity })
  const steer = { role: 'user', act: 'steer' }
  const ride = { role: 'user', act: 'ride' }

  const scenarios = {
    'steering(用户全程开车,期望:不亮)': [
      A(), steer, A(), steer, A(1.5), steer, A(), steer, A(1.2), steer,
    ],
    'riding(用户全程盖章,期望:climbs→亮)': [
      A(), ride, A(), ride, A(), ride, A(), ride, A(), ride,
    ],
    'mixed(先盖章后开车,期望:亮完回落)': [
      A(), ride, A(), ride, A(), ride, A(1.5), steer, A(), steer, A(), ride,
    ],
  }

  for (const [name, turns] of Object.entries(scenarios)) {
    const r = scoreSession(turns)
    console.log(`\n### ${name}`)
    console.log(`maxGap=${r.maxGap}  firstFlagAt=${r.firstFlagAt}  flaggedCount=${r.flaggedCount}`)
    for (const s of r.trace) {
      const who = s.role === 'agent' ? 'AI ' : (s.act === 'steer' ? '用户·开车' : s.act === 'ride' ? '用户·盖章' : '用户·中性')
      console.log(`  t${String(s.i).padStart(2)} ${who.padEnd(9)} gap=${String(s.gap).padStart(5)} ${s.flagged ? '⚠ 亮' : '   '} ${s.reason || s.note}`)
    }
  }
}
