/* 把 24 个语法点单元合并成 12 个「课」单元。
   每个课单元：sections（本课语法点）+ cards（展平后带 sec 信息）。 */
(function () {
  var raw = window.GRAMMAR_UNITS || [];
  var byId = {};
  raw.forEach(function (u) { byId[u.id] = u; });

  var ASPECT = window.GRAMMAR_ASPECT || {};
  var FIX = window.GRAMMAR_CUE_FIX || {};

  /* 把 hint 拆成两部分：
     cue  —— 放在空后的括号提示（动词给未完成体–完成体）
     note —— 进「提示」开关的一句话要求 */
  function splitHint(h) {
    var parts = String(h || '').split('·').map(function (s) { return s.trim(); }).filter(Boolean);
    var head = parts[0] || '';
    var note = parts.slice(1).join(' · ');
    var cue = '';

    if (FIX[head]) {
      cue = FIX[head].cue;
      if (FIX[head].note !== undefined) note = FIX[head].note;
    } else if (/^\d+$/.test(head)) {
      if (parts[1] && parts[1] !== '谚语') {
        cue = head + ' + ' + parts[1];
        note = parts.slice(2).join(' · ');
      } else {
        cue = head;
      }
    } else {
      var base = head.replace(/^не\s+/, '');
      cue = ASPECT[base] || base;
    }

    return { cue: cue, note: note };
  }

  var MAP = [
    {
      n: 1, page: '14–22', title: '外貌', ru: 'Портрет, внешность человека',
      ids: ['u01', 'u02'],
      summary: '两个语法点：俄罗斯人姓名的组成、变格与称呼；когда 引导的时间从句，重点在体的分工。'
    },
    {
      n: 2, page: '36–40', title: '性格', ru: 'Характер человека',
      ids: ['u03'],
      summary: '一个语法点：定向/不定向动词加前缀后的体对应，以及 при-/у-/в-/вы-/до-/про- 等前缀的方向意义。'
    },
    {
      n: 3, page: '59–66', title: '兴趣与爱好', ru: 'Мир интересов и увлечений',
      ids: ['u04', 'u05'],
      summary: '两个语法点：带 -ся 动词的四种意义；ни- 与 не- 两套否定代词、否定副词的分工。'
    },
    {
      n: 4, page: '83–91', title: '旅行', ru: 'Путешествие',
      ids: ['u06', 'u07'],
      summary: '两个语法点：-то / -нибудь / кое- 三类不定代词；直接引语标点与四种间接引语转换。'
    },
    {
      n: 5, page: '106–110', title: '阅读', ru: 'Чтение — полезная привычка',
      ids: ['u08'],
      summary: '一个语法点：过去时体的意义——反复与一次、持续与限时、结果消失与结果保持。'
    },
    {
      n: 6, page: '127–134', title: '居住', ru: 'Где мы живём?',
      ids: ['u09', 'u10', 'u11'],
      summary: '三个语法点：将来时体的用法；假定式（过去时+бы）；条件从句的现实与非现实两类。'
    },
    {
      n: 7, page: '148–156', title: '俄语学习', ru: 'Русский язык — не проблема!',
      ids: ['u12', 'u13'],
      summary: '两个语法点：命令式体的用法（尤其否定式）；说明从句中 что 与 чтобы 的分工。'
    },
    {
      n: 8, page: '173–180', title: '传媒', ru: 'Медиа в современной жизни',
      ids: ['u14', 'u15'],
      summary: '两个语法点：不定式体的选择由支配词决定；形容词短尾形式的构成与谓语用法。'
    },
    {
      n: 9, page: '195–204', title: '节日', ru: 'Праздники',
      ids: ['u16', 'u17'],
      summary: '两个语法点：形动词的概念与主动形动词的构成、用法；集合数词 двое…десятеро。'
    },
    {
      n: 10, page: '219–228', title: '民族饮食', ru: 'Национальные кухни',
      ids: ['u18', 'u19'],
      summary: '两个语法点：被动形动词的构成与用法；被动形动词短尾形式，表结果状态。'
    },
    {
      n: 11, page: '243–250', title: '博物馆与展览', ru: 'Музей и выставка — источник знаний',
      ids: ['u20', 'u21'],
      summary: '两个语法点：副动词的构成与状语用法；集合数词 оба / обе。'
    },
    {
      n: 12, page: '265–271', title: '戏剧与电影', ru: 'Театр или кино?',
      ids: ['u22', 'u23', 'u24'],
      summary: '三个语法点：反身代词与限定代词；定语从句的 чей / что；大数的表示法。'
    }
  ];

  var lessons = [];

  MAP.forEach(function (m) {
    var sections = m.ids.map(function (id) { return byId[id]; }).filter(Boolean);
    if (!sections.length) return;

    var cards = [];
    sections.forEach(function (s, si) {
      s.cards.forEach(function (c) {
        var copy = {};
        for (var k in c) { if (Object.prototype.hasOwnProperty.call(c, k)) copy[k] = c[k]; }
        var h = splitHint(c.hint);
        copy.cue = (h.cue && h.cue.toLowerCase() !== String(c.a).toLowerCase()) ? h.cue : '';
        copy.hintNote = h.note;
        // 中文说明（如“连接词”“陈述事实”）不放进句子里，只作为提示文字
        if (/[\u4e00-\u9fff]/.test(copy.cue)) {
          copy.hintNote = [copy.cue, copy.hintNote].filter(Boolean).join(' · ');
          copy.cue = '';
        }
        copy.sec = si;
        copy.secTitle = s.title;
        copy.secShort = s.short;
        copy._gi = cards.length;
        cards.push(copy);
      });
    });

    var groups = {};
    sections.forEach(function (s) { groups[s.group] = true; });

    lessons.push({
      id: 'l' + (m.n < 10 ? '0' + m.n : m.n),
      n: m.n,
      lesson: m.n,
      page: m.page,
      title: m.title,
      ru: m.ru,
      short: sections.map(function (s) { return s.short; }).join(' + '),
      group: Object.keys(groups).join('·'),
      summary: m.summary,
      sections: sections,
      cards: cards
    });
  });

  window.GRAMMAR_BOOK.units = lessons;
})();
