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
// Env vars required: SERVER_CHAN_KEY, NOTIFY_SECRET
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scKey = process.env.SERVERCHAN_KEY;
  if (!scKey) return NextResponse.json({ error: "SERVER_CHAN_KEY not configured" }, { status: 500 });

  const orders = await prisma.sushiOrder.findMany({ where: { status: 1 } });

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  interface OrderRow { supplierName: string; weekNo: number | null; orderDate: string | null }
  const urgent: OrderRow[] = [];
  const soon: OrderRow[] = [];
  const later: OrderRow[] = [];

  for (const o of orders) {
    const ymd = o.orderDate ? parseToYMD(o.orderDate) : null;
    if (!ymd) continue;
    if (ymd <= tomorrow) urgent.push(o);
    else if (ymd <= in3Days) soon.push(o);
    else later.push(o);
  }

  if (urgent.length === 0 && soon.length === 0 && later.length === 0) {
    return NextResponse.json({ sent: false, reason: "no pending orders" });
  }

  let desp = "";
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

  const title = urgent.length > 0
    ? `🚨 寿司下单提醒 — ${urgent.length} 单今明截止`
    : `📋 寿司下单提醒 — ${orders.length} 单待下单`;

  const resp = await fetch(`https://sctapi.ftqq.com/${scKey}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title, desp }),
  });
  const result = await resp.json();
  return NextResponse.json({ sent: true, urgent: urgent.length, total: orders.length, result });
}
