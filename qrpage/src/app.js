import { encode } from './qr.js';
import { layout, toSvg } from './render.js';

/**
 * 把输入框、按钮、显示区接起来。
 * 空文本时不改显示，避免把上一次的码清成一片空白。
 * @returns {() => void} 手动触发一次渲染
 */
export function bindApp({ input, button, box }) {
  const render = () => {
    const text = input.value;
    if (text === '') return;
    box.innerHTML = toSvg(layout(encode(text)));
  };
  button.addEventListener('click', render);
  return render;
}
