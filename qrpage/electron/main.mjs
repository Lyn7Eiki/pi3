// Electron 外壳：窗口里加载的是本机 HTTP 服务，而不是 file://。
// 原因有两个：file:// 下 ES module 会被 CORS 拦掉，importmap 里的绝对路径也会失效。
import { app, BrowserWindow, shell } from 'electron';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let server;
let win;

async function createWindow() {
  server = await startServer({ root: ROOT, port: 0, host: '127.0.0.1' });
  const { port } = server.address();

  win = new BrowserWindow({
    width: 640,
    height: 840,
    title: 'QR / DM',
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // 页面里若出现外链，交给系统浏览器，别在应用窗口里跳走
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(createWindow);

// 单窗口小工具：关窗即退出，顺手把本地服务关掉
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => server?.close());
