# 更新日志

## v0.2.0 — Miuix (HyperOS) UI 重设计 (2026-05-09)

### 新增
- `public/css/miuix.css` — 完整的 Miuix 设计系统样式表 (1047 行)
  - 基于 [compose-miuix-ui/miuix](https://github.com/compose-miuix-ui/miuix) 的配色、排版、圆角、阴影体系
  - 组件：导航栏、卡片、按钮、输入框、表格、徽章、进度条、分页、空状态、英雄区等
  - 毛玻璃导航栏 (`backdrop-filter: blur(20px)`)
  - 响应式布局，移动端适配

### 变更
- 移除 Tailwind CSS CDN，全部改用本地 Miuix 样式
- 重写全部 15 个 EJS 模板：
  - `partials/nav.ejs` — 毛玻璃导航栏 + 芯片式链接
  - `index.ejs` — 英雄区居中布局
  - `auth/login.ejs` — 圆角表单卡片
  - `auth/register.ejs` — 圆角表单卡片
  - `error.ejs` — Miuix 错误页
  - `user/dashboard.ejs` — 卡片式订阅列表 + 状态徽章
  - `user/plans.ejs` — 套餐卡片网格 + 价格突出
  - `user/subscription.ejs` — 详情卡片 + 流量进度条 + QR 码 + 节点列表
  - `user/redeem.ejs` — 等宽字体兑换码输入
  - `admin/dashboard.ejs` — 统计卡片 + 彩色快捷操作芯片
  - `admin/users.ejs` — Miuix 表格 + 分页
  - `admin/plans.ejs` — Miuix 表格 + 分页
  - `admin/plan_form.ejs` — Miuix 表单 + 选择器
  - `admin/subscriptions.ejs` — Miuix 表格 + 分页
  - `admin/xui.ejs` — Miuix 表单 + 测试连接

### 修复
- `src/routes/admin.js:129` — 多余 `)` 导致的语法错误
- `src/services/xui.js:1` — `require('./db')` 路径错误，改为 `require('../models/db')`
