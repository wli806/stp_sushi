"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, UtensilsCrossed, ChevronDown, ChevronUp, Package, PackagePlus, AlertCircle, CheckCircle2 } from "lucide-react";
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

function parseToYMD(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const dm = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (dm) { const m = MONTH_ABBR[dm[2].toLowerCase()]; if (m) return `${dm[3]}-${m}-${dm[1].padStart(2,"0")}`; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

interface DayEvent { type: "order" | "delivery"; supplier: string; relatedDate: string | null; pairKey: string; }

const CAL_PALETTE = [
  { order: "bg-blue-100 text-blue-700", delivery: "bg-blue-500 text-white", ring: "ring-blue-500", dot: "bg-blue-500" },
  { order: "bg-emerald-100 text-emerald-700", delivery: "bg-emerald-500 text-white", ring: "ring-emerald-500", dot: "bg-emerald-500" },
  { order: "bg-violet-100 text-violet-700", delivery: "bg-violet-500 text-white", ring: "ring-violet-500", dot: "bg-violet-500" },
  { order: "bg-rose-100 text-rose-700", delivery: "bg-rose-500 text-white", ring: "ring-rose-500", dot: "bg-rose-500" },
  { order: "bg-amber-100 text-amber-700", delivery: "bg-amber-500 text-white", ring: "ring-amber-500", dot: "bg-amber-500" },
  { order: "bg-teal-100 text-teal-700", delivery: "bg-teal-500 text-white", ring: "ring-teal-500", dot: "bg-teal-500" },
  { order: "bg-indigo-100 text-indigo-700", delivery: "bg-indigo-500 text-white", ring: "ring-indigo-500", dot: "bg-indigo-500" },
  { order: "bg-orange-100 text-orange-700", delivery: "bg-orange-500 text-white", ring: "ring-orange-500", dot: "bg-orange-500" },
];

function supplierShort(name: string): string { return name.split(/[\s\-\[]/)[0].slice(0, 9); }

function fmtYMD(ymd: string, lang: string): string {
  const [, m, d] = ymd.split("-");
  if (lang === "en") return `${MONTH_NAMES_EN[parseInt(m) - 1]} ${parseInt(d)}`;
  return `${parseInt(m)}月${parseInt(d)}日`;
}

function SushiCalendar({ orders }: { orders: SushiOrder[] }) {
  const { lang, t } = useLanguage();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const [hoveredPairKey, setHoveredPairKey] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const DOW_NAMES = lang === "en" ? DOW_EN : DOW_ZH;

  const supplierColorMap = useMemo(() => {
    const unique = [...new Set(orders.map(o => o.supplierName || ""))];
    const map = new Map<string, typeof CAL_PALETTE[0]>();
    unique.forEach((s, i) => map.set(s, CAL_PALETTE[i % CAL_PALETTE.length]));
    return map;
  }, [orders]);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    for (const o of orders) {
      if (o.status >= 2 && o.items.length === 0) continue;
      const supplier = o.supplierName || "Unknown";
      const orderYMD = o.orderDate ? parseToYMD(o.orderDate) : null;
      const deliveryYMD = o.deliveryDate ? parseToYMD(o.deliveryDate) : null;
      const pairKey = o.id;
      if (orderYMD) {
        const evs = map.get(orderYMD) ?? [];
        evs.push({ type: "order", supplier, relatedDate: o.status >= 2 ? deliveryYMD : null, pairKey });
        map.set(orderYMD, evs);
      }
      if (deliveryYMD && o.status >= 2) {
        const evs = map.get(deliveryYMD) ?? [];
        evs.push({ type: "delivery", supplier, relatedDate: orderYMD, pairKey });
        map.set(deliveryYMD, evs);
      }
    }
    return map;
  }, [orders]);

  // 本周一开始的 14 天（本周 + 下周）
  const twoWeekDays = useMemo(() => {
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const days: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);

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
    const MAX_VISIBLE = 4;
    const isExpanded = expandedDays.has(ymd);
    const visibleEvents = events.length > MAX_VISIBLE && !isExpanded ? events.slice(0, MAX_VISIBLE) : events;
    const hiddenCount = events.length - MAX_VISIBLE;
    return (
      <div key={ymd} className="min-h-[72px] md:min-h-[100px] border-r border-b border-slate-100 p-1.5">
        <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${isToday ? "bg-orange-500 text-white" : "text-slate-500"}`}>{day}</div>
        <div className="space-y-0.5">
          {visibleEvents.map((ev, ei) => {
            const colors = supplierColorMap.get(ev.supplier) ?? CAL_PALETTE[0];
            const isActive = hoveredPairKey === ev.pairKey;
            const isDimmed = hoveredPairKey !== null && !isActive;
            const tooltipText = ev.type === "order"
              ? (ev.relatedDate ? t("orders.tooltipDelivery", { dates: fmtYMD(ev.relatedDate, lang) }) : t("orders.tooltipNoDelivery"))
              : (ev.relatedDate ? t("orders.tooltipOrder", { dates: fmtYMD(ev.relatedDate, lang) }) : t("orders.tooltipNoOrder"));
            return (
              <div key={ei} className="relative group/chip" onMouseEnter={() => setHoveredPairKey(ev.pairKey)} onMouseLeave={() => setHoveredPairKey(null)}>
                <div className={[ev.type === "order" ? colors.order : colors.delivery, "text-xs rounded px-2 py-0.5 truncate leading-5 cursor-default transition-all", isActive ? `ring-2 ring-offset-1 ${colors.ring} shadow-md font-semibold` : "", isDimmed ? "opacity-20" : ""].join(" ")}>
                  {ev.type === "order" ? t("orders.orderLabel") : t("orders.deliveryLabel")}{supplierShort(ev.supplier)}
                </div>
                <div className="absolute bottom-full left-0 mb-1 z-50 hidden group-hover/chip:block pointer-events-none">
                  <div className="bg-slate-800 text-white rounded-lg px-3 py-2 shadow-xl text-[11px] leading-5 min-w-max max-w-[220px]">
                    <div className="font-semibold truncate">{ev.supplier}</div>
                    <div className="text-slate-300">{tooltipText}</div>
                  </div>
                  <div className="w-2 h-2 bg-slate-800 rotate-45 ml-3 -mt-1" />
                </div>
              </div>
            );
          })}
          {events.length > MAX_VISIBLE && !isExpanded && (
            <button onClick={() => setExpandedDays(prev => { const next = new Set(prev); next.add(ymd); return next; })}
              className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 leading-4 pt-0.5">
              +{hiddenCount} {lang === "en" ? "more" : "更多"}
            </button>
          )}
          {events.length > MAX_VISIBLE && isExpanded && (
            <button onClick={() => setExpandedDays(prev => { const next = new Set(prev); next.delete(ymd); return next; })}
              className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 leading-4 pt-0.5">
              {lang === "en" ? "collapse" : "收起"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6">
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DOW_NAMES.map(d => <div key={d} className="text-center text-xs text-slate-400 py-2 font-medium">{d}</div>)}
      </div>
      <div className="px-4 py-1.5 bg-orange-50 border-b border-slate-100 text-xs font-medium text-orange-600 flex items-center gap-2">
        <span>{lang === "en" ? "This week" : "本周"}</span>
        <span className="font-normal text-orange-400">{weekRangeLabel(twoWeekDays.slice(0, 7))}</span>
      </div>
      <div className="grid grid-cols-7 border-l border-slate-100">
        {twoWeekDays.slice(0, 7).map(ymd => renderCell(ymd))}
      </div>
      <div className="px-4 py-1.5 bg-slate-50 border-y border-slate-100 text-xs font-medium text-slate-500 flex items-center gap-2">
        <span>{lang === "en" ? "Next week" : "下周"}</span>
        <span className="font-normal text-slate-400">{weekRangeLabel(twoWeekDays.slice(7, 14))}</span>
      </div>
      <div className="grid grid-cols-7 border-l border-slate-100">
        {twoWeekDays.slice(7, 14).map(ymd => renderCell(ymd))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-slate-100">
        {[...supplierColorMap.entries()].map(([supplier, colors]) => (
          <div key={supplier} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${colors.dot}`} />
            {supplierShort(supplier)}
          </div>
        ))}
        <div className="ml-auto text-xs text-slate-400">{t("orders.calLegend")}</div>
      </div>
    </div>
  );
}

