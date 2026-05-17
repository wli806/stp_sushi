import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: sign off or unsign a checklist task
// body: { taskKey, completedAt, trainerName } — completedAt="" means unsign
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id: staffId } = await params;
    const data = await request.json();
    const { taskKey, completedAt, trainerName } = data;
    if (!taskKey) return NextResponse.json({ error: "taskKey required" }, { status: 400 });

    if (!completedAt) {
      // Unsign: delete the record if exists
      await prisma.trainingChecklist.deleteMany({ where: { staffId, taskKey } });
      return NextResponse.json({ success: true, signed: false });
    }

    if (!trainerName) return NextResponse.json({ error: "Trainer name required" }, { status: 400 });

    const item = await prisma.trainingChecklist.upsert({
      where: { staffId_taskKey: { staffId, taskKey } },
      create: { staffId, taskKey, completedAt, trainerName },
      update: { completedAt, trainerName },
    });
    return NextResponse.json({ success: true, signed: true, item });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
