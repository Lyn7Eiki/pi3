import { encode } from './qr.js';
import { layout, toSvg } from './render.js';

const box = document.getElementById('box');

// 第 3 步：先把渲染打通，文本暂时写死；输入框联动在第 4 步接上。
const TEXT = 'hello';

box.innerHTML = toSvg(layout(encode(TEXT)));
