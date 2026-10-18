import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * 起一个静态服务。
 * 关键点是 Cache-Control: no-store —— 改完代码刷新就生效，不用硬刷新。
 * host 传 '127.0.0.1' 可以只监听本机（Electron 里就这么用），port 传 0 则随机分配。
 */
export function startServer({ root = process.cwd(), port = 1234, host } = {}) {
  const rootDir = resolve(root);

  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(rootDir, '.' + (pathname.endsWith('/') ? `${pathname}index.html` : pathname));

    // 目录穿越防护
    if (file !== rootDir && !file.startsWith(rootDir + sep)) {
      res.writeHead(403, { 'Cache-Control': 'no-store' });
      res.end('403');
      return;
    }

    let stat;
    try {
      stat = statSync(file);
    } catch {
      res.writeHead(404, { 'Cache-Control': 'no-store' });
      res.end('404');
      return;
    }
    if (stat.isDirectory()) {
      res.writeHead(301, { Location: `${pathname}/`, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });

  return new Promise((done) => server.listen(port, host, () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 1234);
  const server = await startServer({ root: process.cwd(), port });
  console.log(`http://localhost:${server.address().port}/  (Cache-Control: no-store)`);
}
