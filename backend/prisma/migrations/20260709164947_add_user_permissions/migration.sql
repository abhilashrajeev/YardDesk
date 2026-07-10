-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('SALES', 'PURCHASES', 'PAYMENTS', 'STOCK', 'EXPENSES');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[];
