import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const { staffId, date, inTime, outTime, code } = await request.json() as {
      staffId: string;
      date: string;
      inTime: string;
      outTime: string;
      code: string;
    };
    if (!staffId || !date) return NextResponse.json({ error: "参数错误" }, { status: 400 });

    const shift = await prisma.rosterShift.upsert({
      where: { staffId_date: { staffId, date } },
      update: { inTime: inTime ?? "", outTime: outTime ?? "", code: code ?? "" },
      create: { staffId, date, inTime: inTime ?? "", outTime: outTime ?? "", code: code ?? "" },
    });
    return NextResponse.json(shift);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
