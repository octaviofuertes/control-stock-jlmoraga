const prisma = require('../config/prisma');
const { LOCATION_TYPE, TIRE_STATE } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { sanitizeNullable } = require('../utils/helpers');
const { buildCurrentLocationData, buildLocationReference } = require('./tire.service');

function isGomeriaDepositName(name) {
  const normalized = (name || '').trim().toLowerCase();
  return normalized.includes('gomeria') || normalized.includes('gomerÃ­a');
}

function normalizeRepairType(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function validateRepairType(value) {
  if (![1, 2, 3].includes(value)) {
    throw new AppError('Debe indicar un tipo de reparacion valido (1, 2 o 3).');
  }
}

function getCurrentLocationReference(tire) {
  return {
    entity: tire.currentDeposit || tire.currentTractor || tire.currentSemi || null,
    depositId: tire.currentDepositId,
    tractorId: tire.currentTractorId,
    semiId: tire.currentSemiId,
    plate:
      tire.currentLocation === LOCATION_TYPE.TRACTOR
        ? tire.currentTractor?.plate || null
        : tire.currentLocation === LOCATION_TYPE.SEMI
          ? tire.currentSemi?.plate || null
          : null,
  };
}

function resolveNextState(tire, nextLocationReference, options = {}) {
  const selectedRepairType = normalizeRepairType(options.repairType);
  const currentDepositName = tire.currentDeposit?.name || '';
  const nextDepositName = nextLocationReference.depositId ? nextLocationReference.entity?.name || '' : '';
  const touchesGomeria = isGomeriaDepositName(currentDepositName) || isGomeriaDepositName(nextDepositName);
  const startsFromDeposit = tire.currentLocation === LOCATION_TYPE.DEPOSIT;

  if (options.markAsBaja || tire.state === TIRE_STATE.BAJA) {
    return {
      state: TIRE_STATE.BAJA,
      repairType: null,
    };
  }

  if (touchesGomeria) {
    const nextRepairType = isGomeriaDepositName(nextDepositName) ? selectedRepairType : tire.repairType;
    validateRepairType(nextRepairType);

    return {
      state: TIRE_STATE.REPARADA,
      repairType: nextRepairType,
    };
  }

  if (tire.state === TIRE_STATE.NUEVA) {
    if (startsFromDeposit) {
      return {
        state: TIRE_STATE.NUEVA,
        repairType: null,
      };
    }

    return {
      state: TIRE_STATE.USADA,
      repairType: null,
    };
  }

  return {
    state: tire.state,
    repairType: tire.state === TIRE_STATE.REPARADA ? tire.repairType : null,
  };
}

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

async function listMovements() {
  const movements = await prisma.movement.findMany({
    include: {
      tire: {
        select: {
          id: true,
          code: true,
          brand: true,
          model: true,
          size: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return enrichMovementsWithDepositNames(movements);
}

async function createMovement(payload, userId) {
  const tire = await prisma.tire.findUnique({
    where: { id: payload.tireId },
    include: {
      currentDeposit: true,
      currentTractor: true,
      currentSemi: true,
    },
  });

  if (!tire) {
    throw new AppError('La goma que intenta mover no existe.', 404);
  }

  if (tire.state === TIRE_STATE.BAJA) {
    throw new AppError('No se pueden registrar movimientos para una goma dada de baja.');
  }

  const isMoveToBaja = payload.newLocation === TIRE_STATE.BAJA;
  if (!isMoveToBaja && !Object.values(LOCATION_TYPE).includes(payload.newLocation)) {
    throw new AppError('La nueva ubicacion es invalida.');
  }

  const nextLocationReference = isMoveToBaja
    ? { entity: null, depositId: null, tractorId: null, semiId: null, plate: null }
    : await buildLocationReference(payload.newLocation, payload);
  const targetLocation = isMoveToBaja ? LOCATION_TYPE.DEPOSIT : payload.newLocation;
  const nextStateData = resolveNextState(tire, nextLocationReference, {
    markAsBaja: isMoveToBaja,
    repairType: payload.repairType,
  });

  const isSamePlace =
    tire.currentLocation === targetLocation &&
    tire.currentDepositId === nextLocationReference.depositId &&
    tire.currentTractorId === nextLocationReference.tractorId &&
    tire.currentSemiId === nextLocationReference.semiId;

  const isSameState =
    tire.state === nextStateData.state &&
    (tire.repairType || null) === (nextStateData.repairType || null);

  if (isSamePlace && isSameState) {
    throw new AppError('La goma ya se encuentra en esa ubicacion.');
  }

  const previousPlate =
    tire.currentLocation === LOCATION_TYPE.TRACTOR
      ? tire.currentTractor?.plate
      : tire.currentLocation === LOCATION_TYPE.SEMI
        ? tire.currentSemi?.plate
        : null;

  return prisma.$transaction(async (tx) => {
    const movement = await tx.movement.create({
      data: {
        tireId: tire.id,
        userId,
        previousLocation: tire.currentLocation,
        newLocation: targetLocation,
        previousState: tire.state,
        newState: nextStateData.state,
        previousRepairType: tire.repairType,
        newRepairType: nextStateData.repairType,
        previousDepositId: tire.currentDepositId,
        previousTractorId: tire.currentTractorId,
        previousSemiId: tire.currentSemiId,
        newDepositId: nextLocationReference.depositId,
        newTractorId: nextLocationReference.tractorId,
        newSemiId: nextLocationReference.semiId,
        previousPlate,
        newPlate: nextLocationReference.plate,
        notes: sanitizeNullable(payload.notes),
      },
      include: {
        tire: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await tx.tire.update({
      where: { id: tire.id },
      data: {
        ...buildCurrentLocationData(targetLocation, nextLocationReference),
        state: nextStateData.state,
        repairType: nextStateData.repairType,
      },
    });

    return movement;
  });
}

module.exports = {
  listMovements,
  createMovement,
};
