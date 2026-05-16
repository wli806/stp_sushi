import { prisma } from "./prisma";
import { applyOrderToInventory } from "./sushi-inventory-apply";
import { wxNotify } from "./serverchan";

const BASE = "https://oss.spientsyserv.com";
const MONTH_ABBR: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};

function parseDeliveryDate(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  // 支持两位或四位年份: "14-May-26" 或 "14-May-2026"
  const dm = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (dm) {
    const m = MONTH_ABBR[dm[2].toLowerCase()];
    const y = dm[3].length === 2 ? `20${dm[3]}` : dm[3];
    if (m) return `${y}-${m}-${dm[1].padStart(2,"0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ossDateFmt(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

// FY2026: week 1 starts March 30, 2026
function getFiscalWeek(d: Date): number {
  const fy2026Start = new Date("2026-03-30").getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((d.getTime() - fy2026Start) / weekMs) + 1);
}

async function ossLogin(): Promise<string> {
  const username = process.env.OSS_USERNAME ?? "";
  const password = process.env.OSS_PASSWORD ?? "";
  if (!username || !password) throw new Error("OSS 登录失败：OSS_USERNAME 或 OSS_PASSWORD 未配置");

  const res = await fetch(`${BASE}/common/login/attemptlogin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
    redirect: "manual",
  });

  let cookie = res.headers.get("set-cookie") ?? "";
  if (!cookie && typeof (res.headers as unknown as Record<string, unknown>).getSetCookie === "function") {
    cookie = ((res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()).join("; ");
  }

  const m = cookie.match(/ci_session=([^;]+)/);
  if (!m) {
    const location = res.headers.get("location") ?? "(none)";
    throw new Error(
      `OSS 登录失败 [HTTP ${res.status}, Location: ${location}, Set-Cookie: ${cookie.substring(0, 120) || "(empty)"}] — 请检查账号密码及服务器网络连通性`
    );
  }
  return m[1];
}

interface RawOrder {
  id: string;
  poNumber: string;
  supplier: string;
  status: number;
  poDate: string;
  deliveryDate: string | null;
  orderDate: string;
  weekNo: number;
  year: number;
  editPath: string | null;
}

function normalizeShortYear(s: string): string {
  return s.replace(/-(\d{2})$/, (_, y) => `-20${y}`);
}

