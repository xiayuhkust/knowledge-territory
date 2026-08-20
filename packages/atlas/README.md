# dsh-plugin-atlas · 知识疆域

从你的会话里，一块块拼出的知识地图。概念是「城」，学科是「大陆」，有类型的连线是「航路」，你自己的笔记与抽的卡沉淀为「桥」。AI 只负责找出相邻的想法；连上它的那一下，是你。

面向 DeepSeek Harness (dsh) 0.1.x 开发者预览，是 [`dsh-pace-popups`](../../README.md) 套件的一员。数据走通用 Connection RPC 通道与本地 markdown 笔记夹，**绝不写会话日志**。

## 三层结构

| 层 | 地图上的样子 | 谁来写 |
|---|---|---|
| **学科 discipline** | 一块大陆（分类 + 地色）；细分学科 = 大陆里的一片「州」 | 会话自动归类，或你手动新建 |
| **概念 node** | 一座城；掌握越深，地盘越大 | 会话编译抽出，或你手动落城 |
| **航路 edge** | 城与城之间「有类型 + 你写的一句为什么」的连线 | AI 提候选，**你点亮** |
| **桥 bridge** | 一个小容器，里头可有很多**词条**（笔记 / 抽的卡 / 随手的词），锚在若干城之间 | **全是你的内容**——最「你」的一层 |

## 与套件其它工具的联动

- **跨学科抽卡（crosslens）** 抽出的卡 → 「塞进地图」→ 落成对应大陆里一条待安置的词条（收进该学科的「抽卡收件」桥）。
- **记一笔（jiyibi）** 记下的笔记 → 「架成一座桥」→ 笔记原文成为桥里的词条，桥锚在这条笔记触及的概念之间。

联动通过前端直接 `rpc.call('/atlas', ...)` 完成，插件之间不做后端耦合；atlas 未安装时按钮自动降级。

## 结构

- 后端 `src/index.mjs`：持有地图、注册 `/atlas` RPC 通道（`getMap` / `compileSession` / `addConcept` / `createDiscipline` / `connect` / `createBridge` / `addEntry` / `addCard` / `addNote`）。存储层 `src/store.mjs`（当前内存，路线图为 `[[互链]]` markdown vault）。
- 前端 `lib/client.js`：手写零构建工厂；把疆域画布（域扭曲加权 Voronoi 地形 + 力导向布局 + 悬停高亮航路 + 建城/连线面板）挂进 app 级 `shell.overlay`，从浮条开一张全屏地图。

## 状态

骨架期：前端画布已可跑（内存态假数据）；后端数据模型 + RPC + 联动端点已就位；`compileSession` 的会话抽取与 markdown vault 持久化为 TODO。

## License

[MIT](../../LICENSE)
