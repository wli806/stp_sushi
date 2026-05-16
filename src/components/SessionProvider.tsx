"use client";

import { createContext, useContext } from "react";

interface SessionContext {
  role: string;
  username: string;
}

const SessionCtx = createContext<SessionContext>({ role: "", username: "" });

export function SessionProvider({
  role,
  username,
  children,
}: {
  role: string;
  username: string;
  children: React.ReactNode;
}) {
  return <SessionCtx.Provider value={{ role, username }}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}
