/**
 * 渲染几何：把矩阵算成一组方块，纯数据、无 DOM，便于断言。
 * @param {{size: number, matrix: boolean[][]}} qr
 * @param {{cellSize?: number, quiet?: number}} [opts] quiet = 静区格数
 * @returns {{width: number, height: number, cellSize: number, quiet: number,
 *            rects: {x: number, y: number, size: number}[]}}
 */
export function layout({ size, matrix }, { cellSize = 8, quiet = 4 } = {}) {
  const side = (size + quiet * 2) * cellSize;
  const rects = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (matrix[r][c]) {
        rects.push({
          x: (c + quiet) * cellSize,
          y: (r + quiet) * cellSize,
          size: cellSize,
        });
      }
    }
  }
  return { width: side, height: side, cellSize, quiet, rects };
}

/** 把几何序列化成 SVG 字符串。不含背景色，静区由页面 CSS 负责。 */
export function toSvg({ width, height, rects }, { label = 'qrcode', attrs = '', extra = '' } = {}) {
  const squares = rects
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.size}" height="${r.size}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"` +
    (attrs ? ` ${attrs}` : '') +
    ` shape-rendering="crispEdges">${squares}${extra}</svg>`
  );
}
