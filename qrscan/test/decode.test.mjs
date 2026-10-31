import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyContent,
  decodeImageData,
  formatLabel,
  parseExtra,
  summarize,
} from '../src/decode.js';
import { encodeMatrix, invert, rasterize, rotate90 } from './support/rasterize.mjs';

const QR_FORMATS = ['QRCode'];

test('D1 二维码往返：中文、链接与长文本', async () => {
  for (const text of ['你好，世界', 'https://example.com/a?b=1&c=2', 'A'.repeat(180)]) {
    const image = rasterize(encodeMatrix(text));
    const { results, elapsedMs } = await decodeImageData(image, { formats: QR_FORMATS });
    assert.equal(results.length, 1, `应只识别出一个码：${text.slice(0, 16)}`);
    assert.equal(results[0].format, 'QRCode');
    assert.equal(results[0].text, text);
    assert.ok(elapsedMs >= 0, '耗时应是非负数');
  }
});

test('D2 Data Matrix 往返', async () => {
  const text = 'DM-2026-001';
  const { results } = await decodeImageData(rasterize(encodeMatrix(text, { symbology: 'dm' })));
  assert.equal(results.length, 1);
  assert.equal(results[0].format, 'DataMatrix');
  assert.equal(results[0].text, text);
});

test('D3 反色二维码也能读', async () => {
  const image = invert(rasterize(encodeMatrix('inverted-code')));
  const { results } = await decodeImageData(image, { formats: QR_FORMATS, deep: false });
  assert.equal(results[0]?.text, 'inverted-code');
  assert.equal(results[0]?.isInverted, true);
});

test('D4 旋转 90° 的二维码也能读', async () => {
  const image = rotate90(rasterize(encodeMatrix('rotated-code')));
  const { results } = await decodeImageData(image, { formats: QR_FORMATS, deep: false });
  assert.equal(results[0]?.text, 'rotated-code');
  assert.equal(results[0]?.rotation, 90);
});

test('D5 非法输入直接报错，不静默返回空结果', async () => {
  await assert.rejects(() => decodeImageData(null), /ImageData/);
  await assert.rejects(() => decodeImageData({ width: 0, height: 0 }), /ImageData/);
});

test('D6 内容类型识别', () => {
  const cases = [
    ['https://example.com/a?b=1', 'url', 'https://example.com/a?b=1'],
    ['www.example.com/x', 'url', 'https://www.example.com/x'],
    ['mailto:hi@example.com', 'email', 'mailto:hi@example.com'],
    ['hi@example.com', 'email', 'mailto:hi@example.com'],
    ['tel:+8613800138000', 'phone', 'tel:+8613800138000'],
    ['sms:+8613800138000', 'sms', 'sms:+8613800138000'],
    ['WIFI:T:WPA;S:home;P:12345678;;', 'wifi', ''],
    ['BEGIN:VCARD\nFN:张三\nEND:VCARD', 'vcard', ''],
    ['geo:31.23,121.47', 'geo', 'geo:31.23,121.47'],
    ['otpauth://totp/Test?secret=ABC', 'otp', ''],
    ['hello world', 'text', ''],
    ['javascript:alert(1)', 'text', ''],
  ];

  for (const [text, kind, href] of cases) {
    const got = classifyContent(text);
    assert.equal(got.kind, kind, text);
    assert.equal(got.href, href, text);
  }
});

test('D7 码制中文名与未知码制回退', () => {
  assert.equal(formatLabel('QRCode'), '二维码');
  assert.equal(formatLabel('DataMatrix'), 'Data Matrix');
  assert.equal(formatLabel('EAN13'), 'EAN-13');
  assert.equal(formatLabel('SomethingNew'), 'SomethingNew');
});

test('D8 extra 解析容错，坏 JSON 不影响结果', () => {
  assert.deepEqual(parseExtra('{"Version":"3","ECLevel":"M"}'), { Version: '3', ECLevel: 'M' });
  assert.deepEqual(parseExtra('not json'), {});
  assert.deepEqual(parseExtra(''), {});
  assert.deepEqual(parseExtra(null), {});
});

test('D9 summarize 把结果整理成页面结构', () => {
  const result = {
    text: 'https://example.com',
    format: 'QRCode',
    bytes: new Uint8Array([1, 2, 3, 4]),
    extra: '{"Version":"2","ECLevel":"Q"}',
    rotation: 0,
    isInverted: false,
    isMirrored: false,
    contentType: 'URL',
    position: {
      topLeft: { x: 1, y: 2 },
      topRight: { x: 3, y: 2 },
      bottomRight: { x: 3, y: 4 },
      bottomLeft: { x: 1, y: 4 },
    },
  };

  const got = summarize(result);
  assert.equal(got.formatLabel, '二维码');
  assert.equal(got.kind, 'url');
  assert.equal(got.href, 'https://example.com');
  assert.equal(got.bytes, 4);
  assert.equal(got.version, '2');
  assert.equal(got.ecLevel, 'Q');
  assert.equal(got.position.topLeft.x, 1);
});
