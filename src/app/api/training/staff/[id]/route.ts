import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const staff = await prisma.trainingStaff.findUnique({
      where: { id },
      include: {
        records: { orderBy: { date: "desc" } },
        checklist: true,
      },
    });
    if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const data = await request.json();
    const staff = await prisma.trainingStaff.update({
      where: { id },
      data: {
        name: data.name,
        position: data.position,
        store: data.store,
        trainerName: data.trainerName,
        startDate: data.startDate,
        notes: data.notes ?? null,
      },
    });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await prisma.trainingStaff.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 400 });
  }
}
