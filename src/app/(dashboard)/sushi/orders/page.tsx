"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, UtensilsCrossed, ChevronDown, ChevronUp, Package, PackagePlus, AlertCircle, CheckCircle2, X } from "lucide-react";
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

const MONTH_NAMES_ZH = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_ZH = ["一","二","三","四","五","六","日"];
const DOW_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_ABBR: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};

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

interface DayEvent { supplier: string; pairKey: string; items: SushiItem[]; }

const CAL_PALETTE = [
  { delivery: "bg-blue-500 text-white", dot: "bg-blue-500" },
  { delivery: "bg-emerald-500 text-white", dot: "bg-emerald-500" },
  { delivery: "bg-violet-500 text-white", dot: "bg-violet-500" },
  { delivery: "bg-rose-500 text-white", dot: "bg-rose-500" },
  { delivery: "bg-amber-500 text-white", dot: "bg-amber-500" },
  { delivery: "bg-teal-500 text-white", dot: "bg-teal-500" },
  { delivery: "bg-indigo-500 text-white", dot: "bg-indigo-500" },
  { delivery: "bg-orange-500 text-white", dot: "bg-orange-500" },
];

function supplierShort(name: string): string { return name.split(/[\s\-\[]/)[0].slice(0, 9); }

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
  const [selectedEvent, setSelectedEvent] = useState<(DayEvent & { deliveryDate: string }) | null>(null);

  const supplierColorMap = useMemo(() => {
    const unique = [...new Set(orders.map(o => o.supplierName || ""))];
    const map = new Map<string, typeof CAL_PALETTE[0]>();
    unique.forEach((s, i) => map.set(s, CAL_PALETTE[i % CAL_PALETTE.length]));
    return map;
  }, [orders]);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    for (const o of orders) {
      if (o.status < 2 || o.items.length === 0) continue;
      const deliveryYMD = o.deliveryDate ? parseToYMD(o.deliveryDate) : null;
      if (!deliveryYMD) continue;
      const supplier = o.supplierName || "Unknown";
      const evs = map.get(deliveryYMD) ?? [];
      evs.push({ supplier, pairKey: o.id, items: o.items });
      map.set(deliveryYMD, evs);
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
      <div key={ymd} className="min-h-[72px] md:min-h-[100px] border-r border-b border-slate-100 p-1.5">
        <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${isToday ? "bg-orange-500 text-white" : "text-slate-500"}`}>{day}</div>
        <div className="space-y-0.5">
          {events.map((ev, ei) => {
            const colors = supplierColorMap.get(ev.supplier) ?? CAL_PALETTE[0];
            return (
              <button key={ei} onClick={() => setSelectedEvent({ ...ev, deliveryDate: ymd })}
                className={`${colors.delivery} w-full text-xs rounded px-2 py-0.5 truncate leading-5 cursor-pointer hover:opacity-85 active:opacity-75 transition-opacity text-left`}>
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DOW_NAMES.map(d => <div key={d} className="text-center text-xs text-slate-400 py-2 font-medium">{d}</div>)}
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
          {[...supplierColorMap.entries()].map(([supplier, colors]) => (
            <div key={supplier} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${colors.dot}`} />
              {supplierShort(supplier)}
            </div>
          ))}
          <div className="ml-auto text-xs text-slate-400">{lang === "en" ? "Click to view items" : "点击查看商品明细"}</div>
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
  const { t } = useLanguage();
  const isRoot = username === "root";
  const canSync = role === "OWNER" || isRoot;

  const [orders, setOrders] = useState<SushiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  function toggleExpanded(id: string) {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

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

  async function handleApplyInventory(order: SushiOrder) {
    setApplying(order.id);
    setApplyMsg(null);
    try {
      const res = await fetch(`/api/sushi/orders/${order.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-inventory" }),
      });
      const data = await res.json();
      setApplyMsg({ id: order.id, ok: !data.error, text: data.error ? data.error : t("orders.applyOk") });
      if (!data.error) load();
    } catch {
      setApplyMsg({ id: order.id, ok: false, text: t("orders.applyFail") });
    } finally {
      setApplying(null);
    }
  }

  const orderedOrders = orders.filter(o => o.status >= 2 && o.items.length > 0);
  const pendingOrders = orders.filter(o => o.status === 1);

  const weekBounds = useMemo(() => getWeekBounds(), []);
  const todayYMD = toLocalYMD(new Date());

  const thisWeekDelivered = useMemo(() =>
    orders.filter(o => {
      if (o.status < 2 || !o.deliveryDate) return false;
      const ymd = parseToYMD(o.deliveryDate);
      return ymd && ymd >= weekBounds.thisStart && ymd <= weekBounds.thisEnd && ymd <= todayYMD;
    }).length, [orders, weekBounds, todayYMD]);

  const thisWeekPending = useMemo(() =>
    orders.filter(o => {
      if (o.status < 2 || !o.deliveryDate) return false;
      const ymd = parseToYMD(o.deliveryDate);
      return ymd && ymd >= weekBounds.thisStart && ymd <= weekBounds.thisEnd && ymd > todayYMD;
    }).length, [orders, weekBounds, todayYMD]);

  const nextWeekNeedOrder = useMemo(() =>
    orders.filter(o => {
      if (o.status !== 1 || !o.orderDate) return false;
      const ymd = parseToYMD(o.orderDate);
      return ymd && ymd >= weekBounds.nextStart && ymd <= weekBounds.nextEnd;
    }).length, [orders, weekBounds]);

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

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: t("orders.stat.total"), value: thisWeekDelivered, color: "text-green-600" },
          { label: t("orders.stat.ordered"), value: thisWeekPending, color: "text-blue-600" },
          { label: t("orders.stat.pending"), value: nextWeekNeedOrder, color: "text-orange-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <SushiCalendar orders={orders} />

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-400">{t("common.loading")}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <UtensilsCrossed size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">{t("orders.noData")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-red-500" />
                <h2 className="font-semibold text-slate-700">{t("orders.section.pending")} <span className="text-red-500">({pendingOrders.length})</span></h2>
                <span className="text-xs text-slate-400">— {t("orders.section.pendingDesc")}</span>
              </div>
              <div className="space-y-2">
                {pendingOrders.map(order => (
                  <div key={order.id} className="bg-red-50 border border-red-200 rounded-xl px-4 md:px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-slate-800">{order.supplierName || "Unknown"}</span>
                        {order.weekNo && <span className="text-xs text-slate-400">W{order.weekNo}</span>}
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">{t("orders.status.pending")}</span>
                      </div>
                      <p className="text-slate-400 text-xs">
                        {order.orderDate && `${t("orders.orderDate")} ${order.orderDate}`}
                        {order.deliveryDate && ` · ${t("orders.deliveryDate")} ${order.deliveryDate}`}
                      </p>
                    </div>
                    <div className="text-xs text-red-400 font-medium">{t("orders.pendingHint")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orderedOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-green-500" />
                <h2 className="font-semibold text-slate-700">{t("orders.section.ordered")} <span className="text-green-600">({orderedOrders.length})</span></h2>
                <span className="text-xs text-slate-400">— {t("orders.section.orderedDesc")}</span>
              </div>
              <div className="space-y-3">
                {orderedOrders.map(order => {
                  const statusLabel = order.status === 3 ? t("orders.status.confirmed") : t("orders.status.ordered");
                  const statusCls = order.status === 3 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
                  return (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-slate-800">{order.supplierName || "Unknown"}</span>
                            {order.weekNo && <span className="text-xs text-slate-400">W{order.weekNo}</span>}
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>{statusLabel}</span>
                            {order.inventoryApplied && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">{t("orders.inStock")}</span>}
                            {!order.inventoryApplied && (() => { const d = order.deliveryDate ? parseToYMD(order.deliveryDate) : null; return d && d <= toLocalYMD(new Date()) ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">{t("orders.toStock")}</span> : null; })()}
                          </div>
                          <p className="text-slate-400 text-xs">
                            {order.poNumber && `${t("orders.poNumber")} ${order.poNumber}`}
                            {order.orderDate && ` · ${t("orders.orderDate")} ${order.orderDate}`}
                            {order.deliveryDate && ` · ${t("orders.deliveryDate")} ${order.deliveryDate}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <span className="text-sm text-slate-500">{order.items.length} {t("orders.items")}</span>
                          {canSync && !order.inventoryApplied && (() => { const d = order.deliveryDate ? parseToYMD(order.deliveryDate) : null; return d && d <= toLocalYMD(new Date()); })() && (
                            <button onClick={() => handleApplyInventory(order)} disabled={applying === order.id}
                              className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg text-xs font-medium transition-colors">
                              <PackagePlus size={13} />
                              {applying === order.id ? t("orders.stockingIn") : t("orders.stockIn")}
                            </button>
                          )}
                          <button onClick={() => toggleExpanded(order.id)} className="text-slate-400 hover:text-slate-600">
                            {expanded.has(order.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                      </div>
                      {applyMsg?.id === order.id && (
                        <div className={`px-6 py-2 text-xs ${applyMsg.ok ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"}`}>{applyMsg.text}</div>
                      )}
                      {expanded.has(order.id) && (
                        order.items.length === 0 ? (
                          <div className="border-t border-slate-100 px-6 py-3 bg-slate-50/50 text-center text-sm text-slate-400">
                            <Package size={14} className="inline mr-1" />{t("orders.noItems")}
                          </div>
                        ) : (
                          <div className="border-t border-slate-100 px-4 md:px-6 py-4 bg-slate-50/50 overflow-x-auto">
                            <table className="w-full text-sm min-w-[300px]">
                              <thead>
                                <tr className="text-slate-400 text-xs border-b border-slate-200">
                                  <th className="text-left pb-2 font-medium">{t("orders.col.code")}</th>
                                  <th className="text-left pb-2 font-medium">{t("orders.col.name")}</th>
                                  <th className="text-center pb-2 font-medium">{t("orders.col.qty")}</th>
                                  <th className="text-left pb-2 font-medium">{t("orders.col.unit")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {order.items.map(item => (
                                  <tr key={item.id}>
                                    <td className="py-2 text-slate-400 text-xs">{item.itemCode}</td>
                                    <td className="py-2 text-slate-700">{item.itemName}</td>
                                    <td className="py-2 text-center font-semibold text-slate-800">{item.quantity}</td>
                                    <td className="py-2 text-slate-500">{item.uom}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
