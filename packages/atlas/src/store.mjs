/**
 * atlas 存储层。
 *
 * 现状:seedMap() 返回一份进程内内存地图(与原型 starchart 的初始数据一致),供骨架期跑通。
 *
 * TODO(持久化 = Karpathy/Obsidian 式 markdown vault):
 *   把地图落成一个 `[[互链]]` 的 markdown 笔记夹,而不是单个 JSON——
 *     concepts/<slug>.md   一概念一文件;frontmatter: disc/sub/mastery/aliases/src;正文用 [[链接]] 记航路(带类型注记)
 *     bridges/<slug>.md    一桥一文件;frontmatter: origin/anchors;正文逐条列 entries(词条)
 *     disciplines.md       学科(大陆)索引 + 地色
 *   loadVault(dir) / saveVault(dir, state):读写该文件夹;绝不写会话日志。
 *   个人规模下无需向量库(Karpathy:"no embeddings needed at personal scale")。
 */

// 学科总库(1 级):与前端 DISC_LIB / 跨学科抽卡 PRESETS 共享同一套结构。
// classifyNote 在前端没传学科时以此为候选;颜色由前端登记簿(DISC/DISC_LIB)统一分配,后端不管色。
const DISCIPLINES = [
  '系统论', '信息论', '经济学', '生物学', '哲学', '心理学', '物理学',
  '数学', '计算机科学', '神经科学', '语言学', '社会学', '历史学', '艺术',
].map((name, i) => ({ key: 'lib' + i, name, land: null, city: null }))

export function seedMap() {
  // 从 0 开始:不再种任何演示城/航路(旧 mock"熵/冗余/反馈回路…"已清)。疆域完全由用户长出来。
  return { disciplines: DISCIPLINES.slice(), nodes: [], edges: [], bridges: [], _seq: 1000 }
}
