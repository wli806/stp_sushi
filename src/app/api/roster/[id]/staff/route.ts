import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const { name } = await request.json() as { name: string };
    if (!name?.trim()) return NextResponse.json({ error: "名字不能为空" }, { status: 400 });

    const count = await prisma.rosterStaff.count({ where: { rosterId: id } });
    const staff = await prisma.rosterStaff.create({
      data: { rosterId: id, name: name.trim(), order: count },
    });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
