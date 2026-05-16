"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { type Lang, createT } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "zh" || saved === "en") setLang(saved);
  }, []);

  const t = createT(lang);

  function toggleLang() {
    const next: Lang = lang === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem("lang", next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("login.networkError"));
        return;
      }
      window.location.href = "/";
    } catch {
      setError(t("login.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
      {/* 语言切换 */}
      <div className="absolute top-4 right-4">
        <button onClick={toggleLang}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
          {lang === "zh" ? "English" : "中文"}
        </button>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
              <UtensilsCrossed size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t("login.title")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("login.subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("login.username")}</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                placeholder={t("login.usernamePlaceholder")} required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("login.password")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                placeholder={t("login.passwordPlaceholder")} required />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
