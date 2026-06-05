import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Config sistema (singleton)
  await prisma.configSistema.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  // Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@tramitesdiamante.mx';
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'Diamante123!';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPass, 12),
      name: 'Administrador',
      role: Role.ADMIN,
      status: UserStatus.APROBADO,
    },
  });

  // Proveedor
  const provEmail = process.env.SEED_PROVEEDOR_EMAIL ?? 'proveedor@tramitesdiamante.mx';
  const provPass = process.env.SEED_PROVEEDOR_PASSWORD ?? 'Proveedor123!';
  await prisma.user.upsert({
    where: { email: provEmail },
    update: {},
    create: {
      email: provEmail,
      passwordHash: await bcrypt.hash(provPass, 12),
      name: 'Proveedor / Operador',
      role: Role.PROVEEDOR,
      status: UserStatus.APROBADO,
    },
  });

  // Cliente demo (aprobado, con creditos)
  const demoEmail = 'demo@papeleria.mx';
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash: await bcrypt.hash('Cliente123!', 12),
      name: 'Papeleria Demo',
      role: Role.CLIENTE,
      status: UserStatus.APROBADO,
    },
  });
  await prisma.cliente.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      razonSocial: 'Papeleria Demo S.A. de C.V.',
      rfc: 'XAXX010101000',
      telefono: '5555555555',
      creditos: 500,
    },
  });

  console.log('Seed completado.');
  console.log(`  Admin:     ${adminEmail} / ${adminPass}`);
  console.log(`  Proveedor: ${provEmail} / ${provPass}`);
  console.log(`  Cliente:   ${demoEmail} / Cliente123!  (500 creditos)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
