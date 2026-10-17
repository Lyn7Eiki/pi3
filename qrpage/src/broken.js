import { layout, toSvg } from './render.js';

/** 与 27 字符的 v3 码同尺寸，看起来更像"本来的那张码"。 */
const SIZE = 29;
const CELL_SIZE = 8;
const QUIET = 4;
const SEED = 20241016;
/** 笔触宽度（单位：模块）。 */
const STROKE_WIDTH = 1.8;
/** 笔触颜色：紫。 */
const STROKE_COLOR = '#7c3aed';

/** 确定性伪随机（LCG）：同样的输入每次画出同样的破图，便于断言。 */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function finder(matrix, top, left) {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      matrix[top + r][left + c] =
        r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
    }
  }
}

/** 5x5 对齐图案：版本 3 的码在这里会有一个，加上更像真码。 */
function alignment(matrix, top, left) {
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      matrix[top + r][left + c] =
        r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
    }
  }
}

function timing(matrix, size) {
  for (let i = 8; i <= size - 9; i += 1) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
}

/**
 * 一张"看着像二维码、其实扫不出来"的矩阵：
 * 随机模块 + 三处定位图案 + 时序图案 + 对齐图案，骨架完整，方便再往上叠涂鸦。
 */
export function brokenMatrix({ size = SIZE, seed = SEED } = {}) {
  const rand = lcg(seed);
  const matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => rand() < 0.5),
  );
  finder(matrix, 0, 0);
  finder(matrix, 0, size - 7);
  finder(matrix, size - 7, 0);
  timing(matrix, size);
  alignment(matrix, size - 9, size - 9);
  return { size, matrix };
}

/**
 * 涂鸦笔触，坐标单位是"模块"（可以是小数）。
 * 两条对角线大叉 + 四条短划，模仿马克笔在码上随手划过的样子。
 */
export function strokeLines(size = SIZE) {
  return [
    [[0.6, 1.0], [size - 0.6, size - 1.2]],
    [[size - 0.8, 0.8], [0.8, size - 1.0]],
    [[1.2, 8.2], [9.5, 12.6]],
    [[16.8, 4.4], [24.2, 8.2]],
    [[2.4, 18.8], [11.2, 25.4]],
    [[17.6, 17.2], [25.8, 22.4]],
  ];
}

/** 被破坏的二维码 SVG：骨架 + 粗黑笔触，带 data-broken 标记。 */
export function brokenSvg({ size = SIZE, seed = SEED } = {}) {
  const geometry = layout(brokenMatrix({ size, seed }), { cellSize: CELL_SIZE, quiet: QUIET });

  const lines = strokeLines(size)
    .map(
      ([[x1, y1], [x2, y2]]) =>
        `<line x1="${((x1 + QUIET) * CELL_SIZE).toFixed(1)}"` +
        ` y1="${((y1 + QUIET) * CELL_SIZE).toFixed(1)}"` +
        ` x2="${((x2 + QUIET) * CELL_SIZE).toFixed(1)}"` +
        ` y2="${((y2 + QUIET) * CELL_SIZE).toFixed(1)}"/>`,
    )
    .join('');

  const extra =
    `<g fill="none" stroke="${STROKE_COLOR}" stroke-linecap="round"` +
    ` stroke-width="${STROKE_WIDTH * CELL_SIZE}">${lines}</g>`;

  return toSvg(geometry, { label: 'broken qrcode', attrs: 'data-broken="true"', extra });
}
