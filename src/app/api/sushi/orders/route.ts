import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const weekNo = searchParams.get("weekNo");
    const year = searchParams.get("year");

    const where = weekNo && year
      ? { weekNo: parseInt(weekNo), year: parseInt(year) }
      : {};

    const orders = await prisma.sushiOrder.findMany({
      where,
      include: { items: { orderBy: { itemCode: "asc" } } },
      orderBy: { syncedAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
