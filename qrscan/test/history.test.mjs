import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addHistory,
  addManyHistory,
  clearHistory,
  HISTORY_KEY,
  HISTORY_LIMIT,
  loadHistory,
  saveHistory,
} from '../src/history.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

const entry = (text, at = 1, format = 'QRCode') => ({ text, at, format });

test('H1 新条目置顶、同文本去重、限制数量', () => {
  let list = [];
  for (let i = 0; i < HISTORY_LIMIT + 3; i += 1) {
    list = addHistory(list, entry(`text-${i}`, i));
  }
  assert.equal(list.length, HISTORY_LIMIT);
  assert.equal(list[0].text, `text-${HISTORY_LIMIT + 2}`);
  assert.equal(list.at(-1).text, 'text-3');

  list = addHistory(list, entry('text-5', 99));
  assert.equal(list[0].text, 'text-5');
  assert.equal(list.filter((item) => item.text === 'text-5').length, 1);
});

test('H2 addHistory 不修改原数组', () => {
  const before = [entry('a')];
  const after = addHistory(before, entry('b'));
  assert.deepEqual(before, [entry('a')]);
  assert.equal(after[0].text, 'b');
});

test('H3 读写与清空', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadHistory(storage), []);

  const list = addHistory([], entry('hello', 123));
  assert.equal(saveHistory(list, storage), true);
  assert.deepEqual(loadHistory(storage), list);

  assert.equal(clearHistory(storage), true);
  assert.deepEqual(loadHistory(storage), []);
  assert.deepEqual(storage.dump(), {});
});

test('H4 坏 JSON、错误结构、坏存储都退化为空列表', () => {
  assert.deepEqual(loadHistory(memoryStorage({ [HISTORY_KEY]: '{oops' })), []);
  assert.deepEqual(loadHistory(memoryStorage({ [HISTORY_KEY]: '{"a":1}' })), []);
  assert.deepEqual(
    loadHistory(memoryStorage({ [HISTORY_KEY]: JSON.stringify([null, {}, { text: '' }, { text: 'ok' }]) })),
    [{ text: 'ok', format: '', at: 0 }],
  );
  assert.deepEqual(
    loadHistory({
      getItem() {
        throw new Error('blocked');
      },
    }),
    [],
  );
});

test('H5 空文本不进历史，重复文本只留最新', () => {
  let list = addHistory([], entry('same', 1));
  list = addHistory(list, entry('', 2));
  list = addHistory(list, entry('same', 3));
  assert.deepEqual(list, [entry('same', 3)]);
});

test('H6 批量加入保持结果顺序，并在批次内去重', () => {
  const list = addManyHistory(
    [entry('old', 0)],
    [entry('a', 1), entry('b', 2), entry('c', 3)],
  );
  assert.deepEqual(
    list.map((item) => item.text),
    ['a', 'b', 'c', 'old'],
  );

  const deduped = addManyHistory([], [entry('x', 1), entry('y', 2), entry('x', 3)]);
  assert.deepEqual(
    deduped.map((item) => item.text),
    ['x', 'y'],
  );
});
