/**
 * associate —— 跨学科联想器的 prompt 本体(可替换的"技能"件,和 grasp 的 ask.mjs 平行)。
 *
 * 抽卡那一刻,拿"最近在聊/在做什么" + "用户关注的学科",生成**一条**跨学科线头:
 * 把某个学科里的确切概念,映射到用户当前正在做的事上。
 *
 * 定位铁律(承系列北极星:给工具不给答案):
 * - 给的是**线头/引子**,不是做完的跨学科分析——留白,让用户自己往下想。
 * - **宁缺毋滥**:没有具体连接就老实说没有,绝不硬凑"都讲究平衡/都是系统"这类泛泛而谈。
 * - 抽卡是手感不是奖励:每张卡都是把人推回自己的思考,不是让他为多巴胺一直抽。
 */

export const ASSOCIATE_INSTRUCTION = `你在帮一个用户跳出单一学科的思维沟。下面是他最近在聊/在做的事,以及他关注的几个学科。
请给出**一条具体的跨学科联想**——把某个学科里的确切概念/结构/现象,映射到他当前正在做的这件事上。

这是一张"抽卡"式的线头,不是分析报告:
- **优先用他列出的学科**:先从他关注的那几个学科里找连接。如果这几个都连不上、但你在**别的**学科想到一个**真正具体**的连接,也可以用那个——但必须在"学科："里如实写出你到底用了哪个学科(哪怕它不在他的列表里)。
- 要**具体**:点名那个学科里的**某个确切概念**(如"生态学的'关键种'""热力学第二定律""音乐里的对位法""免疫系统的'自我/非我'识别"),讲清它和用户当前这件事**哪里同构**。
- 是**引子不是结论**:给一个让他自己往下想的钩子,别替他把跨学科分析做完。点到为止。
- **宁缺毋滥**:如果哪个学科都和他当前在做的事没有真正具体的连接,别硬凑泛泛而谈的("都需要平衡""都讲究系统""都要迭代")。这种情况**只输出这一行**:
  联想：（这次没有靠谱的联想）
- 口吻像一个博学的朋友忽然想到,轻松、点到为止,不说教。
- 严格按下面格式输出,**不要任何其它文字**:
学科：<这张卡实际用的那个确切学科名,如"生态学">
联想：<一句话的跨学科线头:点名确切概念,说清和用户在做的事哪里同构>
展开：<可选,一两句更具体的结构对应;没有可留空或省略这行>`

/**
 * 组装 prompt。recentGists: 最近对话的简述数组;disciplines: 用户选的学科字符串数组。
 */
export function buildAssociatePrompt(recentGists = [], disciplines = []) {
  const disc = (disciplines || []).map((d) => String(d).trim()).filter(Boolean)
  const discLine = disc.length ? disc.join('、') : '(未指定——任选一个能给出具体连接的学科)'
  const items = recentGists.length
    ? recentGists.map((g) => `- ${String(g).replace(/\s+/g, ' ').slice(0, 160)}`).join('\n')
    : '- (还没聊什么实质内容)'
  return `${ASSOCIATE_INSTRUCTION}\n\n他关注的学科:${discLine}\n\n他最近在聊/在做:\n${items}`
}

const NO_CARD = /没有.{0,4}(靠谱|具体)?.{0,4}(联想|连接)|没有.*可.*联想|暂无联想/

/**
 * 解析联想器输出。期望(学科行可选):
 *   学科：<这张卡用的学科>
 *   联想：<线头>
 *   展开：<可选>
 * 容忍围栏 / 变体前缀 / 缺展开 / 缺学科行。命中"没有靠谱的联想"哨兵 → 空卡(前端显示"没抽到")。
 * 返回 { hook, expand, discipline }。
 */
export function parseAssociation(text) {
  const s = String(text || '').trim().replace(/^```[\s\S]*?\n|```$/g, '').trim()
  if (!s) return { hook: '', expand: '', discipline: '' }
  // 学科:模型声明这张卡用的学科(供后端核对是否在用户列表里)
  const discM = s.match(/(?:^|\n)\s*(?:学科|领域)\s*[:：]\s*([^\n]+)/)
  const discipline = discM ? cleanLine(discM[1]) : ''
  // 展开:另起一行的 展开/延伸/说明(取到行尾)
  const expM = s.match(/\n\s*(?:展开|延伸|说明)\s*[:：]\s*([\s\S]*)$/)
  const expand = expM ? cleanLine(expM[1], true) : ''
  // 线头:优先抓"联想："那一行;抓不到则退回首个非"学科/展开"的非空行
  let hook = ''
  const hookM = s.match(/(?:^|\n)\s*(?:联想|线头|想到)\s*[:：]\s*([^\n]+)/)
  if (hookM) hook = cleanLine(hookM[1])
  else {
    const line = s.split(/\r?\n/).map((l) => l.trim())
      .find((l) => l && !/^(?:学科|领域|展开|延伸|说明)\s*[:：]/.test(l)) || ''
    hook = cleanLine(line)
  }
  if (!hook || NO_CARD.test(hook)) return { hook: '', expand: '', discipline: '' } // 没抽到
  return { hook, expand, discipline }
}

/** 去围栏/引号,取首个非空行(multi=true 时保留多行,只去首尾引号)。 */
function cleanLine(text, multi = false) {
  if (!text) return ''
  let s = String(text).trim().replace(/^```[\s\S]*?\n|```$/g, '').trim()
  if (!multi) s = s.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || ''
  return s.replace(/^["'「『]|["'」』]$/g, '').trim()
}
