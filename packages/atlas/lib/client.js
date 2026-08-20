/**
 * 知识疆域 (atlas) 客户端展示件——把每段会话，一块块拼成一张会长大的知识大陆。
 *
 * 手写工厂包裹(window.__ModuleLoader__.load),依赖(react/slots/connection)全平台 external,零构建。
 * 与其它系列弹窗不同:地图是一张**大幅面**画布,不适合塞进对话 dock。故它像 pace-hub 那样挂在官方
 * **shell.overlay** 槽:平时只一个可忽略的浮动小按钮(🗺️ 知识疆域),点开才铺满全屏,再点 × 收回。
 *
 * 本文件是一次**忠实的视觉/交互移植**:原型 starchart.html 的整段 <script>(value-noise 域扭曲 +
 * 加权 Voronoi 疆域渲染、力导向 settle、悬停点亮航路、连接器 picker、新建概念/学科/细分弹窗、
 * 编译会话、掌握度、图例、读数、toast)几乎原样搬进一个挂载 effect,只把所有 getElementById/
 * querySelector 从 document 收窄到挂载容器 root(重复挂载也安全),并在卸载时停掉 rAF、拆监听。
 * 数据仍用原型内存里的 MOCK(seed/compile),尚未接 RPC——见下方 TODO 埋点。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-atlas',
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    var React = require('react');
    var h = React.createElement;

    // apply 里注入的 RPC 调用闭包(留待后续接线;当前地图用内存 mock,不碰会话日志)。
    var rpcCall = null;

    // —— 双语:跟随 dsh 全局语言设置(设置页「语言」,dsh-client-locale 的 locale 服务)。——
    // 中文原文即词典 key:只注册一份 en 词典,active=zh 或查不到时 locale 服务自动回落 key(中文);
    // 宿主没有 locale 服务(旧版/headless)时恒中文。地图整屏挂载、切语言须先关图,故只在挂载时读、不订阅。
    var ATLAS_EN = {
      '知识疆域': 'Knowledge Territory',
      '从你的会话里，一块块拼出的知识大陆': 'Knowledge continents, assembled piece by piece from your sessions',
      '你点亮的链接': 'links you lit',
      '打通的学科对': 'discipline pairs bridged',
      '待安置的连接': 'connections waiting',
      '学科总览': 'Disciplines',
      '查看': 'View',
      '待你点亮的连接': 'Connections waiting for you',
      '＋ 新建连接': '＋ New connection',
      '悬停一座城看它的来历 · 从左侧点亮航路': 'Hover a city for its story · light routes from the left',
      'AI 正在判两端…': 'AI is guessing the two ends…',
      ' 链接': ' link(s)',
      '待你安置': 'ready to place',
      '待你指定两端': 'pick both ends',
      '安置': 'Place',
      '移除': 'Remove',
      '这里汇集待你点亮的连接。<br>抽张卡、记一笔「收进疆域」，或点上方「＋ 新建连接」。': 'Connections waiting for you gather here.<br>Draw a card or jot a note and send it in, or click "＋ New connection" above.',
      '掌握 ': 'mastery ',
      ' 条链接': ' links',
      '（还没有链接）': '(no links yet)',
      '◈ 桥': '◈ bridge',
      '点开：看链接、改两端': 'Click: see links, change ends',
      '空的<b>预备连接</b>已加到左栏 —— 点它选两端': 'An empty <b>pending connection</b> is in the left rail — click it and pick two ends',
      '已加到左栏<b>预备桥</b> —— 点它，选两端安置': 'Added to the left rail as a <b>pending bridge</b> — click it, pick two ends to place',
      '桥已安置 —— ': 'Bridge placed — ',
      '开辟了「{0}」大陆': 'Founded the "{0}" continent',
      '「{0}」已在图上': '"{0}" is already on the map',
      '在「{0}」开辟了「{1}」州': 'Opened the "{1}" state in "{0}"',
      '关闭': 'Close',
      '一级学科（大陆）· 二级学科（州）。点淡显的大陆/带＋的州开辟到地图；「＋ 开辟州」可自建二级学科。': 'Level-1 disciplines (continents) · level-2 (states). Click a dimmed continent or a ＋ state to open it on the map; "＋ New state" adds your own.',
      '＋ 新建学科，回车开辟一块新大陆': '＋ New discipline, Enter to found a continent',
      '开辟': 'Found',
      '未开辟': 'not founded',
      '已在图上': 'already on the map',
      '点击开辟这片州': 'click to open this state',
      '＋ 开辟州': '＋ New state',
      '二级学科名，回车开辟（Esc 取消）': 'State name, Enter to open (Esc cancels)',
      '桥 · ': 'Bridge · ',
      '· 预备，选好两端即安置': '· pending — picking both ends places it',
      '选一端': 'pick an end',
      '链接': 'Links',
      '让这两块连起来的那些话': 'the words that connect these two',
      '还没有链接。加一句"为什么连"，或从抽卡/记一笔收进来。': 'No links yet. Add a line for "why", or send one in from a card draw / a note.',
      '（空）': '(empty)',
      '↩ 回到记一笔': '↩ Back to the note',
      '＋手动加一句：为什么连？': '＋ Add a line: why do they connect?',
      '加': 'Add',
      '删除桥': 'Delete bridge',
      '细到 2 级学科（可选，连接点会落到那片州）': 'Refine to a level-2 state (optional; the anchor lands there)',
      '·大陆中央': ' · continent center',
      '＋新学科，回车': '＋ new discipline, Enter',
      '手动连接': 'manual connection',
      '桥端新辟': 'opened as a bridge end',
      '新建学科': 'newly founded',
      '开辟二级学科': 'opened as a state',
      '恢复疆域': 'restored from your territory',
      '退出知识疆域': 'Exit Knowledge Territory',
    };
    var getLoc = function () { return null; };            // apply 里接上 ctx.get('locale')
    var boundT = null, dictRegistered = false;
    function T(s) {
      var loc = getLoc(); if (!loc) return s;
      if (!dictRegistered) { dictRegistered = true; try { loc.register('pace.atlas', 'en', ATLAS_EN); } catch (e) { } try { boundT = loc.bind('pace.atlas'); } catch (e) { } }
      return boundT ? boundT(s) : s;
    }
    function TF(s) { var out = T(s); for (var i = 1; i < arguments.length; i++) out = out.replace('{' + (i - 1) + '}', arguments[i]); return out; }

    // ════════════════ 原型样式(整块搬入,只做一件事:全部收窄到 .dsh-atlas-root 作用域)════════════════
    // 原型里 :root / html,body 的全局规则若直接注入 document.head 会污染宿主 app(改掉 body 背景、overflow)。
    // 因此:变量落到 .dsh-atlas-root、body 规则并入 .dsh-atlas-root、其余选择器一律加前缀;keyframes 改名防撞。
    var STYLE_ID = 'dsh-atlas-style';
    var styleInjected = false;
    var ATLAS_CSS = `
.dsh-atlas-root{
  /* 外壳 = 浅底黑字;地图视口(--sea)与覆盖其上的图例/提示(--on-map)才是深底浅字。 */
  --sea:#ffffff;                                   /* 地图视口=白底 */
  --panel:#ffffff; --panel-2:#f0f0f1; --field:#f4f4f5;
  --hair:rgba(0,0,0,.16); --hair-soft:rgba(0,0,0,.09);
  --ink:#18181a; --ink-dim:#55565b; --ink-faint:#86888d;              /* 外壳:黑/灰字 */
  --on-map:rgba(238,238,240,.82); --on-map-dim:rgba(238,238,240,.46); /* 深色地图上的浅字 */
  --coast:#E4E5E9; --accent:#18181a; --accent-ink:#ffffff; --gold:var(--accent); --ignite:#3a3b3e;
  --cta:#FF90E8; --cta-ink:#151515; --cta-hi:#FF6FDF;   /* 主行动色（Gumroad 粉）：安置/连上/确认 */
  --serif:var(--pp-serif,"Palatino Linotype",Palatino,Georgia,"Songti SC","Noto Serif CJK SC",serif);
  --sans:var(--pp-sans,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",system-ui,sans-serif);
  --mono:var(--pp-mono,ui-monospace,"SF Mono","Cascadia Mono",Consolas,monospace);
  height:100%; background:var(--panel-2); color:var(--ink); font-family:var(--sans);
  -webkit-font-smoothing:antialiased; overflow:hidden;
}
.dsh-atlas-root, .dsh-atlas-root *{box-sizing:border-box}
.dsh-atlas-root .app{display:flex;flex-direction:column;height:100%}

.dsh-atlas-root .head{display:flex;align-items:center;justify-content:space-between;gap:24px;
  padding:14px 62px 14px 22px;border-bottom:1px solid var(--hair-soft);
  background:var(--panel-2)}
.dsh-atlas-root .brand{display:flex;align-items:baseline;gap:12px;min-width:0}
.dsh-atlas-root .brand .mk{color:var(--gold);font-size:15px;line-height:1}
.dsh-atlas-root .brand h1{font-family:var(--serif);font-weight:600;font-size:20px;margin:0;letter-spacing:.06em}
.dsh-atlas-root .brand .sub{font-size:12.5px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-atlas-root .readout{display:flex;gap:22px;flex-shrink:0}
.dsh-atlas-root .stat{display:flex;flex-direction:column;align-items:flex-end;line-height:1.15}
.dsh-atlas-root .stat b{font-family:var(--mono);font-size:20px;font-variant-numeric:tabular-nums}
.dsh-atlas-root .stat.bridge b{color:var(--gold)}
.dsh-atlas-root .stat span{font-size:10.5px;color:var(--ink-faint);letter-spacing:.4px;margin-top:2px}
.dsh-atlas-root .pop{display:inline-block;animation:atlasPop .5s ease}
@keyframes atlasPop{0%{transform:scale(1);color:var(--ignite)}40%{transform:scale(1.35)}100%{transform:scale(1)}}

.dsh-atlas-root main{flex:1;display:flex;min-height:0}
.dsh-atlas-root .rail{width:330px;flex-shrink:0;border-right:1px solid var(--hair-soft);background:var(--panel-2);
  display:flex;flex-direction:column;min-height:0}
.dsh-atlas-root .rail-label{font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-faint);padding:16px 18px 8px}
.dsh-atlas-root .session{border-bottom:1px solid var(--hair-soft);padding-bottom:14px}
.dsh-atlas-root .convo{padding:0 16px;display:flex;flex-direction:column;gap:8px;max-height:186px;overflow-y:auto}
.dsh-atlas-root .turn{font-size:12.5px;line-height:1.5;padding:8px 11px;border-radius:9px}
.dsh-atlas-root .turn.u{background:#152a3d;color:var(--ink);align-self:flex-end;max-width:88%;border:1px solid var(--hair-soft)}
.dsh-atlas-root .turn.a{background:transparent;color:var(--ink-dim);max-width:94%}
.dsh-atlas-root .turn.a b{color:var(--coast);font-weight:600}
.dsh-atlas-root .compile{margin:12px 16px 0;padding:11px;width:calc(100% - 32px);
  background:var(--panel);color:var(--ink);border:1px solid var(--hair);
  border-radius:10px;font-family:var(--sans);font-size:13px;cursor:pointer;transition:border-color .2s,transform .05s}
.dsh-atlas-root .compile:hover{border-color:var(--gold)}
.dsh-atlas-root .compile:active{transform:translateY(1px)}
.dsh-atlas-root .compile:disabled{opacity:.4;cursor:default;border-color:var(--hair-soft)}

.dsh-atlas-root .inbox{flex:1;display:flex;flex-direction:column;min-height:0}
.dsh-atlas-root .principle{margin:0 18px 6px;font-size:11.5px;color:var(--ink-faint);font-style:italic;line-height:1.5;
  border-left:2px solid var(--hair);padding-left:9px}
.dsh-atlas-root #candidates{overflow-y:auto;padding:6px 14px 18px;display:flex;flex-direction:column;gap:9px}
.dsh-atlas-root .cand{background:var(--panel);border:1px solid var(--hair-soft);border-radius:11px;padding:11px 12px;
  transition:border-color .2s,transform .3s,opacity .3s}
.dsh-atlas-root .cand.cross{border-left:3px solid var(--gold)}
.dsh-atlas-root .cand.armed{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
.dsh-atlas-root .cand.leaving{opacity:0;transform:translateX(14px)}
.dsh-atlas-root .cand-pair{display:flex;align-items:center;gap:8px;font-size:13.5px;flex-wrap:wrap}
.dsh-atlas-root .cand-pair .link{color:var(--ink-faint);font-size:12px}
.dsh-atlas-root .chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;
  background:var(--field);border:1px solid var(--hair-soft)}
.dsh-atlas-root .chip::before{content:"";width:9px;height:9px;border-radius:2px;background:var(--dot,var(--ink-dim))}
.dsh-atlas-root .cand-meta{font-size:11px;color:var(--ink-faint);margin:7px 0 9px;font-family:var(--mono)}
.dsh-atlas-root .cand-actions{display:flex;gap:8px}
.dsh-atlas-root .btn{border:none;border-radius:8px;font-size:12.5px;padding:6px 13px;cursor:pointer;font-family:var(--sans)}
.dsh-atlas-root .btn.lite{background:var(--cta);color:var(--cta-ink);font-weight:700}
.dsh-atlas-root .btn.lite:hover{background:var(--cta-hi)}
.dsh-atlas-root .btn.ghost{background:transparent;color:var(--ink-faint);border:1px solid var(--hair-soft)}
.dsh-atlas-root .btn.ghost:hover{color:var(--ink-dim)}
.dsh-atlas-root .inbox-empty{color:var(--ink-faint);font-size:12.5px;padding:4px 18px;line-height:1.6}

.dsh-atlas-root .stage{flex:1;position:relative;min-width:0;background:var(--sea)}
.dsh-atlas-root #map{display:block;width:100%;height:100%}
.dsh-atlas-root .legend{position:absolute;left:16px;bottom:14px;display:flex;flex-wrap:wrap;gap:6px 14px;max-width:62%;pointer-events:none}
.dsh-atlas-root .legend .lg{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-dim)}
.dsh-atlas-root .legend .lg.off{opacity:.4}
.dsh-atlas-root .legend .lg i{width:11px;height:11px;border-radius:3px;border:1px solid rgba(0,0,0,.22)}
.dsh-atlas-root .hint{position:absolute;right:16px;bottom:14px;font-size:11px;color:var(--ink-faint);font-family:var(--mono);pointer-events:none}

