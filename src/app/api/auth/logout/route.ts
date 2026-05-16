import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export async function POST() {
  const session = await getSession();
  if (session) logActivity(session.username, "退出登录");
  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth_token");
  return response;
}
