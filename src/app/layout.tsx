import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "寿司管理系统",
  description: "St Pierre's 寿司采购订单及库存管理",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
