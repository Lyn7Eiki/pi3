import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startServer } from '../serve.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

async function withServer(fn) {
  const server = await startServer({ root, port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    server.close();
  }
}

test('C7a 所有响应都带 Cache-Control: no-store', async () => {
  await withServer(async (base) => {
    for (const path of ['/index.html', '/src/app.js', '/src/qr.js']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('cache-control') ?? '', /no-store/, path);
    }
  });
});

test('C7b 能返回磁盘上的最新内容，且 JS 的 MIME 正确', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/src/app.js');
    assert.match(res.headers.get('content-type') ?? '', /text\/javascript/, 'MIME');
    const body = await res.text();
    assert.match(body, /export function bindApp/, '应是当前的 app.js');
    assert.doesNotMatch(body, /if \(text === ''\) return;/, '不该是带空输入短路的旧版本');
  });
});

test('C7c 目录访问回落到 index.html，不存在的路径返回 404', async () => {
  await withServer(async (base) => {
    const index = await fetch(base + '/');
    assert.equal(index.status, 200);
    assert.match(await index.text(), /<div id="container">/);

    const missing = await fetch(base + '/nope.js');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('cache-control') ?? '', /no-store/);
  });
});
