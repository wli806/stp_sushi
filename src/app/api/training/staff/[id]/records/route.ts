import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: staffId } = await params;
    const data = await request.json();
    if (!data.date || !data.type || !data.areaForImprovement || !data.feedbackActionTaken || !data.followUpNeeded) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    const record = await prisma.trainingRecord.create({
      data: {
        staffId,
        taskKey: data.taskKey ?? "",
        date: data.date,
        type: data.type,
        areaForImprovement: data.areaForImprovement,
        feedbackActionTaken: data.feedbackActionTaken,
        followUpNeeded: data.followUpNeeded,
        createdByUsername: user.username,
        createdByRole: user.role,
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create" }, { status: 400 });
  }
}
