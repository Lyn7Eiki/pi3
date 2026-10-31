/**
 * 复制文本。优先走异步剪贴板 API（需要安全上下文），
 * 失败或不可用时退回隐藏 textarea + execCommand，兼容 http 页面。
 */
export async function copyText(text) {
  const value = String(text ?? '');

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // 权限被拒或页面不是安全上下文，继续走兜底
    }
  }

  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.left = '-1000px';
  area.style.opacity = '0';
  document.body.appendChild(area);

  let copied = false;
  try {
    area.select();
    area.setSelectionRange(0, value.length);
    copied = document.execCommand('copy');
  } finally {
    area.remove();
  }

  if (!copied) throw new Error('复制失败');
}
