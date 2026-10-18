import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBarcodes } from 'zxing-wasm/reader';
import { encode } from '../src/encode.js';
import { MAX_CHARS } from '../src/app.js';

/** 真实业务编号（房间/设备号），从现场导出的清单原样放进 fixtures。 */
const CORPUS = readFileSync(new URL('./fixtures/qrdata.txt', import.meta.url), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

/** 把矩阵光栅化成解码器能吃的像素缓冲。 */
function rasterize({ size, matrix }, scale = 8, quiet = 4) {
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

/** 编码 → 光栅化 → 独立解码；返回 { format, text } 或 null。
 *  限定 formats：不限时 zxing 会把所有码制都试一遍，单条要上百毫秒。 */
async function roundTrip(text, symbology) {
  const formats = symbology === 'dm' ? ['DataMatrix'] : ['QRCode'];
  const [res] = await readBarcodes(rasterize(encode(text, { symbology })), { formats, tryHarder: true });
  return res ? { format: res.format, text: res.text } : null;
}

// 每条编号单独成例：失败时能直接点名是哪个编号、哪种码制
for (const text of CORPUS) {
  test(`C14a [QR] ${text} 编码后解码与原文一致`, async () => {
    const got = await roundTrip(text, 'qr');
    assert.equal(got?.format, 'QRCode', '应被识别为二维码');
    assert.equal(got?.text, text);
  });
}

for (const text of CORPUS) {
  test(`C14b [DM] ${text} 编码后解码与原文一致`, async () => {
    const got = await roundTrip(text, 'dm');
    assert.equal(got?.format, 'DataMatrix', '应被识别为 Data Matrix');
    assert.equal(got?.text, text);
  });
}

/** 二维码的合法边长：21 + 4k。 */
const QR_SIZES = new Set(Array.from({ length: 40 }, (_, i) => 21 + i * 4));

/** Data Matrix 的合法正方形边长。 */
const DM_SIZES = new Set([10, 12, 14, 16, 18, 20, 22, 24, 26, 32, 36, 40, 44, 48, 52, 64, 72, 80, 88, 96, 104, 120, 132, 144]);

/** 二维码的 7x7 定位图案：外框黑、内圈白、中心 3x3 黑。返回第一个不符的坐标，全符返回 null。 */
function finderMismatch(matrix, top, left) {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const expectDark =
        r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      if (matrix[top + r][left + c] !== expectDark) return `(${top + r},${left + c})`;
    }
  }
  return null;
}

// 编码本身也单独成例：不依赖解码器，只看矩阵结构对不对
for (const text of CORPUS) {
  test(`C14d [QR] ${text} 编码出的矩阵结构合法`, () => {
    const { size, matrix } = encode(text, { symbology: 'qr' });

    assert.ok(QR_SIZES.has(size), `${size} 不是合法的二维码边长`);
    assert.equal(matrix.length, size);
    matrix.forEach((row) => assert.equal(row.length, size, '矩阵应为正方形'));

    assert.equal(finderMismatch(matrix, 0, 0), null, '左上定位图案');
    assert.equal(finderMismatch(matrix, 0, size - 7), null, '右上定位图案');
    assert.equal(finderMismatch(matrix, size - 7, 0), null, '左下定位图案');
    assert.equal(matrix[size - 8][8], true, '规范固定的 dark module');
  });
}

for (const text of CORPUS) {
  test(`C14e [DM] ${text} 编码出的矩阵结构合法`, () => {
    const { size, matrix } = encode(text, { symbology: 'dm' });

    assert.ok(DM_SIZES.has(size), `${size} 不是合法的 Data Matrix 边长`);
    assert.equal(matrix.length, size);
    matrix.forEach((row) => assert.equal(row.length, size, '矩阵应为正方形'));

    matrix.forEach((row, i) => assert.equal(row[0], true, `左边第 ${i} 行应为实线`));
    assert.ok(matrix[size - 1].every(Boolean), '底边应为实线');
    assert.ok(matrix[0].every((v, i) => v === (i % 2 === 0)), '顶边应为交替时序');
    assert.ok(matrix.every((row, i) => row[size - 1] === (i % 2 === 1)), '右边应为交替时序');
  });
}

test('C14c 语料本身合规：非空、无空白、都在 27 字符业务上限内', () => {
  assert.equal(new Set(CORPUS).size, CORPUS.length, '不该有重复编号');

  for (const text of CORPUS) {
    assert.ok(text.length > 0, '不该有空行');
    assert.equal(text, text.trim(), `${JSON.stringify(text)} 带首尾空白`);
    assert.ok([...text].length <= MAX_CHARS, `${text} 超过 ${MAX_CHARS} 字符`);
  }
});
