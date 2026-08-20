/**
 * atlas 存储层:知识疆域的落盘。
 *
 * 疆域(学科/城/桥)落在 `~/.dsh/atlas/territory.json`——同 jiyibi 账本的约定:
 * 用户数据在 homedir、不进仓库、不碰会话日志。写入原子化(先写 .tmp 再 rename),
 * 防中途崩溃留半个 JSON;读失败(没有文件/坏 JSON)则从零开始,绝不炸启动。
 *
 * TODO(vault): 后续可升级为 Karpathy/Obsidian 式 markdown 笔记夹——
 *   concepts/<slug>.md 一概念一文件、bridges/<slug>.md 一桥一文件、[[互链]];
 *   本 JSON 是它的前身,升级时写一次性迁移即可。
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DIR = join(homedir(), '.dsh', 'atlas')
const FILE = join(DIR, 'territory.json')

// 学科总库(1 级):与前端 DISC_LIB / 跨学科抽卡 PRESETS 共享同一套结构(维基学科大纲骨架)。
// classifyNote 在前端没传候选、用户又还没开辟任何学科时,以此为兜底候选。
export const LIB_NAMES = [
  '数学', '统计学', '计算机科学', '系统论', '信息论',
  '物理学', '化学', '天文学', '地球科学', '生物学', '神经科学',
  '经济学', '心理学', '社会学', '政治学', '人类学', '语言学', '地理学', '传播学',
  '哲学', '历史学', '文学', '艺术', '宗教学',
  '工程学', '医学与健康', '法学', '教育学', '管理学',
]

export function seedMap() {
  // 从 0 开始:disciplines = 用户开辟过的(不含总库);疆域完全由用户长出来。
  return { disciplines: [], nodes: [], edges: [], bridges: [], _seq: 1000 }
}

/** 读落盘的疆域;没有/坏了 → 全新白海。字段逐个校验,坏一块不拖累整体。 */
export function loadState() {
  try {
    const s = JSON.parse(readFileSync(FILE, 'utf8'))
    if (s && typeof s === 'object') {
      const base = seedMap()
      for (const k of ['disciplines', 'nodes', 'edges', 'bridges']) if (Array.isArray(s[k])) base[k] = s[k]
      if (typeof s._seq === 'number' && s._seq > base._seq) base._seq = s._seq
      return base
    }
  } catch (e) { /* 首次运行或文件损坏 → 从零开始 */ }
  return seedMap()
}

/** 原子落盘。失败(磁盘/权限)静默返回 false——疆域继续活在内存里,下次写再试。 */
export function saveState(state) {
  try {
    mkdirSync(DIR, { recursive: true })
    const body = JSON.stringify({
      disciplines: state.disciplines, nodes: state.nodes,
      edges: state.edges, bridges: state.bridges, _seq: state._seq,
    })
    const tmp = FILE + '.tmp'
    writeFileSync(tmp, body, 'utf8')
    renameSync(tmp, FILE)
    return true
  } catch (e) { return false }
}
