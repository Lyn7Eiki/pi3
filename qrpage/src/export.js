import { DISPLAY_PX } from './render.js';

/**
 * 浏览器里把 SVG 字符串转成 PNG Blob（依赖 canvas）。
 * 走这条路是因为破坏图上的笔触不在矩阵里，必须按"当前显示的 SVG"来转。
 */
export async function svgToPngBlob(svg, size = DISPLAY_PX) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.width = size;
    img.height = size;
    await new Promise((ok, fail) => {
      img.onload = ok;
      img.onerror = () => fail(new Error('SVG 载入失败'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').drawImage(img, 0, 0, size, size);

    return await new Promise((ok, fail) => {
      canvas.toBlob((blob) => (blob ? ok(blob) : fail(new Error('toBlob 失败'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 触发浏览器下载。 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
