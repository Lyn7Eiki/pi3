/** 解码前把图片缩到这个长边以内：再大既慢，对识别也没有帮助。 */
export const MAX_SIDE = 1600;

/**
 * 等比缩放，长边不超过 maxSide。小图不放大，避免无意义的插值。
 * @returns {{width: number, height: number, scale: number}}
 */
export function fitWithin(width, height, maxSide = MAX_SIDE) {
  if (!(width > 0) || !(height > 0)) throw new RangeError('图片尺寸必须是正数');
  if (!(maxSide > 0)) throw new RangeError('maxSide 必须是正数');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * 把 File / Blob 变成画布 + ImageData。
 * 优先 createImageBitmap（能按 EXIF 方向摆正），失败再退回 <img>；
 * SVG、HEIC 之类浏览器解码能力不同的格式都走这条兜底路。
 */
async function decodeBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // 继续走 <img>
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    if (typeof img.decode === 'function') {
      await img.decode();
    } else {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('图片解码失败'));
      });
    }
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 读取图片、按长边缩放、画出画布并取出像素。
 * 返回的 canvas 直接给预览用，imageData 给解码器用，两者坐标一致。
 *
 * @param {File|Blob} file
 * @param {{maxSide?: number, createBitmap?: (file: File|Blob) => Promise<any>, canvasFactory?: (w: number, h: number) => HTMLCanvasElement}} [options]
 */
export async function loadImageFile(
  file,
  { maxSide = MAX_SIDE, createBitmap = decodeBitmap, canvasFactory = makeCanvas } = {},
) {
  if (!file) throw new TypeError('没有拿到图片文件');

  const bitmap = await createBitmap(file);
  const originalWidth = bitmap.naturalWidth ?? bitmap.width;
  const originalHeight = bitmap.naturalHeight ?? bitmap.height;
  if (!(originalWidth > 0) || !(originalHeight > 0)) {
    throw new Error('图片尺寸为空');
  }

  const { width, height } = fitWithin(originalWidth, originalHeight, maxSide);
  const canvas = canvasFactory(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器没有提供 2D 画布');

  if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
  // 透明 PNG 的白区会保留 alpha=0，直接取像素会被当成黑色；先铺白底再画。
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const imageData = context.getImageData(0, 0, width, height);
  return {
    canvas,
    imageData,
    width,
    height,
    originalWidth,
    originalHeight,
    scale: width / originalWidth,
  };
}
