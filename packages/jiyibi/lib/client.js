/**
 * 记一笔 客户端展示件——像电子书批注:在最新对话下方写一句"它对你意味着什么",攒进可检索的本子。
 *
 * 手写工厂包裹(window.__ModuleLoader__.load),依赖(react/slots/connection)全平台 external,零构建。
 * 静息态只两个淡入口(✍ 记一笔 / 📖 翻本子);写=顺手记一句,存后端账本(快照当前这一刻的原文);
 * 翻本子=检索、倒序浏览你标过的所有时刻。数据走 Connection RPC /jiyibi,绝不碰会话日志。
 *
 * 锚点=最新那条结果(v1 只标最新,不翻回去)。AI 有全部日志,你只写你的话——它绝不替你写。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-jiyibi',
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    var React = require('react');
    var h = React.createElement;

    var wrap = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '4px 10px', fontSize: '12px', lineHeight: 1.5, opacity: 0.66, userSelect: 'none' };
    // dock 槽满宽、框架不给居中容器;用对话根继承来的 CSS 变量把内容对齐到对话列(同 grasp)。
    var center = { boxSizing: 'border-box', width: 'calc(100% - var(--dsh-composer-side-clearance, 16px) * 2 - var(--dsh-composer-dock-inset, 8px) * 2)', maxWidth: 'var(--dsh-composer-card-max-width, 780px)', margin: '0 auto', padding: '0 var(--dsh-composer-dock-inset, 8px)' };
    var dot = { width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', opacity: 0.5, flex: '0 0 auto' };
    var link = { font: 'inherit', color: 'inherit', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', opacity: 0.78, flex: '0 0 auto' };
    var okTip = { flex: '0 0 auto', opacity: 0.7 };
    var block = { flexBasis: '100%', marginTop: '4px' };
    var ta = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: '8px', padding: '5px 8px', opacity: 0.9, width: '100%', minHeight: '46px', resize: 'vertical', boxSizing: 'border-box' };
    var saveBtn = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: '999px', padding: '1px 12px', cursor: 'pointer', opacity: 0.85, marginTop: '4px' };
    var hint = { opacity: 0.55, marginTop: '2px', fontSize: '11px' };
    var search = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: '6px', padding: '2px 8px', opacity: 0.85, width: '100%', boxSizing: 'border-box' };
    var markBox = { borderLeft: '2px solid currentColor', paddingLeft: '10px', margin: '6px 0', opacity: 0.9 };
    var noteLine = { fontWeight: 600 };
    var metaLine = { opacity: 0.55, fontSize: '11px', marginTop: '1px' };

    function fmt(ts) { try { var d = new Date(ts); return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { return ''; } }

    function JiyibiDock(props) {
      var add = props.add, list = props.list, remove = props.remove;
      var ms = React.useState('none'); var mode = ms[0], setMode = ms[1]; // 'none' | 'write' | 'book'
      var ns = React.useState(''); var note = ns[0], setNote = ns[1];
      var ss = React.useState(false); var saved = ss[0], setSaved = ss[1];
      var bs = React.useState(false); var busy = bs[0], setBusy = bs[1];
      var qs = React.useState(''); var query = qs[0], setQuery = qs[1];
      var ls = React.useState(null); var marks = ls[0], setMarks = ls[1];

      function save() {
        var t = note.trim(); if (!t || busy) return;
        setBusy(true);
        Promise.resolve(add(t)).then(function (r) {
          setBusy(false);
          if (r && r.ok && r.value) { setNote(''); setMode('none'); setSaved(true); setTimeout(function () { setSaved(false); }, 1800); }
        }).catch(function () { setBusy(false); });
      }
      function refresh(q) { Promise.resolve(list(q || '')).then(function (r) { setMarks(r && r.ok ? (r.value || []) : []); }).catch(function () { setMarks([]); }); }
      function openBook() { if (mode === 'book') { setMode('none'); } else { setMode('book'); refresh(query); } }
      function del(id) { Promise.resolve(remove(id)).then(function () { refresh(query); }).catch(function () {}); }

      var children = [
        h('span', { key: 'dot', style: dot }),
        h('button', { key: 'w', style: link, onClick: function () { setMode(mode === 'write' ? 'none' : 'write'); } }, '✍ 记一笔'),
        h('button', { key: 'b', style: link, onClick: openBook }, '📖 翻本子'),
      ];
      if (saved) children.push(h('span', { key: 'ok', style: okTip }, '记下了 ✓'));

      if (mode === 'write') {
        children.push(h('textarea', {
          key: 'ta', style: ta, value: note, autoFocus: true,
          placeholder: '值得记一笔吗?写下它对你意味着什么…',
          onChange: function (e) { setNote(e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } },
        }));
        children.push(h('div', { key: 'wr', style: block },
          h('button', { style: saveBtn, disabled: busy, onClick: save }, busy ? '记着…' : '记下(⌘/Ctrl+↵)')));
        children.push(h('div', { key: 'hi', style: Object.assign({}, block, hint) }, '只写你的话——AI 说的那句它自己有日志,这本子只留你的意义。'));
      }

      if (mode === 'book') {
        children.push(h('input', {
          key: 'q', style: Object.assign({}, block, search), value: query, placeholder: '翻找…（关键词,回车搜）',
          onChange: function (e) { setQuery(e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); refresh(query); } },
        }));
        if (marks === null) {
          children.push(h('div', { key: 'ld', style: Object.assign({}, block, hint) }, '翻本子中…'));
        } else if (!marks.length) {
          children.push(h('div', { key: 'em', style: Object.assign({}, block, hint) }, query ? '没翻到。' : '还没有记过。读到心里一动的地方,记一笔。'));
        } else {
          var items = marks.map(function (m) {
            return h('div', { key: m.id, style: markBox }, [
              h('div', { key: 'n', style: noteLine }, m.note),
              h('div', { key: 'm', style: metaLine }, fmt(m.ts) + (m.aiSaid ? ' · 当时:' + String(m.aiSaid).replace(/\s+/g, ' ').slice(0, 48) + '…' : '')),
              h('button', { key: 'd', style: Object.assign({}, link, { fontSize: '11px', opacity: 0.5, marginTop: '1px' }), onClick: function () { del(m.id); } }, '删'),
            ]);
          });
          children.push(h('div', { key: 'list', style: block }, items));
        }
      }

      return h('div', { style: center }, h('div', { style: wrap }, children));
    }

    // ——弹窗总开关——共享 localStorage 标志(浮窗 hub 用它开关各弹窗;缺省=开,只有显式 '0' 才关)。
    var PACE_KEY = 'pace-popup:enabled:jiyibi';
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
    function JiyibiGate(props) { return useEnabled() ? h(JiyibiDock, props) : null; }

    exports.inject = ['slots', 'connection'];
    exports.apply = function (ctx) {
      // UI 已移入浮窗「节奏台」(dsh-plugin-pace-hub):它拿当前 sessionId 调本插件的 /jiyibi 通道,
      // 在浮点里展开"记一笔 + 翻本子"面板。故此处**不再注册 conversation.input.dock**(否则会和浮窗重复)。
      // 后端 RPC 通道(src/index.mjs 的 /jiyibi)不受影响。JiyibiDock/Gate 保留以备回退。
      void ctx; void JiyibiGate; void center;
      // ctx.slots.inject('conversation.input.dock', function () {
      //   return ctx.slots.register(
      //     { name: 'conversation.input.dock', id: 'jiyibi', order: 24,
      //       inject: function (sessionId) {
      //         var call = function (ep, payload) { return ctx.connection.rpc.call('/jiyibi', ep, payload || {}); };
      //         return { sessionId: sessionId, add: function (note) { return call('add', { sessionId: sessionId, note: note }); }, list: function (query) { return call('list', { query: query }); }, remove: function (id) { return call('remove', { id: id }); } };
      //       } },
      //     JiyibiGate);
      // });
    };
    return module.exports;
  },
});
