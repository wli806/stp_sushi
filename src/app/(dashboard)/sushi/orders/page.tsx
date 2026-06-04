"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, UtensilsCrossed, ExternalLink, X } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { format } from "date-fns";

interface SushiItem {
  id: string; ossItemId: string; itemCode: string; itemName: string; uom: string; quantity: number;
}
interface SushiOrder {
  id: string; ossId: string; poNumber: string; supplierName: string; status: number;
  poDate: string | null; deliveryDate: string | null; orderDate: string | null;
  weekNo: number | null; year: number | null; syncedAt: string;
  inventoryApplied: boolean; items: SushiItem[];
}

const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_ZH = ["一","二","三","四","五","六","日"];
const DOW_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_ABBR: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};
const OSS_BASE = "https://oss.spientsyserv.com";

function ossUrl(order: SushiOrder): string {
  if (order.ossId.startsWith("virtual-") && order.poNumber) {
    return `${OSS_BASE}/shop/${order.poNumber}`;
  }
  return `${OSS_BASE}/shop/editorder/${order.ossId}`;
}

function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseToYMD(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const dm = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (dm) { const m = MONTH_ABBR[dm[2].toLowerCase()]; if (m) return `${dm[3]}-${m}-${dm[1].padStart(2,"0")}`; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toLocalYMD(d);
}

interface DayEvent { type: "order" | "delivery"; supplier: string; pairKey: string; items: SushiItem[]; }

const CAL_PALETTE = [
  { order: "bg-blue-100 text-blue-700", delivery: "bg-blue-500 text-white", dot: "bg-blue-500" },
  { order: "bg-emerald-100 text-emerald-700", delivery: "bg-emerald-500 text-white", dot: "bg-emerald-500" },
  { order: "bg-violet-100 text-violet-700", delivery: "bg-violet-500 text-white", dot: "bg-violet-500" },
  { order: "bg-rose-100 text-rose-700", delivery: "bg-rose-500 text-white", dot: "bg-rose-500" },
  { order: "bg-amber-100 text-amber-700", delivery: "bg-amber-500 text-white", dot: "bg-amber-500" },
  { order: "bg-teal-100 text-teal-700", delivery: "bg-teal-500 text-white", dot: "bg-teal-500" },
  { order: "bg-indigo-100 text-indigo-700", delivery: "bg-indigo-500 text-white", dot: "bg-indigo-500" },
  { order: "bg-orange-100 text-orange-700", delivery: "bg-orange-500 text-white", dot: "bg-orange-500" },
];

// Config keyed by first-word prefix (uppercase) of supplier name
const SUPPLIER_SHORT_CONFIG: Record<string, { label?: string; paletteIndex: number }> = {
  "NZ":      { label: "SALMON", paletteIndex: 3 }, // rose = red
  "INGHAMS": { paletteIndex: 7 },                  // orange
  "VEGE":    { paletteIndex: 1 },                  // emerald = green
};

function shortKey(name: string): string {
  return name.split(/[\s\-\[]/)[0].toUpperCase();
}

// Hash-based stable color — keyed by first word so all "INGHAMS - *" variants get same color
function stableColorFor(name: string): typeof CAL_PALETTE[0] {
  const key = shortKey(name);
  if (SUPPLIER_SHORT_CONFIG[key]) return CAL_PALETTE[SUPPLIER_SHORT_CONFIG[key].paletteIndex];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return CAL_PALETTE[Math.abs(h) % CAL_PALETTE.length];
}

function supplierShort(name: string): string {
  const key = shortKey(name);
  return SUPPLIER_SHORT_CONFIG[key]?.label ?? name.split(/[\s\-\[]/)[0].slice(0, 9);
}

function fmtYMD(ymd: string, lang: string): string {
  const [, m, d] = ymd.split("-");
  if (lang === "en") return `${MONTH_NAMES_EN[parseInt(m) - 1]} ${parseInt(d)}`;
  return `${parseInt(m)}月${parseInt(d)}日`;
}

function getTwoWeekDays(): string[] {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() + i);
    days.push(toLocalYMD(d));
  }
  return days;
}

function getWeekBounds() {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);
  function addDays(n: number): string {
    const r = new Date(thisMonday);
    r.setDate(r.getDate() + n);
    return toLocalYMD(r);
  }
  return { thisStart: addDays(0), thisEnd: addDays(6), nextStart: addDays(7), nextEnd: addDays(13) };
}

