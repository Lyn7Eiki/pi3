import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr'; // 只用于空 payload，见 C2f
import { readBarcodes } from 'zxing-wasm/reader';
import { encode } from '../src/qr.js';

const SCALE = 8; // 每个模块 8 像素，解码器对过小的码识别不稳
const QUIET = 4; // 静区 4 模块，规范要求

/** 把矩阵光栅化成解码器能吃的 RGBA 像素缓冲。 */
function rasterize({ size, matrix }, scale = SCALE, quiet = QUIET) {
  const side = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!matrix[r][c]) continue;
      for (let y = (r + quiet) * scale; y < (r + quiet + 1) * scale; y += 1) {
        for (let x = (c + quiet) * scale; x < (c + quiet + 1) * scale; x += 1) {
          const i = (y * side + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { data, width: side, height: side };
}

/** 输入文本 → 编码 → 光栅化 → 独立解码器 zxing-wasm → 应还原原文本 */
async function roundTrip(text) {
  const img = rasterize(encode(text));
  const [res] = await readBarcodes(img, { formats: ['QRCode'], tryHarder: true });
  assert.ok(res, `zxing-wasm 解不出任何内容：${JSON.stringify(text.slice(0, 20))}`);
  return res.text;
}

test('C2a ASCII 往返', async () => {
  assert.equal(await roundTrip('hello'), 'hello');
});

test('C2b 空格与标点往返', async () => {
  assert.equal(await roundTrip('hello, world!'), 'hello, world!');
});

test('C2c 中文往返', async () => {
  assert.equal(await roundTrip('你好，世界'), '你好，世界');
});

test('C2d 长文本往返（200 字符）', async () => {
  const s = 'A'.repeat(200);
  assert.equal(await roundTrip(s), s);
});

test('C2e URL 往返', async () => {
  const s = 'https://example.com/a?b=1&c=2';
  assert.equal(await roundTrip(s), s);
});

test('C2f 空串走 qrcode-generator 兜底：zxing 读不出空 payload，用 jsQR 判', () => {
  const encoded = encode('');
  assert.ok(encoded.size >= 21);

  const img = rasterize(encoded);
  const res = jsQR(img.data, img.width, img.height);
  assert.equal(res ? res.data : null, '');
});
