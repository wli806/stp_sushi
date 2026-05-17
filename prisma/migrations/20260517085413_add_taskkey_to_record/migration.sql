-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrainingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "areaForImprovement" TEXT NOT NULL,
    "feedbackActionTaken" TEXT NOT NULL,
    "followUpNeeded" TEXT NOT NULL,
    "createdByUsername" TEXT NOT NULL DEFAULT '',
    "createdByRole" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "TrainingStaff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TrainingRecord" ("areaForImprovement", "createdAt", "createdByRole", "createdByUsername", "date", "feedbackActionTaken", "followUpNeeded", "id", "staffId", "type") SELECT "areaForImprovement", "createdAt", "createdByRole", "createdByUsername", "date", "feedbackActionTaken", "followUpNeeded", "id", "staffId", "type" FROM "TrainingRecord";
DROP TABLE "TrainingRecord";
ALTER TABLE "new_TrainingRecord" RENAME TO "TrainingRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
