import bwipjs from 'bwip-js';

/** 用 bwip-js 独立生成码矩阵，避免拿解码器自己的输出当测试输入。 */
export function encodeMatrix(text, { symbology = 'qr', ecLevel = 'M' } = {}) {
  const bcid = symbology === 'dm' ? 'datamatrix' : 'qrcode';
  const options = { bcid, text };
  if (symbology === 'qr') options.eclevel = ecLevel;
  const [raw] = bwipjs.raw(options);
  return { width: raw.pixx, height: raw.pixy, pixs: raw.pixs };
}

/** 矩阵 → RGBA 像素，留 4 模块静区，每模块 scale 像素。 */
export function rasterize({ width, height, pixs }, { scale = 8, quiet = 4 } = {}) {
  const canvasWidth = (width + quiet * 2) * scale;
  const canvasHeight = (height + quiet * 2) * scale;
  const data = new Uint8ClampedArray(canvasWidth * canvasHeight * 4).fill(255);

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      if (!pixs[row * width + col]) continue;
      for (let y = (row + quiet) * scale; y < (row + quiet + 1) * scale; y += 1) {
        for (let x = (col + quiet) * scale; x < (col + quiet + 1) * scale; x += 1) {
          const index = (y * canvasWidth + x) * 4;
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 255;
        }
      }
    }
  }

  return { data, width: canvasWidth, height: canvasHeight };
}

/** 反色：模拟深底浅码。 */
export function invert({ data, width, height }) {
  const next = new Uint8ClampedArray(data);
  for (let i = 0; i < next.length; i += 4) {
    next[i] = 255 - next[i];
    next[i + 1] = 255 - next[i + 1];
    next[i + 2] = 255 - next[i + 2];
  }
  return { data: next, width, height };
}

/** 顺时针旋转 90°。 */
export function rotate90({ data, width, height }) {
  const next = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 4;
      const toX = height - 1 - y;
      const toY = x;
      const to = (toY * height + toX) * 4;
      next[to] = data[from];
      next[to + 1] = data[from + 1];
      next[to + 2] = data[from + 2];
      next[to + 3] = data[from + 3];
    }
  }
  return { data: next, width: height, height: width };
}
