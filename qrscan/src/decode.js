import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';

/**
 * 浏览器里把 wasm 指到本地 node_modules，避免默认走 jsDelivr CDN：
 * 这个页面承诺不产生上传，也不该在离线时打不开。
 * Node 测试里交给 zxing-wasm 自己的解析逻辑。
 */
const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
if (IS_BROWSER) {
  const wasmUrl = new URL(
    '../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm',
    import.meta.url,
  ).href;
  prepareZXingModule({
    overrides: {
      locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
  });
}

/** 图片解码时交给 zxing 的码制：空数组表示全部支持。 */
export const IMAGE_FORMATS = [];

/** 摄像头每帧只找常见的矩阵码，避免把一维码的全量扫描拖进实时循环。 */
export const CAMERA_FORMATS = ['QRCode', 'DataMatrix', 'Aztec', 'PDF417', 'MaxiCode'];

const CLOCK = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * 解码一张 ImageData。
 * 图片默认做三轮：常规 → 全局直方图二值化 → 去噪，后两轮只在没结果时跑，
 * 用来救低对比度或有点糊的照片；摄像头走 deep=false，只跑一轮。
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} imageData
 * @param {{formats?: string[], deep?: boolean, maxSymbols?: number}} [options]
 * @returns {Promise<{results: any[], elapsedMs: number}>}
 */
export async function decodeImageData(
  imageData,
  { formats = IMAGE_FORMATS, deep = true, maxSymbols = 8 } = {},
) {
  if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
    throw new TypeError('decodeImageData 需要一份有效的 ImageData');
  }

  const started = CLOCK();
  const base = {
    formats,
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    maxNumberOfSymbols: maxSymbols,
  };
  const attempts = [base];
  if (deep) {
    attempts.push({ ...base, binarizer: 'GlobalHistogram' }, { ...base, tryDenoise: true });
  }

  let results = [];
  let lastError;
  for (const options of attempts) {
    try {
      const found = await readBarcodes(imageData, options);
      results = found.filter((result) => result?.isValid);
    } catch (error) {
      lastError = error;
    }
    if (results.length) break;
  }

  if (!results.length && lastError) throw lastError;
  return { results, elapsedMs: Math.max(0, Math.round(CLOCK() - started)) };
}

const FORMAT_LABELS = {
  QRCode: '二维码',
  QRCodeModel1: 'QR M1',
  QRCodeModel2: '二维码',
  MicroQRCode: '微型 QR',
  RMQRCode: 'rMQR',
  DataMatrix: 'Data Matrix',
  Aztec: 'Aztec',
  AztecCode: 'Aztec',
  AztecRune: 'Aztec Rune',
  PDF417: 'PDF417',
  CompactPDF417: 'PDF417',
  MicroPDF417: 'MicroPDF417',
  MaxiCode: 'MaxiCode',
  Code128: 'Code 128',
  Code93: 'Code 93',
  Code39: 'Code 39',
  Code39Std: 'Code 39',
  Code39Ext: 'Code 39',
  Code32: 'Code 32',
  Codabar: 'Codabar',
  ITF: 'ITF',
  ITF14: 'ITF-14',
  EAN13: 'EAN-13',
  EAN8: 'EAN-8',
  EAN5: 'EAN-5',
  EAN2: 'EAN-2',
  UPCA: 'UPC-A',
  UPCE: 'UPC-E',
  ISBN: 'ISBN',
  PZN: 'PZN',
  Telepen: 'Telepen',
  TelepenAlpha: 'Telepen',
  TelepenNumeric: 'Telepen',
  DataBar: 'DataBar',
  DataBarOmni: 'DataBar',
  DataBarStk: 'DataBar',
  DataBarStkOmni: 'DataBar',
  DataBarLtd: 'DataBar',
  DataBarExp: 'DataBar',
  DataBarExpStk: 'DataBar',
  DXFilmEdge: 'DX Film Edge',
  OtherBarcode: '其他条码',
};

/** 码制的中文显示名；不认识的直接回退到原始枚举名。 */
export function formatLabel(format) {
  return FORMAT_LABELS[format] ?? format ?? '未知';
}

const CONTENT_RULES = [
  { kind: 'url', label: '链接', test: /^https?:\/\/\S+$/i },
  { kind: 'url', label: '链接', test: /^www\.\S+$/i, href: (text) => `https://${text}` },
  { kind: 'email', label: '邮件', test: /^mailto:\S+$/i },
  {
    kind: 'email',
    label: '邮件',
    test: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    href: (text) => `mailto:${text}`,
  },
  { kind: 'phone', label: '电话', test: /^tel:\S+$/i },
  { kind: 'sms', label: '短信', test: /^sms:\S+$/i },
  { kind: 'wifi', label: 'Wi-Fi', test: /^WIFI:/i, href: () => '' },
  { kind: 'vcard', label: '名片', test: /^BEGIN:VCARD/i, href: () => '' },
  { kind: 'calendar', label: '日历', test: /^BEGIN:VEVENT/i, href: () => '' },
  { kind: 'geo', label: '位置', test: /^geo:/i },
  { kind: 'otp', label: '动态口令', test: /^otpauth:\/\//i, href: () => '' },
  { kind: 'crypto', label: '加密地址', test: /^(bitcoin|ethereum|litecoin):/i, href: () => '' },
];

/**
 * 根据内容猜一个类型，顺便给出可安全打开的链接。
 * 只放行 http(s) / mailto / tel / sms / geo，不把任意文本变成 href。
 */
export function classifyContent(text) {
  const value = String(text ?? '').trim();
  for (const rule of CONTENT_RULES) {
    if (!rule.test.test(value)) continue;
    return {
      kind: rule.kind,
      label: rule.label,
      href: rule.href ? rule.href(value) : value,
    };
  }
  return { kind: 'text', label: '文本', href: '' };
}

/** zxing 的 extra 是一段 JSON 字符串，坏数据不应该影响结果展示。 */
export function parseExtra(extra) {
  if (!extra) return {};
  try {
    const parsed = JSON.parse(extra);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const encoder = new TextEncoder();

/**
 * 把 zxing 的 ReadResult 整理成页面直接能用的结构。
 * 文本、码制、内容类型、版本、纠错级别、字节数与检测框都在这里定下来。
 */
export function summarize(result) {
  const text = result?.text ?? '';
  const extra = parseExtra(result?.extra);
  const content = classifyContent(text);
  return {
    text,
    format: result?.format ?? 'None',
    formatLabel: formatLabel(result?.format),
    kind: content.kind,
    kindLabel: content.label,
    href: content.href,
    bytes: result?.bytes?.length ?? encoder.encode(text).length,
    version: String(extra.Version ?? result?.version ?? ''),
    ecLevel: String(extra.ECLevel ?? result?.ecLevel ?? ''),
    rotation: Number(result?.rotation ?? 0),
    inverted: Boolean(result?.isInverted),
    mirrored: Boolean(result?.isMirrored),
    contentType: result?.contentType ?? '',
    position: result?.position ?? null,
  };
}
