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

// OFFICE supplier always delivers on Thursday — compute the Thursday after the order date
function getNextThursday(orderYMD: string): string {
  const d = new Date(orderYMD + "T00:00:00");
  d.setDate(d.getDate() + 1); // start from day after order date
  const daysUntilThu = (4 - d.getDay() + 7) % 7; // Thu = day index 4
  d.setDate(d.getDate() + daysUntilThu);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

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
    // Match both regular (editorder/123) and virtual (editorder/virtual/suppId/date/week)
    const hrefMatch = row.match(/href=["'][^"']*editorder\/(virtual\/[^"'? ]+|\d+(?:\/\d+)?)[^"']*["']/i);
    if (!hrefMatch) continue;
    const editSuffix = hrefMatch[1]; // e.g. "virtual/100060/19-May-26/8" or "12345"
    const isVirtual = editSuffix.startsWith("virtual/");
    const editPath = `editorder/${editSuffix}`;

    const tdTexts = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const supplierRaw = tdTexts[2] ?? "";
    const supplier = supplierRaw.replace(/^[A-Z]\s+/, "").trim();
    const deadlineStr = tdTexts[1] ?? "";

    let id: string;
    let orderDate: string;
    let poDate: string;
    let poNumber: string;
    let status: number;

    if (isVirtual) {
      // URL parts: virtual / supplierId / date / weekNo
      const parts = editSuffix.split("/"); // ["virtual","100060","19-May-26","8"]
      const supplierId = parts[1] ?? "";
      const dateStr = parts[2] ?? "";
      id = `virtual-${supplierId}-${dateStr}-${weekNo}`;
      orderDate = dateStr ? normalizeShortYear(dateStr) : "";
      poDate = deadlineStr || orderDate;
      // Store editPath in poNumber so po-calendar page can build the OSS link
      poNumber = editPath;
      status = 1;
    } else {
      id = editSuffix.match(/^(\d+)/)?.[1] ?? editSuffix;
      const dateCandidate0 = (tdTexts[0] ?? "").match(DATE_RE)?.[1] ?? "";
      const dateCandidate1 = deadlineStr.match(DATE_RE)?.[1] ?? "";
      const orderDateRaw = dateCandidate0 || dateCandidate1;
      orderDate = orderDateRaw ? normalizeShortYear(orderDateRaw) : "";
      poDate = (/o-i-circle[^>]*>\s*O\s*</i.test(row)) ? deadlineStr : orderDate;
      poNumber = tdTexts[6] ?? "";
      status = /o-i-circle[^>]*>\s*O\s*</i.test(row) ? 1 : 2;
    }

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

  // Pre-load all existing orders for this week in one DB query to avoid N individual findUnique calls
  const existingRows = await prisma.sushiOrder.findMany({
    where: { ossId: { in: allOrders.map(o => o.id) } },
    select: { id: true, ossId: true, status: true, deliveryDate: true, inventoryApplied: true },
  });
  const existingMap = new Map(existingRows.map(r => [r.ossId, r]));

  const todayYMDLocal = now.toISOString().slice(0, 10);

  // Batch size 10 (up from 5) — OSS handles concurrent requests fine
  for (let i = 0; i < allOrders.length; i += 10) {
    const batch = allOrders.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (order) => {
        const headers = { "Content-Type": "application/x-www-form-urlencoded", "Cookie": `ci_session=${session}` };
        const isVirtualOrder = order.id.startsWith("virtual-");
        const existing = existingMap.get(order.id);
        const statusChanged = !existing || existing.status !== order.status;
        const isOffice = order.supplier.toUpperCase().includes("OFFICE");
        // Skip delivery-date fetch if OFFICE (we override it) or if already stored
        const needsDeliveryFetch = !isOffice && order.deliveryDate === null && order.editPath && !existing?.deliveryDate;

        const [itemsRes, detailRes] = await Promise.all([
          // Skip item fetch for existing orders whose status hasn't changed
          !isVirtualOrder && statusChanged
            ? fetch(`${BASE}/shop/home/getExistingItems`, { method: "POST", headers, body: new URLSearchParams({ headerid: order.id }) })
            : Promise.resolve(null),
          needsDeliveryFetch
            ? fetch(`${BASE}/shop/${order.editPath}`, { headers: { Cookie: `ci_session=${session}`, Referer: `${BASE}/shop/home`, "User-Agent": "Mozilla/5.0" } })
            : Promise.resolve(null),
        ]);

        let items: Record<string, string>[] = [];
        if (itemsRes) {
          const text = await itemsRes.text();
          try { const parsed = JSON.parse(text); items = Array.isArray(parsed) ? parsed : []; } catch { items = []; }
        }

        let deliveryDate = order.deliveryDate ?? existing?.deliveryDate ?? null;
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
        return { order: { ...order, deliveryDate }, items, existing, statusChanged };
      })
    );

    for (const result of results) {
      if (result.status === "rejected") { errors.push(String(result.reason)); continue; }
      const { order, items, existing, statusChanged } = result.value;
      // Virtual orders whose order date is today or past have been handled by the user
      if (order.id.startsWith("virtual-") && order.orderDate) {
        const ymd = parseDeliveryDate(order.orderDate);
        if (ymd && ymd <= todayYMDLocal) { synced++; continue; }
      }
      // OFFICE supplier always delivers on Thursday — ignore OSS delivery date
      if (order.supplier.toUpperCase().includes("OFFICE") && order.orderDate) {
        const orderYMD = parseDeliveryDate(order.orderDate);
        if (orderYMD) order.deliveryDate = getNextThursday(orderYMD);
      }
      try {
        const isNew = !existing;
        const dbOrder = await prisma.sushiOrder.upsert({
          where: { ossId: order.id },
          update: { poNumber: order.poNumber, supplierName: order.supplier, status: order.status, poDate: order.poDate || null, deliveryDate: order.deliveryDate, orderDate: order.orderDate || null, weekNo: order.weekNo, year: order.year, syncedAt: new Date() },
          create: { ossId: order.id, poNumber: order.poNumber, supplierName: order.supplier, status: order.status, poDate: order.poDate || null, deliveryDate: order.deliveryDate, orderDate: order.orderDate || null, weekNo: order.weekNo, year: order.year },
        });
        if (isNew && items.length > 0) newOrders.push(order.supplier);
        // Only update items when status changed or order is new (avoids unnecessary writes)
        if (statusChanged || isNew) {
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
        }
        const deliveryYMD = parseDeliveryDate(order.deliveryDate ?? "");
        if (deliveryYMD) {
          const todayYMD = now.toISOString().slice(0, 10);
          const tomorrowYMD = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
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
  // Incremental: only current week onward (past weeks stay in DB as-is)
  const startWeek = hasHistory ? currentWeekNo : 1;
  const endWeek = currentWeekNo + 2;

  const allErrors: string[] = [];
  const allDebug: string[] = [];
  const allNewOrders: string[] = [];
  let totalSynced = 0;

  for (let wn = startWeek; wn <= endWeek; wn++) {
    try {
      // Fetch all days only for current week and future (to get pending daily PO templates)
      const result = await syncWeekOrders(session, wn, year, now);
      totalSynced += result.synced;
      allErrors.push(...result.errors);
      allDebug.push(...result.debug);
      allNewOrders.push(...result.newOrders);
    } catch (e) { allErrors.push(`Week ${wn}: ${String(e)}`); }
  }

  // 清理：status=1 但下单日期已处理的订单，从数据库删除
  // - 虚拟订单（virtual-*）：下单日 <= 今天（用户已在 OSS 处理，可能是空提交）
  // - 真实 PO：下单日 < 今天（确实漏单）
  const todayYMD = now.toISOString().slice(0, 10);
  const stalePending = await prisma.sushiOrder.findMany({
    where: { status: 1 },
    select: { id: true, ossId: true, orderDate: true, supplierName: true },
  });
  const toDelete = stalePending
    .filter(o => {
      if (!o.orderDate) return false;
      const ymd = parseDeliveryDate(o.orderDate);
      if (!ymd) return false;
      const isVirtual = o.ossId.startsWith("virtual-");
      return isVirtual ? ymd <= todayYMD : ymd < todayYMD;
    })
    .map(o => o.id);
  if (toDelete.length > 0) {
    await prisma.sushiOrder.deleteMany({ where: { id: { in: toDelete } } });
    allDebug.push(`清理漏单 ${toDelete.length} 条（下单日期已过且未提交）`);
  }

  // 新增订单通知
  if (allNewOrders.length > 0) {
    const unique = [...new Set(allNewOrders)];
    await wxNotify(`🛒 寿司系统：${unique.length} 个新采购订单`, unique.map(s => `- ${s}`).join("\n"));
  }

  // 今日 / 明日到货：同步完成后查数据库，避免时区误差和遗漏
  const nzNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const todayNZ  = nzNow.toISOString().slice(0, 10);
  const tomorrowNZ = new Date(nzNow.getTime() + 86400000).toISOString().slice(0, 10);

  const deliveryOrders = await prisma.sushiOrder.findMany({ where: { status: { gte: 2 } } });

  function matchDate(raw: string | null, target: string): boolean {
    if (!raw) return false;
    const ymd = parseDeliveryDate(raw);
    return ymd === target;
  }

  const todayList   = deliveryOrders.filter(o => matchDate(o.deliveryDate, todayNZ)).map(o => o.supplierName);
  const tomorrowList = deliveryOrders.filter(o => matchDate(o.deliveryDate, tomorrowNZ)).map(o => o.supplierName);

  if (todayList.length > 0) {
    const unique = [...new Set(todayList)];
    await wxNotify(`📦 寿司系统：今日 ${unique.length} 笔订单到货`, unique.map(s => `- ${s}`).join("\n"));
  }
  if (tomorrowList.length > 0) {
    const unique = [...new Set(tomorrowList)];
    await wxNotify(`🚚 寿司系统：明日 ${unique.length} 笔订单到货提醒`, unique.map(s => `- ${s}`).join("\n"));
  }

  return { synced: totalSynced, errors: allErrors, debug: allDebug };
}
