import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const data = await request.json();
    const report = await prisma.weeklyReport.update({
      where: { id },
      data: {
        weekFrom: data.weekFrom,
        weekTo: data.weekTo,
        storeName: data.storeName || "",
        managerName: data.managerName || "",
        lastWeekAchievement: data.lastWeekAchievement || "",
        focusPoint: data.focusPoint || "",
        actionPlan: data.actionPlan || "",
        peopleFocus: data.peopleFocus || "",
      },
    });
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await prisma.weeklyReport.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 400 });
  }
}
