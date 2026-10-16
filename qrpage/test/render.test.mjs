import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { encode } from '../src/qr.js';
import { layout, toSvg } from '../src/render.js';

const countDark = ({ matrix }) => matrix.flat().filter(Boolean).length;

/** 按 layout 给出的几何光栅化，用来独立验证"画出来的东西"能被扫出来。 */
function rasterFromRects({ width, height, rects }) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.size; y += 1) {
      for (let x = r.x; x < r.x + r.size; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

test('C3a 方块数等于暗模块数，画布边长 = (size + 2*quiet) * cellSize', () => {
  const qr = encode('hello');
  const l = layout(qr);
  assert.equal(l.rects.length, countDark(qr));
  assert.equal(l.width, (21 + 8) * 8);
  assert.equal(l.height, l.width);
});

test('C3b 静区：所有方块都在四周 4 格留白之内', () => {
  const { rects, width } = layout(encode('hello'));
  const pad = 4 * 8;
  for (const r of rects) {
    assert.ok(r.x >= pad && r.y >= pad, `起点越界 (${r.x},${r.y})`);
    assert.ok(r.x + r.size <= width - pad, `右边界越界 ${r.x + r.size}`);
    assert.ok(r.y + r.size <= width - pad, `下边界越界 ${r.y + r.size}`);
  }
});

test('C3c SVG 字符串：rect 数量与 viewBox 正确', () => {
  const qr = encode('hello');
  const svg = toSvg(layout(qr));
  assert.equal((svg.match(/<rect/g) || []).length, countDark(qr));
  assert.match(svg, /viewBox="0 0 232 232"/);
  assert.match(svg, /<svg [^>]*width="232" height="232"/);
});

test('C3d 端到端：按渲染几何光栅化后 jsQR 解出原文本', () => {
  const text = '你好，世界';
  const img = rasterFromRects(layout(encode(text)));
  const res = jsQR(img.data, img.width, img.height);
  assert.ok(res, 'jsQR 解不出任何内容');
  assert.equal(res.data, text);
});
