const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { normalizeText, requireFields } = require('../utils/helpers');

const DEFAULT_OIL_KEY = 'main';
const LATEST_MOVEMENTS_SAMPLE = 50;
// Clics seguidos de la misma persona con menos de este intervalo se muestran como un solo movimiento.
const MOVEMENT_GROUP_GAP_MS = 10 * 60 * 1000;

const latestMovementsInclude = {
  movements: {
    take: LATEST_MOVEMENTS_SAMPLE,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  },
};

// Agrupa los ultimos movimientos consecutivos del mismo usuario y la misma accion (ordenados desc).
function summarizeLatestMovement(movements) {
  if (!movements.length) {
    return null;
  }

  const [latest] = movements;
  let quantity = 0;
  let previousTime = new Date(latest.createdAt).getTime();

  for (const movement of movements) {
    const movementTime = new Date(movement.createdAt).getTime();
    const sameRun = movement.userId === latest.userId && movement.action === latest.action;
    if (!sameRun || previousTime - movementTime > MOVEMENT_GROUP_GAP_MS) {
      break;
    }

    quantity += movement.quantity;
    previousTime = movementTime;
  }

  return {
    id: latest.id,
    action: latest.action,
    quantity,
    resultingStock: latest.resultingStock,
    createdAt: latest.createdAt,
    userName: latest.user.name,
  };
}

function serializeSpareItem(item) {
  const { movements, ...rest } = item;
  return {
    ...rest,
    latestMovement: summarizeLatestMovement(movements || []),
  };
}

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
      include: latestMovementsInclude,
    }),
  ]);

  return {
    oil,
    items: items.map(serializeSpareItem),
  };
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

async function updateSpareItemStock(id, payload, user) {
  const delta = Math.trunc(Number(payload.delta));
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AppError('Debes indicar un cambio de stock valido.');
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.spareItem.findUnique({ where: { id } });
    if (!item) {
      throw new AppError('Repuesto no encontrado.', 404);
    }

    // Descuento condicional para que dos usuarios a la vez no dejen el stock en negativo.
    const { count } = await tx.spareItem.updateMany({
      where: delta < 0 ? { id, stock: { gte: -delta } } : { id },
      data: { stock: { increment: delta } },
    });
    if (!count) {
      throw new AppError('No puedes dejar el stock del repuesto en negativo.');
    }

    const updatedItem = await tx.spareItem.findUnique({ where: { id } });

    await tx.spareItemMovement.create({
      data: {
        spareItemId: item.id,
        userId: user.id,
        action: delta > 0 ? 'ADD' : 'REMOVE',
        quantity: Math.abs(delta),
        resultingStock: updatedItem.stock,
      },
    });

    const withMovements = await tx.spareItem.findUnique({
      where: { id },
      include: latestMovementsInclude,
    });

    return serializeSpareItem(withMovements);
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
  summarizeLatestMovement,
};
