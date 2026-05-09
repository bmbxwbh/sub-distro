# sub-distro

3x-ui 订阅链接分发平台。

## 功能

- 管理后台：套餐管理、用户管理、销售统计
- 用户中心：订阅链接、QR 码、多格式导出
- 自动对接 3x-ui API
- 根据 User-Agent 自动返回对应订阅格式

## 技术栈

- Node.js + Express
- SQLite (better-sqlite3)
- Tailwind CSS

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 配置
npm run dev
```

## 环境变量

见 `.env.example`。

## License

MIT
