# STP Sushi — 门店管理系统

> 🌐 [English](README.md) | 中文

基于 Next.js 构建的寿司门店内部管理系统，部署于阿里云，涵盖采购、库存、收货和员工培训四大模块。

---

## 功能模块

### 采购（Sushi 模块）
- **订单管理** — 从 OSS 同步采购订单，查看状态（待下单 / 已下单 / 已确认），两周配送日历
- **PO 日历** — 月视图日历，显示逾期提醒和即将到期的下单截止时间
- **库存管理** — 管理库存品项、数量和备注
- **收货管理** — 拍摄或上传配送发票 → AI 提取 PO#、Invoice No.、供应商、商品明细 → 自动匹配本地订单 → 显示数量对比（Full / Change QTY）

### 员工培训
- **员工列表** — 新增/删除员工，查看每人技能完成进度
- **技能清单** — 四个区域共 32 项任务（Kitchen、Sushi Production、Customer Service、Store Operations），每项标记通过 / 部分通过 / 未通过
- **培训记录** — 按任务记录：日期、类型、改进方向、反馈与行动、跟进情况

### 系统功能
- 基于 JWT 的三角色权限认证：`OWNER`、`MANAGER`、`VIEWER`
- 中英文双语界面，随时切换
- 完全响应式，支持桌面、平板、手机

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15（App Router） |
| 数据库 | SQLite（Prisma + libSQL） |
| 认证 | JWT（`jose`） |
| AI（收货识别） | 阿里云 DashScope 通义千问-VL（`qwen-vl-max`） |
| 样式 | Tailwind CSS v4 |
| 图标 | Lucide React |
| 运行时 | Node.js + PM2（阿里云服务器） |

---

## 项目结构

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── sushi/
│   │   │   ├── orders/          # 订单列表 + 两周日历
│   │   │   ├── po-calendar/     # 月度 PO 日历
│   │   │   ├── inventory/       # 库存管理
│   │   │   └── goods-receiving/ # 发票扫描与收货
│   │   ├── training/
│   │   │   ├── page.tsx         # 员工列表
│   │   │   └── [id]/page.tsx    # 员工详情与技能清单
│   │   └── settings/            # 用户管理（仅 OWNER）
│   ├── api/
│   │   ├── auth/                # 登录 / 登出
│   │   ├── sushi/               # 订单、库存、同步、收货
│   │   └── training/            # 员工、技能清单、培训记录
│   └── login/
├── components/
│   ├── Sidebar.tsx
│   ├── SessionProvider.tsx
│   └── LanguageProvider.tsx
└── lib/
    ├── auth.ts                  # JWT 工具函数
    ├── prisma.ts
    ├── oss-sync.ts              # OSS 订单同步逻辑
    └── i18n.ts                  # 中英文翻译
prisma/
└── schema.prisma
```

---

## 环境变量

在项目根目录创建 `.env.local` 文件：

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key"
OSS_BASE_URL="https://oss.spientsyserv.com"
DASHSCOPE_API_KEY="sk-your-dashscope-key"
```

- `DASHSCOPE_API_KEY` — 在 [阿里云百炼控制台](https://modelstudio.console.alibabacloud.com) 创建，用于收货模块的发票图片识别。

---

## 本地开发

```bash
npm install
npx prisma migrate dev
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

---

## 部署（阿里云服务器）

**本地——打包上传：**
```bash
git bundle create sushi.bundle HEAD
scp sushi.bundle root@<服务器IP>:/root/sushi.bundle
```

**服务器——拉取、构建、重启：**
```bash
cd /var/www/stp_sushi
git fetch /root/sushi.bundle
git reset --hard FETCH_HEAD
npm install
npm run build
pm2 restart stp_sushi
```

首次部署时额外执行：
```bash
npx prisma migrate deploy
pm2 start npm --name stp_sushi -- start
pm2 save
```

---

## 角色权限

| 角色 | 权限说明 |
|------|---------|
| `OWNER` | 全部功能，包含用户管理 |
| `MANAGER` | 全部门店操作，不含用户管理 |
| `VIEWER` | 只读，不能新增或删除 |

---

## 收货管理工作流

1. 拍照或上传配送发票图片
2. 通义千问-VL（`qwen-vl-max`）提取：PO#、Invoice No.、供应商名称、所有商品行（含数量）
3. 系统按 PO# 匹配本地已同步的订单
4. 对比表格显示每项商品的建议操作：Full（全部收货）或 Change QTY（修改数量）
5. 点击 PO# 链接直接跳转到 OSS 收货模块
6. 将 Invoice No.（显示在页面顶部，附复制按钮）填入 OSS 确认单
