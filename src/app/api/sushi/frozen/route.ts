import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAuth();
    const items = await prisma.frozenInventoryItem.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { name, quantity, unit, notes } = await request.json() as {
      name: string; quantity: number; unit: string; notes?: string;
    };
    if (!name?.trim()) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    const item = await prisma.frozenInventoryItem.create({
      data: { name: name.trim(), quantity: Number(quantity ?? 0), unit: unit ?? "", notes: notes ?? null },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
