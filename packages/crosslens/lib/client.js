/**
 * crosslens 客户端展示件——"跨学科抽卡"。
 *
 * 手写工厂包裹(window.__ModuleLoader__.load),依赖(react/slots/connection)全平台 external,零构建。
 * 静息态只一个淡淡的 🎲(可忽略,系列美学);点开才展开学科选择(预置 tag 快选 + 自由输入,存 localStorage);
 * 点抽卡 → RPC /crosslens/associate → 淡淡显示线头,想看展开再点(同 grasp 闪卡背面);列表外的卡标来源。
 *
 * 数据通道 = 通用 Connection RPC(不碰会话日志)。slot 的 inject(sessionId) 给出 draw 闭包。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-crosslens',
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    var React = require('react');
    var h = React.createElement;

    var KEY = 'crosslens.disciplines';
    var PRESETS = ['生态学', '经济学', '心理学', '物理学', '数学', '历史', '音乐', '建筑学', '生物学', '哲学'];

    function loadDisc() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x.trim(); }) : []; } catch (e) { return []; } }
    function saveDisc(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* ignore */ } }

    var wrap = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '4px 10px', fontSize: '12px', lineHeight: 1.5, opacity: 0.66, userSelect: 'none' };
    // dock 槽满宽、框架不给居中容器;用对话根继承来的 CSS 变量把内容对齐到对话列(同 grasp)。
    var center = { boxSizing: 'border-box', width: 'calc(100% - var(--dsh-composer-side-clearance, 16px) * 2 - var(--dsh-composer-dock-inset, 8px) * 2)', maxWidth: 'var(--dsh-composer-card-max-width, 780px)', margin: '0 auto', padding: '0 var(--dsh-composer-dock-inset, 8px)' };
    var dice = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: '999px', padding: '1px 10px', cursor: 'pointer', flex: '0 0 auto', opacity: 0.85 };
    var linkBtn = { font: 'inherit', color: 'inherit', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 };
    var chip = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: '999px', padding: '0 8px', cursor: 'pointer', opacity: 0.8 };
    var chipOn = Object.assign({}, chip, { opacity: 1, borderWidth: '2px' });
    var input = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: '6px', padding: '1px 6px', opacity: 0.85, width: '120px' };
    var block = { flexBasis: '100%', marginTop: '4px', paddingLeft: '4px' };
    var cardHook = Object.assign({}, block, { opacity: 0.95 });
    var cardExp = Object.assign({}, block, { opacity: 0.78, borderLeft: '2px solid currentColor', paddingLeft: '10px', marginLeft: '2px' });
    var tag = { fontSize: '11px', opacity: 0.6, border: '1px solid currentColor', borderRadius: '4px', padding: '0 4px', marginRight: '6px' };

    function CrossLensDock(props) {
      var draw = props.draw;
      var ds = React.useState(loadDisc); var disc = ds[0], setDisc = ds[1];
      var os = React.useState(false); var open = os[0], setOpen = os[1];
      var drs = React.useState('');   var draft = drs[0], setDraft = drs[1];  // 自由输入草稿
      var cs = React.useState(null);  var card = cs[0], setCard = cs[1];       // {hook,expand,discipline,offlist} | 'none' | null
      var ls = React.useState(false); var loading = ls[0], setLoading = ls[1];
      var xs = React.useState(false); var showExp = xs[0], setShowExp = xs[1];
      var ps = React.useState(false); var copied = ps[0], setCopied = ps[1];

      function copyCard() {
        if (!card || card === 'none') return;
        var txt = (card.offlist && card.discipline ? '(列表外·' + card.discipline + ') ' : '') + card.hook + (card.expand ? '\n' + card.expand : '');
        try { navigator.clipboard.writeText(txt); setCopied(true); setTimeout(function () { setCopied(false); }, 1500); } catch (e) { /* ignore */ }
      }

      function commit(next) { setDisc(next); saveDisc(next); }
      function toggle(d) { commit(disc.indexOf(d) >= 0 ? disc.filter(function (x) { return x !== d; }) : disc.concat([d])); }
      function addDraft() {
        var parts = draft.split(/[，,、\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!parts.length) return;
        var next = disc.slice();
        parts.forEach(function (p) { if (next.indexOf(p) < 0) next.push(p); });
        commit(next); setDraft('');
      }
      function drawCard() {
        if (loading || !draw) return;
        setLoading(true); setShowExp(false); setCopied(false); setCard(null);
        Promise.resolve(draw(disc.slice())).then(function (r) {
          var v = (r && r.ok) ? r.value : null;
          setCard(v || 'none');
        }).catch(function () { setCard('none'); }).then(function () { setLoading(false); });
      }

      var children = [
        h('button', { key: 'dice', style: dice, disabled: loading, onClick: drawCard }, loading ? '抽卡中…' : '🎲 跨学科抽卡'),
        h('button', { key: 'cfg', style: linkBtn, onClick: function () { setOpen(!open); } },
          disc.length ? (disc.slice(0, 3).join('·') + (disc.length > 3 ? ('+' + (disc.length - 3)) : '') + ' ▾') : '+ 选学科 ▾'),
      ];

      if (open) {
        var picker = [];
        // 已选(可移除)
        disc.forEach(function (d) { picker.push(h('button', { key: 'on-' + d, style: chipOn, title: '移除', onClick: function () { toggle(d); } }, d + ' ×')); });
        // 预置快选(未选的)
        PRESETS.filter(function (d) { return disc.indexOf(d) < 0; }).forEach(function (d) {
          picker.push(h('button', { key: 'p-' + d, style: chip, onClick: function () { toggle(d); } }, '+ ' + d));
        });
        // 自由输入(用户真在乎的领域,预置里没有也能加)
        picker.push(h('input', {
          key: 'in', style: input, value: draft, placeholder: '自定义，回车添加',
          onChange: function (e) { setDraft(e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } },
        }));
        picker.push(h('button', { key: 'add', style: linkBtn, onClick: addDraft }, '添加'));
        children.push(h('div', { key: 'picker', style: Object.assign({ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }, block) }, picker));
      }

      if (card === 'none') {
        children.push(h('div', { key: 'none', style: Object.assign({}, block, { opacity: 0.6 }) }, '这次没抽到（换个学科或稍后再抽）'));
      } else if (card) {
        var hookKids = [];
        if (card.offlist && card.discipline) hookKids.push(h('span', { key: 't', style: tag }, '列表外·' + card.discipline));
        hookKids.push(card.hook);
        children.push(h('div', { key: 'hook', style: cardHook }, hookKids));
        if (card.expand && showExp) children.push(h('div', { key: 'exp', style: cardExp }, card.expand));
        var actions = [];
        if (card.expand && !showExp) actions.push(h('button', { key: 'expb', style: linkBtn, onClick: function () { setShowExp(true); } }, '展开一点 ›'));
        actions.push(h('button', { key: 'cp', style: linkBtn, onClick: copyCard }, copied ? '已复制' : '复制'));
        children.push(h('div', { key: 'act', style: Object.assign({ display: 'flex', gap: '12px' }, block) }, actions));
      }

      return h('div', { style: center }, h('div', { style: wrap }, children));
    }

    // ——弹窗总开关——共享 localStorage 标志(浮窗 hub 用它开关各弹窗;缺省=开,只有显式 '0' 才关)。
    var PACE_KEY = 'pace-popup:enabled:crosslens';
    function paceEnabled() { try { return localStorage.getItem(PACE_KEY) !== '0'; } catch (e) { return true; } }
    function useEnabled() {
      var s = React.useState(paceEnabled); var on = s[0], set = s[1];
      React.useEffect(function () {
        function upd() { set(paceEnabled()); }
        window.addEventListener('storage', upd);
        window.addEventListener('pace-popup:changed', upd);
        return function () { window.removeEventListener('storage', upd); window.removeEventListener('pace-popup:changed', upd); };
      }, []);
      return on;
    }
    function CrossLensGate(props) { return useEnabled() ? h(CrossLensDock, props) : null; }

    exports.inject = ['slots', 'connection'];
    exports.apply = function (ctx) {
      // UI 已移入浮窗「节奏台」(dsh-plugin-pace-hub):它拿当前 sessionId 调本插件的 /crosslens 通道,
      // 在浮点里展开抽卡面板。故此处**不再注册 conversation.input.dock**(否则会和浮窗重复)。
      // 后端 RPC 通道(src/index.mjs 的 /crosslens)不受影响。CrossLensDock/Gate 保留以备回退:
      // 想退回 dock 版,恢复下面这段即可。
      void ctx; void CrossLensGate; void center;
      // ctx.slots.inject('conversation.input.dock', function () {
      //   return ctx.slots.register(
      //     { name: 'conversation.input.dock', id: 'crosslens', order: 22,
      //       inject: function (sessionId) { return { sessionId: sessionId, draw: function (disciplines) { return ctx.connection.rpc.call('/crosslens', 'associate', { sessionId: sessionId, disciplines: disciplines }); } }; } },
      //     CrossLensGate);
      // });
    };
    return module.exports;
  },
});
