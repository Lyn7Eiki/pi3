import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import { bindApp } from '../src/app.js';

/** 极简 DOM 替身：只需要 value / addEventListener / innerHTML 三样。 */
function stubDom() {
  const button = {
    addEventListener(type, fn) {
      if (type === 'click') this.click = fn;
    },
  };
  return { input: { value: '' }, button, box: { innerHTML: '' } };
}

/** 把 #box 里的 SVG 字符串还原成像素再解码——验的是"真的渲染出来的东西"。 */
function decodeSvg(svg) {
  const w = Number(svg.match(/width="(\d+)"/)[1]);
  const h = Number(svg.match(/height="(\d+)"/)[1]);
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
    const [x, y, rw, rh] = m.slice(1).map(Number);
    for (let yy = y; yy < y + rh; yy += 1) {
      for (let xx = x; xx < x + rw; xx += 1) {
        const i = (yy * w + xx) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  }
  const res = jsQR(data, w, h);
  return res ? res.data : null;
}

test('C4a 输入文本 → 点 Btn → #box 的码扫出来就是该文本', () => {
  const dom = stubDom();
  bindApp(dom);
  for (const text of ['hello', '你好，世界', 'https://example.com/a?b=1']) {
    dom.input.value = text;
    dom.box.innerHTML = '';
    dom.button.click();
    assert.equal(decodeSvg(dom.box.innerHTML), text, `失败于：${text}`);
  }
});

test('C4b 空输入：点 Btn 不改动已有显示', () => {
  const dom = stubDom();
  bindApp(dom);
  dom.input.value = 'hello';
  dom.button.click();
  const before = dom.box.innerHTML;
  dom.input.value = '';
  dom.button.click();
  assert.equal(dom.box.innerHTML, before);
});

test('C4c 连续输入：后一次覆盖前一次', () => {
  const dom = stubDom();
  bindApp(dom);
  dom.input.value = 'first';
  dom.button.click();
  const first = dom.box.innerHTML;
  dom.input.value = 'second';
  dom.button.click();
  assert.notEqual(dom.box.innerHTML, first);
  assert.equal(decodeSvg(dom.box.innerHTML), 'second');
});

test('C4d index.html 保留了约定的结构', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="container">/);
  assert.match(html, /<div id="box">/);
  assert.match(html, /<input placeholder="type the text"/);
  assert.match(html, /<button>/);
});
