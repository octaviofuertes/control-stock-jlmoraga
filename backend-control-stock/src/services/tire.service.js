const prisma = require('../config/prisma');
const { LOCATION_TYPE, TIRE_STATE } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { normalizeText, requireFields, sanitizeNullable } = require('../utils/helpers');

const tireInclude = {
  currentDeposit: true,
  currentTractor: true,
  currentSemi: true,
};

function getReadableLocation(tire) {
  if (tire.state === TIRE_STATE.BAJA) {
    return {
      type: 'DISCARDED',
      label: 'Descartada',
      plate: null,
    };
  }

  if (tire.currentLocation === LOCATION_TYPE.DEPOSIT) {
    return {
      type: LOCATION_TYPE.DEPOSIT,
      label: tire.currentDeposit?.name || 'Deposito',
      plate: null,
    };
  }

  if (tire.currentLocation === LOCATION_TYPE.TRACTOR) {
    return {
      type: LOCATION_TYPE.TRACTOR,
      label: tire.currentTractor?.plate || 'Tractor',
      plate: tire.currentTractor?.plate || null,
    };
  }

  return {
    type: LOCATION_TYPE.SEMI,
    label: tire.currentSemi?.plate || 'Semi',
    plate: tire.currentSemi?.plate || null,
  };
}

function validateState(state) {
  if (!Object.values(TIRE_STATE).includes(state)) {
    throw new AppError('Estado de goma invalido.');
  }
}

