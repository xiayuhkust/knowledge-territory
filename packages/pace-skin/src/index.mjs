/**
 * dsh-plugin-pace-skin —— 套件共享皮肤(纯前端,无后端逻辑)。
 *
 * 真正的活在 lib/client.js:往页面注入一套 `--pp-*` 设计令牌 + `.pp-*` 工具类。
 * 后端在此只占个名分:导出 name / inject / apply(与 pace-hub 同形),apply 里什么都不做。
 * (少了 `export const inject` 会让 dsh 加载器走错分支、把模块当"无 apply 的 object" → 加载失败。)
 */
export const name = 'pace-skin'
export const inject = [] // 无后端依赖:皮肤只在客户端注入
export function apply(_ctx, _config = {}) { /* 皮肤只在客户端注入,后端无需接线 */ }