export default function SushiOrdersPage() {
  const { username } = useSession();
  const { t } = useLanguage();
  const isRoot = username === "root";

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
        {isRoot && (
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
          { label: t("orders.stat.total"), value: orders.length, color: "text-orange-600" },
          { label: t("orders.stat.ordered"), value: orderedOrders.length, color: "text-green-600" },
          { label: t("orders.stat.pending"), value: pendingOrders.length, color: "text-red-500" },
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
                            {!order.inventoryApplied && (() => { const d = order.deliveryDate ? parseToYMD(order.deliveryDate) : null; return d && d <= new Date().toISOString().slice(0,10) ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">{t("orders.toStock")}</span> : null; })()}
                          </div>
                          <p className="text-slate-400 text-xs">
                            {order.poNumber && `${t("orders.poNumber")} ${order.poNumber}`}
                            {order.orderDate && ` · ${t("orders.orderDate")} ${order.orderDate}`}
                            {order.deliveryDate && ` · ${t("orders.deliveryDate")} ${order.deliveryDate}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <span className="text-sm text-slate-500">{order.items.length} {t("orders.items")}</span>
                          {isRoot && !order.inventoryApplied && (() => { const d = order.deliveryDate ? parseToYMD(order.deliveryDate) : null; return d && d <= new Date().toISOString().slice(0,10); })() && (
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
