import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAuth();
    const orders = await prisma.sushiOrder.findMany({
      include: { items: { orderBy: { itemCode: "asc" } } },
      orderBy: { syncedAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
