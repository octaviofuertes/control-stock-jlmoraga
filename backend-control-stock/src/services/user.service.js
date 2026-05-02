const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { normalizeText, requireFields } = require('../utils/helpers');

async function listUsers() {
  return prisma.$queryRaw`
    SELECT "id", "name", "email", "role"::text AS "role", "createdAt"
    FROM "User"
    ORDER BY "createdAt" ASC
  `;
}

async function createUser(payload) {
  requireFields(payload, ['name', 'email', 'password']);

  const email = normalizeText(payload.email).toLowerCase();
  const role = payload.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR';
  const password = String(payload.password || '');

  if (password.length < 6) {
    throw new AppError('La contrasena debe tener al menos 6 caracteres.');
  }

  const existingUsers = await prisma.$queryRaw`
    SELECT "id"
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;
  const existingUser = existingUsers[0];
  if (existingUser) {
    throw new AppError('Ya existe un usuario registrado con ese email.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const createdUsers = await prisma.$queryRaw`
    INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${normalizeText(payload.name)}, ${email}, ${passwordHash}, CAST(${role} AS "UserRole"), NOW(), NOW())
    RETURNING "id", "name", "email", "role"::text AS "role", "createdAt"
  `;

  return createdUsers[0];
}

module.exports = {
  listUsers,
  createUser,
};
