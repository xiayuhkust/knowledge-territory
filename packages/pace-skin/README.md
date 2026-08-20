# dsh-plugin-pace-skin · 共享皮肤

套件 `dsh-pace-popups` 的统一皮肤。一个**无 UI** 的插件:加载即把一套设计令牌与工具类注入页面,让全套弹窗共享同一种质感。

质感借鉴 [larashero3-dotcom/lieflat-charts](https://github.com/larashero3-dotcom/lieflat-charts) 的「编辑部」风——**细线、留白、账本式导轨、平面无装饰、亮度承担层级、字体参与表达**——但**保留我们的彩色**(学科色 + 一处金作强调,一面一色、不铺满)。

## 用法

它随套件一起挂载(在 `suite/cordis.patch.yml` 里排第一个,先注入)。其它插件两种方式消费:

```css
/* 1. 直接引用令牌 */
.my-panel { color: var(--pp-ink); border: 1px solid var(--pp-hairline); }
```
```html
<!-- 2. 套工具类 -->
<div class="pp-panel pp-panel--float">…</div>
<button class="pp-btn pp-btn--accent">点亮</button>
```

## 令牌一览

| 组 | 令牌 |
|---|---|
| 彩色(保留) | `--pp-accent`(金)、`--pp-sys/info/econ/bio/phil`(学科色)、`--pp-good/warn/crit` |
| 中性(近单色) | `--pp-ink` `--pp-ink-dim` `--pp-ink-faint` `--pp-surface` `--pp-surface-2` |
| 线 | `--pp-hairline` `--pp-hairline-strong` `--pp-rule`(账本导轨) |
| 尺度/字体 | `--pp-r` `--pp-pill` `--pp-1..6` `--pp-serif` `--pp-sans` `--pp-mono` `--pp-track` |

深/浅两套:默认暗色制图语境;`prefers-color-scheme: light` 时中性翻为纸/墨,彩色不变。

## 工具类

`.pp-panel(--float)` · `.pp-hairline` · `.pp-eyebrow`(眉标/旁注) · `.pp-rule`(账本导轨) · `.pp-btn(--accent/--ghost)` · `.pp-chip(.is-on / .pp-chip__dot)` · `.pp-field`(账本底线输入) · `.pp-num`(等宽数字) · `.pp-meta`。

## 状态

atlas(知识疆域)已接入:其色/字/细线令牌均引自本皮肤(带回退值)。hub / grasp / crosslens / jiyibi 的回改对齐为后续一轮。

## License

[MIT](../../LICENSE)
