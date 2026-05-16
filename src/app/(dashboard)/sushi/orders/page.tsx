"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, UtensilsCrossed, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Package, PackagePlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
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

const STATUS_MAP: Record<number, { label: string; cls: string }> = {
  1: { label: "待下单", cls: "bg-red-100 text-red-600" },
  2: { label: "已下单", cls: "bg-amber-100 text-amber-700" },
  3: { label: "已确认", cls: "bg-green-100 text-green-700" },
};

const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_NAMES = ["一","二","三","四","五","六","日"];
const MONTH_ABBR: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};

// 财政周计算 FY2026: week 1 starts March 30, 2026
const FY2026_START = new Date("2026-03-30").getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getFiscalWeekNo(date: Date): number {
  return Math.max(1, Math.floor((date.getTime() - FY2026_START) / WEEK_MS) + 1);
}

function getWeekStartDate(weekNo: number): Date {
  return new Date(FY2026_START + (weekNo - 1) * WEEK_MS);
}

function fmtShortDate(d: Date): string {
  return `${d.getDate()}-${MONTH_SHORT[d.getMonth()]}-${d.getFullYear()}`;
}

function buildWeekOptions(currentWeekNo: number): { weekNo: number; year: number; label: string }[] {
  const options = [];
  for (let i = currentWeekNo - 6; i <= currentWeekNo + 1; i++) {
    const wn = i <= 0 ? i + 52 : i;
    const start = getWeekStartDate(i <= 0 ? i + 52 : i);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    options.push({ weekNo: wn, year: start.getFullYear(), label: `(${wn}) ${fmtShortDate(start)} ~ ${fmtShortDate(end)}` });
  }
  return options.reverse();
}

