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

const FY2026_START = new Date("2026-03-30").getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getFiscalWeek(d: Date): number {
  return Math.max(1, Math.floor((d.getTime() - FY2026_START) / WEEK_MS) + 1);
}

function getWeekMonday(weekNo: number): Date {
  return new Date(FY2026_START + (weekNo - 1) * WEEK_MS);
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
      `OSS 登录失败 [HTTP ${res.status}, Location: ${location}, Set-Cookie: ${cookie.substring(0, 120) || "(empty)"}]`
    );
  }
  return m[1];
}

interface RawOrder {
  id: string; poNumber: string; supplier: string; status: number;
  poDate: string; deliveryDate: string | null; orderDate: string;
  weekNo: number; year: number; editPath: string | null;
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

    // Detect pending status: row contains o-i-circle with "O" (Open/not yet submitted)
    const isPending = /o-i-circle[^>]*>\s*O\s*</i.test(row);
    const status = isPending ? 1 : 2;

    // td[0] has order date for submitted; td[1] has the full deadline string for pending
    const dateCandidate0 = (tdTexts[0] ?? "").match(DATE_RE)?.[1] ?? "";
    const deadlineStr = tdTexts[1] ?? "";  // e.g. "Tuesday 19-May-26 11:59 pm"
    const dateCandidate1 = deadlineStr.match(DATE_RE)?.[1] ?? "";
    const orderDateRaw = dateCandidate0 || dateCandidate1;
    const orderDate = orderDateRaw ? normalizeShortYear(orderDateRaw) : "";

    // For pending orders: store full deadline string in poDate (shown as cutoff time in UI)
    const poDate = isPending ? deadlineStr : orderDate;

    orders.push({ id, poNumber, supplier, status, poDate, orderDate, deliveryDate: null, weekNo, year, editPath });
  }
  return orders;
}

interface OSSTemplate {
  id: string | null; po_number: string | null;
  display_name: string; supplier_name: string;
  po_status: string; po_date: string;
  delivery_date: string | null; order_date: string;
  week_no: string; year: string;
}

