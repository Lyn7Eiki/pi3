import test from 'node:test';
import assert from 'node:assert/strict';
import { accentFor, overlayMarkup, polygonPoints } from '../src/overlay.js';

const position = {
  topLeft: { x: 32, y: 32 },
  topRight: { x: 232, y: 32 },
  bottomRight: { x: 232, y: 232 },
  bottomLeft: { x: 32, y: 232 },
};

test('O1 四角转 polygon points', () => {
  assert.equal(polygonPoints(position), '32,32 232,32 232,232 32,232');
  assert.equal(polygonPoints(null), '');
  assert.equal(polygonPoints({ ...position, topRight: null }), '');
});

test('O2 多码生成对应数量的检测框，颜色轮换', () => {
  const markup = overlayMarkup(
    [
      { position },
      {
        position: {
          topLeft: { x: 300, y: 32 },
          topRight: { x: 500, y: 32 },
          bottomRight: { x: 500, y: 232 },
          bottomLeft: { x: 300, y: 232 },
        },
      },
    ],
    600,
    300,
  );

  assert.match(markup, /data-code-index="0"/);
  assert.match(markup, /data-code-index="1"/);
  assert.match(markup, new RegExp(accentFor(0)));
  assert.match(markup, new RegExp(accentFor(1)));
  assert.doesNotMatch(markup, /NaN/);
});

test('O3 空结果或非法尺寸不产生标记', () => {
  assert.equal(overlayMarkup([], 100, 100), '');
  assert.equal(overlayMarkup([{ position }], 0, 100), '');
  assert.equal(overlayMarkup(null, 100, 100), '');
});

test('O4 缺少 position 的结果被跳过', () => {
  assert.equal(overlayMarkup([{ position: null }], 100, 100), '');
});
