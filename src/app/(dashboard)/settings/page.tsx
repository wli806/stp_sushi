"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useSession } from "@/components/SessionProvider";

interface User {
  id: string; username: string; role: string; createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "所有者",
  MANAGER: "管理员",
  VIEWER: "查看者",
};

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
  const isRoot = username === "root";

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
    if (!res.ok) {
      setError("权限不足，仅管理员及以上可访问此页面");
      setLoading(false);
      return;
    }
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

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setFormError(d.error || "保存失败");
      return;
    }
    setShowModal(false);
    load();
  }

  async function handleDelete(u: User) {
    if (u.username === "root") { alert("不能删除 root 账户"); return; }
    if (!confirm(`确认删除用户 "${u.username}"？`)) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    load();
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 flex items-center gap-3">
          <ShieldCheck size={20} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">用户管理</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isRoot ? "管理账户权限，控制各角色的可见内容" : "仅 root 账户可增删改用户"}
          </p>
        </div>
        {isRoot && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> 添加用户
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-700">
        <strong>权限说明：</strong>
        <ul className="mt-1 space-y-0.5 list-disc list-inside">
          <li><strong>所有者</strong>：可访问所有页面，包括用户管理</li>
          <li><strong>管理员</strong>：可访问订单和库存页面</li>
          <li><strong>查看者</strong>：只能查看订单列表</li>
        </ul>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="p-12 text-center text-slate-400">加载中...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400">暂无用户</p>
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
                    <p className="text-xs text-slate-400">加入于 {format(new Date(u.createdAt), "yyyy/MM/dd")}</p>
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
        <Modal title={editUser ? `编辑用户 - ${editUser.username}` : "添加用户"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            {!editUser && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">用户名 *</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                密码 {editUser ? "（留空保持不变）" : "*"}
              </label>
              <input type="password" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editUser} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">角色 *</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="VIEWER">查看者</option>
                <option value="MANAGER">管理员</option>
                <option value="OWNER">所有者</option>
              </select>
            </div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm">取消</button>
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
