import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  try {
    await requireAuth();
    const { rid } = await params;
    const data = await request.json();
    const record = await prisma.trainingRecord.update({
      where: { id: rid },
      data: {
        date: data.date,
        type: data.type,
        areaForImprovement: data.areaForImprovement,
        feedbackActionTaken: data.feedbackActionTaken,
        followUpNeeded: data.followUpNeeded,
      },
    });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  try {
    await requireAuth();
    const { rid } = await params;
    await prisma.trainingRecord.delete({ where: { id: rid } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 400 });
  }
}
