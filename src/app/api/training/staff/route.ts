import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAuth();
    const staff = await prisma.trainingStaff.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { checklist: { where: { status: "pass" } } } } },
    });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const data = await request.json();
    if (!data.name || !data.startDate) {
      return NextResponse.json({ error: "Name and start date are required" }, { status: 400 });
    }
    const staff = await prisma.trainingStaff.create({
      data: {
        name: data.name,
        position: data.position || "Sushi Staff",
        store: data.store || "",
        trainerName: data.trainerName || "",
        startDate: data.startDate,
        notes: data.notes || null,
      },
    });
    return NextResponse.json(staff, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create" }, { status: 400 });
  }
}
