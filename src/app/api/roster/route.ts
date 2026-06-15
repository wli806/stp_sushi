import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAuth();
    const rosters = await prisma.roster.findMany({
      orderBy: { weekStart: "desc" },
      include: { staff: { select: { id: true } } },
    });
    return NextResponse.json(rosters.map(r => ({ ...r, staffCount: r.staff.length, staff: undefined })));
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { weekStart, storeName, staffNames } = await request.json() as {
      weekStart: string;
      storeName?: string;
      staffNames: string[];
    };
    if (!weekStart || !Array.isArray(staffNames)) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }
    const roster = await prisma.roster.create({
      data: {
        weekStart,
        storeName: storeName ?? "",
        staff: {
          create: staffNames
            .filter(n => n.trim())
            .map((name, i) => ({ name: name.trim(), order: i })),
        },
      },
    });
    return NextResponse.json(roster);
  } catch {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
}
