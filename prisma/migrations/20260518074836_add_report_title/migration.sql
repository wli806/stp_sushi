-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Weekly Manager Report: 1% Project',
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
INSERT INTO "new_WeeklyReport" ("actionPlan", "createdAt", "createdBy", "focusPoint", "id", "lastWeekAchievement", "managerName", "peopleFocus", "storeName", "updatedAt", "weekFrom", "weekTo") SELECT "actionPlan", "createdAt", "createdBy", "focusPoint", "id", "lastWeekAchievement", "managerName", "peopleFocus", "storeName", "updatedAt", "weekFrom", "weekTo" FROM "WeeklyReport";
DROP TABLE "WeeklyReport";
ALTER TABLE "new_WeeklyReport" RENAME TO "WeeklyReport";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
