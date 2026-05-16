import { NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth";
import { wxNotify } from "@/lib/serverchan";

export async function POST() {
  try {
    await requireRoot();
    const key = process.env.SERVERCHAN_KEY;
    if (!key) return NextResponse.json({ error: "SERVERCHAN_KEY 未配置" }, { status: 400 });

    await wxNotify("🔔 寿司系统测试通知", "如果你收到这条消息，说明微信推送配置成功！");
    return NextResponse.json({ ok: true, keyPrefix: key.slice(0, 8) + "***" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
