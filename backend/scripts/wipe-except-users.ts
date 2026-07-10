/**
 * One-time reset: clears all business data but leaves the User table untouched.
 * Run once before go-live testing with real data.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function counts() {
  const [
    users, materials, customers, vendors, vehicles, purchases, purchaseItems,
    sales, saleItems, gatePasses, loadingPasses, payments, ledgerEntries,
    stockMovements, dayCloses, expenses, auditLogs, notifications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.material.count(),
    prisma.customer.count(),
    prisma.vendor.count(),
    prisma.vehicle.count(),
    prisma.purchase.count(),
    prisma.purchaseItem.count(),
    prisma.sale.count(),
    prisma.saleItem.count(),
    prisma.gatePass.count(),
    prisma.loadingPass.count(),
    prisma.payment.count(),
    prisma.ledgerEntry.count(),
    prisma.stockMovement.count(),
    prisma.dayClose.count(),
    prisma.expense.count(),
    prisma.auditLog.count(),
    prisma.notification.count(),
  ]);
  return {
    users, materials, customers, vendors, vehicles, purchases, purchaseItems,
    sales, saleItems, gatePasses, loadingPasses, payments, ledgerEntries,
    stockMovements, dayCloses, expenses, auditLogs, notifications,
  };
}

async function main() {
  console.log('--- Before ---');
  console.log(await counts());

  if (process.env.CONFIRM_WIPE !== 'yes') {
    console.log('\nDry run only — no rows deleted. Re-run with CONFIRM_WIPE=yes to actually wipe.');
    return;
  }

  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.gatePass.deleteMany(),
    prisma.loadingPass.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.purchase.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.dayClose.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.material.deleteMany(),
  ]);

  console.log('--- After ---');
  console.log(await counts());
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
