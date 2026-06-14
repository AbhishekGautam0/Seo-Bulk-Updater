-- CreateTable
CREATE TABLE "SEOImportHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "importData" JSONB
);

-- CreateTable
CREATE TABLE "SEOUpdateResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "handle" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
