import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const { name, quantity, unit, notes } = await request.json() as {
      name?: string; quantity?: number; unit?: string; notes?: string;
    };
    const item = await prisma.drinkInventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(quantity !== undefined && { quantity: Number(quantity) }),
        ...(unit !== undefined && { unit }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await prisma.drinkInventoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
