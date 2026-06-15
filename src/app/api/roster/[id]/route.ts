import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const roster = await prisma.roster.findUnique({
      where: { id },
      include: {
        staff: {
          orderBy: { order: "asc" },
          include: { shifts: true },
        },
      },
    });
    if (!roster) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(roster);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await prisma.roster.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