async function fetchWeekDay(
  session: string,
  weekNo: number,
  year: number,
  day: Date,
): Promise<{ templates: OSSTemplate[]; tbody: string }> {
  const res = await fetch(`${BASE}/shop/home/getTemplates`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": `ci_session=${session}` },
    body: new URLSearchParams({
      week: String(weekNo), year: String(year), type: "all", last_row: "",
      dailypo_week_no: String(weekNo), dailypo_year: String(year),
      dailypo_selected_day: ossDateFmt(day), supplier_id: "0",
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { templates: (data.dailypo_template ?? []) as OSSTemplate[], tbody: data.tbody ?? "" };
}

interface WeekSyncResult {
  synced: number; errors: string[]; debug: string[];
  newOrders: string[]; todayDeliveries: string[]; tomorrowDeliveries: string[];
}

async function syncWeekOrders(
  session: string,
  weekNo: number,
  year: number,
  now: Date,
): Promise<WeekSyncResult> {
  const errors: string[] = [];
  const debug: string[] = [];
  const newOrders: string[] = [];
  const todayDeliveries: string[] = [];
  const tomorrowDeliveries: string[] = [];
  let synced = 0;

  const weekMonday = getWeekMonday(weekNo);
  let mergedTemplates: OSSTemplate[] = [];
  let tbody = "";

  // One request per week is enough — all days return identical tbody data
  const r = await fetchWeekDay(session, weekNo, year, weekMonday).catch(() => ({ templates: [], tbody: "" }));
  // Only keep dailypo templates that have a real ID (already-created POs)
  mergedTemplates = r.templates.filter(t => t.id !== null);
  tbody = r.tbody;

  const dailyOrders: RawOrder[] = mergedTemplates
    .filter(o => o.id !== null)
    .map(o => ({
      id: o.id!, poNumber: o.po_number ?? "",
      supplier: o.display_name || o.supplier_name,
      status: parseInt(o.po_status), poDate: o.po_date,
      deliveryDate: o.delivery_date, orderDate: o.order_date,
      weekNo: parseInt(o.week_no) || weekNo, year: parseInt(o.year) || year,
      editPath: null,
    }));

  const normalOrders = parseNormalOrders(tbody, weekNo, year);
  const dailyIds = new Set(dailyOrders.map(o => o.id));
  const allOrders = [...dailyOrders, ...normalOrders.filter(o => !dailyIds.has(o.id))];

  if (allOrders.length === 0) return { synced, errors, debug, newOrders, todayDeliveries, tomorrowDeliveries };

  for (let i = 0; i < allOrders.length; i += 5) {
    const batch = allOrders.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (order) => {
        const headers = { "Content-Type": "application/x-www-form-urlencoded", "Cookie": `ci_session=${session}` };
        const [itemsRes, detailRes] = await Promise.all([
          fetch(`${BASE}/shop/home/getExistingItems`, {
            method: "POST", headers,
            body: new URLSearchParams({ headerid: order.id }),
          }),
          order.deliveryDate === null && order.editPath
            ? fetch(`${BASE}/shop/${order.editPath}`, { headers: { Cookie: `ci_session=${session}`, Referer: `${BASE}/shop/home`, "User-Agent": "Mozilla/5.0" } })
            : Promise.resolve(null),
        ]);

        const text = await itemsRes.text();
        let items: Record<string, string>[] = [];
        try { const parsed = JSON.parse(text); items = Array.isArray(parsed) ? parsed : []; } catch { items = []; }

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
          debug.push(`[${order.supplier}] week=${weekNo} → deliveryDate=${deliveryDate ?? "null"}`);
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
          update: { poNumber: order.poNumber, supplierName: order.supplier, status: order.status, poDate: order.poDate || null, deliveryDate: order.deliveryDate, orderDate: order.orderDate || null, weekNo: order.weekNo, year: order.year, syncedAt: new Date() },
          create: { ossId: order.id, poNumber: order.poNumber, supplierName: order.supplier, status: order.status, poDate: order.poDate || null, deliveryDate: order.deliveryDate, orderDate: order.orderDate || null, weekNo: order.weekNo, year: order.year },
        });
        if (isNew && items.length > 0) newOrders.push(order.supplier);
        await prisma.sushiOrderItem.deleteMany({ where: { orderId: dbOrder.id } });
        if (items.length > 0) {
          await prisma.sushiOrderItem.createMany({
            data: items.map(item => ({
              orderId: dbOrder.id, ossItemId: String(item.id ?? ""),
              itemCode: item.item_code ?? "", itemName: item.item_name ?? item.supplier_item_name ?? "",
              uom: item.uom_name ?? "", quantity: parseFloat(item.qty ?? "0"),
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
      } catch (e) { errors.push(`Order ${order.id}: ${String(e)}`); }
    }
  }

  return { synced, errors, debug, newOrders, todayDeliveries, tomorrowDeliveries };
}

export async function syncOSSOrders(): Promise<{ synced: number; errors: string[]; debug: string[] }> {
  const session = await ossLogin();
  const now = new Date();
  const currentWeekNo = getFiscalWeek(now);
  const year = now.getFullYear();

  // First sync: fetch all weeks from week 1 (slow, but only once).
  // Subsequent syncs: only current-1 through current+4 (fast incremental).
  const hasHistory = (await prisma.sushiOrder.count()) > 0;
  const startWeek = hasHistory ? Math.max(1, currentWeekNo - 1) : 1;
  const endWeek = currentWeekNo + 4;

  const allErrors: string[] = [];
  const allDebug: string[] = [];
  const allNewOrders: string[] = [];
  const allTodayDeliveries: string[] = [];
  const allTomorrowDeliveries: string[] = [];
  let totalSynced = 0;

  for (let wn = startWeek; wn <= endWeek; wn++) {
    try {
      // Fetch all days only for current week and future (to get pending daily PO templates)
      const result = await syncWeekOrders(session, wn, year, now);
      totalSynced += result.synced;
      allErrors.push(...result.errors);
      allDebug.push(...result.debug);
      allNewOrders.push(...result.newOrders);
      allTodayDeliveries.push(...result.todayDeliveries);
      allTomorrowDeliveries.push(...result.tomorrowDeliveries);
    } catch (e) { allErrors.push(`Week ${wn}: ${String(e)}`); }
  }

  // 清理：状态仍为 pending 但下单日期已过的订单（即漏单），从数据库删除
  const todayYMD = now.toISOString().slice(0, 10);
  const stalePending = await prisma.sushiOrder.findMany({
    where: { status: 1 },
    select: { id: true, orderDate: true, supplierName: true },
  });
  const toDelete = stalePending
    .filter(o => {
      if (!o.orderDate) return false;
      const ymd = parseDeliveryDate(o.orderDate);
      return ymd !== null && ymd < todayYMD;
    })
    .map(o => o.id);
  if (toDelete.length > 0) {
    await prisma.sushiOrder.deleteMany({ where: { id: { in: toDelete } } });
    allDebug.push(`清理漏单 ${toDelete.length} 条（下单日期已过且未提交）`);
  }

  if (allNewOrders.length > 0) {
    const unique = [...new Set(allNewOrders)];
    await wxNotify(`🛒 寿司系统：${unique.length} 个新采购订单`, unique.map(s => `- ${s}`).join("\n"));
  }
  if (allTodayDeliveries.length > 0) {
    const unique = [...new Set(allTodayDeliveries)];
    await wxNotify(`📦 寿司系统：今日 ${unique.length} 笔订单到货`, unique.map(s => `- ${s}`).join("\n"));
  }
  if (allTomorrowDeliveries.length > 0) {
    const unique = [...new Set(allTomorrowDeliveries)];
    await wxNotify(`🚚 寿司系统：明日 ${unique.length} 笔订单到货提醒`, unique.map(s => `- ${s}`).join("\n"));
  }

  return { synced: totalSynced, errors: allErrors, debug: allDebug };
}
