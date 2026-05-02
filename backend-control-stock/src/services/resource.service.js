const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { normalizeText, requireFields, sanitizeNullable } = require('../utils/helpers');

async function listDeposits() {
  return prisma.deposit.findMany({ orderBy: { name: 'asc' } });
}

async function createDeposit(payload) {
  requireFields(payload, ['name']);
  return prisma.deposit.create({
    data: {
      name: normalizeText(payload.name),
      description: sanitizeNullable(payload.description),
    },
  });
}

async function updateDeposit(id, payload) {
  const deposit = await prisma.deposit.findUnique({ where: { id } });
  if (!deposit) {
    throw new AppError('Deposito no encontrado.', 404);
  }

  const data = {};
  if (payload.name !== undefined) data.name = normalizeText(payload.name);
  if (payload.description !== undefined) data.description = sanitizeNullable(payload.description);
  return prisma.deposit.update({ where: { id }, data });
}

async function deleteDeposit(id) {
  const deposit = await prisma.deposit.findUnique({ where: { id } });
  if (!deposit) {
    throw new AppError('Deposito no encontrado.', 404);
  }

  const tiresCount = await prisma.tire.count({ where: { currentDepositId: id } });
  if (tiresCount > 0) {
    throw new AppError('No se puede eliminar un deposito con gomas asignadas.');
  }

  const movementsCount = await prisma.movement.count({
    where: {
      OR: [{ previousDepositId: id }, { newDepositId: id }],
    },
  });
  if (movementsCount > 0) {
    throw new AppError('No se puede eliminar el deposito porque aparece en un movimiento del historial.');
  }

  return prisma.deposit.delete({ where: { id } });
}

function normalizeVehiclePayload(payload) {
  requireFields(payload, ['plate']);
  return {
    plate: normalizeText(payload.plate).toUpperCase(),
    brand: sanitizeNullable(payload.brand),
    model: sanitizeNullable(payload.model),
    description: sanitizeNullable(payload.description),
  };
}

async function listTractors() {
  return prisma.tractor.findMany({ orderBy: { plate: 'asc' } });
}

async function createTractor(payload) {
  return prisma.tractor.create({ data: normalizeVehiclePayload(payload) });
}

async function updateTractor(id, payload) {
  const tractor = await prisma.tractor.findUnique({ where: { id } });
  if (!tractor) {
    throw new AppError('Tractor no encontrado.', 404);
  }

  const data = {};
  if (payload.plate !== undefined) data.plate = normalizeText(payload.plate).toUpperCase();
  if (payload.brand !== undefined) data.brand = sanitizeNullable(payload.brand);
  if (payload.model !== undefined) data.model = sanitizeNullable(payload.model);
  if (payload.description !== undefined) data.description = sanitizeNullable(payload.description);
  return prisma.tractor.update({ where: { id }, data });
}

async function deleteTractor(id) {
  const tractor = await prisma.tractor.findUnique({ where: { id } });
  if (!tractor) {
    throw new AppError('Tractor no encontrado.', 404);
  }

  const tiresCount = await prisma.tire.count({ where: { currentTractorId: id } });
  if (tiresCount > 0) {
    throw new AppError('No se puede eliminar un tractor con gomas asignadas.');
  }

  const movementsCount = await prisma.movement.count({
    where: {
      OR: [{ previousTractorId: id }, { newTractorId: id }],
    },
  });
  if (movementsCount > 0) {
    throw new AppError('No se puede eliminar el tractor porque aparece en un movimiento del historial.');
  }

  return prisma.tractor.delete({ where: { id } });
}

async function listSemis() {
  return prisma.semi.findMany({ orderBy: { plate: 'asc' } });
}

async function createSemi(payload) {
  return prisma.semi.create({ data: normalizeVehiclePayload(payload) });
}

async function updateSemi(id, payload) {
  const semi = await prisma.semi.findUnique({ where: { id } });
  if (!semi) {
    throw new AppError('Semi no encontrado.', 404);
  }

  const data = {};
  if (payload.plate !== undefined) data.plate = normalizeText(payload.plate).toUpperCase();
  if (payload.brand !== undefined) data.brand = sanitizeNullable(payload.brand);
  if (payload.model !== undefined) data.model = sanitizeNullable(payload.model);
  if (payload.description !== undefined) data.description = sanitizeNullable(payload.description);
  return prisma.semi.update({ where: { id }, data });
}

async function deleteSemi(id) {
  const semi = await prisma.semi.findUnique({ where: { id } });
  if (!semi) {
    throw new AppError('Semi no encontrado.', 404);
  }

  const tiresCount = await prisma.tire.count({ where: { currentSemiId: id } });
  if (tiresCount > 0) {
    throw new AppError('No se puede eliminar un semi con gomas asignadas.');
  }

  const movementsCount = await prisma.movement.count({
    where: {
      OR: [{ previousSemiId: id }, { newSemiId: id }],
    },
  });
  if (movementsCount > 0) {
    throw new AppError('No se puede eliminar el semi porque aparece en un movimiento del historial.');
  }

  return prisma.semi.delete({ where: { id } });
}

module.exports = {
  listDeposits,
  createDeposit,
  updateDeposit,
  deleteDeposit,
  listTractors,
  createTractor,
  updateTractor,
  deleteTractor,
  listSemis,
  createSemi,
  updateSemi,
  deleteSemi,
};
