-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "costPerUnit" DECIMAL(12,2) NOT NULL,
    "status" "TxnStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionInput" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ProductionInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Production_materialId_idx" ON "Production"("materialId");

-- CreateIndex
CREATE INDEX "Production_date_idx" ON "Production"("date");

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
