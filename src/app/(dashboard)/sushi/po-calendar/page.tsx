"use client";

import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarClock, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

const OSS_BASE = "https://oss.spientsyserv.com";

function ossUrl(order: SushiOrder): string {
  // Virtual orders: poNumber stores the editPath like "editorder/virtual/100060/19-May-26/8"
  if (order.ossId.startsWith("virtual-") && order.poNumber) {
    return `${OSS_BASE}/shop/${order.poNumber}`;
  }
  return `${OSS_BASE}/shop/editorder/${order.ossId}`;
}

interface SushiOrder {
  id: string; ossId: string; poNumber: string; supplierName: string; status: number;
  poDate: string | null; orderDate: string | null; deliveryDate: string | null;
  weekNo: number | null;
}

const MONTH_NAMES_ZH = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_ZH = ["一","二","三","四","五","六","日"];
const DOW_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_ABBR: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};

function parseToYMD(s: string | null): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dm = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (dm) { const m = MONTH_ABBR[dm[2].toLowerCase()]; if (m) return `${dm[3]}-${m}-${dm[1].padStart(2,"0")}`; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function supplierShort(name: string): string {
  return name.split(/[\s\-\[]/)[0].slice(0, 10);
}

export default function POCalendarPage() {
  const { lang, t } = useLanguage();
  const now = new Date();
  const todayYMD = now.toISOString().slice(0, 10);

  const [orders, setOrders] = useState<SushiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cal, setCal] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const MONTH_NAMES = lang === "en" ? MONTH_NAMES_EN : MONTH_NAMES_ZH;
  const DOW_NAMES = lang === "en" ? DOW_EN : DOW_ZH;

  useEffect(() => {
    fetch("/api/sushi/orders")
      .then(r => r.json())
      .then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Map: YMD → orders that have their orderDate on that day
  const dayMap = useMemo(() => {
    const map = new Map<string, SushiOrder[]>();
    for (const o of orders) {
      const ymd = parseToYMD(o.orderDate);
      if (!ymd) continue;
      const list = map.get(ymd) ?? [];
      list.push(o);
      map.set(ymd, list);
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

  // Upcoming & overdue pending orders (outside current month view)
  const pendingAll = useMemo(() =>
    orders
      .filter(o => o.status === 1 && parseToYMD(o.orderDate))
      .sort((a, b) => (parseToYMD(a.orderDate) ?? "").localeCompare(parseToYMD(b.orderDate) ?? "")),
    [orders]
  );
  const overdue = pendingAll.filter(o => (parseToYMD(o.orderDate) ?? "") < todayYMD);
  const upcoming = pendingAll.filter(o => (parseToYMD(o.orderDate) ?? "") >= todayYMD);

  const monthLabel = lang === "en"
    ? `${MONTH_NAMES[cal.month]} ${cal.year}`
    : `${cal.year}年 ${MONTH_NAMES[cal.month]}`;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t("pocal.title")}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t("pocal.subtitle")}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">{t("pocal.overdue")}</p>
          <p className="text-2xl font-bold text-red-500">{overdue.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">{t("pocal.upcoming")}</p>
          <p className="text-2xl font-bold text-orange-500">{upcoming.length}</p>
        </div>
      </div>

      {/* 日历 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button onClick={() => setCal(c => { const d = new Date(c.year, c.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-slate-700">{monthLabel}</span>
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
            if (!day) return <div key={i} className="min-h-[80px] md:min-h-[110px] border-r border-b border-slate-100 bg-slate-50/60" />;
            const key = `${cal.year}-${String(cal.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayOrders = dayMap.get(key) ?? [];
            const isToday = key === todayYMD;
            const isPast = key < todayYMD;

            return (
              <div key={i} className={`min-h-[80px] md:min-h-[110px] border-r border-b border-slate-100 p-1.5 ${isPast && dayOrders.some(o => o.status === 1) ? "bg-red-50/40" : ""}`}>
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${isToday ? "bg-orange-500 text-white" : "text-slate-500"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayOrders.map(order => {
                    const isPending = order.status === 1;
                    const isOverdue = isPending && key < todayYMD;
                    const url = ossUrl(order);

                    // Extract time from poDate (e.g. "Tuesday 19-May-26 11:59 pm")
                    const timeMatch = (order.poDate ?? "").match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
                    const timeStr = timeMatch ? timeMatch[1] : "";

                    if (isPending) {
                      return (
                        <a key={order.id} href={url} target="_blank" rel="noopener noreferrer"
                          title={`${t("pocal.openOSS")}: ${order.supplierName}${timeStr ? ` — ${t("pocal.deadline")} ${timeStr}` : ""}`}
                          className={`block text-xs rounded px-1.5 py-0.5 truncate leading-5 cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:shadow-md font-medium ${isOverdue ? "bg-red-500 text-white hover:ring-red-500" : "bg-orange-400 text-white hover:ring-orange-400"}`}>
                          <span className="inline-flex items-center gap-1 w-full truncate">
                            <ExternalLink size={9} className="flex-shrink-0" />
                            <span className="truncate">{supplierShort(order.supplierName)}</span>
                            {timeStr && <span className="flex-shrink-0 opacity-80 text-[10px]">{timeStr}</span>}
                          </span>
                        </a>
                      );
                    } else {
                      return (
                        <div key={order.id}
                          className="text-xs rounded px-1.5 py-0.5 truncate leading-5 bg-green-100 text-green-700 font-medium"
                          title={`${t("pocal.ordered")}: ${order.supplierName}`}>
                          <span className="inline-flex items-center gap-1 w-full truncate">
                            <CheckCircle2 size={9} className="flex-shrink-0" />
                            <span className="truncate">{supplierShort(order.supplierName)}</span>
                          </span>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="flex items-center gap-6 px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-orange-400" />
            {t("pocal.legend.pending")}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500" />
            {t("pocal.overdue")}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
            {t("pocal.legend.ordered")}
          </div>
        </div>
      </div>

      {/* 待下单列表 */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-400">加载中...</div>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-red-500" />
                <h2 className="font-semibold text-slate-700 text-sm">{t("pocal.overdue")} <span className="text-red-500">({overdue.length})</span></h2>
              </div>
              <div className="space-y-2">
                {overdue.map(o => (
                  <a key={o.id} href={ossUrl(o)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{o.supplierName}</p>
                      <p className="text-xs text-red-500 mt-0.5">
                        {o.orderDate}{o.poDate && o.poDate !== o.orderDate ? ` — ${t("pocal.deadline")} ${(o.poDate ?? "").match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i)?.[1] ?? ""}` : ""}
                        {o.weekNo ? `  W${o.weekNo}` : ""}
                      </p>
                    </div>
                    <ExternalLink size={15} className="text-red-400 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock size={15} className="text-orange-500" />
                <h2 className="font-semibold text-slate-700 text-sm">{t("pocal.upcoming")} <span className="text-orange-500">({upcoming.length})</span></h2>
              </div>
              <div className="space-y-2">
                {upcoming.map(o => {
                  const timeMatch = (o.poDate ?? "").match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
                  const timeStr = timeMatch ? timeMatch[1] : "";
                  return (
                    <a key={o.id} href={ossUrl(o)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 hover:bg-orange-100 transition-colors">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{o.supplierName}</p>
                        <p className="text-xs text-orange-600 mt-0.5">
                          {o.orderDate}{timeStr ? ` — ${t("pocal.deadline")} ${timeStr}` : ""}
                          {o.weekNo ? `  W${o.weekNo}` : ""}
                        </p>
                      </div>
                      <ExternalLink size={15} className="text-orange-400 flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {overdue.length === 0 && upcoming.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center">
              <CalendarClock size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400">{t("pocal.noData")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
