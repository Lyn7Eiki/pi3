import { bindApp } from './app.js';

const box = document.getElementById('box');
const input = document.querySelector('input');
const button = document.querySelector('button');
const exportBtn = document.getElementById('export');

const render = bindApp({ input, button, box, exportBtn });

// 初始就渲染一次，让页面一打开就有码可扫；输入框与显示保持一致。
input.value = 'hello';
render();
