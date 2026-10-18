# ReadMe.md
# README（怎么跑）

cd qrpage  
npm install  
npm test  
npm run serve     # http://localhost:1234/

npm run app          # 开发：直接开窗口  
npm run app:build    # 打包 → dist/QRPage-darwin-arm64/QRPage.app

## 用到的库

编码与解码分开选型：编码负责出图，解码只在测试里当**独立裁判**，避免自己验自己。

**编码**：`bwip-js`（BWIPP 的 JS 移植，MIT）—— 100+ 种码制

  空串用 qrcode-generator 兜底

**解码**：`zxing-wasm`（zxing-cpp 的 wasm 封装，MIT，**仅测试用**）——

  与 bwip-js 是完全独立的实现，同时能读 QR 与 Data Matrix

  空串用 jsQR 兜底

