/**
 * crosslens.test —— 用假 LLM 验证格式/解析契约(确定性,无需真 dsh/真模型)。
 *
 * 只验"接线/解析"这层:buildAssociatePrompt 塞对了学科+上下文、parseAssociation 各种输入都稳。
 * 联想的**质量**是 LLM 的事,靠真机 curl 调 prompt(见 BRAINSTORM),不在这测。
 */

import { buildAssociatePrompt, parseAssociation } from './associate.mjs'

let ok = true
const check = (name, cond) => { console.log(`${cond ? '✓' : '✗'} ${name}`); ok = ok && cond }

// —— buildAssociatePrompt:学科 + 上下文都进了 prompt ——
const p = buildAssociatePrompt(['用户:帮我设计一个限流器', 'AI:用令牌桶实现了滑动窗口'], ['生态学', '热力学'])
check('prompt 含学科', p.includes('生态学') && p.includes('热力学'))
check('prompt 含上下文', p.includes('令牌桶') && p.includes('限流器'))
const pEmpty = buildAssociatePrompt([], [])
check('prompt 空上下文兜底', pEmpty.includes('还没聊什么') && pEmpty.includes('未指定'))

// —— parseAssociation:标准卡(含学科行) ——
const c1 = parseAssociation('学科：生态学\n联想：生态学的"关键种"——限流器就是系统里的关键种,拿掉它整个服务链会级联崩塌。\n展开：关键种数量少但影响面大,你的限流阈值也是这种"少量参数、全局后果"的点。')
check('标准卡 hook', c1.hook.includes('关键种') && c1.hook.includes('限流器'))
check('标准卡 expand', c1.expand.includes('全局后果'))
check('标准卡 discipline', c1.discipline === '生态学')

// —— 变体前缀 + 无展开 + 无学科行 ——
const c2 = parseAssociation('```\n想到：热力学第二定律——你的缓存不主动整理就会熵增成一团乱。\n```')
check('变体前缀+围栏', c2.hook.includes('热力学第二定律') && c2.hook.includes('熵增'))
check('无展开留空', c2.expand === '')
check('无学科行 → discipline 空', c2.discipline === '')

// —— 空卡哨兵:没抽到 ——
const c3 = parseAssociation('联想：（这次没有靠谱的联想）')
check('空卡哨兵 → 空', c3.hook === '' && c3.expand === '')
const c4 = parseAssociation('联想：这几个学科暂无联想')
check('空卡变体 → 空', c4.hook === '')
const c5 = parseAssociation('')
check('空输入 → 空', c5.hook === '' && c5.expand === '')

// —— 引号包裹的 hook 去引号 ——
const c6 = parseAssociation('联想：「音乐的对位法——两条独立旋律线互不干扰又和谐,像你的两个并发任务。」')
check('去引号', c6.hook.startsWith('音乐的对位法') && !c6.hook.startsWith('「'))

console.log(ok ? '\n✓ 格式/解析契约通过' : '\n✗ 契约失败')
process.exit(ok ? 0 : 1)
