import qrcode from '../vendor/qrcode-generator.js';

// 库默认按 Latin-1 取字节，中文会变成乱码；改用 UTF-8。
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/**
 * 把文本编码成二维码矩阵。
 * @param {string} text 要编码的文本
 * @param {{typeNumber?: number, ecLevel?: 'L'|'M'|'Q'|'H'}} [opts]
 * @returns {{size: number, matrix: boolean[][]}} matrix[row][col]，true = 黑
 */
export function encode(text, { typeNumber = 0, ecLevel = 'M' } = {}) {
  if (typeof text !== 'string') throw new TypeError('text 必须是字符串');

  const qr = qrcode(typeNumber, ecLevel);
  qr.addData(text);
  qr.make();

  const size = qr.getModuleCount();
  const matrix = [];
  for (let r = 0; r < size; r += 1) {
    const row = [];
    for (let c = 0; c < size; c += 1) row.push(qr.isDark(r, c));
    matrix.push(row);
  }
  return { size, matrix };
}
