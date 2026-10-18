import test from 'node:test';
import assert from 'node:assert/strict';
import { readBarcodes } from 'zxing-wasm/reader';
import { encode } from '../src/encode.js';
import { bindApp, NOTE_ERROR_COLOR } from '../src/app.js';
import { brokenDmMatrix, brokenMatrix, brokenSvg } from '../src/broken.js';

/** Data Matrix 规范里的正方形尺寸。 */
const DM_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26, 32, 36, 40, 44, 48, 52, 64, 72, 80, 88, 96, 104, 120, 132, 144];

/** 把矩阵光栅化成解码器能吃的像素缓冲。 */
function rasterize({ size, matrix }, scale = 8, quiet = 4) {
  const side = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!matrix[r][c]) continue;
      for (let y = (r + quiet) * scale; y < (r + quiet + 1) * scale; y += 1) {
        for (let x = (c + quiet) * scale; x < (c + quiet + 1) * scale; x += 1) {
          const i = (y * side + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { data, width: side, height: side };
}

/** 把 #box 里的 SVG 还原成像素，交给 zxing-wasm 判卷；解不出返回 null。 */
async function decodeSvg(svg) {
  const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const m of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    const [x, y, rw, rh] = m.slice(1).map(Number);
    // 坐标可能带小数：按"像素中心是否落在格内"填色
    for (let yy = Math.floor(y); yy < Math.ceil(y + rh); yy += 1) {
      if (yy + 0.5 < y || yy + 0.5 >= y + rh) continue;
      for (let xx = Math.floor(x); xx < Math.ceil(x + rw); xx += 1) {
        if (xx + 0.5 < x || xx + 0.5 >= x + rw) continue;
        const i = (yy * w + xx) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  }
  const [res] = await readBarcodes({ data, width: w, height: h }, { tryHarder: true });
  return res ? { format: res.format, text: res.text } : null;
}

function stubDom() {
  const mk = () => {
    const attrs = {};
    return {
      addEventListener(t, fn) {
        if (t === 'click') this.click = fn;
      },
      setAttribute(n, v) {
        attrs[n] = v;
      },
      getAttribute(n) {
        return attrs[n];
      },
    };
  };
  return {
    input: { value: '' },
    button: mk(),
    box: { innerHTML: '' },
    textEl: { textContent: '', style: { color: '' } },
    modeBtns: [mk(), mk()],
  };
}

/** 选好码制、输入文本、点一次渲染。 */
function renderWith(modeIndex, text) {
  const dom = stubDom();
  bindApp(dom, { log: () => {} });
  if (modeIndex !== 0) dom.modeBtns[modeIndex].click();
  dom.input.value = text;
  dom.button.click();
  return dom;
}

test('C11a 编码：hello → 12x12，尺寸属于 DM 规范', () => {
  const { size, matrix } = encode('hello', { symbology: 'dm' });
  assert.equal(size, 12);
  assert.ok(DM_SIZES.includes(size), `${size} 不是合法的 DM 尺寸`);
  assert.equal(matrix.length, 12);
  assert.equal(matrix[0].length, 12);
});

test('C11b 往返：zxing-wasm 认成 DataMatrix 且文本一致', async () => {
  for (const text of ['hello', '你好，世界', 'A'.repeat(27)]) {
    const [res] = await readBarcodes(rasterize(encode(text, { symbology: 'dm' })), { tryHarder: true });
    assert.ok(res, `解不出：${text}`);
    assert.equal(res.format, 'DataMatrix');
    assert.equal(res.text, text);
  }
});

test('C11c 27 个汉字：DM 容量远大于业务上限', () => {
  const { size } = encode('好'.repeat(27), { symbology: 'dm' });
  assert.ok(DM_SIZES.includes(size));
  assert.ok(size <= 36, `27 个汉字不该撑到 ${size}`);
});

test('C11d 空串：BWIPP 拒绝空数据，DM 直接抛错', () => {
  assert.throws(() => encode('', { symbology: 'dm' }), /无法编码空内容/);
});

test('C11e 不认识的码制：抛错而不是静默回退到 QR', () => {
  assert.throws(() => encode('hello', { symbology: 'pdf417' }), /不认识的码制/);
});

test('C11f 选 DM 后渲染出来的是 DataMatrix，原文仍显示在码下', async () => {
  const dom = renderWith(1, 'hello');
  assert.equal(dom.textEl.textContent, '"hello"');
  assert.match(dom.box.innerHTML, /aria-label="data matrix"/);

  const res = await decodeSvg(dom.box.innerHTML);
  assert.equal(res.format, 'DataMatrix');
  assert.equal(res.text, 'hello');
});

test('C11g 切回 QR：又变回二维码', async () => {
  const dom = renderWith(1, 'hello');
  dom.modeBtns[0].click();

  assert.match(dom.box.innerHTML, /aria-label="qrcode"/);
  const res = await decodeSvg(dom.box.innerHTML);
  assert.equal(res.format, 'QRCode');
  assert.equal(res.text, 'hello');
});

test('C11h DM + 空输入：给一张 DM 形状的破坏图，不留上一张', () => {
  const dom = renderWith(1, 'hello');
  const before = dom.box.innerHTML;

  dom.input.value = '';
  dom.button.click();
  assert.notEqual(dom.box.innerHTML, before, '不该还挂着上一张码');
  assert.match(dom.box.innerHTML, /data-broken="true"/);
  assert.match(dom.box.innerHTML, /data-symbology="dm"/, '应该是 DM 形状，不是 QR');
});

test('C11i DM + 28 个字符：仍然是被破坏的码', async () => {
  const dom = renderWith(1, 'A'.repeat(28));
  assert.match(dom.box.innerHTML, /data-broken="true"/);
  assert.equal(await decodeSvg(dom.box.innerHTML), null);
});

test('C11j DM 破坏图的骨架是 L 形实线 + 交替时序，不是二维码的三个定位块', () => {
  const { size, matrix } = brokenDmMatrix();
  assert.equal(size % 2, 0, 'DM 尺寸应为偶数');

  for (let i = 0; i < size; i += 1) {
    assert.equal(matrix[i][0], true, `左边第 ${i} 行应为实线`);
    assert.equal(matrix[size - 1][i], true, `底边第 ${i} 列应为实线`);
    assert.equal(matrix[0][i], i % 2 === 0, `顶边第 ${i} 列应为时序`);
    assert.equal(matrix[i][size - 1], i % 2 === 1, `右边第 ${i} 行应为时序`);
  }

  // 二维码特有的 7x7 定位块不该出现在 DM 骨架上
  const qrFinder = brokenMatrix();
  assert.notDeepEqual(matrix, qrFinder.matrix);
});

test('C11k 两种破坏图各自带自己的标记，不会串味', () => {
  assert.match(brokenSvg(), /data-symbology="qr"/);
  assert.match(brokenSvg({ symbology: 'dm' }), /data-symbology="dm"/);
  assert.match(brokenSvg({ symbology: 'dm' }), /aria-label="broken data matrix"/);
});

test('C11l 提示文案：DM 空串用红字「不支持空串」，正常码仍是引号原文', () => {
  const empty = renderWith(1, '');
  assert.equal(empty.textEl.textContent, '不支持空串');
  assert.equal(empty.textEl.style.color, NOTE_ERROR_COLOR);

  const ok = renderWith(1, 'hello');
  assert.equal(ok.textEl.textContent, '"hello"');
  assert.equal(ok.textEl.style.color, '', '正常内容不该带错误色');

  const over = renderWith(0, 'A'.repeat(28));
  assert.equal(over.textEl.style.color, '', '超长沿用原来的引号原文，不改成红字');
});
