/** 多码时依次轮换的检测框颜色。 */
export const ACCENTS = ['#2f9e6f', '#c8862c', '#3d6fd8', '#9a56c4', '#c15a3f', '#2f8f96'];

export function accentFor(index) {
  return ACCENTS[index % ACCENTS.length];
}

const round = (value) => Math.round(value * 10) / 10;

/** zxing 的 position 四个角 → SVG polygon 的 points；缺角就返回空串。 */
export function polygonPoints(position) {
  if (!position) return '';
  const corners = [position.topLeft, position.topRight, position.bottomRight, position.bottomLeft];
  if (corners.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return '';
  }
  return corners.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
}

/**
 * 生成检测框的 SVG 内容（不含外层 <svg>，直接塞进现成的 overlay）。
 * 白描边垫底，彩色描边在上，深浅背景都看得见。
 */
export function overlayMarkup(results, width, height) {
  if (!Array.isArray(results) || !results.length || !(width > 0) || !(height > 0)) return '';

  const badgeRadius = Math.max(9, Math.min(width, height) * 0.022);
  const badgeFont = Math.max(10, badgeRadius * 1.15);

  return results
    .map((result, index) => {
      const points = polygonPoints(result.position);
      if (!points) return '';

      const accent = accentFor(index);
      const corner = result.position.topLeft;
      const badge = corner
        ? `<g>
             <circle cx="${round(corner.x)}" cy="${round(corner.y)}" r="${round(badgeRadius)}"
               fill="${accent}" stroke="#fff" stroke-width="1.5" />
             <text x="${round(corner.x)}" y="${round(corner.y)}" fill="#fff"
               font-family="ui-monospace, monospace" font-size="${round(badgeFont)}"
               font-weight="700" text-anchor="middle" dominant-baseline="central">${index + 1}</text>
           </g>`
        : '';

      return `<g data-code-index="${index}">
        <polygon points="${points}" fill="none" stroke="rgba(255,255,255,.8)"
          stroke-width="5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        <polygon points="${points}" fill="${accent}" fill-opacity="0.13" stroke="${accent}"
          stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        ${badge}
      </g>`;
    })
    .join('');
}
