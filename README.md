# STP Sushi — Store Management System

> 🌐 [中文文档](README.zh.md) | English

A full-stack internal management system for a sushi store, built with Next.js and deployed on Alibaba Cloud. Covers purchasing, inventory, goods receiving, and staff training.

---

## Features

### Purchasing (Sushi Module)
- **Orders** — Sync purchase orders from OSS, view status (pending / ordered / confirmed), 2-week delivery calendar
- **PO Calendar** — Monthly calendar view with overdue alerts and upcoming order deadlines
- **Inventory** — Track stock items with quantity and notes
- **Goods Receiving** — Upload a delivery invoice photo → AI extracts PO#, Invoice No., supplier, items → auto-matches against local orders → shows quantity comparison (Full / Change QTY)

### Staff Training
- **Staff list** — Add/delete staff, view skill completion progress per person
- **Skill checklist** — 32 tasks across 4 areas (Kitchen, Sushi Production, Customer Service, Store Operations), each marked Pass / Partial / Fail
- **Training records** — Per-task notes with date, type, area for improvement, feedback, and follow-up

### System
- JWT-based authentication with three roles: `OWNER`, `MANAGER`, `VIEWER`
- Bilingual UI — Chinese / English toggle
- Fully responsive — desktop, tablet, and mobile

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite via Prisma + libSQL |
| Auth | JWT (`jose`) |
| AI (Goods Receiving) | Alibaba DashScope Qwen-VL (`qwen-vl-max`) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Runtime | Node.js + PM2 on Alibaba Cloud |

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── sushi/
│   │   │   ├── orders/          # Order list + 2-week calendar
│   │   │   ├── po-calendar/     # Monthly PO calendar
│   │   │   ├── inventory/       # Inventory management
│   │   │   └── goods-receiving/ # Invoice scan & receiving
│   │   ├── training/
│   │   │   ├── page.tsx         # Staff list
│   │   │   └── [id]/page.tsx    # Staff detail & checklist
│   │   └── settings/            # User management (OWNER only)
│   ├── api/
│   │   ├── auth/                # Login / logout
│   │   ├── sushi/               # Orders, inventory, sync, goods-receiving
│   │   └── training/            # Staff, checklist, records
│   └── login/
├── components/
│   ├── Sidebar.tsx
│   ├── SessionProvider.tsx
│   └── LanguageProvider.tsx
└── lib/
    ├── auth.ts                  # JWT helpers
    ├── prisma.ts
    ├── oss-sync.ts              # OSS order sync logic
    └── i18n.ts                  # zh / en translations
prisma/
└── schema.prisma
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key"
OSS_BASE_URL="https://oss.spientsyserv.com"
DASHSCOPE_API_KEY="sk-your-dashscope-key"
```

- `DASHSCOPE_API_KEY` — Get from [Alibaba Cloud Model Studio](https://modelstudio.console.alibabacloud.com). Used for invoice image recognition in Goods Receiving.

---

## Local Development

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Alibaba Cloud)

**Local — bundle and upload:**
```bash
git bundle create sushi.bundle HEAD
scp sushi.bundle root@<server-ip>:/root/sushi.bundle
```

**Server — pull, build, restart:**
```bash
cd /var/www/stp_sushi
git fetch /root/sushi.bundle
git reset --hard FETCH_HEAD
npm install
npm run build
pm2 restart stp_sushi
```

First-time setup on server:
```bash
npx prisma migrate deploy
pm2 start npm --name stp_sushi -- start
pm2 save
```

---

## Roles

| Role | Permissions |
|------|-------------|
| `OWNER` | Full access including user management |
| `MANAGER` | All store operations, no user management |
| `VIEWER` | Read-only, no add/delete |

---

## Goods Receiving — How It Works

1. Upload or photograph a delivery invoice
2. Qwen-VL (`qwen-vl-max`) extracts: PO#, Invoice No., supplier, all line items with quantities
3. System matches PO# against locally synced orders
4. Comparison table shows Full / Change QTY recommendation per item
5. Click the PO# link to jump directly to OSS Goods Receiving page
6. Enter the Invoice No. (shown with copy button) into OSS confirmation