function parseNormalOrders(tbody: string, weekNo: number, year: number): RawOrder[] {
  const DATE_RE = /\b(\d{1,2}-[A-Za-z]{3}-(?:\d{2}|\d{4}))\b/;
  const orders: RawOrder[] = [];
  const rows = tbody.split(/<\/tr>/i);
  for (const row of rows) {
    const hrefMatch = row.match(/href=["']([^"']*editorder\/(\d+)(?:\/(\d+))?)[^"']*["']/i);
    if (!hrefMatch) continue;
    const id = hrefMatch[2];
    const editPath = hrefMatch[1].replace(/^.*?(editorder\/.+)$/, "$1").split("?")[0];

    const tdTexts = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const poNumber = tdTexts[6] ?? "";
    const supplierRaw = tdTexts[2] ?? "";
    const supplier = supplierRaw.replace(/^[A-Z]\s+/, "").trim();

    const orderDateRaw = (tdTexts[0] ?? "").match(DATE_RE)?.[1] ?? "";
    const orderDate = orderDateRaw ? normalizeShortYear(orderDateRaw) : "";

    orders.push({
      id, poNumber, supplier, status: 2,
      poDate: orderDate,
      orderDate,
      deliveryDate: null,
      weekNo, year,
      editPath,
    });
  }
  return orders;
}

export async function syncOSSOrders(): Promise<{ synced: number; errors: string[]; debug: string[] }> {
  const session = await ossLogin();
  const now = new Date();
  const weekNo = getFiscalWeek(now);
  const year = now.getFullYear();

  const listRes = await fetch(`${BASE}/shop/home/getTemplates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": `ci_session=${session}`,
    },
    body: new URLSearchParams({
      week: String(weekNo),
      year: String(year),
      type: "all",
      last_row: "",
      dailypo_week_no: String(weekNo),
      dailypo_year: String(year),
      dailypo_selected_day: ossDateFmt(now),
      supplier_id: "0",
    }),
  });

  const listData = await listRes.json();

  interface OSSTemplate {
    id: string | null;
    po_number: string | null;
    display_name: string;
    supplier_name: string;
    po_status: string;
    po_date: string;
    delivery_date: string | null;
    order_date: string;
    week_no: string;
    year: string;
  }

  const dailyOrders: RawOrder[] = ((listData.dailypo_template ?? []) as OSSTemplate[])
    .filter(o => o.id !== null)
    .map(o => ({
      id: o.id!,
      poNumber: o.po_number ?? "",
      supplier: o.display_name || o.supplier_name,
      status: parseInt(o.po_status),
      poDate: o.po_date,
      deliveryDate: o.delivery_date,
      orderDate: o.order_date,
      weekNo: parseInt(o.week_no),
      year: parseInt(o.year),
      editPath: null,
    }));

  const tbody: string = listData.tbody ?? "";
  const normalOrders = parseNormalOrders(tbody, weekNo, year);
  const dailyIds = new Set(dailyOrders.map(o => o.id));
  const allOrders = [...dailyOrders, ...normalOrders.filter(o => !dailyIds.has(o.id))];

  const errors: string[] = [];
  const debug: string[] = [];
  let synced = 0;
  const newOrders: string[] = [];
  const todayDeliveries: string[] = [];
  const tomorrowDeliveries: string[] = [];

  for (let i = 0; i < allOrders.length; i += 5) {
    const batch = allOrders.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (order) => {
        const headers = {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": `ci_session=${session}`,
        };
        const [itemsRes, detailRes] = await Promise.all([
          fetch(`${BASE}/shop/home/getExistingItems`, {
            method: "POST", headers,
            body: new URLSearchParams({ headerid: order.id }),
          }),
          order.deliveryDate === null && order.editPath
            ? fetch(`${BASE}/shop/${order.editPath}`, { headers: { Cookie: `ci_session=${session}`, Referer: `${BASE}/shop/home`, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } })
            : (order.deliveryDate === null && !order.editPath
                ? (debug.push(`[${order.supplier}] id=${order.id} editPath=null (href regex missed)`), Promise.resolve(null))
                : Promise.resolve(null)),
        ]);

        const text = await itemsRes.text();
        let items: Record<string, string>[] = [];
        try {
          const parsed = JSON.parse(text);
          items = Array.isArray(parsed) ? parsed : [];
        } catch { items = []; }

        let deliveryDate = order.deliveryDate;
        if (detailRes) {
          const html = await detailRes.text();
          const seen = new Set<string>();
          const dates: string[] = [];
          for (const m of html.matchAll(/\b(\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/gi)) {
            const normalized = normalizeShortYear(m[1]);
            if (!seen.has(normalized)) { seen.add(normalized); dates.push(normalized); }
          }
          if (dates.length >= 2) deliveryDate = dates[1];
          else if (dates.length === 1) deliveryDate = dates[0];
          debug.push(`[${order.supplier}] url=/shop/${order.editPath} status=${detailRes.status} htmlLen=${html.length} dates=${JSON.stringify(dates)} → deliveryDate=${deliveryDate ?? "null"}`);
        }

        return { order: { ...order, deliveryDate }, items };
      })
    );

    for (const result of results) {
      if (result.status === "rejected") { errors.push(String(result.reason)); continue; }
      const { order, items } = result.value;
      try {
        const isNew = !(await prisma.sushiOrder.findUnique({ where: { ossId: order.id }, select: { id: true } }));
        const dbOrder = await prisma.sushiOrder.upsert({
          where: { ossId: order.id },
          update: {
            poNumber: order.poNumber,
            supplierName: order.supplier,
            status: order.status,
            poDate: order.poDate || null,
            deliveryDate: order.deliveryDate,
            orderDate: order.orderDate || null,
            weekNo: order.weekNo,
            year: order.year,
            syncedAt: new Date(),
          },
          create: {
            ossId: order.id,
            poNumber: order.poNumber,
            supplierName: order.supplier,
            status: order.status,
            poDate: order.poDate || null,
            deliveryDate: order.deliveryDate,
            orderDate: order.orderDate || null,
            weekNo: order.weekNo,
            year: order.year,
          },
        });
        if (isNew && items.length > 0) newOrders.push(order.supplier);
        await prisma.sushiOrderItem.deleteMany({ where: { orderId: dbOrder.id } });
        if (items.length > 0) {
          await prisma.sushiOrderItem.createMany({
            data: items.map(item => ({
              orderId: dbOrder.id,
              ossItemId: String(item.id ?? ""),
              itemCode: item.item_code ?? "",
              itemName: item.item_name ?? item.supplier_item_name ?? "",
              uom: item.uom_name ?? "",
              quantity: parseFloat(item.qty ?? "0"),
            })),
          });
        }
        const deliveryYMD = parseDeliveryDate(order.deliveryDate ?? "");
        if (deliveryYMD) {
          const todayYMD = new Date().toISOString().slice(0, 10);
          const tomorrowYMD = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
          if (deliveryYMD <= todayYMD && !dbOrder.inventoryApplied) {
            todayDeliveries.push(order.supplier);
            try { await applyOrderToInventory(dbOrder.id); } catch { /* 不影响同步 */ }
          } else if (deliveryYMD === tomorrowYMD) {
            tomorrowDeliveries.push(order.supplier);
          }
        }
        synced++;
      } catch (e) {
        errors.push(`Order ${order.id}: ${String(e)}`);
      }
    }
  }

  if (newOrders.length > 0) {
    const unique = [...new Set(newOrders)];
    await wxNotify(
      `🛒 寿司系统：${unique.length} 个新采购订单`,
      unique.map(s => `- ${s}`).join("\n"),
    );
  }
  if (todayDeliveries.length > 0) {
    const unique = [...new Set(todayDeliveries)];
    await wxNotify(
      `📦 寿司系统：今日 ${unique.length} 笔订单到货`,
      unique.map(s => `- ${s}`).join("\n"),
    );
  }
  if (tomorrowDeliveries.length > 0) {
    const unique = [...new Set(tomorrowDeliveries)];
    await wxNotify(
      `🚚 寿司系统：明日 ${unique.length} 笔订单到货提醒`,
      unique.map(s => `- ${s}`).join("\n"),
    );
  }

  return { synced, errors, debug };
}