function normalizeRepairType(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function validateRepairType(state, repairType) {
  if (state === TIRE_STATE.REPARADA) {
    if (![1, 2, 3].includes(repairType)) {
      throw new AppError('Debe indicar un tipo de reparacion valido (1, 2 o 3).');
    }
    return;
  }

  if (repairType !== null) {
    throw new AppError('El tipo de reparacion solo puede informarse para gomas reparadas.');
  }
}

async function generateNextTireCode(tx = prisma) {
  const result = await tx.$queryRaw`
    SELECT COALESCE(MAX(CAST("code" AS INTEGER)), 0) AS "maxCode"
    FROM "Tire"
    WHERE "code" ~ '^[0-9]+$'
  `;

  const maxCode = Number(result[0]?.maxCode || 0);
  return String(maxCode + 1);
}

async function buildLocationReference(locationType, refs) {
  if (locationType === LOCATION_TYPE.DEPOSIT) {
    if (!refs.depositId) {
      throw new AppError('Debe indicar un deposito de destino.');
    }
    const deposit = await prisma.deposit.findUnique({ where: { id: refs.depositId } });
    if (!deposit) {
      throw new AppError('Deposito no encontrado.', 404);
    }
    return { entity: deposit, depositId: deposit.id, tractorId: null, semiId: null, plate: null };
  }

  if (locationType === LOCATION_TYPE.TRACTOR) {
    if (!refs.tractorId) {
      throw new AppError('Debe indicar un tractor de destino.');
    }
    const tractor = await prisma.tractor.findUnique({ where: { id: refs.tractorId } });
    if (!tractor || !tractor.plate) {
      throw new AppError('Tractor invalido o sin patente.', 404);
    }
    return { entity: tractor, depositId: null, tractorId: tractor.id, semiId: null, plate: tractor.plate };
  }

  if (locationType === LOCATION_TYPE.SEMI) {
    if (!refs.semiId) {
      throw new AppError('Debe indicar un semi de destino.');
    }
    const semi = await prisma.semi.findUnique({ where: { id: refs.semiId } });
    if (!semi || !semi.plate) {
      throw new AppError('Semi invalido o sin patente.', 404);
    }
    return { entity: semi, depositId: null, tractorId: null, semiId: semi.id, plate: semi.plate };
  }

  throw new AppError('Tipo de ubicacion invalido.');
}

function buildCurrentLocationData(locationType, reference) {
  return {
    currentLocation: locationType,
    currentDepositId: reference.depositId,
    currentTractorId: reference.tractorId,
    currentSemiId: reference.semiId,
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

async function listTires(filters = {}) {
  const where = {};

  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: 'insensitive' } },
      { brand: { contains: filters.search, mode: 'insensitive' } },
      { model: { contains: filters.search, mode: 'insensitive' } },
      { size: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.state) where.state = filters.state;
  if (filters.locationType) where.currentLocation = filters.locationType;

  const tires = await prisma.tire.findMany({
    where,
    include: tireInclude,
    orderBy: { createdAt: 'desc' },
  });

  return tires.map((tire) => ({ ...tire, locationDetail: getReadableLocation(tire) }));
}

async function getTireById(id) {
  const tire = await prisma.tire.findUnique({ where: { id }, include: tireInclude });
  if (!tire) {
    throw new AppError('Goma no encontrada.', 404);
  }
  return { ...tire, locationDetail: getReadableLocation(tire) };
}

async function createTire(payload) {
  requireFields(payload, ['brand', 'model', 'size', 'state']);
  validateState(payload.state);
  const repairType = normalizeRepairType(payload.repairType);
  validateRepairType(payload.state, repairType);

  const locationType = payload.state === TIRE_STATE.BAJA ? LOCATION_TYPE.DEPOSIT : payload.currentLocation;
  if (payload.state !== TIRE_STATE.BAJA) {
    requireFields(payload, ['currentLocation']);
  }
  const locationReference =
    payload.state === TIRE_STATE.BAJA
      ? { entity: null, depositId: null, tractorId: null, semiId: null, plate: null }
      : await buildLocationReference(payload.currentLocation, payload);
  const tire = await prisma.$transaction(async (tx) => {
    const generatedCode = await generateNextTireCode(tx);

    return tx.tire.create({
      data: {
        code: generatedCode,
        brand: normalizeText(payload.brand),
        model: normalizeText(payload.model),
        size: normalizeText(payload.size),
        state: payload.state,
        repairType,
        notes: sanitizeNullable(payload.notes),
        ...buildCurrentLocationData(locationType, locationReference),
      },
      include: tireInclude,
    });
  });

  return { ...tire, locationDetail: getReadableLocation(tire) };
}

async function updateTire(id, payload) {
  const existingTire = await prisma.tire.findUnique({ where: { id }, include: tireInclude });
  if (!existingTire) {
    throw new AppError('Goma no encontrada.', 404);
  }

  const data = {};

  if (payload.brand !== undefined) data.brand = normalizeText(payload.brand);
  if (payload.model !== undefined) data.model = normalizeText(payload.model);
  if (payload.size !== undefined) data.size = normalizeText(payload.size);
  if (payload.notes !== undefined) data.notes = sanitizeNullable(payload.notes);

  const nextState = payload.state !== undefined ? payload.state : existingTire.state;
  if (payload.state !== undefined) {
    validateState(payload.state);
    data.state = payload.state;
  }

  const nextRepairType = payload.repairType !== undefined ? normalizeRepairType(payload.repairType) : existingTire.repairType;
  validateRepairType(nextState, nextState === TIRE_STATE.REPARADA ? nextRepairType : null);

  if (payload.repairType !== undefined || nextState !== existingTire.state) {
    data.repairType = nextState === TIRE_STATE.REPARADA ? nextRepairType : null;
  }

  if (nextState === TIRE_STATE.BAJA) {
    data.currentLocation = LOCATION_TYPE.DEPOSIT;
    data.currentDepositId = null;
    data.currentTractorId = null;
    data.currentSemiId = null;
  }

  const tire = await prisma.tire.update({
    where: { id },
    data,
    include: tireInclude,
  });

  return { ...tire, locationDetail: getReadableLocation(tire) };
}

async function deleteTire(id) {
  const tire = await prisma.tire.findUnique({ where: { id } });
  if (!tire) {
    throw new AppError('Goma no encontrada.', 404);
  }

  const movementsCount = await prisma.movement.count({ where: { tireId: id } });
  if (movementsCount > 0) {
    throw new AppError('No se puede eliminar la goma porque aparece en un movimiento del historial.');
  }

  await prisma.tire.delete({ where: { id } });
  return { message: 'Goma eliminada correctamente.' };
}

async function getTireHistory(id) {
  const tire = await prisma.tire.findUnique({ where: { id } });
  if (!tire) {
    throw new AppError('Goma no encontrada.', 404);
  }

  const movements = await prisma.movement.findMany({
    where: { tireId: id },
    include: {
      tire: {
        select: { id: true, code: true, brand: true, model: true, size: true },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return enrichMovementsWithDepositNames(movements);
}

module.exports = {
  listTires,
  getTireById,
  createTire,
  updateTire,
  deleteTire,
  getTireHistory,
  buildLocationReference,
  buildCurrentLocationData,
  getReadableLocation,
  generateNextTireCode,
};
