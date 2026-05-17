-- CreateTable
CREATE TABLE "TrainingStaff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'Sushi Staff',
    "store" TEXT NOT NULL DEFAULT '',
    "trainerName" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "TrainingChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "completedAt" TEXT NOT NULL DEFAULT '',
    "trainerName" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "TrainingChecklist_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "TrainingStaff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingChecklist_staffId_taskKey_key" ON "TrainingChecklist"("staffId", "taskKey");
