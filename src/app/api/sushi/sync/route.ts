import { NextRequest, NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth";
import { syncOSSOrders } from "@/lib/oss-sync";

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const reqSecret = request.headers.get("x-cron-secret");
    if (!cronSecret || reqSecret !== cronSecret) {
      await requireRoot();
    }
    const result = await syncOSSOrders();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
