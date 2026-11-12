#!/usr/bin/env node
/* 数据自检：node check.js
   校验 12 课是否齐全、卡片字段是否完整、挖空与答案是否对得上。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const ctx = { window: {} };
vm.createContext(ctx);

const files = ['data/book.js'];
for (let i = 1; i <= 24; i++) files.push(`data/u${String(i).padStart(2, '0')}.js`);
files.push('data/lessons.js');

for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) {
    console.error(`✗ 缺少文件 ${f}`);
    process.exit(1);
  }
  try {
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  } catch (e) {
    console.error(`✗ 解析失败 ${f}: ${e.message}`);
    process.exit(1);
  }
}

const book = ctx.window.GRAMMAR_BOOK;
if (!book || !Array.isArray(book.units)) {
  console.error('✗ 没有读到 GRAMMAR_BOOK');
  process.exit(1);
}

let errors = 0;
const fail = (msg) => { errors++; console.error('✗ ' + msg); };

if (book.units.length !== 12) fail(`课数应为 12，实际 ${book.units.length}`);

let total = 0;
const ids = new Set();

book.units.forEach((u) => {
  if (!u.sections || !u.sections.length) fail(`${u.id} 没有 sections`);
  if (!u.cards || !u.cards.length) fail(`${u.id} 没有 cards`);

  u.cards.forEach((c, i) => {
    total++;
    const tag = `${u.id} 第 ${i + 1} 张`;
    if (!c.q || c.q.indexOf('___') < 0) fail(`${tag} 缺少挖空`);
    ['a', 'full', 'zh', 'rule'].forEach((k) => {
      if (!c[k] || typeof c[k] !== 'string') fail(`${tag} 缺少字段 ${k}`);
    });
    if (c.a && c.full && c.full.indexOf(c.a) < 0) fail(`${tag} 答案未出现在整句中：${c.a}`);
    if (c.sec === undefined) fail(`${tag} 没有语法点归属 sec`);
  });
});

book.units.forEach((u) => {
  if (ids.has(u.id)) fail(`重复的课 id：${u.id}`);
  ids.add(u.id);
  for (let i = 1; i < u.cards.length; i++) {
    if (u.cards[i].sec < u.cards[i - 1].sec) fail(`${u.id} 卡片未按语法点排序`);
  }
});

if (errors) {
  console.error(`\n共 ${errors} 处问题，卡片总数 ${total}`);
  process.exit(1);
}

console.log(`✓ 12 课 / ${book.units.reduce((n, u) => n + u.sections.length, 0)} 个语法点 / ${total} 张卡，字段完整`);
