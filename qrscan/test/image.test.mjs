import test from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, loadImageFile } from '../src/image.js';

test('I1 等比缩放：小图不放大，大图缩到长边以内', () => {
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600, scale: 1 });
  assert.deepEqual(fitWithin(3200, 1600, 1600), { width: 1600, height: 800, scale: 0.5 });
  assert.deepEqual(fitWithin(1600, 3200, 1600), { width: 800, height: 1600, scale: 0.5 });
  assert.deepEqual(fitWithin(100, 100, 50), { width: 50, height: 50, scale: 0.5 });
  assert.deepEqual(fitWithin(1, 1000, 1600), { width: 1, height: 1000, scale: 1 });
});

test('I2 非法尺寸或上限直接报错', () => {
  assert.throws(() => fitWithin(0, 100), /正数/);
  assert.throws(() => fitWithin(100, -1), /正数/);
  assert.throws(() => fitWithin(100, 100, 0), /正数/);
});

test('I3 loadImageFile 按缩放后的尺寸画布、取像素并释放 bitmap', async () => {
  const calls = {};
  const bitmap = {
    width: 3200,
    height: 1600,
    close() {
      calls.closed = true;
    },
  };

  const context = {
    imageSmoothingQuality: 'low',
    fillStyle: '',
    fillRect(...args) {
      calls.filled = { color: this.fillStyle, args };
    },
    drawImage(...args) {
      calls.drawn = args;
    },
    getImageData(x, y, width, height) {
      calls.getImageData = { x, y, width, height };
      return { data: new Uint8ClampedArray(width * height * 4), width, height };
    },
  };

  const result = await loadImageFile(
    { name: 'photo.png' },
    {
      createBitmap: async () => bitmap,
      canvasFactory: (width, height) => ({
        width,
        height,
        getContext: () => context,
      }),
    },
  );

  assert.equal(result.width, 1600);
  assert.equal(result.height, 800);
  assert.equal(result.originalWidth, 3200);
  assert.equal(result.originalHeight, 1600);
  assert.equal(result.scale, 0.5);
  assert.equal(result.canvas.width, 1600);
  assert.deepEqual(calls.drawn, [bitmap, 0, 0, 1600, 800]);
  assert.deepEqual(calls.filled, { color: '#fff', args: [0, 0, 1600, 800] });
  assert.deepEqual(calls.getImageData, { x: 0, y: 0, width: 1600, height: 800 });
  assert.equal(calls.closed, true);
  assert.equal(context.imageSmoothingQuality, 'high');
});

test('I4 空尺寸图片给出明确错误', async () => {
  await assert.rejects(
    () =>
      loadImageFile(
        {},
        {
          createBitmap: async () => ({ width: 0, height: 0 }),
          canvasFactory: () => ({ getContext: () => ({}) }),
        },
      ),
    /尺寸为空/,
  );
});
