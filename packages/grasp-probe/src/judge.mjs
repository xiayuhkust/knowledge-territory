/**
 * judge —— grasp-probe 的语义判官(prompt 本体)。
 *
 * steer/ride/neutral 是语义判断不是语法:同一句"好,继续"可能是刚验收完的放行,
 * 也可能是纯盖章。只有 LLM 能读出"用户这一句有没有显示他掌握了 AI 刚干的事"。
 * 判官吃 (AI 刚做了什么, 用户回了什么),用情境觉知三层当尺(感知/理解/预测)判类。
 *
 * 产出喂给 grasp-score 的累加器(算术层)。判官用便宜快模型(v4-flash / step-flash)、异步不阻塞。
 */

export const JUDGE_INSTRUCTION = `你是一个"验收落差"判官。给你若干 (AI 刚做了什么 → 用户回应) 的配对,你判断每一对里用户处于哪种状态:

- steer(掌舵):用户显示他**掌握了 AI 刚做的事**并在主动引导——验证、纠正、质疑、基于理解做知情决策、指出方向偏差、引用产出里的具体细节。
- ride(坐车):用户**不涉实质地放行/赞同**——"好/继续/可以/提交吧"这类盖章,没有迹象表明他消化了 AI 刚做的内容。
- neutral(中性):用户有参与、给了指令,但**没有在验收**刚才那批产出(比如批准一个他还没看的东西、只是布置下一步)。

判据用情境觉知三层:用户回应体现了 **感知**(知道改了什么)/ **理解**(为什么这么做)/ **预测**(会影响到哪) → 偏 steer;只有放行、三层都没体现 → 偏 ride;给了方向但不涉刚才产出 → neutral。

最终只输出一个 JSON 数组,每项 {"id","label","confidence","why"}。label 取 steer|ride|neutral,confidence 0-1,why 一句中文。除了读取本任务文件,不要调用其他工具;不要输出 JSON 以外的任何文字。`

/** 本会话真实轮次当测试集(expect=我的预期,用来对照判官)。 */
export const TEST_TURNS = [
  { id: 't1', expect: 'steer',
    aiDid: '汇报:视觉插件 phase3(纯文本 agent 自主用 flicker_detect 成功)与 GitHub 文档清理都完成,并问下一步。',
    user: '1. 告诉我你希望接入狼人杀的目的是什么,为了实战测试吗? 2. 从用户角度想想,谁会在什么场景用到这个功能,目前的 probe 够不够,还缺什么 dsh/skill 没提供的?' },
  { id: 't2', expect: 'steer',
    aiDid: '提议把三个插件按依赖轻重分两组,并问该怎么落仓。',
    user: '那随便叫一个 collection 吧,里面列表说明包括什么。所以 probe、secret-guard、script-exec 目前是平行的,还是你觉得 probe 和其他视觉的该在一起、guard 和 exec 该在一起,方便别人取用?' },
  { id: 't3', expect: 'steer',
    aiDid: '完成 contrast 工具并做了 headless 验证,建议发布视觉族。',
    user: 'shell-kit 里有些文件注释还有"首个里程碑"这种词,没必要,只留清楚功能和用法,再改一下(比如 brainstorm.md);你也看一下 brainstorm 是否有必要上传,好像不太相关。' },
  { id: 't4', expect: 'ride',
    aiDid: '请求确认是否把文档清理提交并推送到已发布的公开仓。',
    user: '是可以提交' },
  { id: 't5', expect: 'steer',
    aiDid: '讲解了社区 MisakaNet 的机制与方向,问要不要深入某一层。',
    user: '看看它的 search_knowledge.py 怎么实现的,你感受一下这样做是否有道理。' },
  { id: 't6', expect: 'neutral',
    aiDid: '把个人 profile 写成 markdown,建议发布成网页,并列了几个可探索方向。',
    user: '好的发一个网页我看看,然后我们来讨论不粘人 agent。' },
  { id: 't7', expect: 'steer',
    aiDid: '建议先用规则启发式(问号/关键词)做 steer/ride 的文本判定,再考虑要不要上模型。',
    user: '你肯定得用 llm 来判断的。' },
]

export function buildBatchPrompt(turns = TEST_TURNS) {
  const items = turns.map((t, i) => `【${t.id}】\nAI 刚做了:${t.aiDid}\n用户回应:「${t.user}」`).join('\n\n')
  return `${JUDGE_INSTRUCTION}\n\n以下是 ${turns.length} 个配对:\n\n${items}`
}

import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // 打印批量 prompt 到 stdout,供管道喂给 dsh headless。
  process.stdout.write(buildBatchPrompt())
}
