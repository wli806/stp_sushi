import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAuth();
    const reports = await prisma.weeklyReport.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reports);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = await request.json();
    if (!data.weekFrom || !data.weekTo) {
      return NextResponse.json({ error: "Week range is required" }, { status: 400 });
    }
    const report = await prisma.weeklyReport.create({
      data: {
        title: data.title || "Weekly Manager Report: 1% Project",
        weekFrom: data.weekFrom,
        weekTo: data.weekTo,
        storeName: data.storeName || "",
        managerName: data.managerName || "",
        lastWeekAchievement: data.lastWeekAchievement || "",
        focusPoint: data.focusPoint || "",
        actionPlan: data.actionPlan || "",
        peopleFocus: data.peopleFocus || "",
        createdBy: session.username,
      },
    });
    return NextResponse.json(report, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create" }, { status: 400 });
  }
}
