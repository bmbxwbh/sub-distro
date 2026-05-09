# sub-distro

基于 3x-ui 面板的订阅链接分发平台。采用 Miuix (HyperOS) 设计风格，支持多端响应式布局。

## 功能

- **管理后台** — 用户管理、套餐管理、订阅管理、订单管理、优惠码管理、节点监控、3x-ui 面板对接
- **代开订阅** — 管理员可为任意用户直接创建订阅，自定义天数和流量
- **用户中心** — 浏览套餐、购买订阅、查看订阅链接、QR 码、多格式导出、订单历史
- **订阅分发** — 根据 User-Agent 自动返回对应格式（Clash YAML / Sing-box JSON / Base64）
- **优惠码系统** — 支持百分比/固定金额折扣，单个创建或批量生成，使用次数限制
- **支付对接** — 易支付 (EPay) 集成，支持支付宝/微信/QQ 钱包
- **订单系统** — 完整的订单流水，记录原价、折扣、实付、优惠码
- **节点监控** — 实时查看 3x-ui 服务器状态、Inbound 列表、客户端流量统计
- **3x-ui API 集成** — 自动创建/管理客户端、同步流量统计、到期自动禁用

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 模板引擎 | EJS |
| 样式 | 自定义 CSS (Miuix/HyperOS 设计语言，响应式) |
| 认证 | express-session + bcryptjs |
| QR 码 | qrcode |
| 支付 | 易支付 (EPay) v1.1 协议 |

## 项目结构

```
sub-distro/
├── src/
│   ├── app.js                 # Express 入口，路由挂载，session 配置
│   ├── middleware/
│   │   └── auth.js            # requireAuth / requireAdmin 中间件
│   ├── models/
│   │   ├── db.js              # SQLite 初始化 + 建表 + 默认管理员
│   │   ├── user.js            # 用户 CRUD，密码验证
│   │   ├── plan.js            # 套餐 CRUD
│   │   ├── subscription.js    # 订阅 CRUD，过期查询
│   │   ├── order.js           # 订单 CRUD，折扣记录
│   │   └── coupon.js          # 优惠码 CRUD，验证，折扣计算
│   ├── routes/
│   │   ├── auth.js            # POST /auth/login, /auth/register, GET /auth/logout
│   │   ├── admin.js           # 管理后台全部路由（含代开订阅、节点监控）
│   │   ├── user.js            # 用户中心全部路由
│   │   ├── sub.js             # 订阅分发（核心，对外暴露）
│   │   └── payment.js         # 支付路由（易支付对接）
│   └── services/
│       ├── xui.js             # 3x-ui HTTP API 封装
│       ├── sub.js             # 订阅创建 + 节点解析 + 多格式导出
│       └── payment.js         # 易支付签名/验签
├── views/                     # EJS 模板（17 个）
│   ├── partials/nav.ejs       # 响应式导航栏（汉堡菜单）
│   ├── auth/                  # login.ejs, register.ejs
│   ├── admin/                 # dashboard, users, plans, subscriptions,
│   │                          # create_sub, orders, coupons, nodes, xui
│   ├── user/                  # dashboard, plans, subscription, orders
│   ├── index.ejs              # 首页
│   └── error.ejs              # 错误页
├── public/css/miuix.css       # Miuix 设计系统样式（1300+ 行，全端响应式）
├── data/                      # SQLite 数据库文件（gitignore）
├── .env.example               # 环境变量模板
├── package.json
└── README.md
```

## 数据库表

| 表 | 用途 |
|---|---|
| `users` | 用户账号，角色 (admin/user)，状态 |
| `plans` | 套餐：名称、流量、天数、价格、绑定 inbound |
| `subscriptions` | 订阅：用户+套餐+token+uuid+流量+到期时间 |
| `orders` | 订单：原价、折扣、实付、优惠码、支付状态 |
| `coupon_codes` | 优惠码：类型(百分比/固定)、折扣值、使用次数限制 |
| `xui_config` | 3x-ui 面板连接配置（单行） |

## API 路由

