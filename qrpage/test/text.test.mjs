import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindApp } from '../src/app.js';

function stubDom() {
  const button = { addEventListener(t, fn) { if (t === 'click') this.click = fn; } };
  return {
    input: { value: '' },
    button,
    box: { innerHTML: '' },
    textEl: { textContent: '' },
  };
}

function renderWith(text) {
  const dom = stubDom();
  bindApp(dom, { log: () => {} });
  dom.input.value = text;
  dom.button.click();
  return dom;
}

test('C9a 二维码下面显示带双引号的原文', () => {
  assert.equal(renderWith('hello').textEl.textContent, '"hello"');
});

test('C9b 换内容后文本跟着变，引号始终在', () => {
  const dom = stubDom();
  bindApp(dom, { log: () => {} });
  for (const text of ['hello', '你好，世界', 'https://example.com']) {
    dom.input.value = text;
    dom.button.click();
    assert.equal(dom.textEl.textContent, `"${text}"`);
  }
});

test('C9c 超长文本显示破坏图时，文本照样显示原文', () => {
  const dom = renderWith('A'.repeat(28));
  assert.match(dom.box.innerHTML, /data-broken="true"/);
  assert.equal(dom.textEl.textContent, `"${'A'.repeat(28)}"`);
});

test('C9d #box 与 #text 同处 #col，#text 紧跟 #box', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="col">[\s\S]*<div id="box">[\s\S]*<div id="text"><\/div>/);
});

test('C9e index.html 给 #text 定了与码同宽的样式', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = html.match(/#text \{([\s\S]*?)\}/);
  assert.ok(css, 'index.html 里缺少 #text 的样式');
  assert.match(css[1], /max-width:\s*296px/, '上限应与码同宽');
  assert.match(css[1], /text-align:\s*center/, '应在码下面居中');
});

test('C9f #text 用负外边距贴近二维码', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = html.match(/#text \{([\s\S]*?)\}/);
  assert.ok(css, 'index.html 里缺少 #text 的样式');
  assert.match(css[1], /margin-top:\s*-[\d.]+rem/, '应抵掉静区与 gap 的间距');
});

test('C9g #text 高度固定，内容长短不会顶动下面的元素', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = html.match(/#text \{([\s\S]*?)\}/);
  assert.ok(css, 'index.html 里缺少 #text 的样式');
  assert.match(css[1], /height:\s*[\d.]+em/, '应有固定高度');
  assert.doesNotMatch(css[1], /min-height/, 'min-height 挡不住多行');
  assert.match(css[1], /overflow:\s*hidden/, '超出部分要裁掉');
  assert.match(css[1], /-webkit-line-clamp:\s*2/, '最多两行');
});

test('C9h 码与按钮横排，间距适中且与原文底对齐', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = html.match(/#top \{([\s\S]*?)\}/);
  assert.ok(css, 'index.html 里缺少 #top 的样式');
  assert.match(css[1], /display:\s*flex/, '应横排');
  assert.match(css[1], /align-items:\s*flex-end/, '按钮与原文底对齐');
  const gap = Number((css[1].match(/gap:\s*([\d.]+)rem/) || [])[1]);
  assert.ok(gap >= 0.5 && gap <= 1, `gap 应在 0.5–1rem 之间，实际 ${gap}rem`);
});
