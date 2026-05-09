# 更新日志

## v0.3.1 — 默认端口调整 (2026-05-10)

### 变更
- 默认端口从 `3000` 改为 `14826`（.env.example、app.js、deploy.sh、README.md）

## v0.3.0 — 支付 + 优惠码 + 代开订阅 + 节点监控 (2026-05-10)

### 新增
- **易支付对接** — 完整的 EPay v1.1 支付流程
  - `src/services/payment.js` — 签名/验签/查单
  - `src/routes/payment.js` — 下单→跳转→异步回调→自动开通订阅
  - 支持支付宝/微信/QQ 钱包，套餐页直接选择支付方式
- **订单系统** — `orders` 表 + 用户订单页 + 管理员订单管理
  - 记录原价、折扣金额、实付金额、优惠码、支付状态
- **优惠码系统** — 替代原兑换码功能
  - 支持百分比折扣和固定金额折扣
  - 可设置使用次数限制（0 = 不限）
  - 管理员单个创建 + 批量生成（最多 200 个/次）
  - 用户在套餐页输入优惠码，实时折后价
- **管理员代开订阅** — `/admin/subscriptions/create`
  - 选择用户 + 套餐，自定义天数和流量，直接创建订阅（跳过支付）
- **节点监控** — `/admin/nodes`
  - 实时显示 3x-ui 服务器状态（CPU/内存/运行时间/Xray 状态）
  - Inbound 列表：端口、协议、客户端数、总流量统计
  - 可展开查看每个客户端的流量、到期时间、启用状态
- **全端响应式适配** — 三个断点（380px / 640px / 960px）
  - 移动端汉堡菜单导航
  - 表格自动转为卡片布局（`data-label` 属性）
  - 按钮/表单/网格全端自适应
  - 触控友好（44px 最小点击区域）

### 变更
- 移除兑换码功能（`redeem_codes` 表、`/user/redeem` 路由和页面）
- 新增 `coupon_codes` 表替代兑换码
- `plans` 套餐页增加优惠码输入框和支付方式选择
- 导航栏增加「订单」入口
- 管理后台增加「代开订阅」「节点监控」「优惠码」快捷操作
- CSS 从 1047 行扩展到 1327 行

### 新增文件
- `src/models/order.js` — 订单模型
- `src/models/coupon.js` — 优惠码模型（验证、折扣计算）
- `src/services/payment.js` — 易支付服务
- `src/routes/payment.js` — 支付路由
- `views/admin/create_sub.ejs` — 代开订阅页
- `views/admin/orders.ejs` — 订单管理页
- `views/admin/coupons.ejs` — 优惠码管理页（含批量生成）
- `views/admin/nodes.ejs` — 节点监控页
- `views/user/orders.ejs` — 用户订单页

### 删除文件
- `views/user/redeem.ejs` — 兑换码页面（功能已合并到优惠码）

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