### 订阅分发（无需登录）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/sub/:token` | 自动检测 UA 返回对应格式 |
| GET | `/sub/:token/raw` | Base64 格式 (V2RayN / Shadowrocket) |
| GET | `/sub/:token/clash` | Clash YAML |
| GET | `/sub/:token/singbox` | Sing-box JSON |
| GET | `/sub/:token/qr` | QR 码页面 |

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/auth/login` | 登录 |
| GET/POST | `/auth/register` | 注册 |
| GET | `/auth/logout` | 退出 |

### 支付

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/payment/create/:planId` | 创建支付订单并跳转收银台 |
| POST | `/payment/notify` | 易支付异步回调 |
| GET | `/payment/return` | 易支付同步回调 |

### 管理后台 (`/admin/*`，需 admin 角色)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin` | 仪表盘 |
| GET | `/admin/users` | 用户列表 |
| POST | `/admin/users/:id/ban` | 封禁用户 |
| POST | `/admin/users/:id/delete` | 删除用户 |
| GET | `/admin/plans` | 套餐列表 |
| GET/POST | `/admin/plans/new` | 新建套餐 |
| GET/POST | `/admin/plans/:id/edit` | 编辑套餐 |
| POST | `/admin/plans/:id/delete` | 删除套餐 |
| GET | `/admin/subscriptions` | 订阅列表 |
| GET/POST | `/admin/subscriptions/create` | **代开订阅** |
| GET | `/admin/orders` | 订单列表 |
| GET | `/admin/coupons` | 优惠码管理 |
| POST | `/admin/coupons/create` | 创建单个优惠码 |
| POST | `/admin/coupons/bulk` | **批量生成优惠码** |
| POST | `/admin/coupons/:id/toggle` | 启用/禁用优惠码 |
| POST | `/admin/coupons/:id/delete` | 删除优惠码 |
| GET | `/admin/nodes` | **节点监控** |
| GET/POST | `/admin/xui` | 3x-ui 面板配置 |
| POST | `/admin/xui/test` | 测试 3x-ui 连接 |

### 用户中心 (`/user/*`，需登录)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/user` | 我的订阅列表 |
| GET | `/user/plans` | 浏览套餐 |
| POST | `/user/subscribe/:planId` | 购买套餐（跳转支付） |
| GET | `/user/sub/:token` | 订阅详情（链接、QR、节点） |
| GET | `/user/orders` | 我的订单 |

## 3x-ui 对接

通过 `src/services/xui.js` 封装 3x-ui 的 HTTP API：

- `POST /login` — 登录获取 session cookie
- `GET /panel/api/inbounds/list` — 获取 inbound 列表
- `POST /panel/api/inbounds/addClient` — 添加客户端
- `POST /panel/api/inbounds/updateClient/:id` — 更新客户端
- `POST /panel/api/inbounds/:id/delClient/:clientId` — 删除客户端
- `GET /panel/api/inbounds/getClientTraffics/:email` — 查询流量
- `GET /panel/api/server/status` — 服务器状态

套餐绑定 inbound ID 后，用户购买时自动在对应 inbound 创建客户端。

## 快速开始

```bash
# 1. 克隆
git clone https://github.com/bmbxwbh/sub-distro.git
cd sub-distro

# 2. 安装依赖
npm install

# 3. 配置
cp .env.example .env
# 编辑 .env，填入你的 3x-ui 面板地址、密码、易支付配置

# 4. 启动
npm run dev

# 5. 访问
# http://localhost:3000
# 默认管理员: admin / admin123
```

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 监听端口 | `3000` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `DB_PATH` | SQLite 文件路径 | `./data/sub-distro.db` |
| `SESSION_SECRET` | session 密钥 | `change-me` |
| `SUB_BASE_URL` | 订阅公开域名 | `http://localhost:3000` |
| `EPAY_API_URL` | 易支付接口地址 | — |
| `EPAY_PID` | 易支付商户 ID | — |
| `EPAY_KEY` | 易支付商户密钥 | — |

## License

MIT
