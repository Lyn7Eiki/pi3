import { encode } from './encode.js';
import { layout, toSvg } from './render.js';
import { brokenSvg } from './broken.js';
import { svgToPngBlob, downloadBlob, copyBlob } from './export.js';

/** 纠错级别固定为 M，不随内容自动变化。 */
export const EC_LEVEL = 'M';

/** 业务约定的字符数上限：超过就打印日志提示。 */
export const MAX_CHARS = 27;

/** 提示文案出错时的颜色：红。 */
export const NOTE_ERROR_COLOR = '#dc2626';

/** 可切换的码制：label 是按钮文案，symbology 交给 encode()。 */
export const MODES = [
  { label: 'QR', symbology: 'qr' },
  { label: 'DM', symbology: 'dm' },
];

/**
 * 把输入框、按钮、显示区接起来。
 * - 空文本：QR 照常出码（内容为空，扫出来是空串）；DM 表示不了空内容，直接不出码
 * - 超过 MAX_CHARS 个字符：打印日志，并显示一张"被破坏的二维码"，不给出可用的码
 * @param {{input: any, button: any, box: any}} dom
 * @param {{log?: (...args: any[]) => void}} [deps] 便于测试注入
 * @returns {() => void} 手动触发一次渲染
 */
export function bindApp(
  { input, button, box, textEl, modeBtns, exportBtn, copyBtn },
  {
    log = console.log,
    toBlob = svgToPngBlob,
    download = downloadBlob,
    copy = copyBlob,
  } = {},
) {
  let lastSvg = '';
  let mode = 0;

  /** 码下面那行原文：出错时换成红字提示。 */
  const setNote = (text, { error = false } = {}) => {
    if (!textEl) return;
    textEl.textContent = text;
    if (textEl.style) textEl.style.color = error ? NOTE_ERROR_COLOR : '';
  };

  const render = () => {
    const text = input.value;
    const symbology = MODES[mode].symbology;

    const chars = [...text].length; // 字母、数字、空格各算 1 个
    if (chars > MAX_CHARS) {
      log(`文本超过 ${MAX_CHARS} 个字符（当前 ${chars} 个）`);
      lastSvg = brokenSvg({ symbology });
      box.innerHTML = lastSvg;
      setNote(`"${text}"`);
      return;
    }

    // Data Matrix 表示不了空内容：给一张 DM 形状的破坏图，并用红字说明
    if (text === '' && symbology === 'dm') {
      log('Data Matrix 不支持空串');
      lastSvg = brokenSvg({ symbology: 'dm' });
      box.innerHTML = lastSvg;
      setNote('不支持空串', { error: true });
      return;
    }

    lastSvg = toSvg(layout(encode(text, { symbology, ecLevel: EC_LEVEL })), {
      label: symbology === 'dm' ? 'data matrix' : 'qrcode',
    });
    box.innerHTML = lastSvg;
    setNote(`"${text}"`);
  };

  button.addEventListener('click', render);

  if (modeBtns && modeBtns.length) {
    const applyMode = () => {
      modeBtns.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === mode)));
    };
    modeBtns.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        mode = i;
        applyMode();
        render(); // 换码制要立刻重画
      });
    });
    applyMode();
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      if (!lastSvg) return;
      const blob = await toBlob(lastSvg);
      download(blob, 'qrcode.png');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!lastSvg) return;
      try {
        await copy(await toBlob(lastSvg));
      } catch (e) {
        // 剪贴板可能被浏览器或权限拒绝，别让它变成未捕获异常
        log('复制图片失败：', e);
      }
    });
  }

  return render;
}
