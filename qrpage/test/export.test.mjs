import test from 'node:test';
import assert from 'node:assert/strict';
import { bindApp } from '../src/app.js';

function stubDom() {
  const button = { addEventListener(t, fn) { if (t === 'click') this.click = fn; } };
  const exportBtn = { addEventListener(t, fn) { if (t === 'click') this.click = fn; } };
  return { input: { value: '' }, button, box: { innerHTML: '' }, exportBtn };
}

function setup() {
  const dom = stubDom();
  const calls = { toBlob: [], download: [] };
  bindApp(dom, {
    log: () => {},
    toBlob: async (svg) => {
      calls.toBlob.push(svg);
      return { fake: 'blob', svg };
    },
    download: (blob, name) => calls.download.push({ blob, name }),
  });
  return { dom, calls };
}

test('C8a 导出：把当前显示的 SVG 转成图片并下载为 qrcode.png', async () => {
  const { dom, calls } = setup();
  dom.input.value = 'hello';
  dom.button.click();
  await dom.exportBtn.click();

  assert.equal(calls.toBlob.length, 1, '应转换一次');
  assert.match(calls.toBlob[0], /<svg /, '转换的应是当前 SVG');
  assert.equal(calls.download.length, 1);
  assert.equal(calls.download[0].name, 'qrcode.png');
  assert.equal(calls.download[0].blob.svg, calls.toBlob[0], '下载的就是转换出来的那张');
});

test('C8b 换内容后导出的是当前显示的那张', async () => {
  const { dom, calls } = setup();
  dom.input.value = 'first';
  dom.button.click();
  dom.input.value = 'second';
  dom.button.click();
  await dom.exportBtn.click();

  assert.equal(calls.toBlob.length, 1);
  assert.equal(calls.toBlob[0], dom.box.innerHTML, '导出的应与当前显示完全一致');
});

test('C8c 超长文本导出的是破坏图（带 data-broken）', async () => {
  const { dom, calls } = setup();
  dom.input.value = 'A'.repeat(28);
  dom.button.click();
  await dom.exportBtn.click();

  assert.match(calls.toBlob[0], /data-broken="true"/, '导出的应是破坏图');
  assert.equal(calls.download[0].name, 'qrcode.png');
});
