import test from 'node:test';
import assert from 'node:assert/strict';
import { readBarcodes } from 'zxing-wasm/reader';
import { encode } from '../src/encode.js';
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

test('C3c 所有码显示尺寸与位置恒定：黑块恒 232px、静区恒 32px', () => {
  for (const text of ['1', 'hello', '1234567890123456789012345', '123456789012345678901234567']) {
    const qr = encode(text);
    const svg = toSvg(layout(qr));

    assert.match(svg, /width="296" height="296"/, `${text} 的显示边长`);
    assert.match(svg, /viewBox="0 0 296 296"/, `${text} 的坐标系`);

    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/g)].map(
      (m) => m.slice(1).map(Number),
    );
    const minX = Math.min(...rects.map((r) => r[0]));
    const minY = Math.min(...rects.map((r) => r[1]));
    assert.ok(Math.abs(minX - 32) < 0.01, `${text} 左上角 x=${minX}，应恒为 32`);
    assert.ok(Math.abs(minY - 32) < 0.01, `${text} 左上角 y=${minY}，应恒为 32`);

    const modulePx = rects[0][2];
    assert.ok(Math.abs(modulePx * qr.size - 232) < 0.2, `${text} 黑块 ${modulePx * qr.size}px`);
  }

  const qr = encode('hello');
  assert.equal((toSvg(layout(qr)).match(/<rect/g) || []).length, countDark(qr));
});

test('C3d 端到端：按渲染几何光栅化后 zxing-wasm 解出原文本', async () => {
  const text = '你好，世界';
  const img = rasterFromRects(layout(encode(text)));
  const [res] = await readBarcodes(img, { formats: ['QRCode'], tryHarder: true });
  assert.ok(res, 'zxing-wasm 解不出任何内容');
  assert.equal(res.text, text);
});
