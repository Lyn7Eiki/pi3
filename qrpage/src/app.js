import { encode } from './qr.js';
import { layout, toSvg } from './render.js';
import { brokenSvg } from './broken.js';

/** 纠错级别固定为 M，不随内容自动变化。 */
export const EC_LEVEL = 'M';

/** 业务约定的字符数上限：超过就打印日志提示。 */
export const MAX_CHARS = 27;

/**
 * 把输入框、按钮、显示区接起来。
 * - 空文本：照常出码（内容为空的二维码，扫出来是空串）
 * - 超过 MAX_CHARS 个字符：打印日志，并显示一张"被破坏的二维码"，不给出可用的码
 * @param {{input: any, button: any, box: any}} dom
 * @param {{log?: (...args: any[]) => void}} [deps] 便于测试注入
 * @returns {() => void} 手动触发一次渲染
 */
export function bindApp({ input, button, box }, { log = console.log } = {}) {
  const render = () => {
    const text = input.value;

    const chars = [...text].length; // 字母、数字、空格各算 1 个
    if (chars > MAX_CHARS) {
      log(`文本超过 ${MAX_CHARS} 个字符（当前 ${chars} 个）`);
      box.innerHTML = brokenSvg();
      return;
    }

    box.innerHTML = toSvg(layout(encode(text, { ecLevel: EC_LEVEL })));
  };

  button.addEventListener('click', render);
  return render;
}
