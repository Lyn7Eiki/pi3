import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('P1 中文界面与关键区域都在', () => {
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>解码头 · 本地二维码解码<\/title>/);
  assert.match(html, /拖进来，<span class="accent">读<\/span>出来。/);
  for (const id of [
    'dropzone',
    'file-input',
    'pick-btn',
    'camera-btn',
    'preview-canvas',
    'preview-overlay',
    'result-list',
    'empty-state',
    'result-loading',
    'result-notice',
    'history',
    'camera-dialog',
    'camera-video',
    'toast',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `缺少 #${id}`);
  }
});

test('P2 解码引擎走本地 node_modules，不依赖外网 CDN', () => {
  assert.match(html, /"zxing-wasm\/reader": "\/node_modules\/zxing-wasm\/dist\/es\/reader\/index\.js"/);
  assert.doesNotMatch(html, /jsdelivr|unpkg|cdn\./i);
});

test('P3 交互按钮都声明了 type，避免在表单语义下误提交', () => {
  const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(buttons.length >= 7, `按钮只有 ${buttons.length} 个`);
  for (const tag of buttons) {
    assert.match(tag, /type="button"/, tag);
  }
});
