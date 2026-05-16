import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStrictOwner, requireRoot } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await requireStrictOwner();
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(users);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRoot();
    const data = await request.json();
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { username: data.username, password: hashed, role: data.role || "VIEWER" },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
