"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2, GraduationCap, ClipboardList, Pencil, StickyNote, Save } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

// ── Checklist definition ──────────────────────────────────────────────────────
const CHECKLIST_AREAS = [
  {
    key: "kitchen", labelZh: "厨房", labelEn: "Kitchen",
    tasks: [
      { key: "kitchen-sushi-rice",    labelEn: "Cooking Sushi Rice" },
      { key: "kitchen-other-food",    labelEn: "Other food preparations" },
      { key: "kitchen-chicken",       labelEn: "Cooking Chicken Items" },
      { key: "kitchen-cleaning",      labelEn: "Cleaning Tasks" },
      { key: "kitchen-food-safety",   labelEn: "Food Safety Program" },
      { key: "kitchen-task-mgmt",     labelEn: "Task Management in Kitchen area" },
      { key: "kitchen-communication", labelEn: "Communication between areas" },
    ],
  },
  {
    key: "sushi", labelZh: "寿司制作", labelEn: "Sushi Production",
    tasks: [
      { key: "sushi-regular-items",   labelEn: "Making Regular Items (Sushi & On rice)" },
      { key: "sushi-ingredients",     labelEn: "Managing Food Ingredients" },
      { key: "sushi-seafood",         labelEn: "Seafood Ready to Eat" },
      { key: "sushi-special-orders",  labelEn: "Making Special Orders" },
      { key: "sushi-speed",           labelEn: "Production Speed" },
      { key: "sushi-production-plan", labelEn: "Production plan, Stock Control & Priorities" },
      { key: "sushi-cleaning",        labelEn: "Cleaning & Area Presentations" },
      { key: "sushi-topping",         labelEn: "Topping up Products" },
      { key: "sushi-cutting",         labelEn: "Cutting & Packing" },
      { key: "sushi-task-mgmt",       labelEn: "Task Management in Sushi Production Area" },
      { key: "sushi-communication",   labelEn: "Communication between areas" },
    ],
  },
  {
    key: "cs", labelZh: "客户服务", labelEn: "Customer Service",
    tasks: [
      { key: "cs-product-names",   labelEn: "Product Names & Prices" },
      { key: "cs-cash-register",   labelEn: "Using cash register & handling online orders" },
      { key: "cs-sales-promo",     labelEn: "Handling Sales Promotion Materials" },
      { key: "cs-7-step",          labelEn: "7 step customer service" },
      { key: "cs-special-orders",  labelEn: "Taking special orders" },
      { key: "cs-presentation",    labelEn: "Product presentation on the display" },
      { key: "cs-topping-misc",    labelEn: "Topping up misc items (drinks, condiments)" },
      { key: "cs-customer-comm",   labelEn: "Communication with customers" },
      { key: "cs-area-comm",       labelEn: "Communication between areas" },
      { key: "cs-cleaning",        labelEn: "Cleaning eating area" },
    ],
  },
  {
    key: "ops", labelZh: "店铺运营", labelEn: "Store Operations",
    tasks: [
      { key: "ops-opening",   labelEn: "Opening Tasks" },
      { key: "ops-closing",   labelEn: "Closing Tasks" },
      { key: "ops-receiving", labelEn: "Receiving goods" },
      { key: "ops-storing",   labelEn: "Storing Goods" },
    ],
  },
];
const TOTAL_TASKS = CHECKLIST_AREAS.reduce((s, a) => s + a.tasks.length, 0);

// ── Types ─────────────────────────────────────────────────────────────────────
interface TrainingRecord {
  id: string; taskKey: string; date: string; type: string;
  areaForImprovement: string; feedbackActionTaken: string; followUpNeeded: string;
  createdByRole: string; createdByUsername: string;
}
interface TrainingChecklistItem {
  taskKey: string; status: string;
}
interface StaffDetail {
  id: string; name: string; position: string; store: string;
  trainerName: string; startDate: string; notes: string | null;
  records: TrainingRecord[];
  checklist: TrainingChecklistItem[];
}

const RECORD_TYPES = ["Feedback", "Retraining", "Observation", "Warning"];
const EMPTY_FORM = { date: "", type: "Feedback", areaForImprovement: "", feedbackActionTaken: "", followUpNeeded: "" };

// ── Status helpers ─────────────────────────────────────────────────────────────
type TaskStatus = "pass" | "partial" | "fail" | "";

