import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id } = await params;
    const data = await request.json();
    const item = await prisma.sushiInventoryItem.update({
      where: { id },
      data: {
        name: data.name,
        quantity: parseFloat(data.quantity) ?? 0,
        unit: data.unit ?? "",
        notes: data.notes ?? null,
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id } = await params;
    const { delta } = await request.json();
    const item = await prisma.sushiInventoryItem.update({
      where: { id },
      data: { quantity: { increment: delta } },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id } = await params;
    await prisma.sushiInventoryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 400 });
  }
}
