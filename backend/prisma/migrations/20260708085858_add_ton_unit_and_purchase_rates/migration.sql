-- AlterEnum
ALTER TYPE "Unit" ADD VALUE 'TON';

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "purchaseRate" DECIMAL(12,2),
ADD COLUMN     "purchaseRateTon" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "unit" "Unit";
