/**
 * 节奏台 客户端展示件——浮在全 app 之上的一条可拖浮窗(像输入法的浮空横条),兼系列的统一展示台。
 *
 * 手写工厂包裹(window.__ModuleLoader__.load),依赖(react/slots/connection)全平台 external,零构建。
 * 挂在官方 **shell.overlay** 槽(app 级、始终挂载、点击穿透:整层 pointer-events:none,只有这条浮窗
 * 自己 pointer-events:auto)。位置持久化到 localStorage `pace-hub:pos`。
 *
 * 职责:
 *  ① 管理各弹窗开/关:共享标志 `pace-popup:enabled:<slug>`(缺省开,'0' 关)+ 广播 `pace-popup:changed`;
 *     grasp 的反应式轻提示仍在对话 dock 里(读此标志),浮窗只负责它的开关。
 *  ② 承载"你主动打开的工具"的 UI:跨学科抽卡、记一笔——从浮点里展开成面板,不再挤在 dock。
 *     面板直接调各弹窗已有的 RPC 通道(/crosslens、/jiyibi),后端不动。
 *
 * 关键:shell.overlay 是 app 级、不带会话上下文,但槽系统给每个组件注入了全局标准 prop `useSessions`。
 * `useSessions(s => s.current)` = 当前 sessionId,切会话自动重渲染 → 面板据此调通道、钉当前对话。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-pace-hub',
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    var React = require('react');
    var h = React.createElement;

    // apply 里注入的 RPC 调用闭包(工厂作用域,apply 先于渲染执行故渲染时已就绪)。
    var rpcCall = null;

    // ——受管弹窗(slug 须与各弹窗 client 的 PACE_KEY 尾段一致;主功能在前,反应式辅助垫底)——
    var TOGGLES = [
      { slug: 'atlas', label: '知识疆域', note: '从这里置顶打开(全屏地图)' },
      { slug: 'crosslens', label: '跨学科抽卡', note: '在这里展开' },
      { slug: 'jiyibi', label: '记一笔', note: '在这里展开' },
      { slug: 'grasp', label: '停一下', note: '在对话里出现(反应式) · 默认关' },
    ];
    // 浮窗内承载 UI 的工具(grasp 不在此:它的 UI 留在对话 dock)
    var TOOLS = [
      { slug: 'crosslens', tab: '🎲 跨学科抽卡' },
      { slug: 'jiyibi', tab: '✍ 记一笔' },
    ];

    // ——开关标志——
    // 停一下(grasp)非核心功能,缺省关;其余缺省开。显式 '1'/'0' 始终优先。
    var DEFAULT_OFF = { grasp: true };
    function keyOf(slug) { return 'pace-popup:enabled:' + slug; }
    function isOn(slug) { try { var v = localStorage.getItem(keyOf(slug)); return v === null ? !DEFAULT_OFF[slug] : v !== '0'; } catch (e) { return !DEFAULT_OFF[slug]; } }
    function setOn(slug, on) {
      try { localStorage.setItem(keyOf(slug), on ? '1' : '0'); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('pace-popup:changed', { detail: { slug: slug } })); } catch (e) { }
    }

    // ——位置持久化——
    var POS_KEY = 'pace-hub:pos';
    function loadPos() { try { var p = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); if (p && typeof p.x === 'number' && typeof p.y === 'number') return p; } catch (e) { } return null; }
    function savePos(p) { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch (e) { } }
    function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
    function short(s, n) { return String(s || '').replace(/\s+/g, ' ').slice(0, n); }

    // ——样式(Canvas/CanvasText 系统色随亮/暗自适应)——
    // ——样式:统一到共享皮肤 pace-skin 的 --pp-* 令牌(与知识疆域一致;深浅由皮肤处理)——
    var layer = { position: 'fixed', zIndex: 2147483000, pointerEvents: 'auto', width: 'max-content', font: '12px/1.5 var(--pp-sans)', color: 'var(--pp-ink)' };
    var handle = { position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 11px', borderRadius: '999px', cursor: 'grab', background: 'var(--pp-surface)', color: 'var(--pp-ink)', border: '1px solid var(--pp-hairline)', boxShadow: 'var(--pp-shadow)', backdropFilter: 'blur(6px)', touchAction: 'none', whiteSpace: 'nowrap', userSelect: 'none' };
    var card = { position: 'absolute', width: '324px', maxHeight: '62vh', overflowY: 'auto', overflowX: 'hidden', padding: '12px 13px', borderRadius: 'var(--pp-r)', background: 'var(--pp-surface)', color: 'var(--pp-ink)', border: '1px solid var(--pp-hairline)', boxShadow: 'var(--pp-shadow)', backdropFilter: 'blur(8px)', boxSizing: 'border-box' };
    var tabBar = { display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px', borderBottom: '1px solid var(--pp-hairline)', paddingBottom: '6px' };
    var tabBtn = { font: 'inherit', color: 'var(--pp-ink-dim)', background: 'transparent', border: '1px solid var(--pp-hairline)', borderRadius: '999px', padding: '2px 10px', cursor: 'pointer' };
    var tabOn = Object.assign({}, tabBtn, { color: 'var(--pp-ink)', borderColor: 'var(--pp-accent)', fontWeight: 600 });
    var linkBtn = { font: 'inherit', color: 'var(--pp-ink-dim)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' };
    // 收进疆域 = 主行动，用 Gumroad 粉填充，非常醒目
    var cta = { font: 'inherit', fontWeight: 700, color: '#151515', background: '#FF90E8', border: 'none', borderRadius: '8px', padding: '5px 13px', cursor: 'pointer', lineHeight: '1.2' };
    var ctaSm = Object.assign({}, cta, { padding: '2px 10px', borderRadius: '999px', fontSize: '11px' });
    var ctaDone = { font: 'inherit', fontWeight: 600, color: 'var(--pp-ink-dim)', background: 'transparent', border: '1px solid var(--pp-hairline)', borderRadius: '8px', padding: '5px 13px', cursor: 'default', lineHeight: '1.2' };
    var ctaDoneSm = Object.assign({}, ctaDone, { padding: '2px 10px', borderRadius: '999px', fontSize: '11px' });
    var pill = { font: 'inherit', color: 'var(--pp-ink)', background: 'transparent', border: '1px solid var(--pp-hairline-strong)', borderRadius: '999px', padding: '0 10px', cursor: 'pointer', lineHeight: '18px', height: '18px' };
    var chip = { font: 'inherit', color: 'var(--pp-ink-dim)', background: 'transparent', border: '1px solid var(--pp-hairline)', borderRadius: '999px', padding: '1px 8px', cursor: 'pointer' };
    var chipOn = Object.assign({}, chip, { color: 'var(--pp-ink)', borderColor: 'var(--pp-accent)' });
    var textIn = { font: 'inherit', color: 'var(--pp-ink)', background: 'var(--pp-surface-2)', border: '1px solid var(--pp-hairline)', borderRadius: '8px', padding: '5px 8px', width: '100%', boxSizing: 'border-box' };
    var hint = { color: 'var(--pp-ink-faint)', fontSize: '11px' };
    var dim = { color: 'var(--pp-ink-dim)' };
    // 知识疆域置顶入口:派发全局事件,由 atlas 插件监听打开全屏地图。
    var atlasPin = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '8px', marginBottom: '9px', borderRadius: 'var(--pp-r-sm)', border: '1px solid var(--pp-accent)', background: 'transparent', color: 'var(--pp-ink)', font: 'inherit', fontWeight: 600, cursor: 'pointer' };
    function openAtlas() { try { window.dispatchEvent(new CustomEvent('pace-popup:atlas:open')); } catch (e) { } }
    // 抽卡/记一笔 → 知识疆域的"预备桥"：压进 window 队列 + 打开地图 + 通知地图排空（地图刚开也不丢）。
    function stageToAtlas(origin, title, text, ref) {
      try { (window.__atlasDraftQueue__ = window.__atlasDraftQueue__ || []).push({ origin: origin, title: title, text: text, ref: ref || null }); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('pace-popup:atlas:open')); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('pace-popup:atlas:stage')); } catch (e) { }
    }

    // ============ 跨学科抽卡 面板(移自 crosslens dock)============
    var DKEY = 'crosslens.disciplines';
    var PRESETS = ['生态学', '经济学', '心理学', '物理学', '数学', '历史', '音乐', '建筑学', '生物学', '哲学'];
    // 「随机学科」池:精选的很细分/冷门学科,随机抽一个给用户新鲜感(零 token、即时;够大 so 少重复)。
    var NICHE = [
      '古生物学', '古气候学', '古地磁学', '孢粉学', '冰川学', '冻土学', '火山学', '矿物物理学', '陨石学', '天体生物学',
      '射电天文学', '系外行星学', '天体化学', '等离子体物理学', '心理声学', '音乐声学', '语音学', '音系学', '词源学', '方言地理学',
      '手语语言学', '计算语言学', '社会语言学', '民族音乐学', '音乐治疗学', '乐器学', '钟表学', '制图学', '地名学', '纹章学',
      '钱币学', '谱系学', '训诂学', '甲骨学', '敦煌学', '简帛学', '版本学', '目录学', '香料化学', '品酒学',
      '风味化学', '感官科学', '食品流变学', '发酵科学', '谷物科学', '葡萄栽培学', '茶学', '菌物学', '地衣学', '苔藓植物学',
      '藻类学', '树木年代学', '森林病理学', '植物病理学', '昆虫行为学', '鳞翅目学', '蜘蛛学', '线虫学', '软体动物学', '甲壳动物学',
      '珊瑚礁生态学', '深海生物学', '浮游生物学', '鱼类学', '两栖爬行动物学', '鸟类学', '鲸类学', '灵长类学', '动物地理学', '寄生虫学',
      '表观遗传学', '群体遗传学', '系统发育学', '生物力学', '神经美学', '神经经济学', '认知考古学', '实验考古学', '水下考古学', '民族植物学',
      '法医人类学', '法医昆虫学', '犯罪地理学', '环境心理学', '时间生物学', '睡眠科学', '疼痛科学', '姑息医学', '高原医学', '潜水医学',
      '航天医学', '运动生物力学', '假肢矫形学', '听力学', '嗓音医学', '微流控学', '胶体科学', '表面科学', '摩擦学', '断裂力学',
      '声子学', '自旋电子学', '量子光学', '非线性光学', '太赫兹科学', '超材料学', '晶体学', '冶金史', '建筑声学', '城市气候学',
      '微气候学', '生物气象学', '农业气象学', '水文地质学', '岩溶学', '沉积学', '层序地层学', '历史地理学', '历史气候学', '计量历史学',
      '行为经济学', '神经营销学', '机制设计理论', '社会网络分析', '计算社会学', '数字人文', '科学计量学', '情感计算', '计算创造力', '民族数学',
    ];
    function loadDisc() { try { var a = JSON.parse(localStorage.getItem(DKEY) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x.trim(); }) : []; } catch (e) { return []; } }
    function saveDisc(a) { try { localStorage.setItem(DKEY, JSON.stringify(a)); } catch (e) { } }

    function CrossLensPanel(props) {
      var sessionId = props.sessionId;
      var ds = React.useState(loadDisc); var disc = ds[0], setDisc = ds[1];
      var drs = React.useState(''); var draft = drs[0], setDraft = drs[1];
      var cs = React.useState(null); var cardv = cs[0], setCard = cs[1]; // {hook,expand,discipline,offlist} | 'none' | null
      var ls = React.useState(false); var loading = ls[0], setLoading = ls[1];
      var xs = React.useState(false); var showExp = xs[0], setShowExp = xs[1];
      var ps = React.useState(false); var copied = ps[0], setCopied = ps[1];
      var as = React.useState(false); var atlased = as[0], setAtlased = as[1];  // 已收进知识疆域?

      function commit(next) { setDisc(next); saveDisc(next); }
      function toggle(d) { commit(disc.indexOf(d) >= 0 ? disc.filter(function (x) { return x !== d; }) : disc.concat([d])); }
      function addDraft() {
        var parts = draft.split(/[，,、\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!parts.length) return;
        var next = disc.slice(); parts.forEach(function (p) { if (next.indexOf(p) < 0) next.push(p); });
        commit(next); setDraft('');
      }
      function randomDisc() {
        var pool = NICHE.filter(function (d) { return disc.indexOf(d) < 0; });
        if (!pool.length) pool = NICHE;
        commit(disc.concat([pool[Math.floor(Math.random() * pool.length)]]));
      }
      function drawCard() {
        if (loading || !rpcCall) return;
        setLoading(true); setShowExp(false); setCopied(false); setAtlased(false); setCard(null);
        Promise.resolve(rpcCall('/crosslens', 'associate', { sessionId: sessionId, disciplines: disc.slice() })).then(function (r) {
          setCard((r && r.ok) ? (r.value || 'none') : 'none');
        }).catch(function () { setCard('none'); }).then(function () { setLoading(false); });
      }
      function copyCard() {
        if (!cardv || cardv === 'none') return;
        var txt = (cardv.offlist && cardv.discipline ? '(列表外·' + cardv.discipline + ') ' : '') + cardv.hook + (cardv.expand ? '\n' + cardv.expand : '');
        try { navigator.clipboard.writeText(txt); setCopied(true); setTimeout(function () { setCopied(false); }, 1500); } catch (e) { }
      }
      // 收进知识疆域:抽的卡作为"预备桥"落到疆域(AI 判两端、你手点安置)
      function toAtlas() {
        if (!cardv || cardv === 'none' || atlased) return;
        var text = cardv.hook + (cardv.expand ? '\n' + cardv.expand : '');
        stageToAtlas('card', cardv.hook, text);
        setAtlased(true);
      }

      var picker = [];
      disc.forEach(function (d) { picker.push(h('button', { key: 'on-' + d, style: chipOn, title: '移除', onClick: function () { toggle(d); } }, d + ' ×')); });
      PRESETS.filter(function (d) { return disc.indexOf(d) < 0; }).forEach(function (d) { picker.push(h('button', { key: 'p-' + d, style: chip, onClick: function () { toggle(d); } }, '+ ' + d)); });
      picker.push(h('input', {
        key: 'in', style: Object.assign({}, textIn, { width: '130px' }), value: draft, placeholder: '自定义，回车添加',
        onChange: function (e) { setDraft(e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } },
      }));
      picker.push(h('button', { key: 'rnd', style: Object.assign({}, chip, { borderStyle: 'dashed', opacity: 0.85 }), title: '随机来一个很冷门的细分学科', onClick: randomDisc }, '🎲 随机学科'));

      var kids = [
        h('div', { key: 'pk', style: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '8px' } }, picker),
        h('div', { key: 'row', style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
          h('button', { key: 'dice', style: Object.assign({}, pill, { height: '24px', lineHeight: '24px', padding: '0 14px', opacity: 0.9 }), disabled: loading, onClick: drawCard }, loading ? '抽卡中…' : '🎲 抽一张'),
          sessionId ? null : h('span', { key: 'ns', style: hint }, '打开一个对话抽得更准'),
        ]),
      ];
      if (cardv === 'none') {
        kids.push(h('div', { key: 'none', style: Object.assign({ marginTop: '8px' }, dim) }, '这次没抽到（换个学科或稍后再抽）'));
      } else if (cardv) {
        var hookKids = [];
        if (cardv.offlist && cardv.discipline) hookKids.push(h('span', { key: 't', style: { fontSize: '11px', opacity: 0.6, border: '1px solid currentColor', borderRadius: '4px', padding: '0 4px', marginRight: '6px' } }, '列表外·' + cardv.discipline));
        hookKids.push(cardv.hook);
        kids.push(h('div', { key: 'hook', style: { marginTop: '8px' } }, hookKids));
        if (cardv.expand && showExp) kids.push(h('div', { key: 'exp', style: { marginTop: '4px', opacity: 0.78, borderLeft: '2px solid currentColor', paddingLeft: '10px' } }, cardv.expand));
        var acts = [];
        if (cardv.expand && !showExp) acts.push(h('button', { key: 'e', style: linkBtn, onClick: function () { setShowExp(true); } }, '展开一点 ›'));
        acts.push(h('button', { key: 'c', style: linkBtn, onClick: copyCard }, copied ? '已复制' : '复制'));
        acts.push(h('button', { key: 'atl', style: atlased ? ctaDone : cta, title: '把这张卡收进知识疆域', onClick: toAtlas }, atlased ? '已收进疆域 ✓' : '🗺 收进疆域'));
        kids.push(h('div', { key: 'act', style: { display: 'flex', gap: '12px', marginTop: '6px' } }, acts));
      }
      return h('div', null, kids);
    }

    // ============ 记一笔 面板(移自 jiyibi dock)============
    function fmt(ts) { try { var d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { return ''; } }

    function JiyibiPanel(props) {
      var sessionId = props.sessionId;
      var ns = React.useState(''); var note = ns[0], setNote = ns[1];
      var bs = React.useState(false); var busy = bs[0], setBusy = bs[1];
      var ss = React.useState(false); var saved = ss[0], setSaved = ss[1];
      var qs = React.useState(''); var query = qs[0], setQuery = qs[1];
      var lsx = React.useState(null); var marks = lsx[0], setMarks = lsx[1];
      var eo = React.useState(null); var openId = eo[0], setOpenId = eo[1];      // 哪条笔记展开了"当时的问答"(一次一条)
      var cq = React.useState(null); var copiedId = cq[0], setCopiedId = cq[1];
      var aq = React.useState(null); var atlasedId = aq[0], setAtlasedId = aq[1]; // 哪条笔记刚收进疆域
      var vw = React.useState('time'); var view = vw[0], setView = vw[1];        // 翻本子视图:'time' 按时间(默认) | 'session' 按会话索引

      function refresh(q) { if (!rpcCall) return; Promise.resolve(rpcCall('/jiyibi', 'list', { query: q || '' })).then(function (r) { setMarks(r && r.ok ? (r.value || []) : []); }).catch(function () { setMarks([]); }); }
      React.useEffect(function () { refresh(''); }, []);
      function copyQA(m) {
        var txt = (m.userAsked ? '问:' + m.userAsked + '\n\n' : '') + (m.aiSaid ? '答:' + m.aiSaid : '');
        try { navigator.clipboard.writeText(txt); setCopiedId(m.id); setTimeout(function () { setCopiedId(null); }, 1500); } catch (e) { }
      }
      function save() {
        var t = note.trim(); if (!t || busy || !rpcCall) return;
        setBusy(true);
        Promise.resolve(rpcCall('/jiyibi', 'add', { sessionId: sessionId, note: t })).then(function (r) {
          setBusy(false);
          if (r && r.ok && r.value) { setNote(''); setSaved(true); setTimeout(function () { setSaved(false); }, 1800); refresh(query); }
        }).catch(function () { setBusy(false); });
      }
      function del(id) { if (!rpcCall) return; Promise.resolve(rpcCall('/jiyibi', 'remove', { id: id })).then(function () { refresh(query); }).catch(function () { }); }
      // 收进知识疆域:笔记作为"预备桥"落到疆域,AI 判两端、你在图上手点安置(确认那一步才持久化)。
      function noteToAtlas(m) {
        stageToAtlas('note', m.note, m.note, { noteId: m.id, sessionId: m.sessionId, ts: m.ts });
        setAtlasedId(m.id); setTimeout(function () { setAtlasedId(null); }, 1600);
      }

      var kids = [];
      // 写
      kids.push(h('textarea', {
        key: 'ta', style: Object.assign({}, textIn, { minHeight: '52px', resize: 'vertical' }), value: note,
        placeholder: sessionId ? '值得记一笔吗?写下它对你意味着什么…' : '打开一个对话再记(要钉在某条对话上)',
        disabled: !sessionId,
        onChange: function (e) { setNote(e.target.value); },
        onKeyDown: function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } },
      }));
      kids.push(h('div', { key: 'wr', style: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' } }, [
        h('button', { key: 's', style: Object.assign({}, pill, { height: '22px', lineHeight: '22px' }), disabled: busy || !sessionId, onClick: save }, busy ? '记着…' : '记下(⌘/Ctrl+↵)'),
        saved ? h('span', { key: 'ok', style: dim }, '记下了 ✓') : null,
      ]));
      kids.push(h('div', { key: 'note', style: Object.assign({ marginTop: '3px' }, hint) }, '只写你的话——AI 说的那句它自有日志,这本子只留你的意义。'));
      // 翻本子
      kids.push(h('div', { key: 'hr', style: { borderTop: '1px solid var(--pp-hairline)', margin: '9px 0 7px' } }));
      kids.push(h('input', {
        key: 'q', style: textIn, value: query, placeholder: '翻本子…（关键词,回车搜）',
        onChange: function (e) { setQuery(e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); refresh(query); } },
      }));
      // 视图切换:按时间(默认)/ 按会话索引
      var vpill = { font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid var(--pp-hairline-strong)', borderRadius: '999px', padding: '0 9px', cursor: 'pointer', fontSize: '11px', lineHeight: '18px', opacity: 0.65 };
      var vpillOn = Object.assign({}, vpill, { opacity: 1, borderColor: 'currentColor', fontWeight: 600 });
      kids.push(h('div', { key: 'vm', style: { display: 'flex', gap: '6px', marginTop: '6px' } }, [
        h('button', { key: 't', style: (view === 'time' ? vpillOn : vpill), onClick: function () { setView('time'); } }, '按时间'),
        h('button', { key: 's', style: (view === 'session' ? vpillOn : vpill), onClick: function () { setView('session'); } }, '按会话'),
      ]));

      var linkMini = Object.assign({}, linkBtn, { fontSize: '11px' });
      var qaLabel = { fontSize: '10px', opacity: 0.5, border: '1px solid currentColor', borderRadius: '4px', padding: '0 3px', marginRight: '5px', flex: '0 0 auto' };
      function markItem(m) {
        var isOpen = openId === m.id;
        var hasQA = !!(m.userAsked || m.aiSaid);
        var ik = [
          h('div', { key: 'n', style: { fontWeight: 600 } }, m.note),
          h('div', { key: 'm', style: Object.assign({ marginTop: '1px' }, hint) }, fmt(m.ts)),
        ];
        var acts = [];
        if (hasQA) acts.push(h('button', { key: 'q', style: linkMini, onClick: function () { setOpenId(isOpen ? null : m.id); } }, isOpen ? '收起' : '看当时的问答 ›'));
        acts.push(h('button', { key: 'atl', style: atlasedId === m.id ? ctaDoneSm : ctaSm, title: '把这一笔收进知识疆域', onClick: function () { noteToAtlas(m); } }, atlasedId === m.id ? '已收进疆域 ✓' : '🗺 收进疆域'));
        acts.push(h('button', { key: 'd', style: Object.assign({}, linkMini, { opacity: 0.5 }), onClick: function () { del(m.id); } }, '删'));
        ik.push(h('div', { key: 'act', style: { display: 'flex', gap: '14px', marginTop: '2px' } }, acts));
        if (isOpen && hasQA) {
          var qa = [];
          if (m.userAsked) qa.push(h('div', { key: 'q', style: { display: 'flex', whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: 0.88, marginBottom: '6px' } }, [h('span', { key: 'l', style: qaLabel }, '问'), h('span', { key: 't' }, m.userAsked)]));
          if (m.aiSaid) qa.push(h('div', { key: 'a', style: { display: 'flex', whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: 0.88 } }, [h('span', { key: 'l', style: qaLabel }, '答'), h('span', { key: 't' }, m.aiSaid)]));
          qa.push(h('button', { key: 'cp', style: Object.assign({}, linkMini, { marginTop: '6px' }), onClick: function () { copyQA(m); } }, copiedId === m.id ? '已复制' : '复制这对问答'));
          ik.push(h('div', { key: 'qa', style: { marginTop: '6px', padding: '7px 9px', borderRadius: '8px', background: 'rgba(128,128,128,0.12)', maxHeight: '240px', overflowY: 'auto' } }, qa));
        }
        return h('div', { key: m.id, style: { borderLeft: '2px solid currentColor', paddingLeft: '10px', margin: '8px 0' } }, ik);
      }

      if (marks === null) kids.push(h('div', { key: 'ld', style: Object.assign({ marginTop: '6px' }, hint) }, '翻本子中…'));
      else if (!marks.length) kids.push(h('div', { key: 'em', style: Object.assign({ marginTop: '6px' }, hint) }, query ? '没翻到。' : '还没有记过。读到心里一动的地方,记一笔。'));
      else if (view === 'time') kids.push(h('div', { key: 'list', style: { marginTop: '4px' } }, marks.map(markItem)));
      else {
        // 按会话分组做索引(marks 已倒序 → 组内保持倒序,组按"最新一笔"先后)
        var order = []; var groups = {};
        marks.forEach(function (m) { var sid = m.sessionId || '∅'; if (!groups[sid]) { groups[sid] = []; order.push(sid); } groups[sid].push(m); });
        var gEls = order.map(function (sid) {
          var gm = groups[sid];
          var isCur = sessionId && sid === sessionId;
          return h('div', { key: sid, style: { marginTop: '9px' } }, [
            h('div', { key: 'h', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', borderBottom: '1px solid var(--pp-hairline)', paddingBottom: '2px', marginBottom: '2px' } }, [
              h('span', { key: 't', style: { fontWeight: 600, opacity: 0.82 } }, '🧵 ' + (sid === '∅' ? '无会话' : '会话 …' + String(sid).slice(-6)) + (isCur ? ' · 当前' : '')),
              h('span', { key: 'c', style: hint }, gm.length + ' 笔'),
            ]),
            h('div', { key: 'b' }, gm.map(markItem)),
          ]);
        });
        kids.push(h('div', { key: 'grp' }, gEls));
      }
      return h('div', null, kids);
    }

    // ============ 设置(开关)面板 ============
    function SettingsPanel() {
      var kids = TOGGLES.map(function (t) {
        var on = isOn(t.slug);
        return h('div', { key: t.slug, style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', padding: '5px 0' } }, [
          h('div', { key: 'l', style: { minWidth: 0 } }, [
            h('div', { key: 'n', style: { fontWeight: 600 } }, t.label),
            h('div', { key: 'h', style: hint }, t.note),
          ]),
          h('button', { key: 'p', style: Object.assign({}, pill, on ? {} : { opacity: 0.4 }), title: on ? '点击关闭' : '点击开启', onClick: function () { setOn(t.slug, !on); } }, on ? '开' : '关'),
        ]);
      });
      kids.push(h('div', { key: 'ft', style: Object.assign({ marginTop: '6px' }, hint) }, '设置存在本浏览器。关掉的工具当场生效,不刷新。'));
      return h('div', null, kids);
    }

    // ============ 浮条本体 ============
    function Bar(props) {
      var useSessions = props.useSessions;
      var sessionId = (typeof useSessions === 'function') ? useSessions(function (s) { return s && s.current; }) : null;

      var ps = React.useState(function () {
        var p = loadPos(); if (p) return p;
        try { return { x: clamp((window.innerWidth || 400) - 132, 8, 99999), y: clamp((window.innerHeight || 400) - 60, 8, 99999) }; } catch (e) { return { x: 20, y: 20 }; }
      });
      var pos = ps[0], setPos = ps[1];
      var osx = React.useState(false); var open = osx[0], setOpen = osx[1];
      var tbs = React.useState(null); var tab = tbs[0], setTab = tbs[1]; // 'crosslens' | 'jiyibi' | 'set' | null(自动)
      var tks = React.useState(0); var setTick = tks[1];
      var hs = React.useState(false); var hidden = hs[0], setHidden = hs[1]; // 进入知识疆域时隐藏浮窗
      var drag = React.useRef(null);
      var posRef = React.useRef(pos); posRef.current = pos;

      React.useEffect(function () {
        function upd() { setTick(function (n) { return n + 1; }); }
        function onAtlasClosed() { setHidden(false); } // × 退出知识疆域 → 浮窗恢复
        function onAtlasOpen() { setHidden(true); }    // 任何入口打开地图（含笔记收进疆域）→ 浮窗让位
        function onJiyibiOpen() { setHidden(false); setOpen(true); setTab('jiyibi'); } // 从地图上的桥「↩回到记一笔」
        window.addEventListener('storage', upd); window.addEventListener('pace-popup:changed', upd);
        window.addEventListener('pace-popup:atlas:closed', onAtlasClosed);
        window.addEventListener('pace-popup:atlas:open', onAtlasOpen);
        window.addEventListener('pace-popup:jiyibi:open', onJiyibiOpen);
        return function () {
          window.removeEventListener('storage', upd); window.removeEventListener('pace-popup:changed', upd);
          window.removeEventListener('pace-popup:atlas:closed', onAtlasClosed);
          window.removeEventListener('pace-popup:atlas:open', onAtlasOpen);
          window.removeEventListener('pace-popup:jiyibi:open', onJiyibiOpen);
        };
      }, []);

      // 置顶入口:打开全屏地图 + 隐藏浮窗自身(收起卡片)
      function launchAtlas() {
        try { window.dispatchEvent(new CustomEvent('pace-popup:atlas:open')); } catch (e) { }
        setOpen(false); setHidden(true);
      }
      if (hidden) return null;

      function onDown(e) {
        e.preventDefault();
        var p = posRef.current;
        drag.current = { sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false, last: p };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }
      }
      function onMove(e) {
        var d = drag.current; if (!d) return;
        var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        var nx = clamp(d.ox + dx, 0, Math.max(0, (window.innerWidth || 9999) - 40));
        var ny = clamp(d.oy + dy, 0, Math.max(0, (window.innerHeight || 9999) - 26));
        d.last = { x: nx, y: ny }; setPos(d.last);
      }
      function onUp(e) {
        var d = drag.current; drag.current = null; if (!d) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { }
        if (d.moved) savePos(d.last); else setOpen(function (o) { return !o; });
      }

      var handleEl = h('div', {
        key: 'handle', style: handle, title: '拖动移动 · 点击' + (open ? '收起' : '展开'),
        onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp,
      }, [
        h('span', { key: 'i' }, '🎛'),
        h('span', { key: 't' }, '知识疆域'),
        h('span', { key: 'c', style: { opacity: 0.5 } }, open ? '▾' : '▸'),
      ]);

      var children = [handleEl];

      if (open) {
        // 哪些工具可见(读开关);拼 tab 列表:可见工具 + 设置
        var tools = TOOLS.filter(function (t) { return isOn(t.slug); });
        var tabs = tools.map(function (t) { return { key: t.slug, label: t.tab }; });
        tabs.push({ key: 'set', label: '⚙' });
        // 当前 tab:默认第一个可见工具,否则设置
        var active = tab;
        if (!active || (active !== 'set' && !tools.some(function (t) { return t.slug === active; }))) {
          active = tools.length ? tools[0].slug : 'set';
        }
        var tabEls = tabs.map(function (tb) {
          return h('button', { key: tb.key, style: (tb.key === active ? tabOn : tabBtn), onClick: function () { setTab(tb.key); } }, tb.label);
        });

        var body;
        if (active === 'set') body = h(SettingsPanel, { key: 'set' });
        else if (active === 'crosslens') body = h(CrossLensPanel, { key: 'cl', sessionId: sessionId });
        else if (active === 'jiyibi') body = h(JiyibiPanel, { key: 'ji', sessionId: sessionId });

        var nearBottom = pos.y > (window.innerHeight || 800) / 2;
        var nearRight = pos.x > (window.innerWidth || 1000) / 2;
        var place = {};
        if (nearBottom) place.bottom = 'calc(100% + 6px)'; else place.top = 'calc(100% + 6px)';
        if (nearRight) place.right = 0; else place.left = 0;

        var cardKids = [];
        // 置顶:打开知识疆域(全屏地图)——仅在其开关开启时显示
        if (isOn('atlas')) cardKids.push(h('button', { key: 'atlas', style: atlasPin, title: '打开全屏知识地图', onClick: launchAtlas }, '🗺️ 打开知识疆域'));
        cardKids.push(h('div', { key: 'tabs', style: tabBar }, tabEls));
        cardKids.push(body);
        children.push(h('div', { key: 'card', style: Object.assign({}, card, place) }, cardKids));
      }

      return h('div', { style: Object.assign({}, layer, { left: pos.x + 'px', top: pos.y + 'px' }) }, children);
    }

    exports.inject = ['slots', 'connection'];
    exports.apply = function (ctx) {
      rpcCall = function (channel, endpoint, payload) { return ctx.connection.rpc.call(channel, endpoint, payload || {}); };
      // 只有 shell.overlay 槽存在时才挂(headless/无此槽的装配天然跳过)
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'pace-hub', order: 10 }, Bar);
      });
    };
    return module.exports;
  },
});
