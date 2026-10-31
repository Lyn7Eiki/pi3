export const HISTORY_KEY = 'qrscan.history.v1';
export const HISTORY_LIMIT = 10;

/**
 * 只保留形状正确的条目：有非空文本、格式是字符串、时间是数字。
 * 去重按文本，保留最先出现（也就是最新）的那条。
 */
function sanitize(entries, limit) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  const next = [];

  for (const entry of entries) {
    if (!entry || typeof entry.text !== 'string' || !entry.text) continue;
    if (seen.has(entry.text)) continue;
    seen.add(entry.text);
    next.push({
      text: entry.text,
      format: typeof entry.format === 'string' ? entry.format : '',
      at: Number(entry.at) || 0,
    });
    if (next.length >= limit) break;
  }
  return next;
}

/** 读历史；存储不可用、JSON 坏了都退化成空列表，不让页面崩。 */
export function loadHistory(storage, limit = HISTORY_LIMIT) {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(HISTORY_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw), limit);
  } catch {
    return [];
  }
}

/** 新条目置顶，同文本的旧条目被顶掉；不修改传入数组。 */
export function addHistory(list, entry, limit = HISTORY_LIMIT) {
  const clean = sanitize(list, limit);
  if (!entry || typeof entry.text !== 'string' || !entry.text) return clean;

  return [
    {
      text: entry.text,
      format: typeof entry.format === 'string' ? entry.format : '',
      at: Number(entry.at) || 0,
    },
    ...clean.filter((item) => item.text !== entry.text),
  ].slice(0, limit);
}

export function saveHistory(list, storage) {
  try {
    (storage ?? globalThis.localStorage)?.setItem(HISTORY_KEY, JSON.stringify(sanitize(list, HISTORY_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function clearHistory(storage) {
  try {
    (storage ?? globalThis.localStorage)?.removeItem(HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}
