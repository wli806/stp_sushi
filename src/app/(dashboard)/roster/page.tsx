"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CalendarDays, ChevronRight } from "lucide-react";

interface RosterSummary {
  id: string;
  weekStart: string;
  storeName: string;
  staffCount: number;
  createdAt: string;
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function RosterListPage() {
  const router = useRouter();
  const [rosters, setRosters] = useState<RosterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [storeName, setStoreName] = useState("");
  const [staffNames, setStaffNames] = useState<string[]>(["", ""]);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function loadRosters() {
    const res = await fetch("/api/roster");
    if (res.ok) setRosters(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadRosters(); }, []);

  function addStaffRow() { setStaffNames(prev => [...prev, ""]); }
  function removeStaffRow(i: number) { setStaffNames(prev => prev.filter((_, idx) => idx !== i)); }
  function updateStaffName(i: number, val: string) {
    setStaffNames(prev => prev.map((n, idx) => idx === i ? val : n));
  }

  async function handleCreate() {
    const names = staffNames.filter(n => n.trim());
    if (!weekStart || names.length === 0) return;
    setCreating(true);
    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, storeName, staffNames: names }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/roster/${data.id}`);
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/roster/${id}`, { method: "DELETE" });
    setDeleteId(null);
    loadRosters();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="text-orange-500" size={24} />
            班表管理
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">创建和管理每周员工排班</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setStaffNames(["", ""]); setStoreName(""); setWeekStart(getMonday(new Date())); }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> 新建班表
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">加载中...</div>
      ) : rosters.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CalendarDays size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无班表，点击「新建班表」开始</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rosters.map(r => (
            <div key={r.id} className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors group">
              <button
                className="flex-1 flex items-center gap-4 text-left"
                onClick={() => router.push(`/roster/${r.id}`)}
              >
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={20} className="text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{formatWeekRange(r.weekStart)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.storeName ? `${r.storeName} · ` : ""}
                    {r.staffCount} 名员工
                  </p>
                </div>
                <ChevronRight size={18} className="ml-auto text-slate-300 group-hover:text-orange-400 transition-colors" />
              </button>
              <button
                onClick={() => setDeleteId(r.id)}
                className="ml-3 p-1.5 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 新建班表 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">新建班表</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">周开始日期（周一）</label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={e => setWeekStart(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">门店名称（可选）</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="例：St Pierre's Sushi"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">员工姓名</label>
                <div className="space-y-2">
                  {staffNames.map((name, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={e => updateStaffName(i, e.target.value)}
                        placeholder={`员工 ${i + 1}`}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                      />
                      {staffNames.length > 1 && (
                        <button onClick={() => removeStaffRow(i)} className="text-slate-300 hover:text-red-500 transition-colors px-1">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addStaffRow}
                  className="mt-2 text-sm text-orange-500 hover:text-orange-700 flex items-center gap-1"
                >
                  <Plus size={14} /> 添加员工
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">取消</button>
              <button
                onClick={handleCreate}
                disabled={creating || !weekStart || staffNames.filter(n => n.trim()).length === 0}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {creating ? "创建中..." : "创建班表"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-slate-800 font-medium mb-4">确认删除这份班表及所有排班数据？</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-slate-600">取消</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
