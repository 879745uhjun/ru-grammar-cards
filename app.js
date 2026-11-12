/* ==================================================================
   俄语语法卡 · 应用逻辑
   结构：书 → 课（12）→ 语法点（24）→ 卡片
   纯前端、无依赖；数据来自 data/book.js + data/uNN.js + data/lessons.js
================================================================== */
(function () {
  'use strict';

  var BOOK = window.GRAMMAR_BOOK || { meta: {}, units: [] };
  var UNITS = (BOOK.units || []).filter(function (u) { return u && u.cards && u.cards.length; });
  var BY_ID = {};
  UNITS.forEach(function (u) { BY_ID[u.id] = u; });

  var STORE_KEY = 'ru-grammar-cards-v1';
  var INTERVALS = [0, 1, 3, 7, 15, 30];
  var BOX_MAX = 5;
  var VERSIONS = window.GRAMMAR_VERSIONS || [];
  var CURRENT_VERSION = VERSIONS[0] ? VERSIONS[0].v : '';

  var state = {
    progress: {},
    settings: { newPerDay: 12, theme: 'light', explanation: 'full', showHint: true },
    session: null
  };

  var view = document.getElementById('view');
  var toastEl = document.getElementById('toast');
  var topProgress = document.getElementById('topProgress');
  var topProgressBar = topProgress ? topProgress.querySelector('span') : null;

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addDays(key, days) {
    var p = key.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ---------------- 存储 ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        state.progress = data.progress || {};
        state.settings = Object.assign(state.settings, data.settings || {});
      }
    } catch (e) { /* 忽略损坏数据 */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        progress: state.progress,
        settings: state.settings
      }));
    } catch (e) { /* 隐私模式下降级为内存态 */ }
  }

  function rec(cardId) { return state.progress[cardId] || null; }
  function isMastered(cardId) { var r = rec(cardId); return !!r && r.b >= 4; }
  function isDue(cardId) {
    var r = rec(cardId);
    return !!r && r.seen > 0 && r.b < BOX_MAX && r.due <= todayKey();
  }

  /* ---------------- 单元 / 卡片 ---------------- */
  function cardId(unit, i) { return unit.id + '-' + (i + 1); }

  var ALL = [];
  UNITS.forEach(function (u) {
    u.cards.forEach(function (c, i) {
      ALL.push({ unit: u, card: c, id: cardId(u, i), index: i });
    });
  });

  function unitStats(u) {
    var total = u.cards.length, mastered = 0, due = 0, seen = 0;
    u.cards.forEach(function (c, i) {
      var id = cardId(u, i), r = rec(id);
      if (r && r.seen) seen++;
      if (isMastered(id)) mastered++;
      if (isDue(id)) due++;
    });
    return { total: total, mastered: mastered, due: due, seen: seen };
  }

  function bookStats() {
    var total = 0, mastered = 0, due = 0, seenToday = 0, t = todayKey();
    ALL.forEach(function (x) {
      total++;
      if (isMastered(x.id)) mastered++;
      if (isDue(x.id)) due++;
      var r = rec(x.id);
      if (r && r.last === t) seenToday++;
    });
    return { total: total, mastered: mastered, due: due, today: seenToday };
  }

  /* ---------------- 路由 ---------------- */
  function parseRoute() {
    var h = (location.hash || '#/').replace(/^#/, '');
    if (!h || h === '/') return { name: 'book' };
    var qs = '';
    var qi = h.indexOf('?');
    if (qi >= 0) { qs = h.slice(qi + 1); h = h.slice(0, qi); }
    var parts = h.split('/').filter(Boolean);
    if (parts[0] === 'u' && parts[1]) return { name: 'unit', id: parts[1], qs: qs };
    if (parts[0] === 's' && parts[1]) return { name: 'study', id: parts[1], qs: qs };
    if (parts[0] === 'plan') return { name: 'plan', qs: qs };
    if (parts[0] === 'search') return { name: 'search', qs: qs };
    if (parts[0] === 'changelog') return { name: 'changelog', qs: qs };
    return { name: 'book' };
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function param(qs, key) {
    var m = new RegExp('[?&]' + key + '=([^&]*)').exec('?' + qs);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* ---------------- 视图：书首页 ---------------- */
  var filter = 'all';

  function renderBook() {
    var s = bookStats();
    var pct = s.total ? Math.round(s.mastered / s.total * 100) : 0;

    var units = UNITS.filter(function (u) {
      var st = unitStats(u);
      if (filter === 'todo') return st.mastered < st.total;
      if (filter === 'due') return st.due > 0;
      if (filter === 'done') return st.mastered === st.total;
      return true;
    });

    var points = UNITS.reduce(function (n, u) { return n + u.sections.length; }, 0);

    view.innerHTML = '' +
      '<section class="hero">' +
        '<div>' +
          '<span class="eyebrow">Учебник · 第 3 册 · 12 уроков</span>' +
          '<h1>一课一单元，<br>把语法点做成 <em>карточки</em></h1>' +
          '<p>' + esc(BOOK.meta.desc || '') + '</p>' +
        '</div>' +
        '<div class="hero-side">' +
          '<div class="stat-row">' +
            '<div class="stat"><b>' + UNITS.length + '</b><span>课</span></div>' +
            '<div class="stat"><b>' + points + '</b><span>语法点</span></div>' +
            '<div class="stat"><b>' + s.total + '</b><span>卡片</span></div>' +
            '<div class="stat"><b>' + s.due + '</b><span>待复习</span></div>' +
          '</div>' +
          '<div class="cta-row">' +
            '<button class="btn primary" data-act="continue">继续学习</button>' +
            '<a class="btn ghost" href="#/plan">今日计划</a>' +
          '</div>' +
          '<div style="color:var(--faint);font-size:12px">总进度 ' + pct + '% · 今天已练 ' + s.today + ' 张</div>' +
        '</div>' +
      '</section>' +

      '<div class="filters">' +
        chip('all', '全部 12 课') + chip('todo', '未掌握') + chip('due', '待复习') + chip('done', '已完成') +
        '<span class="spacer"></span>' +
        '<span class="count">' + units.length + ' / ' + UNITS.length + ' 课</span>' +
      '</div>' +

      '<div class="unit-grid">' + units.map(unitCardHtml).join('') + '</div>';

    setTopProgress(null);
  }

  function chip(key, label) {
    return '<button class="chip' + (filter === key ? ' is-on' : '') + '" data-act="filter" data-f="' + key + '">' + label + '</button>';
  }

  function unitCardHtml(u) {
    var st = unitStats(u);
    var pct = Math.round(st.mastered / st.total * 100);
    return '' +
      '<article class="unit-card" data-act="unit" data-id="' + u.id + '" tabindex="0" role="link">' +
        '<div class="unit-top">' +
          '<span class="unit-no">第 ' + u.lesson + ' 课</span>' +
          '<span class="badge">' + u.sections.length + ' 个语法点</span>' +
          '<span class="spacer" style="flex:1"></span>' +
          '<span class="pct">' + st.total + ' 张</span>' +
        '</div>' +
        '<h3>' + esc(u.title) + '</h3>' +
        '<div class="sub ru">' + esc(u.ru) + '</div>' +
        '<div class="chips">' +
          u.sections.map(function (sec) {
            return '<span class="mini">' + esc(sec.short || sec.title) + '</span>';
          }).join('') +
        '</div>' +
        '<div class="unit-foot">' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<span class="pct">' + pct + '%</span>' +
        '</div>' +
      '</article>';
  }

  /* ---------------- 视图：课页 ---------------- */
  function renderUnit(id) {
    var u = BY_ID[id];
    if (!u) { go('#/'); return; }
    var st = unitStats(u);

    var list = '';
    u.sections.forEach(function (sec, si) {
      var cards = u.cards.filter(function (c) { return c.sec === si; });
      list += '<div class="sec-head"><span class="sec-no">' + pad(si + 1) + '</span>' +
        '<h2>' + esc(sec.title) + '</h2>' +
        '<span class="count">' + cards.length + ' 张</span></div>' +
        '<ul class="card-list">' + cards.map(function (c) {
          var cid = cardId(u, c._gi), r = rec(cid);
          var cls = r && r.b ? 'box' + r.b : '';
          return '' +
            '<li class="card-row" data-act="study" data-id="' + u.id + '" data-start="' + c._gi + '">' +
              '<span class="idx">' + pad(c._gi + 1) + '</span>' +
              '<span class="dot-state ' + cls + '"></span>' +
              '<span class="q">' + esc(c.q).replace(/_{3,}/g, '<span class="mark">　　</span>') + '</span>' +
              '<span class="zh">' + esc(c.zh || '') + '</span>' +
            '</li>';
        }).join('') + '</ul>';
    });

    view.innerHTML = '' +
      '<div class="crumb"><a href="#/">书</a><span class="sep">/</span><span>第 ' + u.lesson + ' 课</span></div>' +

      '<header class="page-head">' +
        '<div>' +
          '<h1>' + esc(u.title) + '</h1>' +
          '<div class="meta">' +
            '<span class="badge lesson">第 ' + u.lesson + ' 课 · 印刷页 ' + esc(u.page) + '</span>' +
            '<span class="badge">' + u.sections.length + ' 个语法点</span>' +
            '<span class="badge">' + st.mastered + ' / ' + st.total + ' 已掌握</span>' +
            (st.due ? '<span class="badge" style="color:var(--accent);background:var(--accent-soft)">' + st.due + ' 张待复习</span>' : '') +
          '</div>' +
          '<p class="ru-title">' + esc(u.ru) + '</p>' +
        '</div>' +
        '<div class="cta-row">' +
          '<button class="btn primary" data-act="study" data-id="' + u.id + '">开始本课</button>' +
          (st.mastered < st.total ? '<button class="btn ghost" data-act="study" data-id="' + u.id + '" data-only="todo">只学未掌握</button>' : '') +
        '</div>' +
      '</header>' +

      '<p class="lesson-summary">' + esc(u.summary) + '</p>' +

      '<div class="sec-list">' + u.sections.map(function (sec, si) {
        return '<article class="sec">' +
          '<div class="sec-title"><span class="sec-no">' + pad(si + 1) + '</span>' +
            '<h2>' + esc(sec.title) + '</h2>' +
            '<span class="badge">' + sec.cards.length + ' 张</span>' +
            '<span class="badge lesson">第 ' + u.lesson + ' 课 · 页 ' + sec.page + '</span>' +
          '</div>' +
          '<p class="sec-concept">' + esc(sec.concept) + '</p>' +
          (sec.points && sec.points.length ?
            '<ul class="points">' + sec.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
        '</article>';
      }).join('') + '</div>' +

      '<div class="list-head"><h2>本课卡片</h2><span class="count">' + st.total + ' 张 · 按语法点排列</span></div>' +
      list;

    setTopProgress(null);
  }

  /* ---------------- 视图：学习 ---------------- */
  function startSession(unit, opts) {
    opts = opts || {};
    var cards = unit.cards.map(function (c, i) {
      return { card: c, id: cardId(unit, i), index: i };
    });

    if (opts.onlyTodo) {
      cards = cards.filter(function (x) { return !isMastered(x.id); });
    }

    cards.sort(function (a, b) {
      var ra = rec(a.id), rb = rec(b.id);
      var da = isDue(a.id) ? 0 : (ra && ra.seen ? 2 : 1);
      var db = isDue(b.id) ? 0 : (rb && rb.seen ? 2 : 1);
      return da - db || a.index - b.index;
    });

    if (!cards.length) { toast('本课已全部掌握'); return; }

    state.session = {
      unitId: unit.id,
      queue: cards,
      idx: Math.min(opts.start || 0, cards.length - 1),
      revealed: false,
      tally: { ok: 0, mid: 0, bad: 0 }
    };
    go('#/s/' + unit.id);
  }

  function renderStudy() {
    var s = state.session;
    if (!s) { go('#/'); return; }
    var u = BY_ID[s.unitId];
    var item = s.queue[s.idx];
    if (!item) { renderDone(); return; }

    var c = item.card;
    var r = rec(item.id);

    view.innerHTML = '' +
      '<div class="study-wrap">' +
        '<div class="study-top">' +
          '<a class="close" href="#/u/' + u.id + '" aria-label="退出学习">✕</a>' +
          '<span class="unitname">第 ' + u.lesson + ' 课 · ' + esc(u.title) + '</span>' +
          '<span class="counter">' + (s.idx + 1) + ' / ' + s.queue.length + '</span>' +
        '</div>' +
        '<div class="session-bar"><i style="width:' + Math.round(s.idx / s.queue.length * 100) + '%"></i></div>' +

        '<article class="flashcard">' +
          '<div class="fc-head">' +
            '<span class="tag">' + esc(c.secShort || c.secTitle || '') + '</span>' +
            '<span class="spacer"></span>' +
            '<div class="seg" role="group" aria-label="解释详略">' +
              '<button type="button" data-act="explain" data-v="brief" class="' + (explainMode() === 'brief' ? 'on' : '') + '" title="只看答案与一行规则">简洁</button>' +
              '<button type="button" data-act="explain" data-v="full" class="' + (explainMode() === 'full' ? 'on' : '') + '" title="整句、翻译、规则、解析、易错">详细</button>' +
            '</div>' +
            (r && r.b ? '<span class="tag">box ' + r.b + '</span>' : '<span class="tag">新卡</span>') +
            '<button class="star' + (r && r.star ? ' on' : '') + '" data-act="star" title="收藏">★</button>' +
          '</div>' +

          '<div class="fc-q"><span class="fc-line">' + qHtml(c, s.revealed) + '</span></div>' +
          (s.revealed ? '' : hintRow(c)) +
          (s.revealed ? answerHtml(c) : '') +

          '<div class="fc-actions">' +
            (s.revealed
              ? '<span style="color:var(--faint);font-size:12.5px">给这张卡打分，决定下次出现时间</span>'
              : '<span style="color:var(--faint);font-size:12.5px">先在心里补全，再翻面</span>') +
            '<span class="spacer"></span>' +
            (s.revealed
              ? '<button class="btn ghost" data-act="prev"' + (s.idx === 0 ? ' disabled' : '') + '>上一张</button>'
              : '<button class="btn primary" data-act="reveal">显示答案 <span class="kbd">空格</span></button>') +
          '</div>' +
        '</article>' +

        (s.revealed ? gradeHtml() : '') +
      '</div>';

    setTopProgress(s.idx / s.queue.length);
  }

  function gradeHtml() {
    return '' +
      '<div class="grade-row">' +
        '<button class="grade g1" data-act="grade" data-g="1"><b>不会</b><span>今天再来</span></button>' +
        '<button class="grade g2" data-act="grade" data-g="2"><b>模糊</b><span>明天再练</span></button>' +
        '<button class="grade g3" data-act="grade" data-g="3"><b>会了</b><span>按间隔复习</span></button>' +
      '</div>' +
      '<div style="text-align:center;color:var(--faint);font-size:11.5px;margin-top:14px">' +
        '快捷键：<span class="kbd">1</span> 不会 · <span class="kbd">2</span> 模糊 · <span class="kbd">3</span> 会了 · <span class="kbd">←</span><span class="kbd">→</span> 换卡' +
      '</div>';
  }

  function hintRow(c) {
    if (!c.hintNote) return '';
    var on = state.settings.showHint !== false;
    return '<div class="hint-row">' +
      '<button type="button" class="hint-toggle' + (on ? ' on' : '') + '" data-act="hint" aria-pressed="' + on + '" title="显示或隐藏语法提示">' +
        '<span class="sw" aria-hidden="true"></span><span>提示</span>' +
      '</button>' +
      '<span class="hint-note' + (on ? '' : ' is-off') + '">' + (on ? esc(c.hintNote) : '已隐藏') + '</span>' +
    '</div>';
  }

  function qHtml(c, revealed) {
    var parts = String(c.q || '').split(/_{3,}/);
    if (parts.length === 1) return esc(c.q);
    var out = esc(parts[0]);
    for (var i = 1; i < parts.length; i++) {
      var tail = parts[i];
      var tight = /^[.,!?;:)]/.test(tail) ? ' tight' : '';
      var hasCue = !revealed && c.cue;
      out += '<span class="blank' + tight + (hasCue ? ' with-cue' : '') + (revealed ? ' filled' : '') + '">' +
        (revealed ? esc(c.a) : '　') + '</span>';
      if (hasCue) out += '<span class="cue">(' + esc(c.cue) + ')</span>';
      out += esc(tail);
    }
    return out;
  }

  function explainMode() {
    return state.settings.explanation === 'brief' ? 'brief' : 'full';
  }

  function answerHtml(c) {
    var brief = explainMode() === 'brief';
    var html = '<div class="answer">';
    if (!brief) html += '<div class="answer-zh">' + esc(c.zh || '') + '</div>';
    if (c.rule) html += '<div class="note-box"><b>规则</b> · ' + esc(c.rule) + '</div>';
    if (!brief) {
      if (c.note) html += '<div class="note-box" style="margin-top:8px"><b>解析</b> · ' + esc(c.note) + '</div>';
      if (c.trap) html += '<div class="trap-box"><b>易错</b> · ' + esc(c.trap) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderDone() {
    var s = state.session;
    var u = BY_ID[s.unitId];
    var total = s.tally.ok + s.tally.mid + s.tally.bad;
    var idx = UNITS.indexOf(u);
    var next = idx >= 0 ? UNITS[idx + 1] : null;

    view.innerHTML = '' +
      '<div class="study-wrap">' +
        '<article class="flashcard" style="min-height:340px;justify-content:center;text-align:center">' +
          '<div class="empty" style="padding:0">' +
            '<div class="big">Готово!</div>' +
            '<p style="color:var(--ink);font-size:20px;font-family:var(--serif-zh);margin-bottom:6px">第 ' + u.lesson + ' 课完成</p>' +
            '<p>' + esc(u.title) + ' · 共 ' + total + ' 张</p>' +
            '<p style="margin-top:14px">会了 <b style="color:var(--green)">' + s.tally.ok + '</b> · ' +
              '模糊 <b style="color:var(--amber)">' + s.tally.mid + '</b> · ' +
              '不会 <b style="color:var(--accent)">' + s.tally.bad + '</b></p>' +
            '<div class="cta-row" style="justify-content:center;margin-top:24px">' +
              (next
                ? '<a class="btn primary" href="#/u/' + next.id + '">下一课 · 第 ' + next.lesson + ' 课 ' + esc(next.title) + '</a>'
                : '<a class="btn primary" href="#/">12 课全部走完</a>') +
              '<a class="btn" href="#/u/' + u.id + '">回到本课</a>' +
            '</div>' +
            (next ? '<div style="margin-top:14px;color:var(--faint);font-size:12px">按课次顺序继续：第 ' + next.lesson + ' 课 / 12</div>' : '') +
          '</div>' +
        '</article>' +
      '</div>';
    setTopProgress(1);
  }

  /* ---------------- 评分 ---------------- */
  function grade(g) {
    var s = state.session;
    if (!s || !s.revealed) return;
    var item = s.queue[s.idx];
    var r = rec(item.id) || { b: 0, seen: 0, ok: 0, bad: 0, due: todayKey(), last: '' };
    var today = todayKey();

    r.seen = (r.seen || 0) + 1;
    r.last = today;

    if (g === 1) {
      r.b = 0; r.bad = (r.bad || 0) + 1; r.due = today; s.tally.bad++;
    } else if (g === 2) {
      r.b = Math.max(1, r.b || 0); r.due = addDays(today, 1); s.tally.mid++;
    } else {
      r.b = Math.min(BOX_MAX, (r.b || 0) + 1);
      r.ok = (r.ok || 0) + 1;
      r.due = addDays(today, INTERVALS[r.b] || 30);
      s.tally.ok++;
      if (r.b === BOX_MAX) toast('已掌握 · 30 天后复习');
    }

    state.progress[item.id] = r;
    save();

    if (s.idx >= s.queue.length - 1) {
      s.idx = s.queue.length;
      renderDone();
    } else {
      s.idx++;
      s.revealed = false;
      renderStudy();
    }
  }

  /* ---------------- 视图：计划 ---------------- */
  function renderPlan() {
    var s = bookStats();
    var dueCards = ALL.filter(function (x) { return isDue(x.id); });
    var unseen = ALL.filter(function (x) { return !rec(x.id) || !rec(x.id).seen; });

    var byUnit = {};
    dueCards.forEach(function (x) { byUnit[x.unit.id] = (byUnit[x.unit.id] || 0) + 1; });

    view.innerHTML = '' +
      '<div class="crumb"><a href="#/">书</a><span class="sep">/</span><span>学习计划</span></div>' +
      '<header class="page-head"><div><h1>学习计划</h1>' +
        '<div class="meta"><span class="badge">12 课 · 24 个语法点 · ' + s.total + ' 张卡</span>' +
        '<span class="badge">今天已练 ' + s.today + ' 张</span></div>' +
      '</div></header>' +

      '<div class="tiles">' +
        tile('待复习', s.due, '到期应复习') +
        tile('未学', unseen.length, '还没打开过') +
        tile('已掌握', s.mastered, 'box ≥ 4') +
        tile('总卡片', s.total, '按课次排列') +
      '</div>' +

      '<div class="panel">' +
        '<h2>今天做什么</h2>' +
        '<p class="hint">按课次推进：先清当前课的到期卡，再开本课新卡（第 1 课 → 第 12 课）。' +
          (dueCards.length ? '' : ' 目前没有到期卡片。') + '</p>' +
        '<div class="cta-row">' +
          (dueCards.length
            ? '<button class="btn accent" data-act="review-all">复习到期 ' + dueCards.length + ' 张</button>' +
              '<button class="btn ghost" data-act="new-session">新卡 · ' + Math.min(state.settings.newPerDay, unseen.length) + ' 张</button>'
            : '<button class="btn primary" data-act="new-session">开始新卡 · ' + Math.min(state.settings.newPerDay, unseen.length) + ' 张</button>' +
              '<a class="btn ghost" href="#/">按课次浏览</a>') +
        '</div>' +
      '</div>' +

      (dueCards.length ?
        '<div class="panel">' +
          '<h2>到期分布</h2>' +
          '<ul class="due-list">' +
            Object.keys(byUnit).map(function (id) {
              var u = BY_ID[id];
              return '<li><span class="n">' + u.lesson + '</span><span>第 ' + u.lesson + ' 课 · ' + esc(u.title) + '</span>' +
                '<span class="badge">' + byUnit[id] + ' 张</span><span class="spacer"></span>' +
                '<span class="go" data-act="study" data-id="' + id + '">去复习 →</span></li>';
            }).join('') +
          '</ul>' +
        '</div>' : '') +

      '<div class="panel">' +
        '<h2>设置</h2>' +
        '<div class="setting-row">' +
          '<div class="t"><b>每天新卡上限</b><span>只影响「新卡」按钮，不限制手动学习</span></div>' +
          '<input type="range" id="newPerDay" min="4" max="40" step="2" value="' + state.settings.newPerDay + '">' +
          '<output id="newPerDayOut">' + state.settings.newPerDay + '</output>' +
        '</div>' +
        '<div class="setting-row">' +
          '<div class="t"><b>数据</b><span>进度保存在本机浏览器；清除后无法恢复</span></div>' +
          '<button class="btn ghost" data-act="export">导出进度</button>' +
          '<button class="btn ghost" data-act="reset">清空进度</button>' +
        '</div>' +
      '</div>';

    var range = $('#newPerDay');
    if (range) {
      range.addEventListener('input', function () {
        state.settings.newPerDay = Number(range.value);
        $('#newPerDayOut').textContent = range.value;
        save();
      });
    }
    setTopProgress(null);
  }

  function tile(k, v, sub) {
    return '<div class="tile"><span class="k">' + k + '</span><b>' + v + '</b><small>' + sub + '</small></div>';
  }

  /* ---------------- 视图：检索 ---------------- */
  function renderSearch(qs) {
    var q = param(qs || '', 'q');
    var results = [];

    if (q.trim()) {
      var needle = q.trim().toLowerCase();
      ALL.forEach(function (x) {
        var hay = [x.card.q, x.card.a, x.card.full, x.card.zh, x.card.rule, x.card.note, x.unit.title, x.card.secTitle].join(' ').toLowerCase();
        if (hay.indexOf(needle) >= 0) results.push(x);
      });
    }

    view.innerHTML = '' +
      '<div class="crumb"><a href="#/">书</a><span class="sep">/</span><span>检索</span></div>' +
      '<header class="page-head"><div><h1>检索卡片</h1>' +
        '<div class="meta"><span class="badge">' + ALL.length + ' 张卡</span><span class="badge">俄语 / 汉语 / 规则关键词</span></div>' +
      '</div></header>' +

      '<form class="search-box" data-act="search-form">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="color:var(--faint)"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        '<input id="q" type="search" placeholder="例如：完成体、который、短尾、第二格" value="' + esc(q) + '" autocomplete="off">' +
      '</form>' +
      '<div class="search-meta">' + (q ? '找到 ' + results.length + ' 张' : '输入关键词开始检索；清空可看 12 课索引') + '</div>' +

      (q
        ? (results.length ? results.map(resultHtml).join('') : '<div class="empty">没有匹配的卡片</div>')
        : UNITS.map(function (u) {
            return '<div class="result" data-act="unit" data-id="' + u.id + '">' +
              '<div class="r-top"><span>第 ' + u.lesson + ' 课</span><span>·</span><span>' + u.sections.length + ' 个语法点</span><span>·</span><span>' + u.cards.length + ' 张</span></div>' +
              '<div class="r-q">' + esc(u.title) + ' <span style="color:var(--faint);font-size:14px">' + esc(u.ru) + '</span></div>' +
              '<div class="r-zh">' + esc(u.short) + '</div>' +
            '</div>';
          }).join(''));

    var input = $('#q');
    if (input) {
      input.addEventListener('input', function () {
        clearTimeout(input._t);
        input._t = setTimeout(function () {
          var v = input.value;
          history.replaceState(null, '', '#/search' + (v ? '?q=' + encodeURIComponent(v) : ''));
          renderSearch(v ? 'q=' + encodeURIComponent(v) : '');
          var el = $('#q');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 220);
      });
      if (q) input.focus();
    }
    setTopProgress(null);
  }

  function resultHtml(x) {
    return '<div class="result" data-act="study" data-id="' + x.unit.id + '" data-start="' + x.index + '">' +
      '<div class="r-top"><span>第 ' + x.unit.lesson + ' 课</span><span>·</span><span>' + esc(x.card.secShort || '') + '</span><span>·</span><span>第 ' + (x.index + 1) + ' 张</span></div>' +
      '<div class="r-q">' + esc(x.card.q).replace(/_{3,}/g, '<span class="r-a">____</span>') + '</div>' +
      '<div class="r-zh">' + esc(x.card.zh || '') + '</div>' +
    '</div>';
  }

  /* ---------------- 视图：更新日志 ---------------- */
  function renderChangelog() {
    view.innerHTML = '' +
      '<div class="crumb"><a href="#/">书</a><span class="sep">/</span><span>更新日志</span></div>' +
      '<header class="page-head"><div><h1>更新日志</h1>' +
        '<div class="meta"><span class="badge">' + esc(CURRENT_VERSION || 'Alpha') + '</span>' +
        '<span class="badge">' + VERSIONS.length + ' 个版本</span></div>' +
      '</div></header>' +
      '<div class="panel" style="margin-top:24px">' +
        VERSIONS.map(function (ver) {
          return '<article class="log-item">' +
            '<div class="log-head"><span class="v">' + esc(ver.v) + '</span>' +
              '<h2>' + esc(ver.title || '') + '</h2>' +
              '<span class="d">' + esc(ver.date || '') + '</span></div>' +
            '<ul>' + (ver.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>' +
          '</article>';
        }).join('') +
      '</div>';
    setTopProgress(null);
  }

  /* ---------------- 版本弹窗 ---------------- */
  function showVersionModal() {
    var ver = VERSIONS[0];
    var modal = document.getElementById('verModal');
    if (!ver || !modal) return;
    document.getElementById('verTitle').textContent = ver.title || ver.v;
    document.getElementById('verMeta').textContent = ver.v + ' · ' + (ver.date || '');
    document.getElementById('verList').innerHTML = (ver.items || []).map(function (it) {
      return '<li>' + esc(it) + '</li>';
    }).join('');
    modal.hidden = false;
  }

  function closeVersionModal() {
    var modal = document.getElementById('verModal');
    if (modal) modal.hidden = true;
    state.settings.seenVersion = CURRENT_VERSION;
    save();
  }

  /* ---------------- 顶栏进度 ---------------- */
  function setTopProgress(ratio) {
    if (!topProgress || !topProgressBar) return;
    if (ratio == null) { topProgress.hidden = true; return; }
    topProgress.hidden = false;
    topProgressBar.style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
  }

  /* ---------------- 渲染入口 ---------------- */
  function render() {
    var r = parseRoute();

    if (r.name === 'study') {
      if (!state.session || state.session.unitId !== r.id) {
        var u = BY_ID[r.id];
        if (!u) { go('#/'); return; }
        startSession(u, { start: Number(param(r.qs, 'i')) || 0 });
      }
      if (param(r.qs, 'show') === '1' && state.session) state.session.revealed = true;
      var m = param(r.qs, 'm');
      if (m === 'brief' || m === 'full') state.settings.explanation = m;
      var h = param(r.qs, 'hint');
      if (h === '0') state.settings.showHint = false;
      if (h === '1') state.settings.showHint = true;
    } else {
      state.session = null;
    }

    if (r.name === 'book') renderBook();
    else if (r.name === 'unit') renderUnit(r.id);
    else if (r.name === 'study') renderStudy();
    else if (r.name === 'plan') renderPlan();
    else if (r.name === 'search') renderSearch(r.qs);
    else if (r.name === 'changelog') renderChangelog();

    $$('.topnav a').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === r.name);
    });

    window.scrollTo(0, 0);
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'filter') { filter = el.getAttribute('data-f'); renderBook(); return; }
    if (act === 'unit') { go('#/u/' + el.getAttribute('data-id')); return; }
    if (act === 'study') {
      var u = BY_ID[el.getAttribute('data-id')];
      if (!u) return;
      startSession(u, {
        onlyTodo: el.getAttribute('data-only') === 'todo',
        start: Number(el.getAttribute('data-start')) || 0
      });
      return;
    }
    if (act === 'continue') {
      var target = firstUnmasteredUnit();
      if (target) go('#/u/' + target.id); else go('#/plan');
      return;
    }
    if (act === 'reveal') {
      if (!state.session) return;
      state.session.revealed = true;
      renderStudy();
      return;
    }
    if (act === 'grade') { grade(Number(el.getAttribute('data-g'))); return; }
    if (act === 'explain') {
      state.settings.explanation = el.getAttribute('data-v') === 'brief' ? 'brief' : 'full';
      save();
      renderStudy();
      return;
    }
    if (act === 'close-version') { closeVersionModal(); return; }
    if (act === 'hint') {
      state.settings.showHint = state.settings.showHint === false;
      save();
      renderStudy();
      return;
    }
    if (act === 'star') {
      if (!state.session) return;
      var item = state.session.queue[state.session.idx];
      var r = rec(item.id) || { b: 0, seen: 0, ok: 0, bad: 0, due: todayKey(), last: '' };
      r.star = !r.star;
      state.progress[item.id] = r;
      save();
      renderStudy();
      return;
    }
    if (act === 'prev') {
      if (!state.session || state.session.idx === 0) return;
      state.session.idx--; state.session.revealed = false; renderStudy();
      return;
    }
    if (act === 'review-all') {
      var due = ALL.filter(function (x) { return isDue(x.id); });
      if (!due.length) { toast('没有到期卡片'); return; }
      state.session = {
        unitId: due[0].unit.id,
        queue: due.sort(function (a, b) { return a.unit.n - b.unit.n || a.index - b.index; }),
        idx: 0, revealed: false, tally: { ok: 0, mid: 0, bad: 0 }
      };
      location.hash = '#/s/' + due[0].unit.id;
      return;
    }
    if (act === 'new-session') {
      var nu = firstUnmasteredUnit();
      if (!nu) { toast('全部课程都已掌握'); return; }
      startSession(nu, { onlyTodo: true });
      return;
    }
    if (act === 'export') {
      var blob = new Blob([JSON.stringify({
        progress: state.progress, settings: state.settings, exportedAt: new Date().toISOString()
      }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'grammar-progress.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('已导出');
      return;
    }
    if (act === 'reset') {
      if (!confirm('清空全部学习进度？此操作不可恢复。')) return;
      state.progress = {}; save(); render(); toast('进度已清空');
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var s = state.session;
    if (!s || parseRoute().name !== 'study') return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!s.revealed) { s.revealed = true; renderStudy(); }
      return;
    }
    if (s.revealed && (e.key === '1' || e.key === '2' || e.key === '3')) {
      e.preventDefault(); grade(Number(e.key)); return;
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (s.idx > 0) { s.idx--; s.revealed = false; renderStudy(); } }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (s.idx < s.queue.length - 1) {
        if (!s.revealed) { s.revealed = true; renderStudy(); return; }
        s.idx++; s.revealed = false; renderStudy();
      }
    }
  });

  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      state.settings.theme = next;
      save();
    });
  }

  function firstUnmasteredUnit() {
    for (var i = 0; i < UNITS.length; i++) {
      var st = unitStats(UNITS[i]);
      if (st.mastered < st.total) return UNITS[i];
    }
    return null;
  }

  /* ---------------- 启动 ---------------- */
  load();
  document.documentElement.setAttribute('data-theme', state.settings.theme || 'light');

  var badge = document.getElementById('verBadge');
  if (badge && CURRENT_VERSION) badge.textContent = CURRENT_VERSION;

  if (!UNITS.length) {
    view.innerHTML = '<div class="empty"><div class="big">Данные</div><p>没有读到卡片数据，请确认 data/ 目录完整。</p></div>';
  } else {
    window.addEventListener('hashchange', render);
    render();
    if (parseRoute().name === 'book' && CURRENT_VERSION && state.settings.seenVersion !== CURRENT_VERSION) {
      showVersionModal();
    }
  }

  // PWA：仅 http(s) 下注册，file:// 打开时跳过
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 忽略 */ });
    });
  }
})();
