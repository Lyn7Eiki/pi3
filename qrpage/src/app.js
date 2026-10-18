import { encode } from './qr.js';
import { layout, toSvg } from './render.js';
import { brokenSvg } from './broken.js';
import { svgToPngBlob, downloadBlob, copyBlob } from './export.js';

/** 纠错级别固定为 M，不随内容自动变化。 */
export const EC_LEVEL = 'M';

/** 业务约定的字符数上限：超过就打印日志提示。 */
export const MAX_CHARS = 27;

/** 可切换的码制。Data Matrix 还没实现，切换只影响按钮文案。 */
export const MODES = ['QR', 'DM'];

/**
 * 把输入框、按钮、显示区接起来。
 * - 空文本：照常出码（内容为空的二维码，扫出来是空串）
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

  const render = () => {
    const text = input.value;

    const chars = [...text].length; // 字母、数字、空格各算 1 个
    if (chars > MAX_CHARS) {
      log(`文本超过 ${MAX_CHARS} 个字符（当前 ${chars} 个）`);
      lastSvg = brokenSvg();
      box.innerHTML = lastSvg;
      if (textEl) textEl.textContent = `"${text}"`;
      return;
    }

    lastSvg = toSvg(layout(encode(text, { ecLevel: EC_LEVEL })));
    box.innerHTML = lastSvg;
    if (textEl) textEl.textContent = `"${text}"`;
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
        // TODO: Data Matrix 的生成尚未实现，切换后仍按 QR 渲染
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
