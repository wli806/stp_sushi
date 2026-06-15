-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "storeName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RosterStaff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rosterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "adjHours" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "RosterStaff_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RosterShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "inTime" TEXT NOT NULL DEFAULT '',
    "outTime" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "RosterShift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "RosterStaff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RosterShift_staffId_date_key" ON "RosterShift"("staffId", "date");
