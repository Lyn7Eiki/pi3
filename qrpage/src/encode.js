import bwipjs from 'bwip-js';
import qrcode from '../vendor/qrcode-generator.js';

// 兜底用的 qrcode-generator 默认按 Latin-1 取字节，中文会变成乱码；改用 UTF-8。
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/** 码制 → bwip-js 的 bcid。 */
export const BCIDS = { qr: 'qrcode', dm: 'datamatrix' };

/**
 * bwip-js 的 raw() 不画图，直接给模块矩阵：
 * pixs 是行优先的 0/1，pixx × pixy 是模块数。
 */
function fromBwip(text, { bcid, ecLevel }) {
  const opts = { bcid, text };
  // 纠错级别只有二维码能指定，Data Matrix 由尺寸决定
  if (bcid === BCIDS.qr) opts.eclevel = ecLevel;

  const [raw] = bwipjs.raw(opts);
  const { pixx: size, pixy, pixs } = raw;
  if (size !== pixy) throw new Error(`矩阵应为正方形，实际 ${size}x${pixy}`);

  const matrix = [];
  for (let r = 0; r < size; r += 1) {
    matrix.push(pixs.slice(r * size, (r + 1) * size).map(Boolean));
  }
  return { size, matrix };
}

/**
 * BWIPP 拒绝空数据（bwipp.qrcodeEmptyData），空串只能退回 qrcode-generator：
 * 它允许零长度内容，扫出来是空串。Data Matrix 没有这种兜底。
 */
function fromEmptyQr(ecLevel) {
  const qr = qrcode(0, ecLevel);
  qr.addData('');
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

/**
 * 把文本编码成码矩阵。
 * @param {string} text 要编码的文本；空串只有 QR 能表示
 * @param {{symbology?: 'qr'|'dm', ecLevel?: 'L'|'M'|'Q'|'H'}} [opts]
 * @returns {{size: number, matrix: boolean[][]}} matrix[row][col]，true = 黑
 */
export function encode(text, { symbology = 'qr', ecLevel = 'M' } = {}) {
  if (typeof text !== 'string') throw new TypeError('text 必须是字符串');

  const bcid = BCIDS[symbology];
  if (!bcid) throw new Error(`不认识的码制：${symbology}`);

  if (text === '') {
    if (symbology === 'qr') return fromEmptyQr(ecLevel);
    throw new Error(`${symbology} 无法编码空内容`);
  }
  return fromBwip(text, { bcid, ecLevel });
}
