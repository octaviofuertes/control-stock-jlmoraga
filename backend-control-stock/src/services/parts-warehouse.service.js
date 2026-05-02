const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { normalizeText, requireFields } = require('../utils/helpers');

const DEFAULT_OIL_KEY = 'main';

async function ensureOilStock() {
  const existing = await prisma.oilStock.findUnique({ where: { key: DEFAULT_OIL_KEY } });
  if (existing) {
    return existing;
  }

  return prisma.oilStock.create({
    data: {
      key: DEFAULT_OIL_KEY,
      capacityLiters: 1000,
      currentLiters: 1000,
    },
  });
}

async function getWarehouseState() {
  const [oil, items] = await Promise.all([
    ensureOilStock(),
    prisma.spareItem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  return { oil, items };
}

async function createSpareItem(payload) {
  requireFields(payload, ['name', 'category']);
  const name = normalizeText(payload.name);
  const category = normalizeText(payload.category).toUpperCase();
  const stock = Number(payload.stock ?? 0);

  if (!['FOCOS', 'FERRETERIA'].includes(category)) {
    throw new AppError('La categoria del repuesto no es valida.');
  }

  if (!Number.isFinite(stock) || stock < 0) {
    throw new AppError('El stock inicial debe ser cero o mayor.');
  }

  return prisma.spareItem.create({
    data: {
      name,
      category,
      stock: Math.floor(stock),
    },
  });
}

async function updateSpareItemStock(id, payload) {
  const item = await prisma.spareItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError('Repuesto no encontrado.', 404);
  }

  const delta = Number(payload.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AppError('Debes indicar un cambio de stock valido.');
  }

  const nextStock = item.stock + Math.trunc(delta);
  if (nextStock < 0) {
    throw new AppError('No puedes dejar el stock del repuesto en negativo.');
  }

  return prisma.spareItem.update({
    where: { id },
    data: { stock: nextStock },
  });
}

async function deleteSpareItem(id) {
  const item = await prisma.spareItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError('Repuesto no encontrado.', 404);
  }

  await prisma.spareItem.delete({ where: { id } });
}

async function updateOilStock(payload) {
  const oil = await ensureOilStock();
  const liters = Number(payload.liters);
  const action = normalizeText(payload.action).toLowerCase();

  if (!Number.isFinite(liters) || liters <= 0) {
    throw new AppError('Debes indicar una cantidad valida de litros.');
  }

  const roundedLiters = Math.trunc(liters);
  let currentLiters = oil.currentLiters;

  if (action === 'add') {
    currentLiters = Math.min(oil.capacityLiters, oil.currentLiters + roundedLiters);
  } else if (action === 'consume') {
    if (roundedLiters > oil.currentLiters) {
      throw new AppError('No puedes descontar mas aceite del disponible.');
    }

    currentLiters = oil.currentLiters - roundedLiters;
  } else {
    throw new AppError('La accion sobre el barril no es valida.');
  }

  return prisma.oilStock.update({
    where: { id: oil.id },
    data: { currentLiters },
  });
}

module.exports = {
  getWarehouseState,
  createSpareItem,
  updateSpareItemStock,
  deleteSpareItem,
  updateOilStock,
};
