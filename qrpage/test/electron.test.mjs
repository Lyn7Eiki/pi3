import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startServer } from '../serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('C13a package.json 把入口指向 Electron 主进程', async () => {
  const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.main, 'electron/main.mjs');
  assert.ok(pkg.devDependencies.electron, 'electron 应在 devDependencies');
  assert.equal(pkg.scripts.app, 'electron .');
});

test('C13b 主进程用本机 HTTP 服务加载页面，而不是 file://', async () => {
  const src = await readFile(resolve(ROOT, 'electron/main.mjs'), 'utf8');
  assert.match(src, /startServer\(\{/, '应复用 serve.mjs');
  assert.match(src, /host: '127\.0\.0\.1'/, '只监听本机');
  assert.match(src, /port: 0/, '端口随机，避免和开发服务撞车');
  assert.match(src, /loadURL\(`http:\/\/127\.0\.0\.1:/, '应走 http，不能 loadFile');
  assert.doesNotMatch(src, /loadFile\(/);
  assert.match(src, /will-quit[\s\S]*server\?\.close\(\)/, '退出时要关掉服务');
});

test('C13c serve.mjs 支持只监听本机 + 随机端口', async () => {
  const server = await startServer({ root: ROOT, port: 0, host: '127.0.0.1' });
  try {
    const { address, port } = server.address();
    assert.equal(address, '127.0.0.1');
    assert.ok(port > 0, '应分配到一个真实端口');

    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<div id="box">/);
  } finally {
    server.close();
  }
});
