import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: set or clear a task status
// body: { taskKey, status } — status="" means clear
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id: staffId } = await params;
    const data = await request.json();
    const { taskKey, status } = data;
    if (!taskKey) return NextResponse.json({ error: "taskKey required" }, { status: 400 });

    if (!status) {
      await prisma.trainingChecklist.deleteMany({ where: { staffId, taskKey } });
      return NextResponse.json({ success: true });
    }

    const item = await prisma.trainingChecklist.upsert({
      where: { staffId_taskKey: { staffId, taskKey } },
      create: { staffId, taskKey, status },
      update: { status },
    });
    return NextResponse.json({ success: true, item });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
