/**
 * dsh-plugin-pace-hub —— 「节奏台」的后端(dsh 接线层)。
 *
 * 定位:节奏弹窗系列的浮窗 hub(见 BRAINSTORM)。像输入法的浮空横条:浮在全 app 之上,
 * ① 管理各弹窗的开/关;② 日后承载重操作(记一笔账本浏览、只读重读)。挂在官方 shell.overlay 槽。
 *
 * v1a 是**纯前端**:开关状态就存在浏览器 localStorage(`pace-popup:enabled:<slug>`),
 * 各弹窗 client 直接读它、监听变化 → 无需任何后端数据。此模块仅作占位,让 client bundle
 * 随插件正常装配(dsh 的 client 半边挂在 host 包上)。绝不碰会话日志。
 *
 * v1b(以后):若账本浏览/只读重读需要跨会话数据,再在此开 Connection RPC 通道
 * (照 jiyibi 的 /jiyibi 先例:loopback、只读内存 + 插件自有文件,永不 append 会话日志)。
 */

export const name = 'pace-hub'
export const inject = [] // v1a 无后端依赖:开关走浏览器 localStorage,弹窗各自读

export function apply(_ctx, _config = {}) {
  // 有意为空:v1a 不注册任何后端行为。client(lib/client.js)自会挂到 shell.overlay。
}
