"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Boxes, Minus } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/components/LanguageProvider";

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
  const { t } = useLanguage();
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
    if (!confirm(t("inventory.confirmDelete", { name: item.name }))) return;
    await fetch(`/api/sushi/inventory/${item.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{t("inventory.title")}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t("inventory.subtitle")}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">{t("inventory.addBtn")}</span><span className="sm:hidden">{t("common.add") || "Add"}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-400">{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400">{t("inventory.noRecord")}</p>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs">
                <th className="text-left px-4 md:px-6 py-3 font-medium">{t("inventory.col.name")}</th>
                <th className="text-center px-3 md:px-4 py-3 font-medium">{t("inventory.col.qty")}</th>
                <th className="text-center px-3 md:px-4 py-3 font-medium">{t("inventory.col.unit")}</th>
                <th className="text-left px-3 md:px-4 py-3 font-medium hidden sm:table-cell">{t("inventory.col.notes")}</th>
                <th className="text-right px-3 md:px-4 py-3 font-medium hidden md:table-cell">{t("inventory.col.updatedAt")}</th>
                <th className="text-center px-3 md:px-4 py-3 font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 md:px-6 py-3.5 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 md:px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5 md:gap-2">
                      <button onClick={() => handleAdjust(item.id, -1)} disabled={adjusting === item.id}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 transition-colors">
                        <Minus size={12} />
                      </button>
                      <span className="w-10 text-center font-semibold text-slate-800 tabular-nums">
                        {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
                      </span>
                      <button onClick={() => handleAdjust(item.id, 1)} disabled={adjusting === item.id}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 transition-colors">
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3.5 text-center text-slate-500">{item.unit || "—"}</td>
                  <td className="px-3 md:px-4 py-3.5 text-slate-400 text-xs hidden sm:table-cell">{item.notes || "—"}</td>
                  <td className="px-3 md:px-4 py-3.5 text-right text-slate-400 text-xs hidden md:table-cell">
                    {format(new Date(item.updatedAt), "MM/dd HH:mm")}
                  </td>
                  <td className="px-3 md:px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 md:gap-2">
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
        <Modal
          title={editing ? t("inventory.modal.edit", { name: editing.name }) : t("inventory.modal.add")}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("inventory.form.name")}</label>
              <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                placeholder={t("inventory.form.namePlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("inventory.form.qty")}</label>
                <input type="number" step="0.1" min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("inventory.form.unit")}</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder={t("inventory.form.unitPlaceholder")} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("inventory.form.notes")}</label>
              <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("common.optional")} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">{t("common.cancel")}</button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium">
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
