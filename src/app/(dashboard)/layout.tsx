import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { SessionProvider } from "@/components/SessionProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <SessionProvider role={session.role} username={session.username}>
      <div className="flex min-h-screen">
        <Sidebar role={session.role} username={session.username} />
        <main className="md:ml-[220px] flex-1 min-h-screen bg-slate-50 pt-14 md:pt-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
