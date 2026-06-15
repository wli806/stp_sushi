"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, GlassWater, Minus } from "lucide-react";

interface DrinkItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string | null;
  updatedAt: string;
}

type ModalMode = "add" | "edit";

const DEFAULT_FORM = { name: "", quantity: 0, unit: "瓶", notes: "" };

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DrinksPage() {
  const [items, setItems] = useState<DrinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: ModalMode; item?: DrinkItem } | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Record<string, boolean>>({});

  async function load() {
    const res = await fetch("/api/sushi/drinks");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(DEFAULT_FORM);
    setModal({ mode: "add" });
  }

  function openEdit(item: DrinkItem) {
    setForm({ name: item.name, quantity: item.quantity, unit: item.unit, notes: item.notes ?? "" });
    setModal({ mode: "edit", item });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const url = modal?.mode === "add" ? "/api/sushi/drinks" : `/api/sushi/drinks/${modal?.item?.id}`;
      const method = modal?.mode === "add" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? `保存失败 (${res.status})`);
        setSaving(false);
        return;
      }
    } catch {
      setSaveError("网络错误，请重试");
      setSaving(false);
      return;
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sushi/drinks/${id}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  }

  async function adjustQty(item: DrinkItem, delta: number) {
    const newQty = Math.max(0, item.quantity + delta);
    setAdjusting(prev => ({ ...prev, [item.id]: true }));
    await fetch(`/api/sushi/drinks/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQty }),
    });
    setAdjusting(prev => ({ ...prev, [item.id]: false }));
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty, updatedAt: new Date().toISOString() } : i));
  }

  const total = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GlassWater className="text-blue-500" size={24} />
            饮品库存
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            共 {items.length} 种饮品 · 合计 {total} {items[0]?.unit ?? ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> 添加饮品
        </button>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <GlassWater size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无饮品记录，点击「添加饮品」开始</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">名称</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">数量</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">备注</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">更新时间</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => adjustQty(item, -1)}
                        disabled={adjusting[item.id] || item.quantity <= 0}
                        className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className={`min-w-[3rem] text-center font-bold text-lg ${item.quantity === 0 ? "text-red-500" : item.quantity <= 3 ? "text-amber-500" : "text-slate-800"}`}>
                        {item.quantity}
                        <span className="text-xs font-normal text-slate-400 ml-0.5">{item.unit}</span>
                      </span>
                      <button
                        onClick={() => adjustQty(item, 1)}
                        disabled={adjusting[item.id]}
                        className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-600 disabled:opacity-40 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{item.notes || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{fmtDate(item.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 库存状态提示 */}
      {items.some(i => i.quantity === 0) && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ 有 {items.filter(i => i.quantity === 0).length} 种饮品已售罄：
          {items.filter(i => i.quantity === 0).map(i => i.name).join("、")}
        </div>
      )}
      {items.some(i => i.quantity > 0 && i.quantity <= 3) && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          ⚡ 库存偏低（≤3）：{items.filter(i => i.quantity > 0 && i.quantity <= 3).map(i => `${i.name}(${i.quantity})`).join("、")}
        </div>
      )}

      {/* 添加/编辑 Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {modal.mode === "add" ? "添加饮品" : `编辑 — ${modal.item?.name}`}
              </h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：可口可乐 375ml"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">数量 *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-slate-700 mb-1">单位</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="瓶/罐/箱"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注（可选）</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="例：冰箱第二层"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            {saveError && (
              <div className="px-6 pb-2 text-sm text-red-600">{saveError}</div>
            )}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => { setModal(null); setSaveError(""); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">取消</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-slate-800 font-medium mb-4">确认删除「{items.find(i => i.id === deleteId)?.name}」？</p>
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
