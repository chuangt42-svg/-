# 论文订单系统（示例工程）

概述
- 本示例为论文订单 + 支付系统的参考实现（后端 Node.js + Express + PostgreSQL，前端 React）。
- 支付默认集成 Stripe，同时提供支付宝与微信支付的接入示例与说明（需商户账号/证书）。
- 项目包含：API 服务、React 前端、简单管理员面板、文件上传（本地 / 可切换 S3）、Docker 化与 GitHub Actions CI 配置示例。

技术栈（默认）
- 后端：Node.js, Express
- ORM：Sequelize（PostgreSQL）
- 数据库：PostgreSQL（可切换 MySQL）
- 前端：React + Vite
- 身份认证：JWT（access / refresh token）
- 支付：Stripe（测试/生产）、支付宝/微信（示例）
- 部署：Docker + docker-compose
- CI：GitHub Actions（测试、lint、构建）

主要目录（示例）
- backend/ : Express API 服务（src、migrations、Dockerfile）
- frontend/ : React 前端（Vite 配置、pages、components、Stripe/支付宝/微信集成示例）
- infra/ : docker-compose.yml、Traefik/nginx 示例、数据库初始化脚本
- .github/workflows/ : GitHub Actions CI 配置

功能（MVP）
- 用户：注册/登录/角色（user / admin / writer）和资料管理
- 订单：创建/编辑（在可编辑状态下）/取消/查看订单详情
- 订单状态流：草稿 -> 待支付 -> 已支付/进行中 -> 已提交 -> 完成 -> 退款中/已退款
- 支付：Stripe 支付意图（PaymentIntent）创建、前端支付、后端 webhook 验签、退款
- 中国支付：支付宝与微信支付的下单 + 异步回调（示例代码，需商户信息）
- 文件管理：用户上传需求附件、写手上传稿件（本地存储或 S3）
- 管理后台：订单列表、修改订单状态、发起退款、用户管理
- 日志与通知：订单状态变更触发站内通知与邮件（SMTP）

环境依赖（本地）
- Docker & docker-compose（推荐用于快速启动）
- Node.js 18+（若本地运行）
- pnpm / npm / yarn（前端/后端依赖管理）
- PostgreSQL（若不使用 Docker）

环境变量（示例）
- 后端（backend/.env）
  - PORT=4000
  - DATABASE_URL=postgres://postgres:password@db:5432/paper_orders
  - JWT_SECRET=your_jwt_secret
  - JWT_REFRESH_SECRET=your_refresh_secret
  - STRIPE_SECRET_KEY=sk_test_xxx
  - STRIPE_WEBHOOK_SECRET=whsec_xxx
  - ALIPAY_APP_ID=your_alipay_app_id
  - ALIPAY_PRIVATE_KEY=/path/to/your/alipay_private_key.pem
  - ALIPAY_PUBLIC_KEY=/path/to/alipay_public_key.pem
  - WECHAT_MCH_ID=your_wechat_mch_id
  - WECHAT_API_KEY=your_wechat_api_key
  - S3_BUCKET=your-bucket
  - S3_REGION=your-region
  - S3_ACCESS_KEY_ID=
  - S3_SECRET_ACCESS_KEY=
  - SMTP_HOST=smtp.example.com
  - SMTP_PORT=587
  - SMTP_USER=you@example.com
  - SMTP_PASS=yourpassword

- 前端（frontend/.env）
  - VITE_API_BASE_URL=http://localhost:4000/api
  - VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
  - VITE_ALIPAY_RETURN_URL=https://example.com/alipay/return

快速开始（使用 Docker，一键启动）
1. 复制示例 env 文件并填写关键密钥：
   - cp backend/.env.example backend/.env
   - cp frontend/.env.example frontend/.env
2. 启动：
   - cd infra
   - docker-compose up --build
3. 服务访问：
   - 后端 API: http://localhost:4000
   - 前端: http://localhost:3000

本地开发（不使用 Docker）
1. 后端：
   - cd backend
   - cp .env.example .env 并配置
   - npm install
   - npm run migrate
   - npm run seed
   - npm run dev
2. 前端：
   - cd frontend
   - cp .env.example .env 并配置
   - npm install
   - npm run dev

数据库迁移与种子数据
- 使用 Sequelize migration 脚本（backend/migrations）
- 示例命令：
  - npx sequelize-cli db:migrate
  - npx sequelize-cli db:seed:all
- 我们提供初始种子：管理员账号、测试用户与示例订单
  - admin@example.com / Password123!
  - user@example.com / Password123!

安全与合规提醒
- 本项目为示例，仅供学习参考；生产环境中处理真实支付与用户数据时：
  - 遵守 PCI-DSS（若处理卡号）；
  - 使用安全的秘钥/证书管理（不要将私钥提交到仓库）；
  - 对外部回调使用验签并以幂等方式处理。
