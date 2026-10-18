# ReadMe.md
# README（怎么跑）

### old
### - **编码**：`qrcode-generator`（Kazuhiko Arase，MIT）—— 只会 QR；
###   已 vendor 到 `qrpage/vendor/qrcode-generator.js`（补了一行 ESM 导出）
### - **解码**：`jsQR`（`jsqr@^1.4.0`，devDependency，**仅测试用**）—— 只认 QR

## 用到的库

编码与解码分开选型：编码负责出图，解码只在测试里当**独立裁判**，避免自己验自己。

- **编码**：`bwip-js`（BWIPP 的 JS 移植，MIT）—— 100+ 种码制，
  QR、Data Matrix、PDF417、Aztec、GS1 DataBar 等一并覆盖；浏览器与 Node 通用
  空串继续用 qrcode-generator 兜底
- **解码**：`zxing-wasm`（zxing-cpp 的 wasm 封装，MIT，**仅测试用**）——
  与 bwip-js 是完全独立的实现，同时能读 QR 与 Data Matrix
  空串继续用 jsQR 兜底

