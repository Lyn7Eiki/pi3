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

test('S1 所有响应都带 Cache-Control: no-store', async () => {
  await withServer(async (base) => {
    for (const path of ['/index.html', '/styles.css', '/src/main.js', '/serve.mjs']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('cache-control') ?? '', /no-store/, path);
    }
  });
});

test('S2 wasm 以 application/wasm 返回，且内容确实是 wasm', async () => {
  await withServer(async (base) => {
    const path = '/node_modules/zxing-wasm/dist/reader/zxing_reader.wasm';
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/wasm');

    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.ok(bytes.length > 500_000, `wasm 只有 ${bytes.length} 字节`);
    assert.deepEqual([...bytes.slice(0, 4)], [0x00, 0x61, 0x73, 0x6d], '应以 \\0asm 开头');
  });
});

test('S3 目录回落到 index.html，缺失路径 404，越界路径 403', async () => {
  await withServer(async (base) => {
    const index = await fetch(base + '/');
    assert.equal(index.status, 200);
    assert.match(await index.text(), /<title>解码头/);

    const missing = await fetch(base + '/nope.js');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('cache-control') ?? '', /no-store/);

    const escape = await fetch(base + '/..%2f..%2fetc%2fpasswd');
    assert.equal(escape.status, 403);
  });
});

test('S4 畸形 URL 返回 400，服务仍然存活', async () => {
  await withServer(async (base) => {
    const bad = await fetch(base + '/%E0%A4%A');
    assert.equal(bad.status, 400);
    assert.match(bad.headers.get('cache-control') ?? '', /no-store/);

    const ok = await fetch(base + '/');
    assert.equal(ok.status, 200);
  });
});
