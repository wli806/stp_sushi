import { NextRequest, NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth";
import { applyOrderToInventory } from "@/lib/sushi-inventory-apply";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRoot();
    const { id } = await params;
    const { action } = await request.json();
    if (action === "apply-inventory") {
      await applyOrderToInventory(id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
