const prisma = require('../config/prisma');
const { LOCATION_TYPE, TIRE_STATE } = require('../utils/constants');

const GOMERIA_FILTER = {
  OR: [
    { name: { contains: 'gomeria', mode: 'insensitive' } },
    { name: { contains: 'gomerÃ­a', mode: 'insensitive' } },
  ],
};

const AUXILIO_FILTER = {
  name: { contains: 'auxilio', mode: 'insensitive' },
};

async function enrichMovementsWithDepositNames(movements) {
  const depositIds = [...new Set(movements.flatMap((movement) => [movement.previousDepositId, movement.newDepositId]).filter(Boolean))];

  if (!depositIds.length) {
    return movements;
  }

  const deposits = await prisma.deposit.findMany({
    where: { id: { in: depositIds } },
    select: { id: true, name: true },
  });

  const depositMap = new Map(deposits.map((deposit) => [deposit.id, deposit.name]));

  return movements.map((movement) => ({
    ...movement,
    previousDepositName: movement.previousDepositId ? depositMap.get(movement.previousDepositId) || null : null,
    newDepositName: movement.newDepositId ? depositMap.get(movement.newDepositId) || null : null,
  }));
}

async function getDashboardSummary() {
  const [totalTires, tiresInDeposit, tiresInSemis, tiresInTractors, tiresInGomeria, tiresInAuxilio, recentMovementsRaw] = await Promise.all([
    prisma.tire.count({ where: { state: { not: TIRE_STATE.BAJA } } }),
    prisma.tire.count({
      where: {
        state: { not: TIRE_STATE.BAJA },
        currentLocation: LOCATION_TYPE.DEPOSIT,
        NOT: {
          OR: [{ currentDeposit: GOMERIA_FILTER }, { currentDeposit: AUXILIO_FILTER }],
        },
      },
    }),
    prisma.tire.count({ where: { currentLocation: LOCATION_TYPE.SEMI, state: { not: TIRE_STATE.BAJA } } }),
    prisma.tire.count({ where: { currentLocation: LOCATION_TYPE.TRACTOR, state: { not: TIRE_STATE.BAJA } } }),
    prisma.tire.count({
      where: {
        state: { not: TIRE_STATE.BAJA },
        currentLocation: LOCATION_TYPE.DEPOSIT,
        currentDeposit: GOMERIA_FILTER,
      },
    }),
    prisma.tire.count({
      where: {
        state: { not: TIRE_STATE.BAJA },
        currentLocation: LOCATION_TYPE.DEPOSIT,
        currentDeposit: AUXILIO_FILTER,
      },
    }),
    prisma.movement.findMany({
      take: 8,
      include: {
        tire: {
          select: { id: true, code: true, brand: true, model: true, size: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const recentMovements = await enrichMovementsWithDepositNames(recentMovementsRaw);

  return {
    totalTires,
    tiresInDeposit,
    tiresInSemis,
    tiresInTractors,
    tiresInGomeria,
    tiresInAuxilio,
    recentMovements,
  };
}

module.exports = {
  getDashboardSummary,
};
