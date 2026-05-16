import { prisma } from "./prisma";

export function logActivity(username: string, action: string, detail?: string): void {
  prisma.activityLog.create({
    data: { username, action, detail: detail ?? null },
  }).catch(() => {});
}
