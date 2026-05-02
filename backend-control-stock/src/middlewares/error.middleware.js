const { Prisma } = require('@prisma/client');
const { AppError } = require('../utils/errors');

function errorMiddleware(error, _req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Ya existe un registro con ese valor unico.' });
    }
  }

  console.error(error);
  return res.status(500).json({ message: 'Ocurrio un error interno en el servidor.' });
}

module.exports = errorMiddleware;
