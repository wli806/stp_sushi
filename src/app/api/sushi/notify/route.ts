import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseToYMD(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const ABBR: Record<string,string> = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
  const dm = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (dm) { const m = ABBR[dm[2].toLowerCase()]; if (m) return `${dm[3]}-${m}-${dm[1].padStart(2,"0")}`; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// GET /api/sushi/notify?secret=xxx
// Called by a daily cron job on the server.
// Env vars required: SERVERCHAN_KEY, CRON_SECRET
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scKey = process.env.SERVERCHAN_KEY;
  if (!scKey) return NextResponse.json({ error: "SERVERCHAN_KEY not configured" }, { status: 500 });

  // Use NZ local time (UTC+12) for date comparisons
  const nzNow = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const today    = nzNow.toISOString().slice(0, 10);
  const tomorrow = new Date(nzNow.getTime() + 86400000).toISOString().slice(0, 10);
  const in3Days  = new Date(nzNow.getTime() + 3 * 86400000).toISOString().slice(0, 10);

  // 待下单订单（按下单截止日分紧急程度）
  const pendingOrders = await prisma.sushiOrder.findMany({ where: { status: 1 } });

  interface OrderRow { supplierName: string; weekNo: number | null; orderDate: string | null; deliveryDate: string | null }
  const urgent: OrderRow[] = [];
  const soon: OrderRow[] = [];
  const later: OrderRow[] = [];

  for (const o of pendingOrders) {
    const ymd = o.orderDate ? parseToYMD(o.orderDate) : null;
    if (!ymd) continue;
    if (ymd <= tomorrow) urgent.push(o);
    else if (ymd <= in3Days) soon.push(o);
    else later.push(o);
  }

  // 到货订单：与日历相同逻辑 — status >= 2 且有商品明细
  const allOrders = await prisma.sushiOrder.findMany({
    where: { status: { gte: 2 } },
    include: { items: true },
  });
  const tomorrowDeliveries = allOrders.filter(o => o.items.length > 0 && o.deliveryDate && parseToYMD(o.deliveryDate) === tomorrow);
  const todayDeliveries    = allOrders.filter(o => o.items.length > 0 && o.deliveryDate && parseToYMD(o.deliveryDate) === today);

  const hasAnything = urgent.length > 0 || soon.length > 0 || later.length > 0 || tomorrowDeliveries.length > 0 || todayDeliveries.length > 0;
  if (!hasAnything) {
    return NextResponse.json({ sent: false, reason: "nothing to notify" });
  }

  let desp = "";

  // 今日 / 明日到货
  if (todayDeliveries.length > 0) {
    desp += `### 🚚 今日到货（${todayDeliveries.length} 笔）\n\n`;
    for (const o of todayDeliveries) {
      desp += `- ${o.supplierName}${o.weekNo ? ` (W${o.weekNo})` : ""}\n`;
    }
    desp += "\n";
  }
  if (tomorrowDeliveries.length > 0) {
    desp += `### 📦 明日到货（${tomorrowDeliveries.length} 笔）\n\n`;
    for (const o of tomorrowDeliveries) {
      desp += `- ${o.supplierName}${o.weekNo ? ` (W${o.weekNo})` : ""}\n`;
    }
    desp += "\n";
  }

  // 待下单提醒
  if (urgent.length > 0) {
    desp += "### ⚠️ 今明截止，需立即下单\n\n";
    for (const o of urgent) {
      const ymd = parseToYMD(o.orderDate!)!;
      const label = ymd === today ? "**今天**" : "明天";
      desp += `- ${label} · ${o.supplierName}${o.weekNo ? ` (W${o.weekNo})` : ""} · 下单日 ${ymd}\n`;
    }
    desp += "\n";
  }
  if (soon.length > 0) {
    desp += "### 📋 3天内截止\n\n";
    for (const o of soon) {
      desp += `- ${o.supplierName}${o.weekNo ? ` (W${o.weekNo})` : ""} · 下单日 ${parseToYMD(o.orderDate!)}\n`;
    }
    desp += "\n";
  }
  if (later.length > 0) {
    desp += "### 📌 其他待下单\n\n";
    for (const o of later) {
      desp += `- ${o.supplierName}${o.weekNo ? ` (W${o.weekNo})` : ""} · 下单日 ${parseToYMD(o.orderDate!)}\n`;
    }
  }

  const titleParts: string[] = [];
  if (todayDeliveries.length > 0) titleParts.push(`今日到货 ${todayDeliveries.length} 笔`);
  if (tomorrowDeliveries.length > 0) titleParts.push(`明日到货 ${tomorrowDeliveries.length} 笔`);
  if (urgent.length > 0) titleParts.push(`${urgent.length} 单今明截止下单`);
  const title = titleParts.length > 0 ? `🔔 寿司提醒 — ${titleParts.join(" · ")}` : `📋 寿司提醒 — ${pendingOrders.length} 单待下单`;

  const resp = await fetch(`https://sctapi.ftqq.com/${scKey}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title, desp }),
  });
  const result = await resp.json();
  return NextResponse.json({ sent: true, todayDeliveries: todayDeliveries.length, tomorrowDeliveries: tomorrowDeliveries.length, urgentOrders: urgent.length, result });
}
