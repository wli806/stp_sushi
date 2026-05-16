import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";

export async function GET() {
  try {
    await requireOwner();
    const items = await prisma.sushiInventoryItem.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner();
    const data = await request.json();
    const item = await prisma.sushiInventoryItem.create({
      data: {
        name: data.name,
        quantity: parseFloat(data.quantity) || 0,
        unit: data.unit || "",
        notes: data.notes || null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 400 });
  }
}