const STATUS_CONFIG: Record<string, { labelZh: string; labelEn: string; active: string; inactive: string }> = {
  pass:    { labelZh: "通过",   labelEn: "Pass",    active: "bg-green-500 text-white",  inactive: "border border-green-300 text-green-600 hover:bg-green-50" },
  partial: { labelZh: "部分",   labelEn: "Partial", active: "bg-amber-400 text-white",  inactive: "border border-amber-300 text-amber-600 hover:bg-amber-50" },
  fail:    { labelZh: "不通过", labelEn: "Fail",    active: "bg-red-500 text-white",    inactive: "border border-red-300 text-red-500 hover:bg-red-50" },
};

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.active}`}>
      {lang === "en" ? cfg.labelEn : cfg.labelZh}
    </span>
  );
}

function roleBorder(role: string) {
  if (role === "OWNER") return "border-l-orange-500";
  if (role === "MANAGER") return "border-l-blue-500";
  return "border-l-slate-400";
}
function roleBadge(role: string) {
  if (role === "OWNER") return "bg-orange-100 text-orange-700";
  if (role === "MANAGER") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 truncate pr-2">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none flex-shrink-0">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function RecordCard({ r, onDelete }: { r: TrainingRecord; onDelete: () => void }) {
  const { t } = useLanguage();
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm border-l-4 ${roleBorder(r.createdByRole)} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-sm font-semibold text-slate-700">{r.date}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{r.type}</span>
            {r.createdByUsername && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(r.createdByRole)}`}>{r.createdByUsername}</span>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-400 text-xs">{t("training.record.area")}</span> <span className="text-slate-700">{r.areaForImprovement}</span></p>
            <p><span className="text-slate-400 text-xs">{t("training.record.feedback")}</span> <span className="text-slate-700">{r.feedbackActionTaken}</span></p>
            <p><span className="text-slate-400 text-xs">{t("training.record.followUp")}</span> <span className="text-slate-700">{r.followUpNeeded}</span></p>
          </div>
        </div>
        <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function RecordForm({
  form, setForm, onSave, onCancel, saving,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";
  const disabled = saving || !form.date || !form.areaForImprovement || !form.feedbackActionTaken || !form.followUpNeeded;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t("training.record.date")} *</label>
          <input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t("training.record.type")}</label>
          <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {RECORD_TYPES.map(tp => <option key={tp}>{tp}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">{t("training.record.area")} *</label>
        <textarea className={`${inputCls} resize-none`} rows={2} value={form.areaForImprovement} onChange={e => setForm(f => ({ ...f, areaForImprovement: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">{t("training.record.feedback")} *</label>
        <textarea className={`${inputCls} resize-none`} rows={2} value={form.feedbackActionTaken} onChange={e => setForm(f => ({ ...f, feedbackActionTaken: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">{t("training.record.followUp")} *</label>
        <textarea className={`${inputCls} resize-none`} rows={2} value={form.followUpNeeded} onChange={e => setForm(f => ({ ...f, followUpNeeded: e.target.value }))} />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">{t("common.cancel")}</button>
        <button onClick={onSave} disabled={disabled}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}

export default function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit staff info modal
  const [showEditStaff, setShowEditStaff] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", position: "", store: "", trainerName: "", startDate: "", notes: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  function openEditStaff() {
    if (!staff) return;
    setEditForm({ name: staff.name, position: staff.position, store: staff.store, trainerName: staff.trainerName, startDate: staff.startDate, notes: staff.notes ?? "" });
    setShowEditStaff(true);
  }

  async function handleSaveEdit() {
    if (!editForm.name || !editForm.startDate) return;
    setSavingEdit(true);
    await fetch(`/api/training/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSavingEdit(false);
    setShowEditStaff(false);
    load();
  }

  // Tab
  const [activeTab, setActiveTab] = useState<"checklist" | "notes">("checklist");

  // Notes
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  async function handleSaveNotes() {
    setSavingNotes(true);
    await fetch(`/api/training/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: staff!.name, position: staff!.position, store: staff!.store,
        trainerName: staff!.trainerName, startDate: staff!.startDate,
        notes: notesText,
      }),
    });
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
    load();
  }

  // Task records modal
  const [taskModal, setTaskModal] = useState<{ key: string; label: string } | null>(null);
  const [showAddTaskRecord, setShowAddTaskRecord] = useState(false);
  const [taskRecordForm, setTaskRecordForm] = useState({ ...EMPTY_FORM });
  const [savingTaskRecord, setSavingTaskRecord] = useState(false);

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/training/staff/${id}`);
    if (res.ok) {
      const data = await res.json();
      setStaff(data);
      setNotesText(data.notes ?? "");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  const taskRecordsMap = new Map<string, TrainingRecord[]>();
  (staff?.records ?? []).forEach(r => {
    if (r.taskKey) {
      const arr = taskRecordsMap.get(r.taskKey) ?? [];
      arr.push(r);
      taskRecordsMap.set(r.taskKey, arr);
    }
  });

  const statusMap = new Map<string, string>();
  (staff?.checklist ?? []).forEach(c => { if (c.status) statusMap.set(c.taskKey, c.status); });

  const passCount = [...statusMap.values()].filter(s => s === "pass").length;

  async function handleSetStatus(taskKey: string, status: TaskStatus) {
    setUpdatingStatus(taskKey);
    const current = statusMap.get(taskKey) ?? "";
    const next = current === status ? "" : status;
    await fetch(`/api/training/staff/${id}/checklist`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskKey, status: next }),
    });
    setUpdatingStatus(null);
    load();
  }

  // ── Task record actions ─────────────────────────────────────────────────────
  async function handleSaveTaskRecord() {
    if (!taskModal) return;
    const { date, type, areaForImprovement, feedbackActionTaken, followUpNeeded } = taskRecordForm;
    if (!date || !areaForImprovement || !feedbackActionTaken || !followUpNeeded) return;
    setSavingTaskRecord(true);
    await fetch(`/api/training/staff/${id}/records`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type, areaForImprovement, feedbackActionTaken, followUpNeeded, taskKey: taskModal.key }),
    });
    setSavingTaskRecord(false);
    setShowAddTaskRecord(false);
    setTaskRecordForm({ ...EMPTY_FORM });
    load();
  }

  async function handleDeleteRecord(recordId: string) {
    if (!confirm(t("training.confirmDeleteRecord"))) return;
    await fetch(`/api/training/staff/${id}/records/${recordId}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="p-8 text-center text-slate-400">{t("common.loading")}</div>;
  if (!staff) return <div className="p-8 text-center text-slate-400">Not found</div>;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push("/training")} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-3">
          <ChevronLeft size={15} /> {t("training.backToList")}
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <GraduationCap size={22} className="text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-800">{staff.name}</h1>
            <p className="text-slate-500 text-sm">{staff.position}{staff.store ? ` · ${staff.store}` : ""} · {lang === "en" ? "Start" : "入职"} {staff.startDate}</p>
          </div>
          <button onClick={openEditStaff}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0">
            <Pencil size={13} />
            {lang === "en" ? "Edit" : "编辑"}
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-slate-700">{t("training.checklist.progress")}</span>
          <span className={`font-bold ${passCount === TOTAL_TASKS ? "text-green-600" : "text-orange-500"}`}>{passCount}/{TOTAL_TASKS}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all ${passCount === TOTAL_TASKS ? "bg-green-500" : "bg-orange-400"}`}
            style={{ width: `${Math.round((passCount / TOTAL_TASKS) * 100)}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-400">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>{lang === "en" ? "Pass" : "通过"} {[...statusMap.values()].filter(s => s === "pass").length}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"></span>{lang === "en" ? "Partial" : "部分通过"} {[...statusMap.values()].filter(s => s === "partial").length}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>{lang === "en" ? "Fail" : "不通过"} {[...statusMap.values()].filter(s => s === "fail").length}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveTab("checklist")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "checklist" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <ClipboardList size={15} />
          {lang === "en" ? "Skill Checklist" : "技能清单"}
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "notes" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <StickyNote size={15} />
          {lang === "en" ? "Notes" : "笔记"}
          {notesText && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />}
        </button>
      </div>

      {/* ── Notes Tab ───────────────────────────────────────────────────────── */}
      {activeTab === "notes" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">
              {lang === "en" ? "Personal Notes" : "个人笔记"}
            </p>
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${notesSaved ? "bg-green-500 text-white" : "bg-orange-500 hover:bg-orange-600 text-white disabled:bg-orange-300"}`}
            >
              <Save size={12} />
              {savingNotes ? (lang === "en" ? "Saving..." : "保存中...") : notesSaved ? (lang === "en" ? "Saved!" : "已保存") : (lang === "en" ? "Save" : "保存")}
            </button>
          </div>
          <textarea
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none leading-relaxed"
            rows={16}
            placeholder={lang === "en" ? "Write notes here — things to remember, personal goals, reminders..." : "在这里写下需要记住的事情、个人目标、提醒事项..."}
            value={notesText}
            onChange={e => setNotesText(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-2 text-right">{notesText.length} {lang === "en" ? "chars" : "字"}</p>
        </div>
      )}

      {/* ── Checklist Tab ────────────────────────────────────────────────────── */}
      {activeTab === "checklist" && CHECKLIST_AREAS.map(area => (
        <div key={area.key} className="bg-white rounded-xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 text-sm">{lang === "en" ? area.labelEn : area.labelZh}</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {area.tasks.map(task => {
              const taskRecords = taskRecordsMap.get(task.key) ?? [];
              const hasRecords = taskRecords.length > 0;
              const currentStatus = statusMap.get(task.key) ?? "";
              const isUpdating = updatingStatus === task.key;
              return (
                <div key={task.key} className="px-4 py-3">
                  {/* Task name + status badge */}
                  <div className="flex items-start gap-2 mb-2">
                    <p className="text-sm text-slate-700 flex-1 leading-snug">{task.labelEn}</p>
                    <StatusBadge status={currentStatus} lang={lang} />
                  </div>
                  {/* Controls row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status buttons */}
                    {(["pass", "partial", "fail"] as const).map(s => {
                      const cfg = STATUS_CONFIG[s];
                      const isActive = currentStatus === s;
                      return (
                        <button
                          key={s}
                          disabled={isUpdating}
                          onClick={() => handleSetStatus(task.key, s)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${isActive ? cfg.active : cfg.inactive}`}>
                          {lang === "en" ? cfg.labelEn : cfg.labelZh}
                        </button>
                      );
                    })}
                    {/* Records button */}
                    <button
                      onClick={() => { setTaskModal({ key: task.key, label: task.labelEn }); setShowAddTaskRecord(false); }}
                      className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors flex-shrink-0 ${hasRecords ? "bg-orange-50 text-orange-600 hover:bg-orange-100 font-medium" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
                      <ClipboardList size={12} />
                      {hasRecords ? `${taskRecords.length} ${lang === "en" ? "record(s)" : "条记录"}` : (lang === "en" ? "Records" : "记录")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Task Records Modal ──────────────────────────────────────────────── */}
      {taskModal && (
        <Modal title={taskModal.label} onClose={() => { setTaskModal(null); setShowAddTaskRecord(false); }}>
          {showAddTaskRecord ? (
            <RecordForm
              form={taskRecordForm} setForm={setTaskRecordForm}
              onSave={handleSaveTaskRecord}
              onCancel={() => { setShowAddTaskRecord(false); setTaskRecordForm({ ...EMPTY_FORM }); }}
              saving={savingTaskRecord}
            />
          ) : (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => { setShowAddTaskRecord(true); setTaskRecordForm({ ...EMPTY_FORM }); }}
                  className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                  <Plus size={12} /> {t("training.record.add")}
                </button>
              </div>
              {(taskRecordsMap.get(taskModal.key) ?? []).length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">{t("training.record.noData")}</p>
              ) : (
                <div className="space-y-3">
                  {(taskRecordsMap.get(taskModal.key) ?? []).map(r => (
                    <RecordCard key={r.id} r={r} onDelete={() => handleDeleteRecord(r.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Edit Staff Modal ─────────────────────────────────────────────────── */}
      {showEditStaff && (
        <Modal title={lang === "en" ? "Edit Staff Info" : "编辑员工信息"} onClose={() => setShowEditStaff(false)}>
          {(() => {
            const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t("training.form.name")} *</label>
                  <input className={inputCls} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t("training.form.position")}</label>
                    <input className={inputCls} value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t("training.form.store")}</label>
                    <input className={inputCls} value={editForm.store} onChange={e => setEditForm(f => ({ ...f, store: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t("training.form.startDate")} *</label>
                    <input type="date" className={inputCls} value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t("training.form.trainer")}</label>
                    <input className={inputCls} value={editForm.trainerName} onChange={e => setEditForm(f => ({ ...f, trainerName: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t("common.notes")}</label>
                  <textarea className={`${inputCls} resize-none`} rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowEditStaff(false)}
                    className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                    {t("common.cancel")}
                  </button>
                  <button onClick={handleSaveEdit} disabled={savingEdit || !editForm.name || !editForm.startDate}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                    {savingEdit ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
