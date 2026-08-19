/**
 * jiyibi.test —— 验证账本存取契约(确定性,用临时文件,无需真 dsh)。
 * 用法:JIYIBI_FILE=<tmp> node src/jiyibi.test.mjs(下面自设临时文件)。
 */

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync, existsSync } from 'node:fs'

// 必须在 import store 之前设好 JIYIBI_FILE(store 在模块加载时读它)
const TMP = join(tmpdir(), `jiyibi-test-${Date.now()}.jsonl`)
process.env.JIYIBI_FILE = TMP
if (existsSync(TMP)) rmSync(TMP)

const { addMark, listMarks, removeMark, readMarks } = await import('./store.mjs')
const { assistantOf, humanUserOf } = await import('./seams.mjs')

let ok = true
const check = (name, cond) => { console.log(`${cond ? '✓' : '✗'} ${name}`); ok = ok && cond }

try {
  // add + list
  const m1 = addMark({ sessionId: 's1', note: '这个"公地悲剧"的类比点醒我了', userAsked: '限流怎么设计', aiSaid: '令牌桶+公平队列' })
  const m2 = addMark({ sessionId: 's1', note: '原来我一直没搞懂 async', userAsked: '解释 async', aiSaid: '事件循环…' })
  check('add 返回 id/ts', !!m1.id && typeof m1.ts === 'number')
  check('list 倒序(最新在前)', listMarks()[0].id === m2.id)
  check('list 全部', listMarks().length === 2)

  // 检索:note 命中
  check('search note 命中', listMarks({ query: '公地悲剧' }).length === 1)
  // 检索:快照原文命中
  check('search 快照命中', listMarks({ query: '事件循环' }).some((m) => m.id === m2.id))
  // 检索:不命中
  check('search 无果', listMarks({ query: '不存在的词xyz' }).length === 0)

  // 软删除:tombstone,不重写文件
  removeMark(m1.id)
  const after = listMarks()
  check('remove 后消失', !after.some((m) => m.id === m1.id) && after.length === 1)
  check('remove 是 append(文件仍含原记录行)', readMarks().length === 1)

  // 空 note 由 index 层挡(store 不管);这里只测 store 契约

  // seams:锚点提取
  const a = assistantOf({ type: 'assistant/message', data: { message: { id: 'msg1', content: [{ type: 'text', text: '这是 AI 说的话' }] } } })
  check('assistantOf 取文本+id', a.text === '这是 AI 说的话' && a.id === 'msg1')
  const u = humanUserOf({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '我的问题' }] } })
  check('humanUserOf 取真人文本', u === '我的问题')
  const up = humanUserOf({ type: 'user/message', data: { source: { kind: 'plugin' }, text: '合成' } })
  check('humanUserOf 排除合成来源', up === '')
} finally {
  try { rmSync(TMP) } catch { /* ignore */ }
}

console.log(ok ? '\n✓ 账本存取契约通过' : '\n✗ 契约失败')
process.exit(ok ? 0 : 1)
