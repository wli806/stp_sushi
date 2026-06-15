import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "未登录" }, { status: 401 }); }
  try {
    const items = await prisma.packagingInventoryItem.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(items);
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "未登录" }, { status: 401 }); }
  try {
    const { name, quantity, unit, lowThreshold, notes } = await request.json() as {
      name: string; quantity: number; unit: string; lowThreshold?: number; notes?: string;
    };
    if (!name?.trim()) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    const item = await prisma.packagingInventoryItem.create({
      data: { name: name.trim(), quantity: Number(quantity ?? 0), unit: unit ?? "", lowThreshold: Number(lowThreshold ?? 0), notes: notes ?? null },
    });
    return NextResponse.json(item);
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
