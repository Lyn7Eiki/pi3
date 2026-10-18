/** 黑色区域边长：以 27 个字符那张码为准，29 模块 × 8px。 */
export const CODE_PX = 232;

/** 每边静区：4 个模块 × 8px。 */
export const QUIET_PX = 32;

/** 整张图的显示边长：所有码都一样，位置也不动。 */
export const DISPLAY_PX = CODE_PX + QUIET_PX * 2;

/**
 * 渲染几何：把矩阵算成一组方块，纯数据、无 DOM，便于断言。
 * 坐标单位是"像素"，基于 cellSize 的原始比例，不含显示缩放。
 * @param {{size: number, matrix: boolean[][]}} qr
 * @param {{cellSize?: number, quiet?: number}} [opts] quiet = 静区格数
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

/**
 * 把"模块坐标"映射到固定的 296px 显示空间。
 * 黑块恒为 CODE_PX、静区恒为 QUIET_PX，因此换内容时码既不缩放也不位移，
 * 只有模块边长随版本变化（232 / 模块数）。
 */
export function projector({ width, cellSize, quiet }) {
  const size = width / cellSize - quiet * 2;
  const modulePx = CODE_PX / size;
  return {
    size,
    modulePx,
    point: (mx, my) => [QUIET_PX + mx * modulePx, QUIET_PX + my * modulePx],
  };
}

/**
 * 把几何序列化成 SVG 字符串。不含背景色，静区由页面 CSS 负责。
 */
export function toSvg(geometry, { label = 'qrcode', attrs = '', extra = '' } = {}) {
  const { rects, cellSize, quiet } = geometry;
  const p = projector(geometry);
  const squares = rects
    .map((r) => {
      const [x, y] = p.point(r.x / cellSize - quiet, r.y / cellSize - quiet);
      return (
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}"` +
        ` width="${p.modulePx.toFixed(2)}" height="${p.modulePx.toFixed(2)}"/>`
      );
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${DISPLAY_PX}" height="${DISPLAY_PX}"` +
    ` viewBox="0 0 ${DISPLAY_PX} ${DISPLAY_PX}" role="img" aria-label="${label}"` +
    (attrs ? ` ${attrs}` : '') +
    ` shape-rendering="crispEdges">${squares}${extra}</svg>`
  );
}
