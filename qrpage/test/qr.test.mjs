import test from 'node:test';
import assert from 'node:assert/strict';
import { encode } from '../src/qr.js';

/** 7x7 定位图案：外框黑、内圈白、中心 3x3 黑。返回第一个不符的坐标，全符返回 null。 */
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

test('C1a 输入 "hello" → 版本 1 的 21x21 矩阵', () => {
  const { size, matrix } = encode('hello');
  assert.equal(size, 21);
  assert.equal(matrix.length, 21);
  assert.equal(matrix[0].length, 21);
});

test('C1b 三个 7x7 定位图案位置正确', () => {
  const { size, matrix } = encode('hello');
  assert.equal(finderMismatch(matrix, 0, 0), null, '左上');
  assert.equal(finderMismatch(matrix, 0, size - 7), null, '右上');
  assert.equal(finderMismatch(matrix, size - 7, 0), null, '左下');
});

test('C1c 时序图案在第 6 行/第 6 列交替', () => {
  const { size, matrix } = encode('hello');
  for (let c = 8; c <= size - 9; c += 1) {
    assert.equal(matrix[6][c], c % 2 === 0, `第6行第${c}列`);
  }
  for (let r = 8; r <= size - 9; r += 1) {
    assert.equal(matrix[r][6], r % 2 === 0, `第${r}行第6列`);
  }
});

test('C1d 规范固定的 dark module 在 (size-8, 8)', () => {
  const { size, matrix } = encode('hello');
  assert.equal(matrix[size - 8][8], true);
});

test('C1e 中文按 UTF-8 编码：能生成且与同长度 ASCII 不同', () => {
  const zh = encode('你好');
  const ascii = encode('hi');
  assert.ok(zh.size >= 21);
  assert.notDeepEqual(zh.matrix, ascii.matrix);
});
