require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function upsertUser({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      passwordHash,
    },
    create: {
      name,
      email,
      role,
      passwordHash,
    },
  });
}

async function main() {
  const users = [
    { name: 'Octavio', email: 'octavio@jlmoraga.com', password: 'Octavio1234', role: 'ADMIN' },
    { name: 'Admin JLMoraga', email: 'admin@jlmoraga.com', password: 'Admin1234', role: 'ADMIN' },
    { name: 'Carlos Medina', email: 'cmedina@jlmoraga.com', password: 'Operador123', role: 'OPERATOR' },
    { name: 'Lucia Torres', email: 'ltorres@jlmoraga.com', password: 'Operador123', role: 'OPERATOR' },
  ];

  for (const user of users) {
    await upsertUser(user);
  }

  console.log('Usuarios iniciales creados o actualizados correctamente.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
