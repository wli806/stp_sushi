import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  try {
    await requireAuth();
    const { staffId } = await params;
    const body = await request.json() as { name?: string; adjHours?: number };
    const data: { name?: string; adjHours?: number } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.adjHours !== undefined) data.adjHours = Number(body.adjHours);
    const staff = await prisma.rosterStaff.update({ where: { id: staffId }, data });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  try {
    await requireAuth();
    const { staffId } = await params;
    await prisma.rosterStaff.delete({ where: { id: staffId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
