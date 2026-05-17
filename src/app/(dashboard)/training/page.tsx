"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, Trash2, ChevronRight, User } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

const TOTAL_TASKS = 32;

interface StaffMember {
  id: string;
  name: string;
  position: string;
  store: string;
  trainerName: string;
  startDate: string;
  notes: string | null;
  createdAt: string;
  _count: { checklist: number };
}

interface StaffForm {
  name: string;
  position: string;
  store: string;
  trainerName: string;
  startDate: string;
  notes: string;
}

const EMPTY_FORM: StaffForm = { name: "", position: "Sushi Staff", store: "", trainerName: "", startDate: "", notes: "" };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/training/staff");
    const data = await res.json();
    setStaff(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.name || !form.startDate) return;
    setSaving(true);
    await fetch("/api/training/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm(t("training.confirmDelete"))) return;
    setDeleting(id);
    await fetch(`/api/training/staff/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("training.title")}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t("training.subtitle")}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} />
          {t("training.addStaff")}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-400">{t("common.loading")}</div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center">
          <GraduationCap size={44} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">{t("training.noStaff")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {staff.map(s => {
            const progress = s._count.checklist;
            const pct = Math.round((progress / TOTAL_TASKS) * 100);
            return (
              <div key={s.id} onClick={() => router.push(`/training/${s.id}`)}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-orange-200 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.position}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => handleDelete(e, s.id)} disabled={deleting === s.id}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </div>
                <div className="text-xs text-slate-400 space-y-0.5 mb-3">
                  {s.store && <p>{lang === "en" ? "Store" : "门店"}：{s.store}</p>}
                  <p>{lang === "en" ? "Start" : "入职"}：{s.startDate}</p>
                  {s.trainerName && <p>{lang === "en" ? "Trainer" : "培训员"}：{s.trainerName}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">{t("training.checklist.progress")}</span>
                    <span className={`font-semibold ${pct === 100 ? "text-green-600" : "text-orange-500"}`}>{progress}/{TOTAL_TASKS}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-orange-400"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={t("training.addStaff")} onClose={() => { setShowModal(false); setForm(EMPTY_FORM); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t("training.form.name")} *</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("training.form.position")}</label>
                <input className={inputCls} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("training.form.store")}</label>
                <input className={inputCls} value={form.store} onChange={e => setForm(f => ({ ...f, store: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("training.form.startDate")} *</label>
                <input type="date" className={inputCls} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("training.form.trainer")}</label>
                <input className={inputCls} value={form.trainerName} onChange={e => setForm(f => ({ ...f, trainerName: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t("common.notes")}</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
                className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                {t("common.cancel")}
              </button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.startDate}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
