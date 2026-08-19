/**
 * grasp-probe 客户端展示件——那条"淡淡的、可忽略"的提示条。
 *
 * 手写成 dsh 客户端模块的工厂包裹格式(window.__ModuleLoader__.load{ id, factory }),
 * 依赖(react / slots / connection)都是平台注入的 external,故无需构建——契合 grasp-probe 全程零构建。
 *
 * 数据通道 = 通用 Connection RPC(不是 session projection)。后端把每会话最近一次 view 存内存,
 * 这里经 slot 的 inject(sessionId) 工厂拿到 sessionId + 一个 fetchState 闭包,组件同源轮询
 * ctx.connection.rpc.call('/grasp-probe','get',{sessionId})。绝不读写会话日志。
 *
 * 语义 = Claude Code recap 美学:平时不存在(view 为 null 或 shouldPrompt=false → 渲染 null);
 * 只有当"AI 进度已超出你的验收范围"时,才在输入框上方浮一条淡字,永远可忽略;
 * 点"停一下"展开一句为什么 + 自查 1 问(闪卡),想看答案再点。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-grasp-probe',
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    var React = require('react');
    var h = React.createElement;

    var wrap = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '4px 10px', fontSize: '12px', lineHeight: 1.5, opacity: 0.62, userSelect: 'none' };
    // dock 槽本身满宽、框架不给居中容器(官方 QueueDock 等都自居中);用对话根继承来的 CSS 变量把内容对齐到对话列。
    var center = { boxSizing: 'border-box', width: 'calc(100% - var(--dsh-composer-side-clearance, 16px) * 2 - var(--dsh-composer-dock-inset, 8px) * 2)', maxWidth: 'var(--dsh-composer-card-max-width, 780px)', margin: '0 auto', padding: '0 var(--dsh-composer-dock-inset, 8px)' };
    var dot = { width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', opacity: 0.5, flex: '0 0 auto' };
    var msg = { flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
    var btn = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: '999px', padding: '1px 9px', opacity: 0.75, cursor: 'pointer', flex: '0 0 auto' };
    var linkBtn = { font: 'inherit', color: 'inherit', background: 'transparent', border: 'none', padding: 0, opacity: 0.7, cursor: 'pointer', textDecoration: 'underline' };
    var exp = { flexBasis: '100%', marginTop: '4px', paddingLeft: '14px', opacity: 0.9 };
    var ans = { flexBasis: '100%', marginTop: '4px', paddingLeft: '14px', opacity: 0.75, borderLeft: '2px solid currentColor', paddingTop: '1px', paddingBottom: '1px' };

    function GraspProbeDock(props) {
      var fetchState = props.fetchState;
      var sessionId = props.sessionId;
      var vs = React.useState(null); var view = vs[0], setView = vs[1];
      var os = React.useState(false); var open = os[0], setOpen = os[1];
      var as = React.useState(false); var showAns = as[0], setShowAns = as[1];
      var cps = React.useState(false); var copied = cps[0], setCopied = cps[1];

      // fetchState 每次渲染可能是新闭包 → 用 ref 存,useEffect 只依赖稳定的 sessionId。
      var fsRef = React.useRef(fetchState); fsRef.current = fetchState;
      React.useEffect(function () {
        var alive = true;
        function tick() {
          var fn = fsRef.current; if (!fn) return;
          Promise.resolve(fn()).then(function (r) {
            if (!alive) return;
            setView(r && r.ok ? (r.value || null) : null);
          }).catch(function () { /* 拉取失败就当没信号,保持不打扰 */ });
        }
        tick(); // 挂载即拉一次
        // 轻量轮询:gap 只在每轮边界变、判官又是异步,拉取正好等它算完;标签页隐藏时不拉。
        var id = setInterval(function () { if (!document.hidden) tick(); }, 2000);
        return function () { alive = false; clearInterval(id); };
      }, [sessionId]);

      var p = view;
      // 换了问题就把"已展开的答案"收回去,免得显示上一轮的旧答案
      var q = (p && p.questions && p.questions.length) ? p.questions[0] : '';
      React.useEffect(function () { setShowAns(false); }, [q]);

      // 平时什么都不画——这正是"不打扰"的本分
      if (!p || !p.shouldPrompt) return null;
      var reason = p.reason || '当前进度可能已超出你能验收的范围';
      var children = [
        h('span', { key: 'dot', style: dot }),
        h('span', { key: 'msg', style: msg, title: reason }, '要不要停一下 · ' + reason),
        h('button', { key: 'btn', style: btn, onClick: function () { setOpen(!open); } }, open ? '收起' : '停一下'),
      ];
      if (open) {
        if (q) {
          // 闪卡:先给问题(逼你自己回忆),再放一个"看看答案"——不点就不看
          children.push(h('div', { key: 'q', style: exp }, '想一想 · ' + q));
          if (p.answer) {
            children.push(showAns
              ? h('div', { key: 'a', style: ans }, p.answer)
              : h('button', { key: 'ab', style: Object.assign({ flexBasis: '100%', textAlign: 'left', marginTop: '2px', paddingLeft: '14px' }, linkBtn), onClick: function () { setShowAns(true); } }, '看看 AI 的答案 ›'));
          }
          // 复制:问题 +(已展开则含)答案
          children.push(h('button', {
            key: 'cp', style: Object.assign({ flexBasis: '100%', textAlign: 'left', marginTop: '2px', paddingLeft: '14px' }, linkBtn),
            onClick: function () {
              var txt = '想一想:' + q + (showAns && p.answer ? '\n答案:' + p.answer : '');
              try { navigator.clipboard.writeText(txt); setCopied(true); setTimeout(function () { setCopied(false); }, 1500); } catch (e) { /* ignore */ }
            },
          }, copied ? '已复制' : '复制'));
        } else {
          children.push(h('div', { key: 'ph', style: Object.assign({}, exp, { opacity: 0.6 }) }, '这次没能想出问题(可忽略)。'));
        }
      }
      return h('div', { style: center }, h('div', { style: wrap }, children));
    }

    // ——弹窗总开关——共享 localStorage 标志(浮窗 hub 用它开关各弹窗;缺省=开,只有显式 '0' 才关)。
    // Gate 恒定调用 useEnabled(hook 顺序稳),被关时不渲染真组件。跨标签听 storage、同标签听 pace-popup:changed。
    var PACE_KEY = 'pace-popup:enabled:grasp';
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
    function GraspGate(props) { return useEnabled() ? h(GraspProbeDock, props) : null; }

    exports.inject = ['slots', 'connection'];
    exports.apply = function (ctx) {
      // 只有 conversation.input.dock 槽存在时才挂(headless/无此槽的装配天然跳过)
      ctx.slots.inject('conversation.input.dock', function () {
        return ctx.slots.register(
          {
            name: 'conversation.input.dock',
            id: 'grasp-probe',
            order: 20,
            // 每会话注入:把 sessionId + 一个拉取该会话 view 的闭包喂给组件。
            inject: function (sessionId) {
              return {
                sessionId: sessionId,
                fetchState: function () { return ctx.connection.rpc.call('/grasp-probe', 'get', { sessionId: sessionId }); },
              };
            },
          },
          GraspGate,
        );
      });
    };
    return module.exports;
  },
});
