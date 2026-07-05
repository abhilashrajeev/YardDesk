-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('CFT', 'BAG', 'NOS');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'BANK', 'CREDIT');

-- CreateEnum
CREATE TYPE "TxnStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAYMENT_REMINDER', 'LOW_STOCK', 'GENERAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unit" "Unit" NOT NULL,
    "currentStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "defaultRate" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT,
    "invoiceNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "freight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "TxnStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT,
    "billNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "freight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "status" "TxnStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatePass" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT,
    "passNo" TEXT,
    "saleId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gateOutAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "GatePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadingPass" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT,
    "passNo" TEXT,
    "saleId" TEXT NOT NULL,
    "loadedById" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "LoadingPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "PaymentDirection" NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "partyType" "PartyType" NOT NULL,
    "customerId" TEXT,
    "vendorId" TEXT,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partyType" "PartyType" NOT NULL,
    "customerId" TEXT,
    "vendorId" TEXT,
    "description" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "materialId" TEXT NOT NULL,
    "direction" "StockDirection" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "balance" DECIMAL(14,3) NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClose" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "materialId" TEXT NOT NULL,
    "opening" DECIMAL(14,3) NOT NULL,
    "totalIn" DECIMAL(14,3) NOT NULL,
    "totalOut" DECIMAL(14,3) NOT NULL,
    "closing" DECIMAL(14,3) NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_number_key" ON "Vehicle"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_clientUuid_key" ON "Purchase"("clientUuid");

-- CreateIndex
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");

-- CreateIndex
CREATE INDEX "Purchase_vendorId_idx" ON "Purchase"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_clientUuid_key" ON "Sale"("clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_billNo_key" ON "Sale"("billNo");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "GatePass_clientUuid_key" ON "GatePass"("clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "GatePass_passNo_key" ON "GatePass"("passNo");

-- CreateIndex
CREATE UNIQUE INDEX "GatePass_saleId_key" ON "GatePass"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "LoadingPass_clientUuid_key" ON "LoadingPass"("clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "LoadingPass_passNo_key" ON "LoadingPass"("passNo");

-- CreateIndex
CREATE UNIQUE INDEX "LoadingPass_saleId_key" ON "LoadingPass"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_clientUuid_key" ON "Payment"("clientUuid");

-- CreateIndex
CREATE INDEX "Payment_date_idx" ON "Payment"("date");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_vendorId_idx" ON "Payment"("vendorId");

-- CreateIndex
CREATE INDEX "LedgerEntry_customerId_idx" ON "LedgerEntry"("customerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_vendorId_idx" ON "LedgerEntry"("vendorId");

-- CreateIndex
CREATE INDEX "LedgerEntry_date_idx" ON "LedgerEntry"("date");

-- CreateIndex
CREATE INDEX "StockMovement_materialId_idx" ON "StockMovement"("materialId");

-- CreateIndex
CREATE INDEX "StockMovement_date_idx" ON "StockMovement"("date");

-- CreateIndex
CREATE INDEX "DayClose_businessDate_idx" ON "DayClose"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DayClose_businessDate_materialId_key" ON "DayClose"("businessDate", "materialId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadingPass" ADD CONSTRAINT "LoadingPass_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadingPass" ADD CONSTRAINT "LoadingPass_loadedById_fkey" FOREIGN KEY ("loadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClose" ADD CONSTRAINT "DayClose_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClose" ADD CONSTRAINT "DayClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
