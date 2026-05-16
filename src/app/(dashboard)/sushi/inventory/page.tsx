"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Boxes, Minus } from "lucide-react";
import { format } from "date-fns";

interface Item {
  id: string; name: string; quantity: number; unit: string; notes: string | null; updatedAt: string;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function SushiInventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: "", quantity: "0", unit: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sushi/inventory");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", quantity: "0", unit: "", notes: "" });
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({ name: item.name, quantity: String(item.quantity), unit: item.unit, notes: item.notes || "" });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = editing ? `/api/sushi/inventory/${editing.id}` : "/api/sushi/inventory";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, quantity: parseFloat(form.quantity) || 0 }),
    });
    setSaving(false);
    setShowModal(false);
    load();
  }

  async function handleAdjust(id: string, delta: number) {
    setAdjusting(id);
    await fetch(`/api/sushi/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    setAdjusting(null);
    load();
  }

  async function handleDelete(item: Item) {
    if (!confirm(`确认删除「${item.name}」？`)) return;
    await fetch(`/api/sushi/inventory/${item.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">寿司店库存统计</h1>
          <p className="text-slate-500 text-sm mt-0.5">手动记录店内物品库存数量</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> 添加物品
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="p-12 text-center text-slate-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400">暂无记录，点击右上角添加物品</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs">
                <th className="text-left px-6 py-3 font-medium">物品名称</th>
                <th className="text-center px-4 py-3 font-medium">数量</th>
                <th className="text-center px-4 py-3 font-medium">单位</th>
                <th className="text-left px-4 py-3 font-medium">备注</th>
                <th className="text-right px-4 py-3 font-medium">更新时间</th>
                <th className="text-center px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-slate-800">{item.name}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleAdjust(item.id, -1)}
                        disabled={adjusting === item.id}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-12 text-center font-semibold text-slate-800 tabular-nums">
                        {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
                      </span>
                      <button
                        onClick={() => handleAdjust(item.id, 1)}
                        disabled={adjusting === item.id}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-500">{item.unit || "—"}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs">{item.notes || "—"}</td>
                  <td className="px-4 py-3.5 text-right text-slate-400 text-xs">
                    {format(new Date(item.updatedAt), "MM/dd HH:mm")}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(item)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(item)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? `编辑 — ${editing.name}` : "添加物品"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">物品名称 *</label>
              <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="例：酱油" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">数量 *</label>
                <input type="number" step="0.1" min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">单位</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="瓶/袋/盒" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
              <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="可选" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">取消</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
