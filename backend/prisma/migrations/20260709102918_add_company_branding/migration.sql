-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'My Company',
    "tagline" TEXT,
    "logoInitial" TEXT NOT NULL DEFAULT 'Y',
    "accentColor" TEXT NOT NULL DEFAULT '#d85a30',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
