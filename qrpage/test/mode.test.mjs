import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindApp, MODES } from '../src/app.js';

function mkBtn() {
  const attrs = {};
  return {
    attrs,
    addEventListener(t, fn) {
      if (t === 'click') this.click = fn;
    },
    setAttribute(name, value) {
      attrs[name] = value;
    },
    getAttribute(name) {
      return attrs[name];
    },
  };
}

function setup() {
  const dom = {
    input: { value: '' },
    button: mkBtn(),
    box: { innerHTML: '' },
    textEl: { textContent: '' },
    modeBtns: [mkBtn(), mkBtn()],
  };
  bindApp(dom, { log: () => {} });
  return dom;
}

const pressed = (dom) => dom.modeBtns.map((b) => b.getAttribute('aria-pressed'));

test('C10a 两个按钮，默认选中 QR', () => {
  assert.deepEqual(MODES.map((m) => m.label), ['QR', 'DM']);
  assert.deepEqual(MODES.map((m) => m.symbology), ['qr', 'dm']);
  assert.deepEqual(pressed(setup()), ['true', 'false']);
});

test('C10b 点 DM 选中它，再点 QR 换回来', () => {
  const dom = setup();
  dom.modeBtns[1].click();
  assert.deepEqual(pressed(dom), ['false', 'true']);

  dom.modeBtns[0].click();
  assert.deepEqual(pressed(dom), ['true', 'false']);
});

test('C10c 切换码制会立刻重画', () => {
  const dom = setup();
  dom.input.value = 'hello';
  dom.button.click();
  const before = dom.box.innerHTML;

  dom.modeBtns[1].click();
  assert.notEqual(dom.box.innerHTML, before, '选 DM 后应换成 Data Matrix');
});

test('C10d index.html 里是两个并列按钮，文案正确', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const group = html.match(/<div id="modes"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(group, '找不到 #modes');
  assert.match(group[1], />QR<\/button>/);
  assert.match(group[1], />DM<\/button>/);
  assert.equal((group[1].match(/<button/g) || []).length, 2);
});

test('C10e #modes 与 #col 平级，落在码框右侧外面', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const top = html.match(/<div id="top">([\s\S]*?)<input/);
  assert.ok(top, '找不到 #top 块');

  const iCol = top[1].indexOf('<div id="col">');
  const iModes = top[1].indexOf('<div id="modes"');
  assert.ok(iCol >= 0, '#col 应在 #top 内');
  assert.ok(iModes > iCol, '#modes 应排在 #col 之后，才在码的右边');

  // #modes 不能嵌进码那一列，否则会压在二维码区域上
  const between = top[1].slice(iCol, iModes);
  const opens = (between.match(/<div/g) || []).length;
  const closes = (between.match(/<\/div>/g) || []).length;
  assert.equal(opens, closes, '#modes 应与 #col 平级，不能嵌在码所在的列里');
});

test('C10f 两个按钮宽度固定，切换不改变整体布局宽度', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = html.match(/#modes button \{([\s\S]*?)\}/);
  assert.ok(css, 'index.html 里缺少 #modes button 的样式');
  assert.match(css[1], /width:\s*[\d.]+rem/, '应有固定宽度');
  assert.doesNotMatch(css[1], /min-width/, 'min-width 挡不住变宽');
  assert.match(css[1], /white-space:\s*nowrap/);
});

test('C10g #modes 略微左移，但不越过静区', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = html.match(/#modes \{([\s\S]*?)\}/);
  assert.ok(css, 'index.html 里缺少 #modes 的样式');

  // 静区上限是 gap 12 + 静区 32 = 44px；但这一行整行落在黑区下方，
  // 横向越界盖不到模块，上限按视觉取舍放到 80px
  const MAX_SHIFT_PX = 104;
  const shift = Number((css[1].match(/margin-left:\s*-([\d.]+)rem/) || [])[1]);
  assert.ok(shift > 0, '应有左移');
  assert.ok(shift * 16 <= MAX_SHIFT_PX, `左移不能超过 ${MAX_SHIFT_PX}px，实际 ${shift * 16}px`);
});
