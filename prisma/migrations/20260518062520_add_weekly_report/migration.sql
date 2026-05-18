-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekFrom" TEXT NOT NULL,
    "weekTo" TEXT NOT NULL,
    "storeName" TEXT NOT NULL DEFAULT '',
    "managerName" TEXT NOT NULL DEFAULT '',
    "lastWeekAchievement" TEXT NOT NULL DEFAULT '',
    "focusPoint" TEXT NOT NULL DEFAULT '',
    "actionPlan" TEXT NOT NULL DEFAULT '',
    "peopleFocus" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
