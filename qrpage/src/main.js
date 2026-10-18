import { bindApp } from './app.js';

const box = document.getElementById('box');
const input = document.querySelector('input');
const button = document.getElementById('render');
const modeBtns = Array.from(document.querySelectorAll('#modes button'));
const exportBtn = document.getElementById('export');
const copyBtn = document.getElementById('copy');
const textEl = document.getElementById('text');

const render = bindApp({ input, button, box, textEl, modeBtns, exportBtn, copyBtn });

// 初始就渲染一次，让页面一打开就有码可扫；输入框与显示保持一致。
input.value = 'hello';
render();
