import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { bindApp, MAX_CHARS, EC_LEVEL } from '../src/app.js';
import { brokenSvg, strokeLines } from '../src/broken.js';

function stubDom() {
  const button = {
    addEventListener(type, fn) {
      if (type === 'click') this.click = fn;
    },
  };
  return { input: { value: '' }, button, box: { innerHTML: '' } };
}

/** 从 #box 的 SVG 字符串还原成像素再解码；解不出返回 null。 */
function decodeSvg(svg) {
  const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const m of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    const [x, y, rw, rh] = m.slice(1).map(Number);
    // 坐标可能带小数：按"像素中心是否落在格内"填色，避免格间漏掉一列像素
    for (let yy = Math.floor(y); yy < Math.ceil(y + rh); yy += 1) {
      if (yy + 0.5 < y || yy + 0.5 >= y + rh) continue;
      for (let xx = Math.floor(x); xx < Math.ceil(x + rw); xx += 1) {
        if (xx + 0.5 < x || xx + 0.5 >= x + rw) continue;
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

function clickWith(text) {
  const dom = stubDom();
  const logs = [];
  bindApp(dom, { log: (...args) => logs.push(args) });
  dom.input.value = text;
  dom.button.click();
  return { dom, logs };
}

test('C6a 常量：纠错固定 M、上限 27 字符', () => {
  assert.equal(EC_LEVEL, 'M');
  assert.equal(MAX_CHARS, 27);
});

test('C6b 恰好 27 个字符：不打日志，出可用码', () => {
  const text = 'A'.repeat(27);
  const { dom, logs } = clickWith(text);
  assert.equal(logs.length, 0);
  assert.equal(decodeSvg(dom.box.innerHTML), text);
});

test('C6c 28 个字符：打日志，出被破坏的码（扫不出来）', () => {
  const { dom, logs } = clickWith('A'.repeat(28));
  assert.equal(logs.length, 1);
  assert.match(String(logs[0][0]), /超过 27 个字符/);
  assert.match(dom.box.innerHTML, /data-broken="true"/);
  assert.equal(decodeSvg(dom.box.innerHTML), null, '破坏图必须解不出内容');
});

test('C6d 空格也算 1 个字符：26 字母 + 1 空格 = 27 正常，再 +1 空格 = 28 破坏', () => {
  const ok = clickWith('A'.repeat(26) + ' ');
  assert.equal(ok.logs.length, 0);
  assert.equal(decodeSvg(ok.dom.box.innerHTML), 'A'.repeat(26) + ' ');

  const over = clickWith('A'.repeat(26) + '  ');
  assert.equal(over.logs.length, 1);
  assert.match(over.dom.box.innerHTML, /data-broken="true"/);
});

test('C6e 汉字同样按字符计：27 正常，28 破坏', () => {
  const ok = clickWith('好'.repeat(27));
  assert.equal(ok.logs.length, 0);
  assert.equal(decodeSvg(ok.dom.box.innerHTML), '好'.repeat(27));

  const over = clickWith('好'.repeat(28));
  assert.equal(over.logs.length, 1);
  assert.match(over.dom.box.innerHTML, /data-broken="true"/);
});

test('C6g 破坏图 = 二维码骨架 + 粗黑笔触', () => {
  const svg = brokenSvg();
  assert.match(svg, /data-broken="true"/);
  assert.equal((svg.match(/<line /g) || []).length, strokeLines().length, '笔触条数');
  assert.match(svg, /stroke-linecap="round"/);
  assert.match(svg, /stroke="#7c3aed"/, '笔触应为紫色');
  assert.match(svg, /stroke-width="14.4"/); // 1.8 模块 × 8 px
  assert.ok((svg.match(/<rect /g) || []).length > 100, '骨架方块还在');
});

test('C6f 破坏图是确定性的：同一份 SVG 每次相同', () => {
  const a = clickWith('B'.repeat(28));
  const b = clickWith('C'.repeat(99));
  assert.equal(a.dom.box.innerHTML, b.dom.box.innerHTML);
  assert.equal(brokenSvg(), brokenSvg());
});