function parseToYMD(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const dm = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (dm) {
    const m = MONTH_ABBR[dm[2].toLowerCase()];
    if (m) return `${dm[3]}-${m}-${dm[1].padStart(2,"0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

interface DayEvent { type: "order" | "delivery"; supplier: string; relatedDates: string[]; }

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

function supplierShort(name: string): string {
  return name.split(/[\s\-\[]/)[0].slice(0, 9);
}

function fmtYMD(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${parseInt(m)}月${parseInt(d)}日`;
}

function SushiCalendar({ orders }: { orders: SushiOrder[] }) {
  const now = new Date();
  const [cal, setCal] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [hoveredSupplier, setHoveredSupplier] = useState<string | null>(null);
  const supplierColorMap = useMemo(() => {
    const unique = [...new Set(orders.map(o => o.supplierName || "未知"))];
    const map = new Map<string, typeof CAL_PALETTE[0]>();
    unique.forEach((s, i) => map.set(s, CAL_PALETTE[i % CAL_PALETTE.length]));
    return map;
  }, [orders]);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    for (const o of orders) {
      const supplier = o.supplierName || "未知供应商";
      const orderYMD = o.orderDate ? parseToYMD(o.orderDate) : null;
      const deliveryYMD = o.deliveryDate ? parseToYMD(o.deliveryDate) : null;
      const upsert = (k: string, type: "order" | "delivery", related: string | null) => {
        const evs = map.get(k) ?? [];
        let ev = evs.find(e => e.type === type && e.supplier === supplier);
        if (!ev) { ev = { type, supplier, relatedDates: [] }; evs.push(ev); map.set(k, evs); }
        if (related && !ev.relatedDates.includes(related)) ev.relatedDates.push(related);
      };
      if (orderYMD) upsert(orderYMD, "order", deliveryYMD);
      if (deliveryYMD) upsert(deliveryYMD, "delivery", orderYMD);
    }
    return map;
  }, [orders]);

  const cells = useMemo(() => {
    const first = new Date(cal.year, cal.month, 1);
    const daysInMonth = new Date(cal.year, cal.month + 1, 0).getDate();
    const startDow = (first.getDay() + 6) % 7;
    const result: Array<number | null> = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [cal]);

  const todayKey = now.toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-xl">
        <button onClick={() => setCal(c => { const d = new Date(c.year, c.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold text-slate-700">{cal.year}年 {MONTH_NAMES[cal.month]}</span>
        <button onClick={() => setCal(c => { const d = new Date(c.year, c.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DOW_NAMES.map(d => <div key={d} className="text-center text-xs text-slate-400 py-2 font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 border-l border-slate-100">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[72px] md:min-h-[100px] border-r border-b border-slate-100 bg-slate-50/60" />;
          const key = `${cal.year}-${String(cal.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const events = dayMap.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={i} className="relative min-h-[72px] md:min-h-[100px] border-r border-b border-slate-100 p-1.5">
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${isToday ? "bg-orange-500 text-white" : "text-slate-500"}`}>{day}</div>
              <div className="space-y-0.5">
                {events.map((ev, ei) => {
                  const colors = supplierColorMap.get(ev.supplier) ?? CAL_PALETTE[0];
                  const isActive = hoveredSupplier === ev.supplier;
                  const isDimmed = hoveredSupplier !== null && !isActive;
                  const tooltipText = ev.type === "order"
                    ? (ev.relatedDates.length > 0 ? `预计配送: ${ev.relatedDates.map(fmtYMD).join("、")}` : "暂无配送日期")
                    : (ev.relatedDates.length > 0 ? `下单日: ${ev.relatedDates.map(fmtYMD).join("、")}` : "暂无下单日期");
                  return (
                    <div key={ei} className="relative group/chip" onMouseEnter={() => setHoveredSupplier(ev.supplier)} onMouseLeave={() => setHoveredSupplier(null)}>
                      <div className={[ev.type === "order" ? colors.order : colors.delivery, "text-xs rounded px-2 py-0.5 truncate leading-5 cursor-default transition-all duration-100", isActive ? `ring-2 ring-offset-1 ${colors.ring} shadow-md font-semibold` : "", isDimmed ? "opacity-20" : ""].join(" ")}>
                        {ev.type === "order" ? "下单 " : "配送 "}{supplierShort(ev.supplier)}
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
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-slate-100 rounded-b-xl">
        {[...supplierColorMap.entries()].map(([supplier, colors]) => (
          <div key={supplier} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${colors.dot}`} />
            {supplierShort(supplier)}
          </div>
        ))}
        <div className="ml-auto text-xs text-slate-400">浅色 = 下单 · 深色 = 配送</div>
      </div>
    </div>
  );
}

export default function SushiOrdersPage() {
  const { username } = useSession();
  const isRoot = username === "root";

  const now = new Date();
  const currentWeekNo = getFiscalWeekNo(now);
  const weekOptions = useMemo(() => buildWeekOptions(currentWeekNo), [currentWeekNo]);

  const [selectedWeek, setSelectedWeek] = useState(() => weekOptions[0]);
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

  async function load(weekNo: number, year: number) {
    setLoading(true);
    const res = await fetch(`/api/sushi/orders?weekNo=${weekNo}&year=${year}`);
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(selectedWeek.weekNo, selectedWeek.year); }, [selectedWeek]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/sushi/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNo: selectedWeek.weekNo, year: selectedWeek.year }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMsg(`同步失败：${data.error}`);
      } else {
        setSyncMsg(`同步成功：${data.synced} 条订单已更新${data.errors?.length ? `，${data.errors.length} 条失败` : ""}`);
        load(selectedWeek.weekNo, selectedWeek.year);
      }
    } catch {
      setSyncMsg("同步失败：网络错误");
    } finally {
      setSyncing(false);
    }
  }

  async function handleApplyInventory(order: SushiOrder) {
    setApplying(order.id);
    setApplyMsg(null);
    try {
      const res = await fetch(`/api/sushi/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-inventory" }),
      });
      const data = await res.json();
      if (data.error) {
        setApplyMsg({ id: order.id, ok: false, text: data.error });
      } else {
        setApplyMsg({ id: order.id, ok: true, text: "已成功同步到库存" });
        load(selectedWeek.weekNo, selectedWeek.year);
      }
    } catch {
      setApplyMsg({ id: order.id, ok: false, text: "网络错误" });
    } finally {
      setApplying(null);
    }
  }

  const orderedOrders = orders.filter(o => o.status >= 2 && o.items.length > 0);
  const pendingOrders = orders.filter(o => o.status === 1);
  const lastSync = orders.length > 0 ? orders[0].syncedAt : null;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">寿司采购订单</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            同步自 St Pierre&apos;s OSS 系统
            {lastSync && ` · 上次同步 ${format(new Date(lastSync), "MM/dd HH:mm")}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 周选择器 */}
          <select
            value={`${selectedWeek.weekNo}-${selectedWeek.year}`}
            onChange={e => {
              const opt = weekOptions.find(o => `${o.weekNo}-${o.year}` === e.target.value);
              if (opt) { setSelectedWeek(opt); setSyncMsg(""); }
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {weekOptions.map(opt => (
              <option key={`${opt.weekNo}-${opt.year}`} value={`${opt.weekNo}-${opt.year}`}>
                {opt.label}{opt.weekNo === currentWeekNo ? " （本周）" : ""}
              </option>
            ))}
          </select>
          {isRoot && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              <span>{syncing ? "同步中..." : "同步此周"}</span>
            </button>
          )}
        </div>
      </div>

      {syncMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${syncMsg.includes("失败") ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {syncMsg}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "本周订单", value: orders.length, color: "text-orange-600" },
          { label: "已下单", value: orderedOrders.length, color: "text-green-600" },
          { label: "待下单", value: pendingOrders.length, color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 日历 */}
      <SushiCalendar orders={orders} />

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-400">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <UtensilsCrossed size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">暂无数据，点击「同步此周」获取订单</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 待下单区 */}
          {pendingOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-red-500" />
                <h2 className="font-semibold text-slate-700">待下单 <span className="text-red-500">({pendingOrders.length})</span></h2>
                <span className="text-xs text-slate-400">— 以下订单尚未在 OSS 系统提交</span>
              </div>
              <div className="space-y-2">
                {pendingOrders.map(order => (
                  <div key={order.id} className="bg-red-50 border border-red-200 rounded-xl px-4 md:px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-slate-800">{order.supplierName || "未知供应商"}</span>
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">待下单</span>
                      </div>
                      <p className="text-slate-400 text-xs">
                        {order.orderDate && `截止 ${order.orderDate}`}
                        {order.deliveryDate && ` · 预计送达 ${order.deliveryDate}`}
                      </p>
                    </div>
                    <div className="text-xs text-red-400 font-medium">需要在 OSS 下单</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 已下单区 */}
          {orderedOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-green-500" />
                <h2 className="font-semibold text-slate-700">已下单 <span className="text-green-600">({orderedOrders.length})</span></h2>
                <span className="text-xs text-slate-400">— 点击展开查看商品明细</span>
              </div>
              <div className="space-y-3">
                {orderedOrders.map(order => {
                  const st = STATUS_MAP[order.status] ?? { label: "未知", cls: "bg-slate-100 text-slate-500" };
                  return (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-slate-800">{order.supplierName || "未知供应商"}</span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                            {order.inventoryApplied && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">已入库</span>}
                            {!order.inventoryApplied && (() => { const d = order.deliveryDate ? parseToYMD(order.deliveryDate) : null; return d && d <= new Date().toISOString().slice(0,10) ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">待入库</span> : null; })()}
                          </div>
                          <p className="text-slate-400 text-xs">
                            {order.poNumber && `PO# ${order.poNumber}`}
                            {order.orderDate && ` · 下单 ${order.orderDate}`}
                            {order.deliveryDate && ` · 预计送达 ${order.deliveryDate}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <span className="text-sm text-slate-500">{order.items.length} 件</span>
                          {isRoot && !order.inventoryApplied && (() => { const d = order.deliveryDate ? parseToYMD(order.deliveryDate) : null; return d && d <= new Date().toISOString().slice(0,10); })() && (
                            <button onClick={() => handleApplyInventory(order)} disabled={applying === order.id}
                              className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg text-xs font-medium transition-colors">
                              <PackagePlus size={13} />
                              {applying === order.id ? "同步中..." : "入库"}
                            </button>
                          )}
                          <button onClick={() => toggleExpanded(order.id)} className="text-slate-400 hover:text-slate-600">
                            {expanded.has(order.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>
                      </div>

                      {applyMsg?.id === order.id && (
                        <div className={`px-6 py-2 text-xs ${applyMsg.ok ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"}`}>
                          {applyMsg.text}
                        </div>
                      )}

                      {expanded.has(order.id) && (
                        order.items.length === 0 ? (
                          <div className="border-t border-slate-100 px-6 py-3 bg-slate-50/50 text-center text-sm text-slate-400">
                            <Package size={14} className="inline mr-1" />暂无商品明细
                          </div>
                        ) : (
                          <div className="border-t border-slate-100 px-4 md:px-6 py-4 bg-slate-50/50 overflow-x-auto">
                            <table className="w-full text-sm min-w-[300px]">
                              <thead>
                                <tr className="text-slate-400 text-xs border-b border-slate-200">
                                  <th className="text-left pb-2 font-medium">代码</th>
                                  <th className="text-left pb-2 font-medium">商品名称</th>
                                  <th className="text-center pb-2 font-medium">数量</th>
                                  <th className="text-left pb-2 font-medium">单位</th>
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
