-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DrinkInventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "lowThreshold" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_DrinkInventoryItem" ("createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt") SELECT "createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt" FROM "DrinkInventoryItem";
DROP TABLE "DrinkInventoryItem";
ALTER TABLE "new_DrinkInventoryItem" RENAME TO "DrinkInventoryItem";
CREATE TABLE "new_FrozenInventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "lowThreshold" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_FrozenInventoryItem" ("createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt") SELECT "createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt" FROM "FrozenInventoryItem";
DROP TABLE "FrozenInventoryItem";
ALTER TABLE "new_FrozenInventoryItem" RENAME TO "FrozenInventoryItem";
CREATE TABLE "new_PackagingInventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "lowThreshold" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PackagingInventoryItem" ("createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt") SELECT "createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt" FROM "PackagingInventoryItem";
DROP TABLE "PackagingInventoryItem";
ALTER TABLE "new_PackagingInventoryItem" RENAME TO "PackagingInventoryItem";
CREATE TABLE "new_VegeInventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "lowThreshold" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VegeInventoryItem" ("createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt") SELECT "createdAt", "id", "name", "notes", "quantity", "unit", "updatedAt" FROM "VegeInventoryItem";
DROP TABLE "VegeInventoryItem";
ALTER TABLE "new_VegeInventoryItem" RENAME TO "VegeInventoryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