.dsh-atlas-root .hovercard{position:absolute;pointer-events:none;z-index:5;min-width:150px;max-width:212px;
  background:rgba(255,255,255,.97);border:1px solid var(--hair);border-radius:11px;padding:11px 13px;
  opacity:0;transform:translateY(4px);transition:opacity .12s;backdrop-filter:blur(3px)}
.dsh-atlas-root .hovercard.show{opacity:1;transform:none}
.dsh-atlas-root .hovercard h4{margin:0;font-family:var(--serif);font-size:15px;font-weight:600}
.dsh-atlas-root .hovercard .hc-disc{font-size:11px;margin:3px 0 8px}
.dsh-atlas-root .hovercard .bar{height:4px;border-radius:3px;background:#e6e6e8;overflow:hidden;margin-bottom:8px}
.dsh-atlas-root .hovercard .bar i{display:block;height:100%;border-radius:3px}
.dsh-atlas-root .hovercard .hc-src{font-size:10.5px;color:var(--ink-faint);line-height:1.45}
.dsh-atlas-root .hovercard .hc-master{font-size:10px;color:var(--ink-faint);font-family:var(--mono);float:right}

.dsh-atlas-root .picker{position:absolute;left:50%;bottom:26px;transform:translateX(-50%) translateY(10px);z-index:8;
  width:min(440px,86%);background:rgba(255,255,255,.98);border:1px solid var(--hair);border-radius:14px;
  padding:15px 17px;box-shadow:0 18px 50px rgba(0,0,0,.22);opacity:0;pointer-events:none;
  transition:opacity .18s,transform .18s;backdrop-filter:blur(6px)}
.dsh-atlas-root .picker.show{opacity:1;transform:translateX(-50%);pointer-events:auto}
.dsh-atlas-root .picker .pk-head{font-size:13.5px;margin-bottom:11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsh-atlas-root .picker .pk-head b{font-family:var(--serif);font-weight:600}
.dsh-atlas-root .types{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}
.dsh-atlas-root .type{padding:5px 11px;border-radius:20px;font-size:12px;cursor:pointer;background:var(--field);
  border:1px solid var(--hair-soft);color:var(--ink-dim);transition:all .15s}
.dsh-atlas-root .type:hover{border-color:var(--hair)}
.dsh-atlas-root .type.sel{background:var(--gold);color:var(--accent-ink);border-color:var(--gold);font-weight:600}
.dsh-atlas-root .type.leap.sel{background:var(--ignite);box-shadow:0 0 12px -2px rgba(0,0,0,.35)}
.dsh-atlas-root .why{width:100%;background:var(--field);border:1px solid var(--hair-soft);border-radius:9px;color:var(--ink);
  font-family:var(--sans);font-size:12.5px;padding:9px 11px;resize:none;margin-bottom:12px}
.dsh-atlas-root .why::placeholder{color:var(--ink-faint)}
.dsh-atlas-root .why:focus{outline:none;border-color:var(--gold)}
.dsh-atlas-root .pk-actions{display:flex;justify-content:flex-end;gap:9px}
.dsh-atlas-root .pk-actions .btn.lite{padding:8px 18px}
.dsh-atlas-root .rl-row{display:flex;justify-content:space-between;align-items:center;padding-right:14px}
.dsh-atlas-root .mini{background:transparent;border:1px solid var(--hair);color:var(--ink-dim);border-radius:7px;
  font-size:11px;padding:3px 9px;cursor:pointer;font-family:var(--sans);letter-spacing:0;text-transform:none}
.dsh-atlas-root .mini:hover{border-color:var(--gold);color:var(--ink)}
.dsh-atlas-root .tin{width:100%;background:var(--field);border:1px solid var(--hair-soft);border-radius:9px;color:var(--ink);
  font-family:var(--sans);font-size:12.5px;padding:8px 11px;margin-bottom:10px}
.dsh-atlas-root .tin:focus{outline:none;border-color:var(--gold)}
.dsh-atlas-root .pk-sub{font-size:11px;color:var(--ink-faint);margin:2px 0 7px;letter-spacing:.4px}
.dsh-atlas-root .chipin{padding:5px 11px;border-radius:20px;font-size:12px;background:var(--field);
  border:1px solid var(--gold);color:var(--ink);font-family:var(--sans);width:132px}
.dsh-atlas-root .chipin:focus{outline:none}

.dsh-atlas-root .toast{position:absolute;left:50%;top:22px;transform:translateX(-50%) translateY(-12px);z-index:9;
  background:rgba(255,255,255,.97);border:1px solid var(--accent);color:var(--ink);padding:10px 18px;
  border-radius:30px;font-size:13px;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;
  white-space:nowrap;box-shadow:0 6px 24px rgba(0,0,0,.18)}
.dsh-atlas-root .toast.show{opacity:1;transform:translateX(-50%)}
.dsh-atlas-root .toast.plain{background:rgba(255,255,255,.97);border-color:var(--hair);color:var(--ink-dim);box-shadow:none}
.dsh-atlas-root .toast b{color:var(--gold);font-weight:600}

/* 学科总览：鲜艳色块 + 子学科 */
.dsh-atlas-root .rail-top{border-bottom:1px solid var(--hair-soft);padding-bottom:10px;margin-bottom:4px}
.dsh-atlas-root .overview{display:flex;flex-wrap:wrap;gap:7px;padding:2px 14px 4px}
.dsh-atlas-root .ov-item{flex:1 1 44%;min-width:104px;border-radius:10px;padding:8px 10px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.dsh-atlas-root .ov-name{font-family:var(--serif);font-weight:700;font-size:13px;letter-spacing:.5px}
.dsh-atlas-root .ov-subs{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.dsh-atlas-root .ov-subs span{font-size:10px;background:rgba(255,255,255,.34);border-radius:20px;padding:1px 7px;line-height:1.5;
  cursor:pointer;border:1px dashed rgba(0,0,0,.22)}
.dsh-atlas-root .ov-subs span:hover{background:rgba(255,255,255,.6)}
.dsh-atlas-root .ov-subs span.on{background:rgba(255,255,255,.78);border-style:solid;font-weight:600;color:#151515}
.dsh-atlas-root .ov-newsub{margin-top:7px}
.dsh-atlas-root .ov-addsub{font-size:10px;color:inherit;background:rgba(255,255,255,.24);border:1px dashed rgba(0,0,0,.32);
  border-radius:20px;padding:2px 9px;cursor:pointer;font-family:var(--sans)}
.dsh-atlas-root .ov-addsub:hover{background:rgba(255,255,255,.55)}
.dsh-atlas-root .ov-newsub .chipin{width:100%;font-size:11px;padding:3px 9px;background:rgba(255,255,255,.85);color:#151515}
/* 学科总览弹窗（收起，点"查看"才铺开；含新建学科 + 未开辟态）*/
.dsh-atlas-root .ov-new{display:flex;gap:7px;margin-bottom:12px}
.dsh-atlas-root .ov-new .chipin{flex:1;width:auto}
.dsh-atlas-root .ov-item{cursor:pointer;transition:transform .12s,box-shadow .12s}
.dsh-atlas-root .ov-item:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(0,0,0,.2)}
.dsh-atlas-root .ov-item.ov-off{opacity:.45;box-shadow:none;outline:1.5px dashed rgba(0,0,0,.25);outline-offset:-4px}
.dsh-atlas-root .ov-item.ov-off:hover{opacity:.8}
.dsh-atlas-root .ov-tag{font-size:9.5px;font-weight:400;opacity:.75;margin-left:6px;letter-spacing:1px}
.dsh-atlas-root .ov-modal{position:absolute;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:rgba(18,18,22,.34)}
.dsh-atlas-root .ov-modal.show{display:flex}
.dsh-atlas-root .ov-card{width:min(560px,88%);max-height:80%;overflow-y:auto;background:var(--panel);border:1px solid var(--hair);
  border-radius:16px;padding:16px 18px;box-shadow:0 24px 60px rgba(0,0,0,.32)}
.dsh-atlas-root .ov-card h3{margin:0;font-family:var(--serif);font-size:18px;letter-spacing:.08em}
.dsh-atlas-root .ov-card .ov-sub-h{font-size:11.5px;color:var(--ink-faint);margin:2px 0 12px}
.dsh-atlas-root .ov-modal .overview{padding:0}
.dsh-atlas-root .ov-modal .ov-item{flex:1 1 46%;padding:11px 13px}
.dsh-atlas-root .endchooser .subChip{font-size:11px;border-style:dashed;opacity:.92}
/* 桥面板：两端可点选 + 链接列表 */
.dsh-atlas-root .bp-ends{display:flex;align-items:center;justify-content:center;gap:12px;margin:4px 0 10px}
.dsh-atlas-root .endchip{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600;color:var(--ink);
  background:var(--field);border:1px solid var(--hair);border-radius:20px;padding:5px 12px}
.dsh-atlas-root .endchip.open{border-color:var(--cta);box-shadow:0 0 0 2px rgba(255,144,232,.35)}
.dsh-atlas-root .endchip .ec-dot{width:9px;height:9px;border-radius:3px;flex:0 0 auto}
.dsh-atlas-root .bp-arrow{color:var(--ink-faint);font-size:15px}
.dsh-atlas-root .endchooser{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 0 10px;padding:8px;background:var(--field);border-radius:10px}
.dsh-atlas-root .bp-links{display:flex;flex-direction:column;gap:6px;margin-bottom:9px;max-height:180px;overflow-y:auto}
.dsh-atlas-root .bp-empty{font-size:11.5px;color:var(--ink-faint);line-height:1.5;padding:2px 0}
.dsh-atlas-root .bp-link{border:1px solid var(--hair-soft);border-radius:9px;overflow:hidden}
.dsh-atlas-root .bp-link.open{border-color:var(--gold)}
.dsh-atlas-root .bp-lrow{display:flex;align-items:center;gap:7px;padding:7px 9px;cursor:pointer;font-size:12px}
.dsh-atlas-root .bp-ltext{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
.dsh-atlas-root .bp-lx{color:var(--ink-faint);cursor:pointer;font-size:15px;line-height:1;padding:0 2px}
.dsh-atlas-root .bp-lx:hover{color:var(--crit,#E27D8F)}
.dsh-atlas-root .bp-ldetail{padding:2px 10px 10px;font-size:12px;line-height:1.55;color:var(--ink-dim);white-space:pre-wrap;word-break:break-word}
.dsh-atlas-root .bp-back{display:block;margin-top:8px;background:transparent;border:1px solid var(--hair);color:var(--ink-dim);
  border-radius:7px;font-size:11px;padding:3px 9px;cursor:pointer;font-family:var(--sans)}
.dsh-atlas-root .bp-back:hover{border-color:var(--gold);color:var(--ink)}
.dsh-atlas-root .bp-add{display:flex;gap:6px;align-items:center;margin-bottom:10px}
.dsh-atlas-root .bp-add .chipin{flex:1;width:auto}
@media (max-width:820px){.dsh-atlas-root .rail{width:280px}.dsh-atlas-root .brand .sub{display:none}}
@media (prefers-reduced-motion:reduce){.dsh-atlas-root *{animation-duration:.001ms!important;transition-duration:.05ms!important}}
.dsh-atlas-root :focus-visible{outline:2px solid var(--gold);outline-offset:2px}
`;

    function injectStyle() {
      if (styleInjected) return;
      try {
        if (!document.getElementById(STYLE_ID)) {
          var el = document.createElement('style');
          el.id = STYLE_ID;
          el.textContent = ATLAS_CSS;
          document.head.appendChild(el);
        }
        styleInjected = true;
      } catch (e) { /* ignore */ }
    }

    // ════════════════ 原型 DOM 结构(.app/.head/.rail/.stage 原样;挂载时求值以带上当前语言)════════════════
    function bodyHtml() { return `
<div class="app">
  <header class="head">
    <div class="brand">
      <span class="mk">◆</span>
      <h1>${T('知识疆域')}</h1>
      <span class="sub">${T('从你的会话里，一块块拼出的知识大陆')}</span>
    </div>
    <div class="readout">
      <div class="stat"><b id="rConn">—</b><span>${T('你点亮的链接')}</span></div>
      <div class="stat bridge"><b id="rBridge">—</b><span>${T('打通的学科对')}</span></div>
      <div class="stat"><b id="rFront">—</b><span>${T('待安置的连接')}</span></div>
    </div>
  </header>

  <main>
    <aside class="rail">
      <section class="rail-top">
        <div class="rail-label rl-row">${T('学科总览')}<button id="ovOpen" class="mini">${T('查看')}</button></div>
      </section>
      <section class="inbox">
        <div class="rail-label rl-row">${T('待你点亮的连接')}<button id="newLink" class="mini">${T('＋ 新建连接')}</button></div>
        <div id="candidates"></div>
      </section>
    </aside>

    <div class="stage" id="stage">
      <canvas id="map"></canvas>
      <div class="hovercard" id="hover"></div>
      <div class="picker" id="picker"></div>
      <div class="toast" id="toast"></div>
      <div class="legend" id="legend"></div>
      <div class="hint">${T('悬停一座城看它的来历 · 从左侧点亮航路')}</div>
    </div>
  </main>
</div>
`; }

    // ════════════════ 原型 <script> 逻辑(忠实移植)════════════════
    // 唯一的系统性改动:所有 document.getElementById → byId(root 作用域);
    // document.querySelectorAll → root.querySelectorAll;getComputedStyle(document.body) → getComputedStyle(root);
    // 顶层 rAF 收编进 rafId+stopped 以便卸载取消;window.resize 具名以便解绑,并附加 ResizeObserver;返回 cleanup。
    // TODO(RPC): 将 seed()/compile() 的内存 MOCK 换成 rpc.call('/atlas','getMap') 等——见 apply 里 rpcCall 埋点。
    function runAtlas(root) {
      "use strict";
      var stopped = false, rafId = 0, ro = null;
      function byId(id) { return root.querySelector('#' + id); }

      const REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;
      const now = () => performance.now();

      // ── 暗色夜地图配色（明度受控：地块一律深色字）──
      // 鲜艳色块（参照日本行政区图）：land = 中等明度的鲜亮地色（黑字仍可读）；city = 更饱和的同色，用作"区域外"的大陆名 + 图例
      const DISC = {
        sys: { name: "系统论", city: "#E0A020", land: [245, 205, 100] },
        info: { name: "信息论", city: "#2E77C8", land: [120, 176, 232] },
        econ: { name: "经济学", city: "#D6402E", land: [240, 132, 120] },
        bio: { name: "生物学", city: "#3E9E52", land: [138, 205, 140] },
        phil: { name: "哲学", city: "#9B45C4", land: [200, 150, 226] },
        frontier: { name: "未登陆", city: "#8494a8", land: [180, 192, 206] },
      };
      const SEA_SHELF = [236, 238, 242], SEA_BASE = [247, 248, 250], SEA_DEEP = [251, 252, 253]; // 白底海:近岸略深,主体近白(叠淡水纹)
      const COASTLINE = [64, 70, 80], BORDER_NAT = [40, 44, 52], PROVINCE = [250, 250, 252];       // 海岸/国界:深灰勾边;省界:浅色细缝(似府县白缝)
      const LABEL_DARK = "#151515", HALO = "rgba(255,255,255,.9)";                                  // 城名纯黑字 + 白色光晕
      const TYPES = ["属于", "部分", "前置", "相关", "矛盾", "跨学科跳跃"];

      function hsl(h, s, l) {
        let r, g, b; if (s === 0) { r = g = b = l; } else {
          const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
          const hue = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
          r = hue(h + 1 / 3); g = hue(h); b = hue(h - 1 / 3);
        } return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }
      const SPARE = [{ land: [95, 163, 156], city: [143, 203, 196] }];
      function newDiscColor() {
        if (SPARE.length) { const s = SPARE.shift(); return { land: s.land, city: 'rgb(' + s.city.join(',') + ')' }; }
        const h = ((order.length) * 0.61803398875) % 1; return { land: hsl(h, .30, .50), city: 'rgb(' + hsl(h, .52, .62).join(',') + ')' };
      }
      function subTint(sub) { if (!sub) return 0; let h = 0; for (let i = 0; i < sub.length; i++) h = (h * 31 + sub.charCodeAt(i)) >>> 0; return (h % 7 - 3) * 4.5; }

      // ── 学科总库（1 级学科 + 2 级学科）：知识疆域与跨学科抽卡共享的**同一套**学科结构 ──
      // 总览面板即由它渲染；跨学科抽卡的 PRESETS 用其 1 级名对齐（见 crosslens/lib/client.js）。
      const DISC_LIB = [
        ["系统论", ["控制论", "复杂系统", "混沌理论", "反馈"]],
        ["信息论", ["编码理论", "密码学", "数据压缩", "信道"]],
        ["经济学", ["行为经济学", "博弈论", "宏观经济", "微观经济"]],
        ["生物学", ["进化生物学", "生态学", "分子生物学", "神经生物"]],
        ["哲学", ["认识论", "伦理学", "逻辑学", "形而上学"]],
        ["心理学", ["认知心理", "社会心理", "发展心理"]],
        ["物理学", ["热力学", "量子力学", "统计力学", "相对论"]],
        ["数学", ["拓扑学", "概率论", "图论", "代数"]],
        ["计算机科学", ["算法", "机器学习", "分布式系统", "编程语言"]],
        ["神经科学", ["神经可塑性", "计算神经", "认知神经"]],
        ["语言学", ["句法学", "语义学", "语用学"]],
        ["社会学", ["社会网络", "组织理论", "阶层流动"]],
        ["历史学", ["经济史", "思想史", "科技史"]],
        ["艺术", ["音乐", "建筑", "绘画", "叙事"]],
      ];
      // 给总库里每个 1 级学科**登记稳定的地色**（前 5 个复用手调色 sys/info/…；其余按黄金角派生），
      // 令总览色块与地图大陆同色；此刻只登记，不落地图（order 起始为空 = 从 0 开始）。
      DISC_LIB.forEach((row, i) => {
        const name = row[0]; let exists = false;
        for (const k in DISC) { if (k !== 'frontier' && DISC[k].name === name) { exists = true; break; } }
        if (!exists) { const hh = (i * 0.61803398875) % 1; DISC['lib' + i] = { name, city: 'rgb(' + hsl(hh, .52, .60).join(',') + ')', land: hsl(hh, .34, .62) }; }
      });

      let nodes = [], edges = [], cands = [], bridges = []; const present = new Set(); let nid = 0;
      const byLabel = {};
      function N(label, disc, mastery, src) {
        const n = { id: ++nid, label, disc, mastery, src: src || "", sub: "", x: 0, y: 0, vx: 0, vy: 0, frontier: disc === "frontier" };
        nodes.push(n); if (!n.frontier) present.add(disc); return n;
      }
      function seed() {
        // 从 0 开始：不再种任何 mock 城/航路（旧的"熵/冗余/信息…"演示数据已清）。
        // 疆域完全由你长出来：安置一座桥、或在总览里开辟一个学科，第一块大陆才落海。
        nodes = []; edges = []; cands = []; bridges = [];
      }

      // ── 噪声（域扭曲用）：内联 value-noise + fBm ──
      function makeNoise(sd) {
        function hash(x, y) {
          let h = (x | 0) * 374761393 + (y | 0) * 668265263 + sd * 2246822519;
          h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
        }
        const sm = t => t * t * (3 - 2 * t);
        function v2(x, y) {
          const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
          const tl = hash(xi, yi), tr = hash(xi + 1, yi), bl = hash(xi, yi + 1), br = hash(xi + 1, yi + 1);
          const u = sm(xf), v = sm(yf); const tp = tl + (tr - tl) * u, bt = bl + (br - bl) * u; return tp + (bt - tp) * v;
        }
        function fbm(x, y) { let a = .5, f = 1, s = 0, n = 0; for (let i = 0; i < 4; i++) { s += a * v2(x * f, y * f); n += a; a *= .5; f *= 2; } return s / n; }
        return fbm;
      }
      const fbm = makeNoise(42);

      // ── 画布 ──
      const cv = byId("map"), ctx = cv.getContext("2d");
      const off = document.createElement("canvas"), octx = off.getContext("2d");
      const stage = byId("stage");
      let W = 0, H = 0, cx = 0, cy = 0, dpr = 1, GW = 0, GH = 0;
      const SC = 0.62, CELL = 80, WARP_AMP = 0.42 * CELL, WARP_F = 1 / (1.7 * CELL);
      const D_SEA = 54, BIAS = 28;
      let warpX = null, warpY = null;               // 预算的扭曲坐标场（只依赖空间，不依赖种子）
      // order = **已开辟**（落在地图上）的学科；从空开始，DISC 只是颜色/名字登记簿（含 DISC_LIB 总库）。
      const order = [], cAng = {};
      // ── 世界与相机：地图可横向扩张（学科越多、疆域越宽），超出视口时可左右滑动 ──
      let WW = 0, worldCx = 0, Rx = 0, Ry = 0, camX = 0;
      const D_SPREAD = 64;                                         // 每个学科占的圈周半径（越大越铺得开、越早需要滑动）
      function discLayout() {
        const margin = Math.min(W, H) * 0.22;
        Rx = Math.max(Math.min(W, H) * 0.28, order.length * D_SPREAD); // 学科圈半径随学科数增长
        Ry = Math.min(H * 0.30, Rx);                               // 纵向封顶：只横向扩张
        WW = Math.max(W, Math.round(2 * (Rx + margin)));           // 世界宽 ≥ 视口宽；扩张时学科铺满整个世界
        worldCx = WW / 2; GW = Math.round(WW * SC);
      }
      function panMax() { return Math.max(0, WW - W); }
      function panable() { return panMax() > 8; }
      function clampCam() { camX = Math.max(0, Math.min(panMax(), camX)); }
      function cCenter(d) {
        if (d === "frontier") return null; const a = cAng[d] ?? 0;
        return { x: worldCx + Math.cos(a) * Rx, y: cy + Math.sin(a) * Ry };
      }
      function placeNear(n) {
        const c = cCenter(n.disc) || { x: worldCx, y: cy }, a = Math.random() * 6.28, r = 24 + Math.random() * 30;
        n.x = c.x + Math.cos(a) * r; n.y = c.y + Math.sin(a) * r;
      }
      function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = stage.clientWidth || root.clientWidth || window.innerWidth || 960;
        H = stage.clientHeight || root.clientHeight || window.innerHeight || 600;
        cx = W / 2; cy = H / 2;
        cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        discLayout();                                   // 先定世界宽 WW / GW（含横向扩张）
        GH = Math.round(H * SC); off.width = GW; off.height = GH;
        clampCam(); buildWarp();
      }
      function buildWarp() {
        warpX = new Float32Array(GW * GH); warpY = new Float32Array(GW * GH);
        for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
          const dx = gx / SC, dy = gy / SC, i = gy * GW + gx;
          const nx = fbm(dx * WARP_F, dy * WARP_F), ny = fbm(dx * WARP_F + 5.2, dy * WARP_F + 1.3);
          warpX[i] = dx + WARP_AMP * (nx * 2 - 1); warpY[i] = dy + WARP_AMP * (ny * 2 - 1);
        }
      }
      const nodeById = id => nodes.find(n => n.id === id);

      // 桥的连接点：锚在**实际画出的**大陆/子学科中心（力导向 settle 后的质心），
      // 而非 cCenter 的理论圈位——后者与真实大陆位置偏差就是"哲学⟷信息论"那条桥错位的原因。
      function discCentroid(key) {
        let sx = 0, sy = 0, n = 0; nodes.forEach(nd => { if (nd.frontier || nd.disc !== key) return; sx += nd.x; sy += nd.y; n++; });
        return n ? { x: sx / n, y: sy / n } : (cCenter(key) || { x: worldCx, y: cy });   // 无城 → 退回理论圈位
      }
      function subCentroid(key, sub) {
        let sx = 0, sy = 0, n = 0; nodes.forEach(nd => { if (nd.frontier || nd.disc !== key || nd.sub !== sub) return; sx += nd.x; sy += nd.y; n++; });
        return n ? { x: sx / n, y: sy / n } : discCentroid(key);                          // 该子学科无城 → 退回大陆中央
      }
      function subsOf(key) { return [...new Set(nodes.filter(nd => nd.disc === key && nd.sub).map(nd => nd.sub))]; }
      // 1 级学科 → 大陆中央；2 级学科 → 该"州"的中心
      function endAnchor(key, sub) { return sub ? subCentroid(key, sub) : discCentroid(key); }

      // 力导向：settle 到稳定
      function step() {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 1, d = Math.sqrt(d2);
            const rep = Math.min(2200 / d2, .8), ux = dx / d, uy = dy / d;
            a.vx += ux * rep; a.vy += uy * rep; b.vx -= ux * rep; b.vy -= uy * rep;
            if (a.disc === b.disc && a.sub && a.sub === b.sub) {
              const att = Math.min(d * 0.0006, .35); // 同细分聚成邻里
              a.vx -= ux * att; a.vy -= uy * att; b.vx += ux * att; b.vy += uy * att;
            }
          }
        }
        edges.forEach(e => {
          const a = nodeById(e.a), b = nodeById(e.b); if (!a || !b) return;
          let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, k = (d - 88) * 0.006, ux = dx / d, uy = dy / d;
          a.vx += ux * k; a.vy += uy * k; b.vx -= ux * k; b.vy -= uy * k;
        });
        nodes.forEach(n => {
          const c = cCenter(n.disc);
          if (c) { n.vx += (c.x - n.x) * 0.013; n.vy += (c.y - n.y) * 0.013; } else { n.vx += (cx - n.x) * 0.0016; n.vy += (cy - n.y) * 0.0016; }
          n.vx *= 0.8; n.vy *= 0.8; n.x += n.vx; n.y += n.vy;
          const m = 34; n.x = Math.max(m, Math.min(WW - m, n.x)); n.y = Math.max(m, Math.min(H - m, n.y));
        });
      }
      function settle(it) { for (let i = 0; i < (it || 220); i++) step(); }

      // ── 疆域镶嵌：域扭曲 + 加权 Voronoi + 海 ──
      let territoryAlpha = 1;
      function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
      function rebuild(fade) {
        if (!warpX) buildWarp();
        const img = octx.createImageData(GW, GH), data = img.data;
        const owner = new Int32Array(GW * GH), discOf = new Int8Array(GW * GH);
        const dIdx = {}; order.forEach((k, i) => dIdx[k] = i); dIdx.frontier = 9;
        const pts = nodes.map(n => ({ x: n.x, y: n.y, disc: n.disc, reach: (n.frontier ? D_SEA * 0.42 : D_SEA + n.mastery * BIAS), id: n.id, fr: n.frontier, tint: subTint(n.sub) }));
        for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
          const i = gy * GW + gx, wx = warpX[i], wy = warpY[i];
          let best = 1e9, bi = -1;
          for (let p = 0; p < pts.length; p++) {
            const pt = pts[p];
            const d = Math.hypot(wx - pt.x, wy - pt.y) - pt.reach; if (d < best) { best = d; bi = p; }
          }
          const o = i * 4;
          if (best > 0) {
            owner[i] = -1; discOf[i] = -1;
            let col; if (best < 16) col = lerp3(SEA_SHELF, SEA_BASE, best / 16);
            else col = lerp3(SEA_BASE, SEA_DEEP, Math.min(1, (best - 16) / 90));
            // 淡淡的水纹理:低幅 fbm 水印 + 极细颗粒，让白底不死板（整体仍是白）
            const sxT = gx / SC, syT = gy / SC;
            const wm = (fbm(sxT / 46, syT / 46) - 0.5) * 5.5 + (((gx * 61 + gy * 113) & 255) / 255 - 0.5) * 2;
            data[o] = clamp(col[0] + wm); data[o + 1] = clamp(col[1] + wm); data[o + 2] = clamp(col[2] + wm); data[o + 3] = 255;
          } else {
            owner[i] = pts[bi].id; discOf[i] = dIdx[pts[bi].disc];
            const L = DISC[pts[bi].disc].land;
            // 纹理:中频软斑(fbm)+ 廉价细纹(hash),让色块有质感;再叠细分学科的深浅
            const dxT = gx / SC, dyT = gy / SC;
            const mottle = (fbm(dxT / 55, dyT / 55) - 0.5) * 22;
            const speckle = (((gx * 131 + gy * 197) & 255) / 255 - 0.5) * 7;
            const j = pts[bi].tint + mottle + speckle;
            data[o] = clamp(L[0] + j); data[o + 1] = clamp(L[1] + j); data[o + 2] = clamp(L[2] + j); data[o + 3] = 255;
          }
        }
        // 边界层级：陆海=海岸线；异学科=国界；同学科异城=省界(纹理级)
        for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
          const i = gy * GW + gx, R = gx < GW - 1 ? i + 1 : -1, B = gy < GH - 1 ? i + GW : -1;
          [R, B].forEach(nb => {
            if (nb < 0) return; if (owner[i] === owner[nb]) return;
            const a = discOf[i], b = discOf[nb];
            if (a === -1 || b === -1) { const land = a === -1 ? nb : i; paint(data, land, COASTLINE, 1); } // 海岸线画在陆侧
            else if (a !== b) { paint(data, i, BORDER_NAT, .85); paint(data, nb, BORDER_NAT, .85); }
            else { paint(data, i, PROVINCE, .4); }
          });
        }
        octx.putImageData(img, 0, 0);
        if (fade && !REDUCE) territoryAlpha = 0.4;
      }
      function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
      function paint(data, i, c, a) {
        const o = i * 4;
        data[o] = data[o] * (1 - a) + c[0] * a; data[o + 1] = data[o + 1] * (1 - a) + c[1] * a; data[o + 2] = data[o + 2] * (1 - a) + c[2] * a;
      }

      // ── 逐帧：贴地图 + 矢量叠层 ──
      let hoverNode = null, hoverBridge = null, armed = null;
      function draw() {
        ctx.clearRect(0, 0, W, H);
        if (territoryAlpha < 1) territoryAlpha = Math.min(1, territoryAlpha + 0.05);
        ctx.globalAlpha = territoryAlpha; ctx.imageSmoothingEnabled = true;
        // 只把相机窗口那一段疆域贴到视口（源 x = camX*SC，宽 = 一屏的栅格）
        ctx.drawImage(off, camX * SC, 0, W * SC, GH, 0, 0, W, H); ctx.globalAlpha = 1;

        // 矢量叠层整体按相机左移（节点/桥都用世界坐标）
        ctx.save(); ctx.translate(-camX, 0);

        // 大陆名（学科）——放到大陆"外面"的海上，用大陆自己的颜色（参照日本地图的区域名）
        const cen = {}; nodes.forEach(n => {
          if (n.frontier) return; const c = (cen[n.disc] = cen[n.disc] || { x: 0, y: 0, n: 0 });
          c.x += n.x; c.y += n.y; c.n++;
        });
        ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = '700 19px ' + ff('--serif'); try { ctx.letterSpacing = '3px'; } catch (e) { }
        ctx.lineJoin = "round";
        for (const d in cen) {
          const c = cen[d], mx = c.x / c.n, my = c.y / c.n;
          // 大陆半径（城到质心最大距离）→ 沿"从世界中心向外"的方向，把名字推到海上
          let rad = 38; nodes.forEach(n => { if (n.frontier || n.disc !== d) return; rad = Math.max(rad, Math.hypot(n.x - mx, n.y - my)); });
          const ox = mx - worldCx, oy = my - cy, ol = Math.hypot(ox, oy) || 1;
          const lx = Math.max(30, Math.min(WW - 30, mx + ox / ol * (rad + 40)));
          const ly = Math.max(20, Math.min(H - 18, my + oy / ol * (rad + 34)));
          ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(DISC[d].name, lx, ly); // 白色光晕托住
          ctx.fillStyle = DISC[d].city; ctx.fillText(DISC[d].name, lx, ly);
        }
        try { ctx.letterSpacing = '0px'; } catch (e) { } ctx.restore();

        // 细分学科名（州）——小号斜体，≥2 座城才标
        const subCen = {}; nodes.forEach(n => {
          if (n.frontier || !n.sub) return; const k = n.disc + '|' + n.sub;
          (subCen[k] = subCen[k] || { x: 0, y: 0, n: 0, nm: n.sub }); subCen[k].x += n.x; subCen[k].y += n.y; subCen[k].n++;
        });
        ctx.save(); ctx.textAlign = "center"; ctx.font = 'italic 500 11.5px ' + ff('--serif'); ctx.fillStyle = 'rgba(20,17,11,.5)';
        for (const k in subCen) { const c = subCen[k]; if (c.n < 2) continue; ctx.fillText('· ' + c.nm + ' ·', c.x / c.n, c.y / c.n + 16); }
        ctx.restore();

        // 只画跨学科航路（同学科已由同一块大陆表达，不再连线，减少杂乱）
        edges.forEach(e => drawRoute(e));
        if (armed) {
          const a = byLabel[armed.a], b = byLabel[armed.b];
          ctx.save(); ctx.setLineDash([4, 6]); ctx.lineDashOffset = -(now() / 40) % 20;
          ctx.strokeStyle = "rgba(230,197,106,.8)"; ctx.lineWidth = 1.6; arc(a, b); ctx.stroke(); ctx.restore();
        }

        // 悬停一座城 → 点亮它连出去的所有航路（含平时不画的同学科连线）
        if (hoverNode) {
          ctx.save(); ctx.setLineDash([5, 5]); ctx.lineDashOffset = -(now() / 45) % 20;
          edges.forEach(e => {
            if (e.a !== hoverNode.id && e.b !== hoverNode.id) return;
            const a = nodeById(e.a), b = nodeById(e.b); if (!a || !b) return;
            const cross = !a.frontier && !b.frontier && a.disc !== b.disc;
            ctx.strokeStyle = cross ? "rgba(150,98,12,.95)" : "rgba(78,80,88,.7)";
            ctx.lineWidth = cross ? 2.2 : 1.6; ctx.shadowColor = cross ? "rgba(150,98,12,.45)" : "rgba(78,80,88,.35)"; ctx.shadowBlur = 6;
            arc(a, b); ctx.stroke();
          });
          ctx.restore();
        }

        nodes.forEach(n => drawCity(n));
        drawBridges();                       // 已安置的桥（实航路）浮在最上层
        ctx.restore();                       // 收起相机位移

        // 可滑动提示：世界比视口宽时，左右两侧淡淡渐隐，暗示还能滑
        if (panable()) {
          if (camX > 2) { const g = ctx.createLinearGradient(0, 0, 34, 0); g.addColorStop(0, 'rgba(110,96,58,.12)'); g.addColorStop(1, 'rgba(110,96,58,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 34, H); }
          if (camX < panMax() - 2) { const g = ctx.createLinearGradient(W - 34, 0, W, 0); g.addColorStop(0, 'rgba(110,96,58,0)'); g.addColorStop(1, 'rgba(110,96,58,.12)'); ctx.fillStyle = g; ctx.fillRect(W - 34, 0, 34, H); }
        }
        if (!stopped) rafId = requestAnimationFrame(loop);
      }
      function arc(a, b) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
        const nx = -dy, ny = dx, len = Math.hypot(nx, ny) || 1, bow = Math.min(44, len * 0.16);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx + nx / len * bow, my + ny / len * bow, b.x, b.y);
      }
      function drawRoute(e) {
        const a = nodeById(e.a), b = nodeById(e.b); if (!a || !b) return;
        const cross = !a.frontier && !b.frontier && a.disc !== b.disc; if (!cross) return; // 同学科不画
        ctx.save(); ctx.strokeStyle = "rgba(170,112,20,.9)"; ctx.lineWidth = 1.7; ctx.setLineDash([5, 4]);
        arc(a, b); ctx.stroke(); ctx.setLineDash([]);
        const age = now() - e.born;
        if (age >= 0 && age < 820 && !REDUCE) {
          const t = age / 820, e2 = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const px = a.x + (b.x - a.x) * e2, py = a.y + (b.y - a.y) * e2;
          ctx.fillStyle = "rgba(214,150,40," + (1 - t) + ")"; ctx.shadowColor = "rgba(170,112,20,.9)"; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 6.28); ctx.fill();
          [a, b].forEach(p => {
            ctx.strokeStyle = "rgba(190,130,32," + (1 - t) * .85 + ")"; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(p.x, p.y, 6 + t * 22, 0, 6.28); ctx.stroke();
          });
        }
        ctx.restore();
      }
      function drawCity(n) {
        const d = DISC[n.disc], hov = hoverNode === n;
        ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        if (n.frontier) {
          ctx.globalAlpha = .6 + .28 * Math.sin(now() / 700 + n.id);
          ctx.strokeStyle = "rgba(180,196,220,.7)"; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = d.city; ctx.beginPath(); ctx.arc(n.x, n.y, 1.6, 0, 6.28); ctx.fill(); ctx.restore(); return;
        }
        // 城标记：暖白外环 + 深芯
        ctx.fillStyle = COASTstr(hov ? 1 : .9); ctx.beginPath(); ctx.arc(n.x, n.y, hov ? 4 : 3.2, 0, 6.28); ctx.fill();
        ctx.fillStyle = LABEL_DARK; ctx.beginPath(); ctx.arc(n.x, n.y, hov ? 2 : 1.6, 0, 6.28); ctx.fill();
        if (hov) { ctx.strokeStyle = COASTstr(.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(n.x, n.y, 8, 0, 6.28); ctx.stroke(); }
        // 城名：全部显示，深色字 + 暖白光晕；字号/浓淡随掌握度
        const fs = (10 + n.mastery * 2.5).toFixed(1);   // 城名(似都道府县名):黑色无衬线、小号刚好
        ctx.font = (n.mastery >= .6 ? '600 ' : '500 ') + fs + 'px ' + ff('--sans');
        ctx.globalAlpha = hov ? 1 : (0.72 + n.mastery * 0.28);
        ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = HALO; ctx.strokeText(n.label, n.x, n.y - 9);
        ctx.fillStyle = hov ? "#000" : LABEL_DARK; ctx.fillText(n.label, n.x, n.y - 9);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      function COASTstr(a) { return "rgba(234,224,200," + a + ")"; }
      function ff(v) { return getComputedStyle(root).getPropertyValue(v); }
      function loop() { if (stopped) return; draw(); }

      // ── 悬停 ──
      const hover = byId("hover");
      cv.addEventListener("mousemove", ev => {
        if (panDrag) return;                       // 拖动平移时不做悬停
        const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
        const wx = mx + camX;                      // 屏幕 → 世界坐标
        let best = null, bd = 1e9;
        nodes.forEach(n => { if (n.frontier) return; const dd = Math.hypot(n.x - wx, n.y - my); if (dd < 16 && dd < bd) { bd = dd; best = n; } });
        hoverNode = best;
        if (best) { hoverBridge = null; showHover(best, mx, my); return; }
        const b = hitBridge(wx, my); hoverBridge = b;
        if (b) showBridgeHover(b, mx, my); else hover.classList.remove("show");
      });
      cv.addEventListener("mouseleave", () => { hoverNode = null; hoverBridge = null; hover.classList.remove("show"); });

      // ── 左右滑动查看不同区域（仅当世界比视口宽时）──
      let panDrag = null, lastPanMoved = false;
      function setCursor() { try { cv.style.cursor = panable() ? (panDrag ? 'grabbing' : 'grab') : 'default'; } catch (e) { } }
      cv.addEventListener("pointerdown", ev => {
        if (!panable()) return;
        panDrag = { sx: ev.clientX, cam0: camX, moved: false };
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { } setCursor();
      });
      cv.addEventListener("pointermove", ev => {
        if (!panDrag) return; const d = ev.clientX - panDrag.sx; if (Math.abs(d) > 2) panDrag.moved = true;
        camX = panDrag.cam0 - d; clampCam();
      });
      function endPan(ev) { if (!panDrag) return; lastPanMoved = panDrag.moved; panDrag = null; try { cv.releasePointerCapture(ev.pointerId); } catch (e) { } setCursor(); }
      cv.addEventListener("pointerup", endPan);
      cv.addEventListener("pointercancel", endPan);
      cv.addEventListener("wheel", ev => {
        if (!panable()) return;
        const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : (ev.shiftKey ? ev.deltaY : 0);
        if (!d) return; ev.preventDefault(); camX += d; clampCam();
      }, { passive: false });
      // 点桥可操作：点笔记桥 → 打开"改两端"面板（点抽卡收件桥暂只看词条=悬停）
      cv.addEventListener("click", ev => {
        if (lastPanMoved) { lastPanMoved = false; return; }
        const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, wx = mx + camX;
        const b = hitBridge(wx, my); if (b) openBridgePanel(b, false);          // 点已安置桥 → 看链接、改两端
      });
      function showHover(n, x, y) {
        const d = DISC[n.disc];
        hover.innerHTML = '<span class="hc-master">' + T('掌握 ') + Math.round(n.mastery * 100) + '%</span><h4>' + n.label + '</h4>' +
          '<div class="hc-disc" style="color:' + d.city + '">● ' + d.name + (n.sub ? ' · ' + n.sub : '') + '</div>' +
          '<div class="bar"><i style="width:' + (n.mastery * 100) + '%;background:' + d.city + '"></i></div>' +
          '<div class="hc-src">' + (n.src || "—") + '</div>';
        hover.style.left = Math.min(x + 14, stage.clientWidth - 222) + "px";
        hover.style.top = Math.max(8, y - 10) + "px"; hover.classList.add("show");
      }

      // ── 待你点亮的连接：预备桥（抽卡/记一笔，跨大陆）+ 概念候选（同疆域相邻概念）合成一栏 ──
      const candBox = byId("candidates");
      function discChip(name) {
        const k = name ? matchDiscByName(name) : null, dot = k ? DISC[k].city : 'rgba(120,122,128,.55)';
        return '<span class="chip" style="--dot:' + dot + '">' + esc(name || '?') + '</span>';
      }
      function renderRail() {
        candBox.innerHTML = "";
        const drafts = getDrafts();
        // ① 预备桥（本质同候选：AI 提两端，你确认/安置）
        drafts.forEach(d => {
          const el = document.createElement("div"); el.className = "cand cross";
          const kinds = (d.links || []).map(l => linkIcon(l.kind)).join('') || '·';
          const nlk = (d.links || []).length;
          const ready = matchDiscByName(d.aName) && matchDiscByName(d.bName);
          const meta = d.classifying ? T('AI 正在判两端…') : (kinds + (nlk ? ' ' + nlk + T(' 链接') : '') + ' · ' + (ready ? T('待你安置') : T('待你指定两端')));
          el.innerHTML = '<div class="cand-pair">' + discChip(d.aName) + '<span class="link">⟷</span>' + discChip(d.bName) + '</div>' +
            '<div class="cand-meta">' + meta + '</div>' +
            '<div class="cand-actions"><button class="btn lite">' + T('安置') + '</button><button class="btn ghost">' + T('移除') + '</button></div>';
          el.querySelector(".lite").onclick = () => openBridgePanel(d, true);
          el.querySelector(".ghost").onclick = () => { const arr = getDrafts(), i = arr.indexOf(d); if (i >= 0) arr.splice(i, 1); renderRail(); };
          candBox.appendChild(el);
        });
        if (!drafts.length) candBox.innerHTML = '<div class="inbox-empty">' + T('这里汇集待你点亮的连接。<br>抽张卡、记一笔「收进疆域」，或点上方「＋ 新建连接」。') + '</div>';
        updateReadout();
      }

      // ── 连接器 ──
      const picker = byId("picker"); let pickState = null;
      function openPicker(c, el) {
        root.querySelectorAll(".cand.armed").forEach(x => x.classList.remove("armed"));
        el.classList.add("armed"); armed = c;
        const A = byLabel[c.a], B = byLabel[c.b], cross = A.disc !== B.disc, preset = cross ? "跨学科跳跃" : c.guess;
        pickState = { c, type: preset };
        picker.innerHTML = '<div class="pk-head">把 <b style="color:' + DISC[byLabel[c.a].disc].city + '">' + c.a + '</b> 连到 <b style="color:' + DISC[byLabel[c.b].disc].city + '">' + c.b + '</b> —— 这是一种什么关系？</div>' +
          '<div class="types">' + TYPES.map(t => '<span class="type' + (t === "跨学科跳跃" ? " leap" : "") + (t === preset ? " sel" : "") +
            '" data-t="' + t + '">' + t + '</span>').join("") + '</div>' +
          '<textarea class="why" rows="2" placeholder="用你自己的话写一句：为什么它们连得上？（可留空）"></textarea>' +
          '<div class="pk-actions"><button class="btn ghost" id="pkCancel">取消</button>' +
          '<button class="btn lite" id="pkGo">点亮这条航路 ◆</button></div>';
        picker.querySelectorAll(".type").forEach(tb => tb.onclick = () => {
          picker.querySelectorAll(".type").forEach(x => x.classList.remove("sel")); tb.classList.add("sel"); pickState.type = tb.dataset.t;
        });
        picker.querySelector("#pkCancel").onclick = () => { el.classList.remove("armed"); armed = null; closePicker(); };
        picker.querySelector("#pkGo").onclick = () => confirmConnect(el);
        picker.classList.add("show");
      }
      function closePicker() { picker.classList.remove("show"); pickState = null; }
      function confirmConnect(el) {
        const { c, type } = pickState, A = byLabel[c.a], B = byLabel[c.b];
        const why = picker.querySelector(".why").value.trim();
        const before = bridgePairs().size;
        // TODO(RPC): 连线目前只改内存;后续 rpc.call('/atlas','connect',{a,b,type,why}) 落库。
        edges.push({ a: A.id, b: B.id, type, why, born: now() });
        A.mastery = Math.min(1, A.mastery + 0.05); B.mastery = Math.min(1, B.mastery + 0.05); // 连线→更懂→疆域涨
        armed = null; closePicker(); el.classList.add("leaving");
        setTimeout(() => { cands = cands.filter(x => x !== c); renderRail(); }, 300);
        rebuild(false);
        const cross = A.disc !== B.disc, after = bridgePairs().size;
        updateReadout(true, cross && after > before);
        if (cross && after > before) {
          toast('◆ 创造性跳跃 · 你在 <b>' + DISC[A.disc].name + '</b> 与 <b>' + DISC[B.disc].name + '</b> 之间架起第一条航路', "", 3600);
          if (!REDUCE) flare((A.x + B.x) / 2, (A.y + B.y) / 2);
        }
        else if (cross) toast('航路已通 —— 又一条跨海连接', "plain", 2000);
        else toast('连上了' + (why ? '：“' + why + '”' : ''), "plain", 2000);
      }
      function bridgePairs() {
        const s = new Set();
        edges.forEach(e => {
          const a = nodeById(e.a), b = nodeById(e.b); if (!a || !b || a.frontier || b.frontier) return;
          if (a.disc !== b.disc) s.add([a.disc, b.disc].sort().join("-"));
        });
        bridges.forEach(b => { if (b.aKey && b.bKey && b.aKey !== b.bKey) s.add([b.aKey, b.bKey].sort().join("-")); });
        return s;
      }

      // ── 学科开辟：名字 → 地图上的一块大陆（新建概念/细分的旧弹窗已并入总览与桥面板）──
      let ucount = 0;
      function esc(s) { return (s || "").replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
      function regKeyByName(name) { for (const k in DISC) { if (k === 'frontier') continue; if (DISC[k].name === name) return k; } return null; }
      function getDiscKey(name) {
        for (const k of order) if (DISC[k].name === name) return { key: k, created: false };  // 已开辟
        let key = regKeyByName(name);                                                        // 总库里登记过 → 复用它的地色
        if (!key) { key = 'u' + (++ucount); const col = newDiscColor(); DISC[key] = { name, city: col.city, land: col.land }; }
        order.push(key); cAng[key] = (order.length) * 2.39996; present.add(key); relayout(); return { key, created: true };
      }

      // ── 读数 / 图例 / toast ──
      const rConn = byId("rConn"), rBridge = byId("rBridge"), rFront = byId("rFront");
      function setStat(el, v, pop) { el.innerHTML = pop ? '<span class="pop">' + v + '</span>' : v; }
      function updateReadout(pc, pb) {
        const nLinks = bridges.reduce((s, b) => s + (b.links ? b.links.length : 0), 0) +
          edges.filter(e => { const a = nodeById(e.a), b = nodeById(e.b); return a && b && !a.frontier && !b.frontier; }).length;
        setStat(rConn, nLinks, pc);
        setStat(rBridge, bridgePairs().size, pb); setStat(rFront, getDrafts().length, false);
      }
      const legend = byId("legend");
      function rgb(a) { return "rgb(" + a[0] + "," + a[1] + "," + a[2] + ")"; }
      function renderLegend() {
        legend.innerHTML = order.map(k => {
          const on = present.has(k);
          return '<div class="lg' + (on ? "" : " off") + '"><i style="background:' + rgb(DISC[k].land) + '"></i>' + DISC[k].name + '</div>';
        }).join("");
      }
      const toastEl = byId("toast"); let toastT = null;
      function toast(html, cls, ms) {
        toastEl.className = "toast" + (cls ? " " + cls : ""); toastEl.innerHTML = html; toastEl.classList.add("show");
        clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), ms || 2400);
      }
      function flare(x, y) {
        const t0 = now(); (function f() {
          if (stopped) return;
          const t = (now() - t0) / 900; if (t >= 1) return;
          ctx.save(); ctx.translate(-camX, 0); ctx.strokeStyle = "rgba(200,140,40," + (1 - t) + ")"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 10 + t * 70, 0, 6.28); ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * 6.28 + t * 2, R = 20 + t * 60; ctx.fillStyle = "rgba(180,120,28," + (1 - t) + ")";
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, 2.2 * (1 - t) + .5, 0, 6.28); ctx.fill();
          }
          ctx.restore(); requestAnimationFrame(f);
        })();
      }

      // ── 桥 / 驿站：抽卡收件、笔记，落到疆域上（小容器，内含很多词条）──
      function short(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; }
      function matchDiscByName(name) { for (const k of order) if (DISC[k] && DISC[k].name === name) return k; return null; }
      function normEntries(b) { return (b.entries || []).map(e => (typeof e === "string" ? e : (e && e.text) || "")).filter(Boolean); }
      let bseq = 0;
      function placeBridge(b) {
        const pts = [];
        if (b.aKey || b.bKey) {                          // 桥：锚在两端的实际中心（1级=大陆中央，2级=子学科中心）
          const ca = b.aKey && endAnchor(b.aKey, b.aSub), cb = b.bKey && endAnchor(b.bKey, b.bSub);
          if (ca) pts.push(ca); if (cb) pts.push(cb);
        } else {
          (b.conceptNames || []).forEach(nm => { const n = byLabel[nm]; if (n && !n.frontier) pts.push({ x: n.x, y: n.y }); });
          const dk = b.discName ? matchDiscByName(b.discName) : null;
          if (!pts.length && dk) { const c = cCenter(dk); if (c) pts.push(c); }
        }
        b.anchorPts = pts;
        let bx, by;
        if (pts.length === 2) {                           // 落在弓形航路的中点上
          const a = pts[0], c = pts[1], mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
          const dx = c.x - a.x, dy = c.y - a.y, nx = -dy, ny = dx, len = Math.hypot(nx, ny) || 1, bow = Math.min(44, len * 0.16);
          bx = mx + nx / len * bow * 0.5; by = my + ny / len * bow * 0.5;
        } else if (pts.length) {
          let sx = 0, sy = 0; pts.forEach(p => { sx += p.x; sy += p.y; }); bx = sx / pts.length; by = sy / pts.length;
          const ox = bx - worldCx, oy = by - cy, ol = Math.hypot(ox, oy) || 1; // 往外推一点，落到城郊/近海
          bx += ox / ol * 42; by += oy / ol * 42;
        } else {
          const a = (b.id % 360) * Math.PI / 180, R = Math.min(W, H) * 0.34; // 无锚：漂在开阔海域（据 id 稳定散布）
          bx = worldCx + Math.cos(a) * R * 1.3; by = cy + Math.sin(a) * Math.min(Ry * 1.1, R);
        }
        b.x = Math.max(24, Math.min(WW - 24, bx)); b.y = Math.max(24, Math.min(H - 24, by));
      }
      // 桥 = 两块大陆之间的一条连线；链接(link) = 让它们连起来的一条条信息(卡/笔记/手动)。
      // 一座桥可承载多条链接(菱形里的数字=链接数)；同两端的卡/笔记并进同一座桥。
      function sameEnds(b, ka, kb) { return (b.aKey === ka && b.bKey === kb) || (b.aKey === kb && b.bKey === ka); }
      function findPlaced(ka, kb, except) { return bridges.find(b => b !== except && sameEnds(b, ka, kb)); }
      function linkIcon(kind) { return kind === 'card' ? '🎲' : kind === 'note' ? '✍' : '·'; }
      function newLink(kind, text, ref) { return { id: 'l' + (++bseq), kind: kind || 'manual', text: text || '', ref: ref || null }; }
      function ingestBridge(raw) {          // 恢复：后端已安置的桥（addNote 落库），按两端并成一座、收集链接
        if (!raw.discA || !raw.discB) return null;
        // 端点学科还没在图上 → 自动开辟（getDiscKey 复用总库地色；created 时落一座首府）
        const ga = getDiscKey(raw.discA); if (ga.created) { const cap = N(raw.discA, ga.key, 0.42, T('恢复疆域')); placeNear(cap); }
        const gb = getDiscKey(raw.discB); if (gb.created) { const cap = N(raw.discB, gb.key, 0.42, T('恢复疆域')); placeNear(cap); }
        if (ga.created || gb.created) { settle(120); rebuild(false); renderLegend(); }
        const ka = ga.key, kb = gb.key;
        const e0 = (raw.entries && raw.entries[0]) || {};
        const txt = (typeof e0 === 'string' ? e0 : e0.text) || raw.text || '';
        const link = newLink(e0.kind || raw.origin || 'note', txt, e0.ref || raw.ref || null); link._saved = true;
        let b = findPlaced(ka, kb);
        if (b) { if (txt && !b.links.some(l => l.text === txt)) b.links.push(link); return b; }
        b = { id: ++bseq, status: 'placed', discA: DISC[ka].name, discB: DISC[kb].name, aKey: ka, bKey: kb, aSub: raw.subA || '', bSub: raw.subB || '', links: txt ? [link] : [] };
        placeBridge(b); bridges.push(b); return b;
      }
      function hitBridge(wx, wy) { let best = null, bd = 1e9; bridges.forEach(b => { const dd = Math.hypot(b.x - wx, b.y - wy); if (dd < 13 && dd < bd) { bd = dd; best = b; } }); return best; }
      function drawBridges() {
        bridges.forEach(b => {
          const pts = b.anchorPts || [];
          if (pts.length === 2) {                           // 已安置桥 = 一条连起两块大陆的实航路
            ctx.save(); ctx.strokeStyle = hoverBridge === b ? "rgba(150,102,20,.98)" : "rgba(150,102,20,.82)";
            ctx.lineWidth = hoverBridge === b ? 2.6 : 1.9; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -(now() / 60) % 20;
            arc(pts[0], pts[1]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
          }
          const hov = hoverBridge === b, s = hov ? 8 : 6.5;  // 菱形 + 链接数（点它看链接、改两端）
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = "rgba(255,255,255,.96)"; ctx.strokeStyle = "rgba(150,102,20,.98)"; ctx.lineWidth = hov ? 2.2 : 1.7;
          ctx.beginPath(); ctx.rect(-s, -s, s * 2, s * 2); ctx.fill(); ctx.stroke(); ctx.rotate(-Math.PI / 4);
          ctx.fillStyle = "rgba(120,82,14,1)"; ctx.font = '700 11px monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(b.links.length || 0), 0, 0.5); ctx.restore();
        });
      }
      function showBridgeHover(b, x, y) {
        const list = b.links.slice(-4).map(l => '<div style="font-size:11px;opacity:.82;margin-top:3px;line-height:1.4">' + linkIcon(l.kind) + ' ' + esc(short(l.text, 36)) + '</div>').join("") || '<div style="font-size:11px;opacity:.55;margin-top:3px">' + T('（还没有链接）') + '</div>';
        hover.innerHTML = '<span class="hc-master">' + (b.links.length || 0) + T(' 条链接') + '</span><h4>' + esc(b.discA || '?') + ' ⟷ ' + esc(b.discB || '?') + '</h4>' +
          '<div class="hc-disc" style="color:rgba(150,102,20,1)">' + T('◈ 桥') + '</div>' + list +
          '<div style="font-size:10.5px;opacity:.5;margin-top:5px">' + T('点开：看链接、改两端') + '</div>';
        hover.style.left = Math.min(x + 14, stage.clientWidth - 222) + "px";
        hover.style.top = Math.max(8, y - 10) + "px"; hover.classList.add("show");
      }

      // ── 预备桥（draft，左栏）：每条自带 links[]（抽卡=一句钩子；记一笔=笔记+回链）──
      // 存 window（跨地图开/关存活；整页刷新才清）。每条：{id,links:[{id,kind,text,ref}],aName,bName,classifying,why}
      function getDrafts() { try { return (window.__atlasDrafts__ = window.__atlasDrafts__ || []); } catch (e) { return []; } }
      function draftText(d) { return (d.links || []).map(l => l.text).filter(Boolean).join(' / '); }
      function draftTitle(d) { const t = d.links && d.links[0] && d.links[0].text; return t ? short(t, 14) : T('手动连接'); }
      function addDraft(d) {
        const drafts = getDrafts(), id = 'd' + (++bseq);
        const draft = { id, links: d.links || [], aName: d.aName || '', bName: d.bName || '', why: '', classifying: false };
        drafts.push(draft); renderRail();
        if (rpcCall && draftText(draft) && !(draft.aName && draft.bName)) { draft.classifying = true; renderRail(); classifyDraft(draft); }
        toast(d.empty ? T('空的<b>预备连接</b>已加到左栏 —— 点它选两端') : T('已加到左栏<b>预备桥</b> —— 点它，选两端安置'), 'plain', 2600);
        return draft;
      }
      function classifyDraft(draft) {                        // AI 先判两端（不确定就留空，等你手点）
        Promise.resolve(rpcCall('/atlas', 'classifyNote', { text: draftText(draft), disciplines: discChoices().map(it => it.name) }))
          .then(r => { const g = r && r.ok && r.value && r.value.guess; draft.classifying = false; if (g) { draft.aName = g.a || ''; draft.bName = g.b || ''; draft.why = g.why || ''; } renderRail(); syncPanel(); })
          .catch(() => { draft.classifying = false; renderRail(); syncPanel(); });
      }
      // 学科增加 → 世界变宽：重算世界、重建海陆栅格、重排桥
      function relayout() { discLayout(); off.width = GW; GH = Math.round(H * SC); off.height = GH; clampCam(); buildWarp(); bridges.forEach(placeBridge); setCursor(); }
      // 开辟的城(首府/州)落库——疆域重启后由 loadTerritory 恢复;后端 addConcept 幂等,重复开辟不重复落
      function persistCity(label, discName, sub) {
        if (!rpcCall) return;
        try { rpcCall('/atlas', 'addConcept', { label, disc: discName, sub: sub || '', ts: Date.now() }); } catch (e) { }
      }
      function loadTerritory() {                             // 启动:从后端(~/.dsh/atlas/territory.json)恢复疆域
        if (!rpcCall) return;
        Promise.resolve(rpcCall('/atlas', 'getMap', {})).then(r => {
          if (!(r && r.ok && r.value)) return;
          const v = r.value, keyName = {};
          (v.disciplines || []).forEach(d => { keyName[d.key] = d.name; });
          let touched = false;
          (v.nodes || []).forEach(nd => {                    // 先恢复城(开辟过的大陆/州随之恢复)
            const dn = keyName[nd.disc] || nd.disc; if (!dn || !nd.label) return;
            const gk = getDiscKey(dn), sub = nd.sub || '';
            if (!nodes.some(x => !x.frontier && x.disc === gk.key && x.label === nd.label && (x.sub || '') === sub)) {
              const c = N(nd.label, gk.key, typeof nd.mastery === 'number' ? nd.mastery : 0.45, nd.src || T('恢复疆域')); c.sub = sub; placeNear(c); touched = true;
            }
          });
          (v.bridges || []).forEach(b => { if (b.discA && b.discB) { ingestBridge(b); touched = true; } });
          if (touched) { settle(180); rebuild(false); bridges.forEach(placeBridge); renderLegend(); renderOverview(); updateReadout(); }
        }).catch(() => { });
      }
      // 抽卡 / 记一笔 交接：都作为"预备桥"落到左栏。经 window 队列，地图刚开也不丢。
      function drainStage() {
        let q; try { q = window.__atlasDraftQueue__; } catch (e) { q = null; }
        if (!q || !q.length) return;
        while (q.length) { const it = q.shift() || {}; addDraft({ links: [newLink(it.origin === 'card' ? 'card' : 'note', it.text || '', it.ref || null)] }); }
      }

      function discChoices() {                                // 已开辟的大陆 + 总库里未开辟的学科（都可当端点）
        const items = [], seen = new Set();
        order.forEach(k => { seen.add(DISC[k].name); items.push({ key: k, name: DISC[k].name }); });
        DISC_LIB.forEach(row => { const nm = row[0]; if (seen.has(nm)) return; seen.add(nm); items.push({ key: '__new', name: nm }); });
        return items;
      }
      function libSubs(name) { const row = DISC_LIB.find(r => r[0] === name); return row ? row[1] : []; }

      // ── 学科总览（弹窗）：左栏只留"查看"入口。面板 = 学科总库（1 级色块 + 2 级学科）+ 新建学科。
      //    与跨学科抽卡共享同一套学科结构（DISC_LIB）；未开辟的淡显，点一下即开辟成大陆。
      const ovModal = document.createElement('div'); ovModal.className = 'ov-modal';
      ovModal.innerHTML = '<div class="ov-card"><div class="rl-row" style="margin-bottom:6px"><h3>' + T('学科总览') + '</h3><button class="mini" id="ovClose">' + T('关闭') + '</button></div>' +
        '<div class="ov-sub-h">' + T('一级学科（大陆）· 二级学科（州）。点淡显的大陆/带＋的州开辟到地图；「＋ 开辟州」可自建二级学科。') + '</div>' +
        '<div class="ov-new"><input class="chipin" id="ovNew" placeholder="' + T('＋ 新建学科，回车开辟一块新大陆') + '"><button class="mini" id="ovNewGo">' + T('开辟') + '</button></div>' +
        '<div id="overview" class="overview"></div></div>';
      stage.appendChild(ovModal);
      ovModal.addEventListener('click', e => { if (e.target === ovModal) closeOverview(); });   // 点背景关闭
      ovModal.querySelector('#ovClose').onclick = () => closeOverview();
      let ovSubFor = null;                                         // 哪张学科卡正展开"自建州"输入
      function openOverview() { ovSubFor = null; renderOverview(); ovModal.classList.add('show'); }
      function closeOverview() { ovSubFor = null; ovModal.classList.remove('show'); }
      // 总览内所有点击走一个委托监听（不随重渲染丢绑定）：＋开辟州按钮 / 州chip / 大陆卡
      ovModal.querySelector('#overview').addEventListener('click', e => {
        const t = e.target;
        if (t.closest('.ov-newsub')) {                             // ＋开辟州 行（按钮或输入框）：不触发大陆点击
          const btn = t.closest('.ov-addsub');
          if (btn) { ovSubFor = btn.dataset.add; renderOverview(); }
          return;
        }
        const sub = t.closest('.ov-subs span');                    // 点州 → 开辟到父大陆里
        if (sub) { foundSub(sub.dataset.d, sub.dataset.s); return; }
        const item = t.closest('.ov-item');
        if (item) {
          const nm = item.dataset.nm, k = matchDiscByName(nm);
          if (k) {                                                 // 已开辟 → 关总览、相机滑到那块大陆
            closeOverview(); const c = discCentroid(k);
            if (panable()) { camX = c.x - W / 2; clampCam(); }
          } else foundDisc(nm);                                    // 未开辟 → 点它落成大陆
        }
      });
      function foundDisc(nm) {                                     // 开辟一块大陆（总库/自建通用）
        const gk = getDiscKey(nm);
        if (gk.created) { const cap = N(nm, gk.key, 0.42, T('新建学科')); placeNear(cap); settle(80); persistCity(nm, nm, ''); }
        rebuild(false); renderLegend(); renderOverview(); updateReadout();
        toast(gk.created ? TF('开辟了「{0}」大陆', esc(nm)) : TF('「{0}」已在图上', esc(nm)), 'plain', 2400);
        return gk;
      }
      function subOpened(k, s) { return nodes.some(n => !n.frontier && n.disc === k && n.sub === s); }
      function foundSub(dn, sn) {                                  // 开辟一片"州"（二级学科；父大陆没开就先开）
        const gk = getDiscKey(dn);
        if (gk.created) { const cap = N(dn, gk.key, 0.42, T('新建学科')); placeNear(cap); persistCity(dn, dn, ''); }
        if (subOpened(gk.key, sn)) { toast(TF('「{0}」已在图上', esc(sn)), 'plain', 2000); return; }
        const c = N(sn, gk.key, 0.4, T('开辟二级学科')); c.sub = sn; placeNear(c); persistCity(sn, dn, sn);
        settle(120); rebuild(false); renderLegend(); renderOverview(); updateReadout();
        toast(TF('在「{0}」开辟了「{1}」州', esc(dn), esc(sn)), 'plain', 2400);
      }
      function renderOverview() {
        const ov = byId('overview'); if (!ov) return;
        // 总库 1 级学科 + 用户自建（order 里名字不在总库的）
        const names = DISC_LIB.map(r => r[0]);
        order.forEach(k => { if (!names.includes(DISC[k].name)) names.push(DISC[k].name); });
        ov.innerHTML = names.map(nm => {
          const k = regKeyByName(nm), d = k ? DISC[k] : null, opened = k && order.includes(k);
          const land = d ? d.land : [180, 184, 190];
          const dark = (land[0] * 299 + land[1] * 587 + land[2] * 114) / 1000 > 150;
          const ink = dark ? '#151515' : '#fff';
          const mk = k && matchDiscByName(nm);
          const subs = [...new Set([...libSubs(nm), ...(mk ? subsOf(mk) : [])])];
          const newsub = ovSubFor === nm
            ? '<div class="ov-newsub"><input class="chipin" id="ovSubNew" data-d="' + esc(nm) + '" placeholder="' + T('二级学科名，回车开辟（Esc 取消）') + '"></div>'
            : '<div class="ov-newsub"><button class="ov-addsub" data-add="' + esc(nm) + '">' + T('＋ 开辟州') + '</button></div>';
          return '<div class="ov-item' + (opened ? '' : ' ov-off') + '" data-nm="' + esc(nm) + '" style="background:' + rgb(land) + ';color:' + ink + '">' +
            '<div class="ov-name">' + esc(nm) + (opened ? '' : '<span class="ov-tag">' + T('未开辟') + '</span>') + '</div>' +
            (subs.length ? '<div class="ov-subs">' + subs.map(s => {
              const on = mk && subOpened(mk, s);                   // 二级学科也可点开辟：未开的带＋，已开的亮显
              return '<span class="' + (on ? 'on' : '') + '" data-d="' + esc(nm) + '" data-s="' + esc(s) + '" title="' + (on ? T('已在图上') : T('点击开辟这片州')) + '">' + (on ? '' : '＋ ') + esc(s) + '</span>';
            }).join('') + '</div>' : '') +
            newsub + '</div>';
        }).join('');
        const si = ov.querySelector('#ovSubNew');                  // 自建州输入：回车开辟、Esc 收起
        if (si) {
          si.focus();
          si.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); const v = si.value.trim(); if (v) { ovSubFor = null; foundSub(si.dataset.d, v); } }
            else if (e.key === 'Escape') { ovSubFor = null; renderOverview(); }
          };
        }
      }

      // ── 桥面板（bpanel）：一处看链接 + 改两端；点选两端即安置。替代原"安置"弹窗 ──
      const bpanel = document.createElement('div'); bpanel.className = 'picker bpanel'; stage.appendChild(bpanel);
      let bp = null;   // { target, isDraft, editEnd:null|'a'|'b', openLink:null }
      function syncPanel() { if (bp) renderPanel(); }
      function endKey(slot) {
        if (bp.isDraft) return matchDiscByName(slot === 'a' ? bp.target.aName : bp.target.bName);
        return slot === 'a' ? bp.target.aKey : bp.target.bKey;
      }
      function endName(slot) {
        if (bp.isDraft) return (slot === 'a' ? bp.target.aName : bp.target.bName) || '';
        const k = slot === 'a' ? bp.target.aKey : bp.target.bKey; return k && DISC[k] ? DISC[k].name : '';
      }
      function openBridgePanel(target, isDraft) { bp = { target, isDraft: !!isDraft, editEnd: null, openLink: null }; renderPanel(); }
      function closePanel() { bpanel.classList.remove('show'); bp = null; }
      function endSub(slot) { return (slot === 'a' ? bp.target.aSub : bp.target.bSub) || ''; }
      function endChip(slot) {
        const nm = endName(slot), sub = endSub(slot), k = endKey(slot), dot = k ? DISC[k].city : 'rgba(120,122,128,.55)';
        const label = nm ? esc(nm) + (sub ? '·' + esc(sub) : '') : T('选一端');
        return '<span class="endchip' + (bp.editEnd === slot ? ' open' : '') + '" data-end="' + slot + '" style="--dot:' + dot + '">' +
          '<i class="ec-dot" style="background:' + dot + '"></i>' + label + ' ▾</span>';
      }
      // (endChip 的 label 用 T('选一端') 兜底,见下)
      function chooserHTML(slot) {
        // 两步选端：① 选 1 级学科（大陆）② 可选细到 2 级学科（州）。2 级来自总库 ∪ 图上实有。
        const cur = endName(slot), curSub = endSub(slot);
        let inner = '';
        discChoices().forEach(it => {
          inner += '<span class="type discChip' + (cur === it.name ? ' sel' : '') + '" data-pick="' + esc(it.name) + '">' + esc(it.name) + '</span>';
        });
        let html = '<div class="endchooser">' + inner + '<input class="chipin" id="endnew" placeholder="' + T('＋新学科，回车') + '"></div>';
        if (cur) {
          const k = matchDiscByName(cur);
          const subs = [...new Set([...libSubs(cur), ...(k ? subsOf(k) : [])])];
          if (subs.length) {
            html += '<div class="endchooser"><span class="pk-sub" style="margin:0;flex-basis:100%">' + T('细到 2 级学科（可选，连接点会落到那片州）') + '</span>' +
              '<span class="type subChip' + (!curSub ? ' sel' : '') + '" data-pick="' + esc(cur) + '" data-sub="">' + esc(cur) + T('·大陆中央') + '</span>' +
              subs.map(s => '<span class="type subChip' + (curSub === s ? ' sel' : '') + '" data-pick="' + esc(cur) + '" data-sub="' + esc(s) + '">' + esc(s) + '</span>').join('') + '</div>';
          }
        }
        return html;
      }
      function renderPanel() {
        if (!bp) return;
        const t = bp.target, links = t.links || [], n = links.length;
        let html = '<div class="pk-head">' + T('桥 · ') + n + T(' 条链接') + (bp.isDraft ? ' <span style="opacity:.6">' + T('· 预备，选好两端即安置') + '</span>' : '') + '</div>';
        html += '<div class="bp-ends">' + endChip('a') + '<span class="bp-arrow">⟷</span>' + endChip('b') + '</div>';
        if (bp.editEnd) html += chooserHTML(bp.editEnd);
        html += '<div class="pk-sub">' + T('链接') + '　<span style="opacity:.6">' + T('让这两块连起来的那些话') + '</span></div><div class="bp-links">';
        if (!n) html += '<div class="bp-empty">' + T('还没有链接。加一句"为什么连"，或从抽卡/记一笔收进来。') + '</div>';
        links.forEach(l => {
          const open = bp.openLink === l.id;
          html += '<div class="bp-link' + (open ? ' open' : '') + '" data-link="' + l.id + '">' +
            '<div class="bp-lrow">' + linkIcon(l.kind) + '<span class="bp-ltext">' + esc(short(l.text || T('（空）'), 30)) + '</span><span class="bp-lx" data-del="' + l.id + '">×</span></div>' +
            (open ? '<div class="bp-ldetail">' + esc(l.text || T('（空）')) + (l.kind === 'note' ? '<button class="bp-back" data-back="' + l.id + '">' + T('↩ 回到记一笔') + '</button>' : '') + '</div>' : '') +
            '</div>';
        });
        html += '</div><div class="bp-add"><input class="chipin" id="bpAdd" placeholder="' + T('＋手动加一句：为什么连？') + '"><button class="mini" id="bpAddGo">' + T('加') + '</button></div>';
        html += '<div class="pk-actions"><button class="btn ghost" id="bpDel">' + T('删除桥') + '</button><button class="btn ghost" id="bpClose">' + T('关闭') + '</button></div>';
        bpanel.innerHTML = html;
        bpanel.querySelectorAll('.endchip').forEach(el => el.onclick = () => { bp.editEnd = bp.editEnd === el.dataset.end ? null : el.dataset.end; renderPanel(); });
        bpanel.querySelectorAll('.endchooser .type').forEach(el => el.onclick = () =>
          pickEnd(bp.editEnd, el.dataset.pick, el.dataset.sub || '', el.classList.contains('discChip'))); // 选大陆→留着挑州；选州→收起
        const en = byId('endnew'); if (en) en.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = en.value.trim(); if (v) pickEnd(bp.editEnd, v, '', true); } };
        bpanel.querySelectorAll('.bp-link').forEach(el => el.querySelector('.bp-lrow').onclick = (e) => { if (e.target.dataset.del) return; bp.openLink = bp.openLink === el.dataset.link ? null : el.dataset.link; renderPanel(); });
        bpanel.querySelectorAll('.bp-lx').forEach(el => el.onclick = () => {
          const gone = t.links.find(l => l.id === el.dataset.del);
          t.links = t.links.filter(l => l.id !== el.dataset.del);
          // 已落库的链接同步从后端删(按 学科对+原文;草稿链接没落过库不用删)
          if (gone && gone._saved && !bp.isDraft && rpcCall) { try { rpcCall('/atlas', 'removeLink', { discA: t.discA, discB: t.discB, text: gone.text }); } catch (e) { } }
          commitAfterEdit(); renderPanel();
        });
        bpanel.querySelectorAll('.bp-back').forEach(el => el.onclick = () => backToJiyibi(t.links.find(l => l.id === el.dataset.back)));
        const ag = byId('bpAddGo'); if (ag) ag.onclick = () => { const inp = byId('bpAdd'), v = inp && inp.value.trim(); if (v) { t.links.push(newLink('manual', v)); commitAfterEdit(); renderPanel(); } };
        byId('bpDel').onclick = deleteBridge; byId('bpClose').onclick = closePanel;
        bpanel.classList.add('show');
      }
      function pickEnd(slot, name, sub, keepOpen) {
        sub = sub || '';
        const gk = getDiscKey(name);
        if (gk.created) { const cap = N(name, gk.key, 0.4, T('桥端新辟')); placeNear(cap); persistCity(name, name, ''); }
        if (sub && !subOpened(gk.key, sub)) { const c = N(sub, gk.key, 0.4, T('桥端新辟')); c.sub = sub; placeNear(c); persistCity(sub, name, sub); } // 选到州 → 州也开辟(随城落库)
        if (gk.created || sub) settle(80);
        if (bp.isDraft) {
          if (slot === 'a') { bp.target.aName = DISC[gk.key].name; bp.target.aSub = sub; }
          else { bp.target.bName = DISC[gk.key].name; bp.target.bSub = sub; }
        } else {
          if (slot === 'a') { bp.target.aKey = gk.key; bp.target.discA = DISC[gk.key].name; bp.target.aSub = sub; }
          else { bp.target.bKey = gk.key; bp.target.discB = DISC[gk.key].name; bp.target.bSub = sub; }
          placeBridge(bp.target); persistNew(bp.target);
        }
        bp.editEnd = keepOpen ? slot : null; tryCommit();
        rebuild(false); renderRail(); renderOverview(); renderLegend(); renderPanel();
      }
      function tryCommit() {   // 两端齐 → 安置/并入；草稿转为已安置桥
        const ka = endKey('a'), kb = endKey('b'); if (!ka || !kb || ka === kb) return;
        if (bp.isDraft) {
          const arr = getDrafts(), i = arr.indexOf(bp.target); if (i >= 0) arr.splice(i, 1);
          const b = commitBridge(bp.target.links, ka, kb, null, bp.target.aSub, bp.target.bSub);
          bp.target = b; bp.isDraft = false;
          if (!REDUCE) flare(b.x, b.y); if (panable()) { camX = b.x - W / 2; clampCam(); }
          toast(T('桥已安置 —— ') + '<b>' + esc(DISC[ka].name) + '</b> ⟷ <b>' + esc(DISC[kb].name) + '</b>', '', 2600);
        }
      }
      function commitBridge(links, ka, kb, except, aSub, bSub) {          // 同两端已有桥 → 并链接；否则新建
        const target = findPlaced(ka, kb, except);
        if (target) { (links || []).forEach(l => { if (!target.links.some(x => x.text === l.text)) target.links.push(l); }); persistNew(target); return target; }
        const b = { id: ++bseq, status: 'placed', discA: DISC[ka].name, discB: DISC[kb].name, aKey: ka, bKey: kb, aSub: aSub || '', bSub: bSub || '', links: links || [] };
        placeBridge(b); bridges.push(b); persistNew(b); renderLegend(); updateReadout(); return b;
      }
      function persistNew(b) {                                // 未存过的链接落库（loadBridges 会按两端再并成一座）
        if (!rpcCall) return;
        (b.links || []).forEach(l => { if (l._saved) return; l._saved = true; try { rpcCall('/atlas', 'addNote', { text: l.text, title: draftTitle(b), discA: b.discA, discB: b.discB, subA: b.aSub || '', subB: b.bSub || '', origin: l.kind === 'card' ? 'card' : 'note', kind: l.kind, ref: l.ref || null, ts: Date.now() }); } catch (e) { } });
      }
      function commitAfterEdit() {   // 链接增删后
        if (!bp) return;
        if (bp.isDraft) { renderRail(); return; }
        persistNew(bp.target); rebuild(false);
      }
      function deleteBridge() {
        const t = bp.target;
        if (bp.isDraft) { const arr = getDrafts(), i = arr.indexOf(t); if (i >= 0) arr.splice(i, 1); renderRail(); }
        else {
          bridges = bridges.filter(x => x !== t); rebuild(false); renderLegend(); updateReadout();
          // 后端同步删(桥按"同两端并成一座"存取,故按学科对删)
          if (t.discA && t.discB && rpcCall) { try { rpcCall('/atlas', 'removeBridgePair', { discA: t.discA, discB: t.discB }); } catch (e) { } }
        }
        closePanel();
      }
      function backToJiyibi(link) {
        closePanel();
        try { window.dispatchEvent(new CustomEvent('pace-popup:atlas:request-close')); } catch (e) { }   // 关地图
        try { window.dispatchEvent(new CustomEvent('pace-popup:jiyibi:open', { detail: (link && link.ref) || null })); } catch (e) { } // 开记一笔
      }

      // ── 启动 ──
      byId("ovOpen").onclick = openOverview;                       // 查看学科总览（弹窗，内含新建学科）
      const ovNew = ovModal.querySelector('#ovNew');
      function ovNewGo() { const nm = (ovNew.value || '').trim(); if (!nm) { ovNew.focus(); return; } ovNew.value = ''; foundDisc(nm); }
      ovModal.querySelector('#ovNewGo').onclick = ovNewGo;
      ovNew.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ovNewGo(); } };
      byId("newLink").onclick = () => openBridgePanel(addDraft({ links: [], empty: true }), true);  // 新建连接（空预备桥，直接开面板选两端）
      seed(); resize();
      nodes.forEach(n => {
        if (n.frontier) {
          const a = Math.random() * 6.28, R = Math.min(W, H) * 0.44 + Math.random() * 40;
          n.x = worldCx + Math.cos(a) * R; n.y = cy + Math.sin(a) * Math.min(R, H * 0.42);
        } else placeNear(n);
      });
      settle(260); rebuild(false); renderLegend(); renderOverview(); updateReadout(); setCursor();
      loadTerritory();                                           // 恢复落盘的疆域(城 + 桥)
      renderRail();                                              // 概念候选 + 恢复上次没安置完的预备桥（window 存活）
      window.addEventListener('pace-popup:atlas:stage', drainStage); // 抽卡/记一笔交接 → 落成预备桥
      drainStage();                                             // 地图刚打开、队列里已有 → 立即接住
      let rT = null;
      function onWinResize() {
        clearTimeout(rT); rT = setTimeout(() => {
          const oWc = worldCx, oy = cy; resize();
          nodes.forEach(n => { n.x += worldCx - oWc; n.y += cy - oy; }); settle(60); rebuild(false);
          bridges.forEach(placeBridge); clampCam(); setCursor();
        }, 150);
      }
      window.addEventListener("resize", onWinResize);
      try { ro = new ResizeObserver(function () { onWinResize(); }); ro.observe(stage); } catch (e) { ro = null; }
      rafId = requestAnimationFrame(loop);

      // 卸载清理：停帧、拆监听、清定时器(重复挂载安全)。
      return function cleanup() {
        stopped = true;
        if (rafId) { try { cancelAnimationFrame(rafId); } catch (e) { } }
        clearTimeout(rT); clearTimeout(toastT);
        window.removeEventListener("resize", onWinResize);
        window.removeEventListener('pace-popup:atlas:stage', drainStage);
        if (ro) { try { ro.disconnect(); } catch (e) { } }
      };
    }

    // ════════════════ React 挂载:容器 div + innerHTML + effect 内跑 vanilla 脚本 ════════════════
    function AtlasMap() {
      var ref = React.useRef(null);
      React.useEffect(function () {
        injectStyle();
        var host = ref.current;
        if (!host) return;
        host.innerHTML = bodyHtml();              // 原型 body 结构一次性写入(带当前语言)
        var cleanup = runAtlas(host);             // 脚本在此容器作用域内运行
        return function () {
          try { if (typeof cleanup === 'function') cleanup(); } catch (e) { }
          try { host.innerHTML = ''; } catch (e) { }
        };
      }, []);
      // 容器铺满其父(全屏面板);脚本用 innerHTML 接管其内部,故这里不给 children。
      return h('div', { ref: ref, className: 'dsh-atlas-root', style: { width: '100%', height: '100%' } });
    }

    // ════════════════ shell.overlay 启动器:平时一枚可忽略浮钮,点开铺满全屏 ════════════════
    var overlayWrap = { position: 'fixed', inset: 0, zIndex: 2147482600, pointerEvents: 'none' };
    var fab = {
      position: 'absolute', right: '16px', bottom: '16px', pointerEvents: 'auto',
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 13px', borderRadius: '999px',
      background: '#102436', color: '#ECE4D2', border: '1px solid #25415a', boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
      cursor: 'pointer', font: '13px/1 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",system-ui,sans-serif',
      whiteSpace: 'nowrap', userSelect: 'none', opacity: 0.9,
    };
    var fullPanel = { position: 'absolute', inset: 0, pointerEvents: 'auto', background: '#ffffff', overflow: 'hidden' };
    var closeBtn = {
      position: 'absolute', top: '11px', right: '14px', zIndex: 20, width: '30px', height: '30px',
      borderRadius: '999px', background: 'rgba(255,255,255,.96)', color: '#18181a', border: '1px solid rgba(0,0,0,.16)',
      cursor: 'pointer', fontSize: '17px', lineHeight: '28px', textAlign: 'center', padding: 0, pointerEvents: 'auto',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    };

    function AtlasLauncher(props) {
      // shell.overlay 是 app 级、无会话上下文;槽注入全局 useSessions(切会话自动重渲染)。地图暂用 mock,
      // 故 sessionId 现在只取用不消费,留待接 RPC 时按当前会话拉图。
      var useSessions = props.useSessions;
      var sessionId = (typeof useSessions === 'function') ? useSessions(function (s) { return s && s.current; }) : null;
      void sessionId;

      var os = React.useState(false); var open = os[0], setOpen = os[1];
      // 启动权收归节奏台:不再自带浮钮,改为监听 hub 置顶入口派发的全局事件来打开。
      React.useEffect(function () {
        function onOpen() { setOpen(true); }
        function onClose() { setOpen(false); try { window.dispatchEvent(new CustomEvent('pace-popup:atlas:closed')); } catch (e) { } } // 桥「↩回到记一笔」请求关地图
        window.addEventListener('pace-popup:atlas:open', onOpen);
        window.addEventListener('pace-popup:atlas:request-close', onClose);
        return function () { window.removeEventListener('pace-popup:atlas:open', onOpen); window.removeEventListener('pace-popup:atlas:request-close', onClose); };
      }, []);
      if (!open) return null;
      return h('div', { style: overlayWrap }, [
        h('div', { key: 'panel', style: fullPanel }, [
          h('button', {
          key: 'x', style: closeBtn, title: T('退出知识疆域'), onClick: function () {
            setOpen(false);
            try { window.dispatchEvent(new CustomEvent('pace-popup:atlas:closed')); } catch (e) { } // 通知浮窗恢复
          },
        }, '×'),
          h(AtlasMap, { key: 'map' }),
        ]),
      ]);
    }

    // ——弹窗总开关——与系列一致(缺省开,只有显式 '0' 才关);pace-hub 浮窗据此开关本启动器。
    var PACE_KEY = 'pace-popup:enabled:atlas';
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
    function AtlasGate(props) { return useEnabled() ? h(AtlasLauncher, props) : null; }

    exports.inject = ['slots', 'connection'];
    exports.apply = function (ctx) {
      // TODO(RPC): 接线后用这个闭包把 runAtlas 里的内存 mock 换成后端图数据,例如
      //   rpcCall('/atlas','getMap',{sessionId}) / 'compileSession' / 'connect' / 'createConcept'。
      rpcCall = function (channel, endpoint, payload) { return ctx.connection.rpc.call(channel, endpoint, payload || {}); };
      void rpcCall;
      // 双语:运行时取 dsh 全局 locale 服务(ctx.get 不需 inject,缺席=恒中文)。
      getLoc = function () { try { return ctx.get ? ctx.get('locale') : null; } catch (e) { return null; } };
      // 只有 shell.overlay 槽存在时才挂(headless/无此槽的装配天然跳过)。
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'atlas', order: 12 }, AtlasGate);
      });
    };
    return module.exports;
  },
});
