# ReadMe.md
# README（怎么跑）


## 用到的库
- **编码**：`qrcode-generator`（Kazuhiko Arase，MIT）—— 把文本编成二维码矩阵；
  已 vendor 到 `qrpage/vendor/qrcode-generator.js`（补了一行 ESM 导出）
- **解码**：`jsQR`（`jsqr@^1.4.0`，devDependency，**仅测试用**）—— 把矩阵光栅化后交给它，
  验证解出的文本与输入一致
