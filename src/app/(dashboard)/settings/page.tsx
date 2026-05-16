"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useSession } from "@/components/SessionProvider";
import { useLanguage } from "@/components/LanguageProvider";

interface User {
  id: string; username: string; role: string; createdAt: string;
}

const ROLE_COLOR: Record<string, string> = {
  OWNER: "bg-orange-100 text-orange-700",
  MANAGER: "bg-blue-100 text-blue-700",
  VIEWER: "bg-gray-100 text-gray-600",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { username } = useSession();
  const { t } = useLanguage();
  const isRoot = username === "root";

  const ROLE_LABEL: Record<string, string> = {
    OWNER: t("sidebar.role.owner"),
    MANAGER: t("sidebar.role.manager"),
    VIEWER: t("sidebar.role.viewer"),
  };

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ username: "", password: "", role: "VIEWER" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/users");
    if (!res.ok) { setError(t("settings.noPermission")); setLoading(false); return; }
    setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditUser(null);
    setForm({ username: "", password: "", role: "VIEWER" });
    setFormError("");
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ username: u.username, password: "", role: u.role });
    setFormError("");
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const url = editUser ? `/api/users/${editUser.id}` : "/api/users";
    const method = editUser ? "PUT" : "POST";
    const body = editUser
      ? { role: form.role, ...(form.password ? { password: form.password } : {}) }
      : { username: form.username, password: form.password, role: form.role };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setFormError(d.error || t("settings.saveError")); return; }
    setShowModal(false);
    load();
  }

  async function handleDelete(u: User) {
    if (u.username === "root") { alert(t("settings.cannotDeleteRoot")); return; }
    if (!confirm(t("settings.confirmDelete", { name: u.username }))) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    load();
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 flex items-center gap-3">
          <ShieldCheck size={20} /><p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{t("settings.title")}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isRoot ? t("settings.subtitleRoot") : t("settings.subtitleOther")}
          </p>
        </div>
        {isRoot && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> {t("settings.addBtn")}
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-700">
        <strong>{t("settings.permTitle")}</strong>
        <ul className="mt-1 space-y-0.5 list-disc list-inside">
          <li>{t("settings.perm.owner")}</li>
          <li>{t("settings.perm.manager")}</li>
          <li>{t("settings.perm.viewer")}</li>
        </ul>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="p-12 text-center text-slate-400">{t("common.loading")}</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400">{t("settings.noUsers")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 md:px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{u.username}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOR[u.role] ?? "bg-slate-100 text-slate-500"}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{t("settings.col.joinedAt")} {format(new Date(u.createdAt), "yyyy/MM/dd")}</p>
                  </div>
                </div>
                {isRoot && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50">
                      <Pencil size={15} />
                    </button>
                    {u.username !== "root" && (
                      <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editUser ? t("settings.modal.edit", { name: editUser.username }) : t("settings.modal.add")}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {!editUser && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.form.username")}</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("settings.form.password")}{editUser ? t("settings.form.passwordHint") : t("settings.form.passwordRequired")}
              </label>
              <input type="password" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editUser} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.form.role")}</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="VIEWER">{t("sidebar.role.viewer")}</option>
                <option value="MANAGER">{t("sidebar.role.manager")}</option>
                <option value="OWNER">{t("sidebar.role.owner")}</option>
              </select>
            </div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm">{t("common.cancel")}</button>
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