function SushiCalendar({ orders }: { orders: SushiOrder[] }) {
  const { lang, t } = useLanguage();
  const now = new Date();
  const todayKey = toLocalYMD(now);
  const DOW_NAMES = lang === "en" ? DOW_EN : DOW_ZH;
  const DOW_NAMES_SHORT = lang === "en" ? ["M","T","W","T","F","S","S"] : DOW_ZH;
  const [selectedEvent, setSelectedEvent] = useState<(DayEvent & { deliveryDate: string }) | null>(null);

  const supplierColorMap = useMemo(() => {
    const unique = [...new Set(orders.map(o => o.supplierName || ""))];
    const map = new Map<string, typeof CAL_PALETTE[0]>();
    unique.forEach(s => map.set(s, stableColorFor(s)));
    return map;
  }, [orders]);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    for (const o of orders) {
      if (o.status < 2) continue;
      const supplier = o.supplierName || "Unknown";
      const pairKey = o.id;
      const deliveryYMD = o.deliveryDate ? parseToYMD(o.deliveryDate) : null;
      if (deliveryYMD && o.items.length > 0) {
        const evs = map.get(deliveryYMD) ?? [];
        evs.push({ type: "delivery", supplier, pairKey, items: o.items });
        map.set(deliveryYMD, evs);
      }
    }
    return map;
  }, [orders]);

  const twoWeekDays = useMemo(() => getTwoWeekDays(), []);

  function weekRangeLabel(days: string[]): string {
    const [, m1, d1] = days[0].split("-");
    const [, m2, d2] = days[6].split("-");
    if (lang === "en") return `${MONTH_NAMES_EN[parseInt(m1)-1]} ${parseInt(d1)} – ${MONTH_NAMES_EN[parseInt(m2)-1]} ${parseInt(d2)}`;
    return `${parseInt(m1)}月${parseInt(d1)}日 – ${parseInt(m2)}月${parseInt(d2)}日`;
  }

  function renderCell(ymd: string) {
    const day = parseInt(ymd.split("-")[2]);
    const events = dayMap.get(ymd) ?? [];
    const isToday = ymd === todayKey;
    return (
      <div key={ymd} className="min-h-[52px] sm:min-h-[72px] md:min-h-[100px] border-r border-b border-slate-100 p-0.5 sm:p-1.5">
        <div className={`text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full mx-auto ${isToday ? "bg-orange-500 text-white" : "text-slate-500"}`}>{day}</div>
        <div className="space-y-0.5">
          {events.map((ev, ei) => {
            const colors = supplierColorMap.get(ev.supplier) ?? CAL_PALETTE[0];
            if (ev.type === "order") {
              return (
                <div key={ei} className={`${colors.order} text-[9px] sm:text-xs rounded px-1 sm:px-2 py-0.5 truncate leading-4 sm:leading-5`}>
                  {supplierShort(ev.supplier)}
                </div>
              );
            }
            return (
              <button key={ei} onClick={() => setSelectedEvent({ ...ev, deliveryDate: ymd })}
                className={`${colors.delivery} w-full text-[9px] sm:text-xs rounded px-1 sm:px-2 py-0.5 truncate leading-4 sm:leading-5 cursor-pointer hover:opacity-85 active:opacity-75 transition-opacity text-left`}>
                {supplierShort(ev.supplier)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const weekLabels = lang === "en" ? ["This week", "Next week"] : ["本周", "下周"];
  const weekStyles = ["text-orange-600 bg-orange-50", "text-slate-500 bg-slate-50"];

  return (
    <>
      <div className="mb-6">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DOW_NAMES.map((d, i) => (
            <div key={i} className="text-center text-xs text-slate-400 py-2 font-medium">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{DOW_NAMES_SHORT[i]}</span>
            </div>
          ))}
        </div>
        {[0, 1].map(w => (
          <div key={w}>
            <div className={`px-4 py-1.5 border-b border-slate-100 text-xs font-medium flex items-center gap-2 ${weekStyles[w]}`}>
              <span>{weekLabels[w]}</span>
              <span className="font-normal opacity-70">{weekRangeLabel(twoWeekDays.slice(w * 7, w * 7 + 7))}</span>
            </div>
            <div className="grid grid-cols-7 border-l border-slate-100">
              {twoWeekDays.slice(w * 7, w * 7 + 7).map(ymd => renderCell(ymd))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-slate-100">
          {(() => {
            const seen = new Set<string>();
            return [...supplierColorMap.entries()].filter(([s]) => {
              const label = supplierShort(s);
              if (seen.has(label)) return false;
              seen.add(label);
              return true;
            });
          })().map(([supplier, colors]) => (
            <div key={supplierShort(supplier)} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${colors.dot}`} />
              {supplierShort(supplier)}
            </div>
          ))}
          <div className="ml-auto text-xs text-slate-400">{lang === "en" ? "Click delivery to view items" : "点击配送日查看商品明细"}</div>
        </div>
      </div>
      </div>
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-semibold text-slate-800">{selectedEvent.supplier}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === "en" ? "Delivery: " : "配送日期："}{fmtYMD(selectedEvent.deliveryDate, lang)}
                </p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {selectedEvent.items.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-4">{t("orders.noItems")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-100">
                      <th className="text-left pb-2 font-medium">{t("orders.col.name")}</th>
                      <th className="text-right pb-2 font-medium">{t("orders.col.qty")}</th>
                      <th className="text-left pb-2 pl-2 font-medium">{t("orders.col.unit")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedEvent.items.map(item => (
                      <tr key={item.id}>
                        <td className="py-2 text-slate-700">{item.itemName}</td>
                        <td className="py-2 text-right font-semibold text-slate-800">{item.quantity}</td>
                        <td className="py-2 pl-2 text-slate-500">{item.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SushiOrdersPage() {
  const { username, role } = useSession();
  const { t, lang } = useLanguage();
  const isRoot = username === "root";
  const canSync = role === "OWNER" || isRoot;

  const [orders, setOrders] = useState<SushiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sushi/orders");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/sushi/sync", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (data.error) {
        setSyncMsg(t("orders.syncFail", { msg: data.error }));
      } else {
        setSyncMsg(t("orders.syncSuccess", { n: data.synced }) + (data.errors?.length ? `, ${data.errors.length} failed` : ""));
        load();
      }
    } catch {
      setSyncMsg(t("orders.syncFail", { msg: "network error" }));
    } finally {
      setSyncing(false);
    }
  }

  const weekBounds = useMemo(() => getWeekBounds(), []);
  const todayYMD = toLocalYMD(new Date());

  const todayDeliveries = useMemo(() =>
    orders.filter(o => {
      if (o.status < 2 || !o.deliveryDate || o.items.length === 0) return false;
      return parseToYMD(o.deliveryDate) === todayYMD;
    }).length, [orders, todayYMD]);

  const pendingDeliveries = useMemo(() =>
    orders.filter(o => {
      if (o.status < 2 || !o.deliveryDate || o.items.length === 0) return false;
      const ymd = parseToYMD(o.deliveryDate);
      return ymd && ymd > todayYMD;
    }).length, [orders, todayYMD]);


  const lastSync = orders.length > 0
    ? orders.reduce((a, b) => a.syncedAt > b.syncedAt ? a : b).syncedAt
    : null;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("orders.title")}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {t("orders.subtitle")}
            {lastSync && ` · ${t("orders.lastSync")} ${format(new Date(lastSync), "MM/dd HH:mm")}`}
          </p>
        </div>
        {canSync && (
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? t("orders.syncing") : t("orders.syncBtn")}</span>
          </button>
        )}
      </div>

      {syncMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${syncMsg.includes("失败") || syncMsg.includes("failed") ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {syncMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-1 leading-tight">{lang === "en" ? "Today's deliveries" : "今日到货"}</p>
          <p className={`text-xl md:text-2xl font-bold ${todayDeliveries > 0 ? "text-green-600" : "text-slate-300"}`}>{todayDeliveries}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 md:p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-1 leading-tight">{lang === "en" ? "Upcoming deliveries" : "未到货"}</p>
          <p className={`text-xl md:text-2xl font-bold ${pendingDeliveries > 0 ? "text-blue-600" : "text-slate-300"}`}>{pendingDeliveries}</p>
        </div>
      </div>

      <SushiCalendar orders={orders} />

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-400">{t("common.loading")}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <UtensilsCrossed size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">{t("orders.noData")}</p>
        </div>
      ) : null}
    </div>
  );
}
