const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { jwtSecret } = require('../config/env');
const { AppError } = require('../utils/errors');
const { normalizeText, requireFields } = require('../utils/helpers');

function signToken(userId) {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: '1d' });
}

async function register(payload) {
  requireFields(payload, ['name', 'email', 'password']);

  const email = normalizeText(payload.email).toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw new AppError('Ya existe un usuario registrado con ese email.', 409);
  }

  const password = String(payload.password || '');
  if (password.length < 6) {
    throw new AppError('La contrasena debe tener al menos 6 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: normalizeText(payload.name),
      email,
      passwordHash,
      role: payload.role || 'OPERATOR',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return { user, token: signToken(user.id) };
}

async function login(payload) {
  requireFields(payload, ['email', 'password']);

  const email = normalizeText(payload.email).toLowerCase();
  const users = await prisma.$queryRaw`
    SELECT "id", "name", "email", "passwordHash", "role"::text AS "role", "createdAt"
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;
  const user = users[0];

  if (!user) {
    throw new AppError('Credenciales invalidas.', 401);
  }

  const isValid = await bcrypt.compare(String(payload.password), user.passwordHash);
  if (!isValid) {
    throw new AppError('Credenciales invalidas.', 401);
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token: signToken(user.id),
  };
}

module.exports = {
  login,
};
