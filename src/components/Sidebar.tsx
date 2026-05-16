"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/SessionProvider";
import {
  ClipboardList,
  Settings,
  LogOut,
  UtensilsCrossed,
  Boxes,
  ChevronDown,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

type Role = "OWNER" | "MANAGER" | "VIEWER";

interface ChildItem { href: string; label: string; icon: LucideIcon }
interface NavItem {
  href: string; label: string; icon: LucideIcon;
  roles: Role[];
  rootOnly?: boolean;
  children?: ChildItem[];
}

const navItems: NavItem[] = [
  {
    href: "/sushi", label: "寿司采购", icon: UtensilsCrossed, roles: ["OWNER", "MANAGER", "VIEWER"],
    children: [
      { href: "/sushi/orders",    label: "订单管理", icon: ClipboardList },
      { href: "/sushi/inventory", label: "库存统计", icon: Boxes },
    ],
  },
  { href: "/settings", label: "用户管理", icon: Settings, roles: ["OWNER"], rootOnly: true },
];

interface SidebarProps {
  role: string;
  username: string;
}

export default function Sidebar({ role, username }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { username: sessionUsername } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    navItems.forEach(item => {
      if (item.children) {
        init[item.href] = item.children.some(c => pathname === c.href || pathname.startsWith(c.href));
      }
    });
    return init;
  });

  function toggleGroup(href: string) {
    setOpenGroups(prev => ({ ...prev, [href]: !prev[href] }));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const visibleItems = navItems.filter((item) => {
    if (item.rootOnly && (sessionUsername || username) !== "root") return false;
    return item.roles.includes(role as Role);
  });

  return (
    <>
      {/* 移动端汉堡按钮 */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 bg-slate-900 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside className={`w-[220px] min-h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center font-bold text-lg shadow">
              <UtensilsCrossed size={18} className="text-white" />
            </div>
            <p className="font-semibold text-sm leading-tight">寿司管理系统</p>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleItems.map(({ href, label, icon: Icon, children }) => {
          const hasChildren = children && children.length > 0;
          const childActive = hasChildren && children.some(c => pathname === c.href || pathname.startsWith(c.href));
          const active = !hasChildren
            ? (pathname === href || (href !== "/" && pathname.startsWith(href)))
            : pathname === href;
          const isOpen = hasChildren && !!openGroups[href];

          return (
            <div key={href}>
              {hasChildren ? (
                <button
                  onClick={() => toggleGroup(href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active || childActive
                      ? "bg-orange-600 text-white font-medium"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              ) : (
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-orange-600 text-white font-medium"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </Link>
              )}
              {hasChildren && isOpen && (
                <div className="mt-0.5 ml-2 pl-4 border-l border-slate-700 space-y-0.5">
                  {children.map(({ href: chref, label: clabel, icon: CIcon }) => {
                    const cActive = pathname === chref || pathname.startsWith(chref);
                    return (
                      <Link
                        key={chref}
                        href={chref}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                          cActive
                            ? "bg-orange-500/70 text-white font-medium"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <CIcon size={14} />
                        <span>{clabel}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-slate-400">登录账户</p>
          <p className="text-sm font-medium text-white">{username}</p>
          <p className="text-xs text-orange-400 mt-0.5">
            {role === "OWNER" ? "所有者" : role === "MANAGER" ? "管理员" : "查看者"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white text-sm transition-colors"
        >
          <LogOut size={17} />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
    </>
  );
}
