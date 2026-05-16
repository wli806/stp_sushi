"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { type Lang, createT, type TranslationKey } from "@/lib/i18n";

interface LangCtx {
  lang: Lang;
  toggle: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LangCtx>({
  lang: "zh",
  toggle: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "zh" || saved === "en") setLang(saved);
  }, []);

  function toggle() {
    setLang(prev => {
      const next: Lang = prev === "zh" ? "en" : "zh";
      localStorage.setItem("lang", next);
      return next;
    });
  }

  return (
    <Ctx.Provider value={{ lang, toggle, t: createT(lang) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLanguage() {
  return useContext(Ctx);
}
