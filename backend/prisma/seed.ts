// Seeds the initial super admin and the fixed material catalog.
// Run with: npm run db:seed
import { PrismaClient, Role, Unit } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const MATERIALS: { name: string; unit: Unit }[] = [
  { name: 'M-sand', unit: Unit.CFT },
  { name: 'P-sand', unit: Unit.CFT },
  { name: '20mm metal', unit: Unit.CFT },
  { name: '40mm metal', unit: Unit.CFT },
  { name: '12mm metal', unit: Unit.CFT },
  { name: '6mm metal', unit: Unit.CFT },
  { name: 'GSP', unit: Unit.CFT },
  { name: 'Dust', unit: Unit.CFT },
  { name: 'Cement', unit: Unit.BAG },
  { name: 'Bricks', unit: Unit.NOS },
];

async function main() {
  // Super admin
  const phone = process.env.SEED_ADMIN_PHONE ?? '9999999999';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { phone },
    update: {},
    create: {
      name: process.env.SEED_ADMIN_NAME ?? 'Owner',
      phone,
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`Super admin ready (phone: ${phone})`);

  // Materials
  for (const m of MATERIALS) {
    await prisma.material.upsert({
      where: { name: m.name },
      update: { unit: m.unit },
      create: { name: m.name, unit: m.unit },
    });
  }
  console.log(`Seeded ${MATERIALS.length} materials`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
