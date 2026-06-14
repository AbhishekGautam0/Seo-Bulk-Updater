-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" REAL NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "showOnStorefront" BOOLEAN NOT NULL DEFAULT true,
    "minSubtotal" REAL NOT NULL DEFAULT 0,
    "requiredProductId" TEXT,
    "requiredProductTitle" TEXT,
    "requiredProductHandle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
