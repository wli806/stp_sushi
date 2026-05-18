"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Plus, Trash2, ChevronRight, Save, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface WeeklyReport {
  id: string;
  weekFrom: string;
  weekTo: string;
  storeName: string;
  managerName: string;
  lastWeekAchievement: string;
  focusPoint: string;
  actionPlan: string;
  peopleFocus: string;
  createdBy: string;
  createdAt: string;
}

const EMPTY_FORM = {
  weekFrom: "",
  weekTo: "",
  storeName: "",
  managerName: "",
  lastWeekAchievement: "",
  focusPoint: "",
  actionPlan: "",
  peopleFocus: "",
};

type FormData = typeof EMPTY_FORM;

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

export default function ImprovementPage() {
  const { lang } = useLanguage();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WeeklyReport | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/improvement");
    const data = await res.json();
    setReports(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setSelected(null);
    setIsNew(true);
    setForm(EMPTY_FORM);
    setSaved(false);
  }

  function selectReport(r: WeeklyReport) {
    setSelected(r);
    setIsNew(false);
    setForm({
      weekFrom: r.weekFrom,
      weekTo: r.weekTo,
      storeName: r.storeName,
      managerName: r.managerName,
      lastWeekAchievement: r.lastWeekAchievement,
      focusPoint: r.focusPoint,
      actionPlan: r.actionPlan,
      peopleFocus: r.peopleFocus,
    });
    setSaved(false);
  }

  function cancelEdit() {
    setSelected(null);
    setIsNew(false);
    setForm(EMPTY_FORM);
    setSaved(false);
  }

  async function handleSave() {
    if (!form.weekFrom || !form.weekTo) return;
    setSaving(true);
    if (isNew) {
      const res = await fetch("/api/improvement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const created = await res.json();
      await load();
      setIsNew(false);
      setSelected(created);
    } else if (selected) {
      const res = await fetch(`/api/improvement/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      setSelected(updated);
      await load();
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete(id: string) {
    const msg = lang === "zh" ? "确认删除这份周报？" : "Delete this report?";
    if (!confirm(msg)) return;
    setDeleting(id);
    await fetch(`/api/improvement/${id}`, { method: "DELETE" });
    if (selected?.id === id) cancelEdit();
    await load();
    setDeleting(null);
  }

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const textareaCls = `${inputCls} resize-none`;
  const labelCls = "block text-xs font-medium text-slate-500 mb-1";

  const showForm = isNew || selected !== null;

  return (
    <div className="flex h-full min-h-screen bg-slate-50">
      {/* 左侧：历史列表 */}
      <div className="w-72 min-w-[220px] bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800 text-sm">
              1% Project
            </h2>
          </div>
          <button
            onClick={startNew}
            className="flex items-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            {lang === "zh" ? "新建周报" : "New Report"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-8">{lang === "zh" ? "加载中..." : "Loading..."}</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8 px-4">
              {lang === "zh" ? "暂无周报，点击「新建周报」开始" : "No reports yet — click New Report"}
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {reports.map(r => (
                <div
                  key={r.id}
                  onClick={() => selectReport(r)}
                  className={`group relative flex items-center gap-2 px-3 py-3 rounded-lg cursor-pointer transition-colors ${selected?.id === r.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {formatDate(r.weekFrom)} → {formatDate(r.weekTo)}
                    </p>
                    {r.storeName && <p className="text-xs text-slate-400 truncate mt-0.5">{r.storeName}</p>}
                    {r.managerName && <p className="text-xs text-slate-400 truncate">{r.managerName}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                      disabled={deleting === r.id}
                      className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧：表单 */}
      <div className="flex-1 overflow-y-auto">
        {!showForm ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
            <TrendingUp size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-400 text-sm">
              {lang === "zh" ? "选择一份历史周报，或点击「新建周报」" : "Select a report or click New Report"}
            </p>
          </div>
        ) : (
          <div className="p-6 max-w-3xl mx-auto">
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-lg font-bold text-slate-800">
                  Weekly Manager Report: 1% Project
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isNew
                    ? (lang === "zh" ? "新建周报" : "New Report")
                    : (lang === "zh" ? `由 ${selected?.createdBy || "—"} 创建` : `Created by ${selected?.createdBy || "—"}`)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={cancelEdit} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.weekFrom || !form.weekTo}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? "bg-green-500 text-white" : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white"}`}
                >
                  <Save size={14} />
                  {saving ? (lang === "zh" ? "保存中..." : "Saving...") : saved ? (lang === "zh" ? "已保存" : "Saved!") : (lang === "zh" ? "保存" : "Save")}
                </button>
              </div>
            </div>

            {/* 表单主体 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              {/* Week of */}
              <div>
                <label className={labelCls}>Week of</label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    className={`${inputCls} flex-1`}
                    value={form.weekFrom}
                    onChange={e => setForm(f => ({ ...f, weekFrom: e.target.value }))}
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="date"
                    className={`${inputCls} flex-1`}
                    value={form.weekTo}
                    onChange={e => setForm(f => ({ ...f, weekTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Store + Manager */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Store Name</label>
                  <input
                    className={inputCls}
                    placeholder="Enter store name"
                    value={form.storeName}
                    onChange={e => setForm(f => ({ ...f, storeName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Manager Name</label>
                  <input
                    className={inputCls}
                    placeholder="Enter manager name"
                    value={form.managerName}
                    onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
                  />
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Q1 */}
              <div>
                <label className={labelCls}>
                  <span className="text-blue-600 font-bold mr-1">1.</span>
                  What did we improve or achieve last week?
                </label>
                <textarea
                  className={textareaCls}
                  rows={4}
                  placeholder="Describe last week's improvements and achievements..."
                  value={form.lastWeekAchievement}
                  onChange={e => setForm(f => ({ ...f, lastWeekAchievement: e.target.value }))}
                />
              </div>

              {/* Q2 */}
              <div>
                <label className={labelCls}>
                  <span className="text-blue-600 font-bold mr-1">2.</span>
                  Where do we want to grow by &quot;1%&quot; next week?
                  <span className="ml-1 text-slate-400 font-normal">(Focus Point)</span>
                </label>
                <textarea
                  className={textareaCls}
                  rows={4}
                  placeholder="Identify the focus area for next week's 1% growth..."
                  value={form.focusPoint}
                  onChange={e => setForm(f => ({ ...f, focusPoint: e.target.value }))}
                />
              </div>

              {/* Q3 */}
              <div>
                <label className={labelCls}>
                  <span className="text-blue-600 font-bold mr-1">3.</span>
                  How will we achieve this?
                  <span className="ml-1 text-slate-400 font-normal">(Action Plan)</span>
                </label>
                <textarea
                  className={textareaCls}
                  rows={4}
                  placeholder="List the specific actions to achieve the focus point..."
                  value={form.actionPlan}
                  onChange={e => setForm(f => ({ ...f, actionPlan: e.target.value }))}
                />
              </div>

              {/* People First */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="block text-xs font-medium text-amber-700 mb-2">
                  &quot;People First&quot; Highlight of the Week
                  <span className="ml-1 text-amber-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
                  rows={3}
                  placeholder="Share a people-first moment or recognition from this week..."
                  value={form.peopleFocus}
                  onChange={e => setForm(f => ({ ...f, peopleFocus: e.target.value }))}
                />
              </div>
            </div>

            {/* 底部保存按钮 */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !form.weekFrom || !form.weekTo}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${saved ? "bg-green-500 text-white" : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white"}`}
              >
                <Save size={14} />
                {saving ? (lang === "zh" ? "保存中..." : "Saving...") : saved ? (lang === "zh" ? "已保存" : "Saved!") : (lang === "zh" ? "保存周报" : "Save Report")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
