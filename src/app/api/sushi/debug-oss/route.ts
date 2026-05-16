import { NextRequest, NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth";

const BASE = "https://oss.spientsyserv.com";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ossDateFmt(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

const FY2026_START = new Date("2026-03-30").getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function getWeekMonday(weekNo: number): Date {
  return new Date(FY2026_START + (weekNo - 1) * WEEK_MS);
}

export async function GET(request: NextRequest) {
  try {
    await requireRoot();
    const weekNo = parseInt(request.nextUrl.searchParams.get("week") ?? "8");
    const year = parseInt(request.nextUrl.searchParams.get("year") ?? "2026");

    const username = process.env.OSS_USERNAME ?? "";
    const password = process.env.OSS_PASSWORD ?? "";
    const loginRes = await fetch(`${BASE}/common/login/attemptlogin`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
      redirect: "manual",
    });
    let cookie = loginRes.headers.get("set-cookie") ?? "";
    if (!cookie && typeof (loginRes.headers as unknown as Record<string, unknown>).getSetCookie === "function") {
      cookie = ((loginRes.headers as unknown as { getSetCookie(): string[] }).getSetCookie()).join("; ");
    }
    const sessionMatch = cookie.match(/ci_session=([^;]+)/);
    if (!sessionMatch) return NextResponse.json({ error: "Login failed", cookie: cookie.slice(0, 100) });
    const session = sessionMatch[1];

    const weekMonday = getWeekMonday(weekNo);
    const results: Record<string, unknown>[] = [];

    // Try Monday through Friday for this week
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekMonday.getTime() + d * 86400000);
      const res = await fetch(`${BASE}/shop/home/getTemplates`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": `ci_session=${session}` },
        body: new URLSearchParams({
          week: String(weekNo), year: String(year), type: "all", last_row: "",
          dailypo_week_no: String(weekNo), dailypo_year: String(year),
          dailypo_selected_day: ossDateFmt(day), supplier_id: "0",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const templates = (data.dailypo_template ?? []) as Record<string, unknown>[];
      const tbodyLen = (data.tbody ?? "").length;

      results.push({
        day: ossDateFmt(day),
        responseKeys: Object.keys(data),
        dailypo_count: templates.length,
        tbody_length: tbodyLen,
        // Show first 3 templates with full detail
        sample_templates: templates.slice(0, 3).map(t => ({
          id: t.id, po_status: t.po_status, display_name: t.display_name,
          supplier_name: t.supplier_name, order_date: t.order_date,
          delivery_date: t.delivery_date, week_no: t.week_no, year: t.year,
        })),
        // Show tbody snippet
        tbody_snippet: (data.tbody ?? "").slice(0, 300),
      });
    }

    return NextResponse.json({ weekNo, year, weekMonday: ossDateFmt(weekMonday), results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
