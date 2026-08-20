/**
 * dsh-pace-popups 共享皮肤注入器（零构建客户端）。
 *
 * 加载即把整段皮肤 CSS 注进 <head>（幂等，认 id）。其余插件只需引用 var(--pp-*) 或加 .pp-* 类，
 * 全套弹窗就统一到同一套「lieflat 编辑部质感 + 保留彩色」的皮肤上。
 *
 * 皮肤主张（借 larashero3-dotcom/lieflat-charts）：
 *   细线优先 · 大量留白 · 账本式导轨/旁注 · 平面无装饰（不玻璃拟态/不噪点）· 亮度承担层级 · 字体参与表达。
 *   彩色保留，但当「精准的强调」用：学科色 + 一处金，一面一色，不铺满。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-pace-skin',
  factory: function (require) {
    var module = { exports: {} }; var exports = module.exports;

    var CSS = [
      ':root{',
      /* ── 彩色：保留（学科色 + 一处金作强调；语义色独立于强调）── */
      // 强调 = 近黑(浅底上:选中描边/主按钮深底白字);"连接金"只在地图画布里(见 atlas)
      '--pp-accent:#2C2D30;--pp-accent-ink:#F5F5F6;',
      '--pp-sys:#E8B15C;--pp-info:#8FA6CF;--pp-econ:#E27D8F;--pp-bio:#8FCBA0;--pp-phil:#C0A0D0;',
      '--pp-good:#77C79A;--pp-warn:#E6C56A;--pp-crit:#E27D8F;',
      /* ── 中性：近单色，亮度承担层级（默认暗色制图语境）── */
      // 浅色单色:灰白底 + 黑字(亮度承担层级);明/暗系统主题下都保持浅色。
      '--pp-ink:#1B1C1E;--pp-ink-dim:#5A5C60;--pp-ink-faint:#8A8C90;',
      '--pp-surface:rgba(250,250,251,.96);--pp-surface-2:rgba(242,242,244,.98);',
      '--pp-hairline:rgba(20,21,23,.13);--pp-hairline-strong:rgba(20,21,23,.24);--pp-rule:rgba(20,21,23,.07);',
      '--pp-shadow:0 10px 30px rgba(20,21,23,.12);',
      /* ── 尺度 / 圆角（lieflat：小圆角、克制）／字体 ── */
      '--pp-r:8px;--pp-r-sm:6px;--pp-pill:999px;--pp-hair:1px;--pp-track:.14em;',
      '--pp-1:4px;--pp-2:8px;--pp-3:12px;--pp-4:16px;--pp-5:20px;--pp-6:28px;',
      '--pp-serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Songti SC",STSong,SimSun,"Noto Serif CJK SC",serif;',
      '--pp-sans:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;',
      '--pp-mono:ui-monospace,"SF Mono","Cascadia Mono","JetBrains Mono",Consolas,monospace;',
      '}',
      /* 浅色宿主：翻中性为纸/墨；彩色不变 */
      '@media (prefers-color-scheme:light){:root{',
      '--pp-accent:#2C2D30;--pp-accent-ink:#F5F5F6;',
      '--pp-ink:#1B1C1E;--pp-ink-dim:#5A5C60;--pp-ink-faint:#8A8C90;',
      '--pp-surface:rgba(250,250,251,.96);--pp-surface-2:rgba(242,242,244,.98);',
      '--pp-hairline:rgba(20,21,23,.13);--pp-hairline-strong:rgba(20,21,23,.24);--pp-rule:rgba(20,21,23,.07);',
      '--pp-shadow:0 10px 30px rgba(20,21,23,.12);}}',
      /* ── 工具类 ── */
      '.pp-panel{background:var(--pp-surface);border:var(--pp-hair) solid var(--pp-hairline);border-radius:var(--pp-r);color:var(--pp-ink);font-family:var(--pp-sans);padding:var(--pp-4);}',
      '.pp-panel--float{box-shadow:var(--pp-shadow);}',
      '.pp-hairline{border:0;border-top:var(--pp-hair) solid var(--pp-hairline);margin:var(--pp-3) 0;}',
      /* 旁注/眉标：小号、宽字距、亮度低 */
      '.pp-eyebrow{font-family:var(--pp-sans);font-size:10.5px;letter-spacing:var(--pp-track);text-transform:uppercase;color:var(--pp-ink-faint);}',
      /* 账本导轨：一根细线 + 缩进 */
      '.pp-rule{border-left:var(--pp-hair) solid var(--pp-hairline);padding-left:var(--pp-2);}',
      '.pp-btn{font-family:var(--pp-sans);font-size:12.5px;line-height:1;padding:7px 13px;border-radius:var(--pp-r-sm);border:var(--pp-hair) solid var(--pp-hairline-strong);background:transparent;color:var(--pp-ink);cursor:pointer;transition:border-color .15s,color .15s;}',
      '.pp-btn:hover{border-color:var(--pp-accent);}',
      '.pp-btn--accent{background:var(--pp-accent);color:var(--pp-accent-ink);border-color:var(--pp-accent);font-weight:600;}',
      '.pp-btn--accent:hover{filter:brightness(1.06);}',
      '.pp-btn--ghost{border-color:transparent;color:var(--pp-ink-faint);}',
      '.pp-btn--ghost:hover{color:var(--pp-ink-dim);}',
      '.pp-chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--pp-sans);font-size:12px;padding:4px 10px;border-radius:var(--pp-pill);border:var(--pp-hair) solid var(--pp-hairline);background:transparent;color:var(--pp-ink);cursor:pointer;}',
      '.pp-chip:hover{border-color:var(--pp-hairline-strong);}',
      '.pp-chip.is-on{border-color:var(--pp-accent);}',
      '.pp-chip__dot{width:8px;height:8px;border-radius:2px;background:currentColor;flex:0 0 auto;}',
      /* 输入：账本式底线，而非四边框 */
      '.pp-field{width:100%;font-family:var(--pp-sans);font-size:12.5px;color:var(--pp-ink);background:transparent;border:0;border-bottom:var(--pp-hair) solid var(--pp-hairline-strong);border-radius:0;padding:6px 2px;}',
      '.pp-field:focus{outline:none;border-bottom-color:var(--pp-accent);}',
      '.pp-field::placeholder{color:var(--pp-ink-faint);}',
      '.pp-num{font-family:var(--pp-mono);font-variant-numeric:tabular-nums;}',
      '.pp-meta{font-family:var(--pp-mono);font-size:11px;color:var(--pp-ink-faint);}',
      '@media (prefers-reduced-motion:reduce){.pp-btn{transition:none;}}',
    ].join('');

    function inject() {
      if (typeof document === 'undefined') return;
      if (document.getElementById('dsh-pace-skin')) return;
      var s = document.createElement('style');
      s.id = 'dsh-pace-skin';
      s.textContent = CSS;
      (document.head || document.documentElement).appendChild(s);
    }
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }

    // 客户端插件形状:必须导出 apply —— 否则客户端 cordis 加载器判为“无 apply 的 object”而报错。
    // 皮肤在工厂加载时已即时注入;apply 再兜一次(幂等),满足加载器对插件形状的要求。
    exports.inject = [];
    exports.apply = function (/* ctx, config */) { inject(); };
    exports.SKIN_CSS = CSS;   // 需要的插件可直接读取这段 CSS
    exports.injectSkin = inject;
    return module.exports;
  },
});
