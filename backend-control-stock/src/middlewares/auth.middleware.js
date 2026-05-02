const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { jwtSecret } = require('../config/env');

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'No autorizado. Token faltante.' });
    }

    const payload = jwt.verify(token, jwtSecret);
    const users = await prisma.$queryRaw`
      SELECT "id", "name", "email", "role"::text AS "role", "createdAt"
      FROM "User"
      WHERE "id" = ${payload.userId}
      LIMIT 1
    `;
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado para este token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalido o vencido.' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Solo un administrador puede realizar esta accion.' });
  }

  return next();
}

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;
