const prisma = require('../config/prisma');
const { LOCATION_TYPE, TIRE_STATE } = require('../utils/constants');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RECOMMENDATIONS = 8;

function startOfWeek(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const daysFromMonday = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - daysFromMonday);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(start, end) {
  if (!start) {
    return 0;
  }

  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / MS_PER_DAY));
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function normalize(value) {
  return (value || '').trim().toLowerCase();
}

function isGomeriaDepositName(name) {
  return normalize(name).includes('gomer');
}

function isAuxilioDepositName(name) {
  return normalize(name).includes('auxilio');
}

function isSpecialDeposit(tire) {
  const name = tire.currentDeposit?.name || '';
  return isGomeriaDepositName(name) || isAuxilioDepositName(name);
}

function cleanBrand(brand) {
  return brand?.trim() || 'Sin marca';
}

function getLocationLabel(tire) {
  if (tire.state === TIRE_STATE.BAJA) {
    return 'Descartada';
  }

  if (tire.currentLocation === LOCATION_TYPE.DEPOSIT) {
    const name = tire.currentDeposit?.name || 'Deposito';
    if (isGomeriaDepositName(name)) {
      return 'Gomeria';
    }

    if (isAuxilioDepositName(name)) {
      return 'Auxilio';
    }

    return name;
  }

  if (tire.currentLocation === LOCATION_TYPE.TRACTOR) {
    return `Tractor ${tire.currentTractor?.plate || 'sin patente'}`;
  }

  return `Semi ${tire.currentSemi?.plate || 'sin patente'}`;
}

function tireSummary(tire) {
  return {
    id: tire.id,
    code: tire.code,
    brand: tire.brand,
    model: tire.model,
    size: tire.size,
    state: tire.state,
    repairType: tire.repairType,
    location: getLocationLabel(tire),
  };
}

function groupMovementsByTire(movements) {
  return movements.reduce((map, movement) => {
    const items = map.get(movement.tireId) || [];
    items.push(movement);
    map.set(movement.tireId, items);
    return map;
  }, new Map());
}

function matchesCurrentPlace(tire, movement) {
  if (movement.newLocation !== tire.currentLocation) {
    return false;
  }

  if (tire.currentLocation === LOCATION_TYPE.DEPOSIT) {
    return movement.newDepositId === tire.currentDepositId;
  }

  if (tire.currentLocation === LOCATION_TYPE.TRACTOR) {
    return movement.newTractorId === tire.currentTractorId;
  }

  return movement.newSemiId === tire.currentSemiId;
}

function findLastArrivalToCurrentPlace(tire, tireMovements) {
  for (let index = tireMovements.length - 1; index >= 0; index -= 1) {
    const movement = tireMovements[index];
    if (matchesCurrentPlace(tire, movement)) {
      return movement;
    }
  }

  return null;
}

function getConfidence(sampleCount, eventCount) {
  if (sampleCount >= 5 && eventCount >= 3) {
    return 'ALTA';
  }

  if (sampleCount >= 2 || eventCount >= 1) {
    return 'MEDIA';
  }

  return 'BAJA';
}

function buildBrandAnalytics(tires, movementsByTire, now) {
  const stats = new Map();

  for (const tire of tires) {
    const brand = cleanBrand(tire.brand);
    const existing =
      stats.get(brand) ||
      {
        brand,
        tireCount: 0,
        repairDurations: [],
        discardDurations: [],
        observedDurations: [],
        repairedCount: 0,
        discardedCount: 0,
        longestTire: null,
      };

    const tireMovements = movementsByTire.get(tire.id) || [];
    const firstRepair = tireMovements.find((movement) => movement.newState === TIRE_STATE.REPARADA);
    const firstDiscard = tireMovements.find((movement) => movement.newState === TIRE_STATE.BAJA);
    const observedUntil = firstDiscard?.createdAt || now;
    const observedDays = daysBetween(tire.createdAt, observedUntil);

    existing.tireCount += 1;
    existing.observedDurations.push(observedDays);

    if (firstRepair) {
      existing.repairedCount += 1;
      existing.repairDurations.push(daysBetween(tire.createdAt, firstRepair.createdAt));
    }

    if (firstDiscard) {
      existing.discardedCount += 1;
      existing.discardDurations.push(daysBetween(tire.createdAt, firstDiscard.createdAt));
    }

    if (!existing.longestTire || observedDays > existing.longestTire.days) {
      existing.longestTire = {
        code: tire.code,
        brand: tire.brand,
        model: tire.model,
        size: tire.size,
        days: observedDays,
        state: tire.state,
        location: getLocationLabel(tire),
      };
    }

    stats.set(brand, existing);
  }

  return Array.from(stats.values())
    .map((item) => {
      const averageDaysToRepair = average(item.repairDurations);
      const averageDaysToDiscard = average(item.discardDurations);
      const averageObservedDays = average(item.observedDurations);
      const eventCount = item.repairedCount + item.discardedCount;
      const confidence = getConfidence(item.tireCount, eventCount);
      const durabilityScore = averageDaysToDiscard || averageObservedDays || 0;

      return {
        brand: item.brand,
        tireCount: item.tireCount,
        repairedCount: item.repairedCount,
        discardedCount: item.discardedCount,
        averageDaysToRepair,
        averageDaysToDiscard,
        averageObservedDays,
        durabilityScore,
        confidence,
        longestTire: item.longestTire,
        insight: buildBrandInsight(item.brand, averageDaysToRepair, averageDaysToDiscard, averageObservedDays, confidence),
      };
    })
    .sort((a, b) => {
      if (b.durabilityScore !== a.durabilityScore) {
        return b.durabilityScore - a.durabilityScore;
      }

      return a.brand.localeCompare(b.brand);
    });
}

function buildBrandInsight(brand, averageDaysToRepair, averageDaysToDiscard, averageObservedDays, confidence) {
  if (averageDaysToRepair && averageDaysToDiscard) {
    return `${brand}: promedio de ${averageDaysToRepair} dias hasta reparacion y ${averageDaysToDiscard} dias hasta baja. Confianza ${confidence.toLowerCase()}.`;
  }

  if (averageDaysToRepair) {
    return `${brand}: promedio de ${averageDaysToRepair} dias antes de registrar reparacion. Confianza ${confidence.toLowerCase()}.`;
  }

  if (averageDaysToDiscard) {
    return `${brand}: promedio de ${averageDaysToDiscard} dias antes de baja. Confianza ${confidence.toLowerCase()}.`;
  }

  return `${brand}: ${averageObservedDays || 0} dias observados en promedio; faltan mas reparaciones o bajas para comparar mejor.`;
}

function stateWeight(tire) {
  if (tire.state === TIRE_STATE.NUEVA) {
    return 100;
  }

  if (tire.state === TIRE_STATE.USADA) {
    return 75;
  }

  if (tire.state === TIRE_STATE.REPARADA) {
    return Math.max(10, 55 - (tire.repairType || 1) * 12);
  }

  return 0;
}

function sortDepositCandidates(candidates, analyticsByBrand) {
  return [...candidates].sort((a, b) => {
    const scoreA = stateWeight(a) + (analyticsByBrand.get(cleanBrand(a.brand))?.durabilityScore || 0) / 30;
    const scoreB = stateWeight(b) + (analyticsByBrand.get(cleanBrand(b.brand))?.durabilityScore || 0) / 30;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return a.code.localeCompare(b.code);
  });
}

function pickReplacement(tire, depositCandidates, usedReplacementIds, analyticsByBrand) {
  const sorted = sortDepositCandidates(
    depositCandidates.filter((candidate) => candidate.id !== tire.id && !usedReplacementIds.has(candidate.id)),
    analyticsByBrand,
  );
  const sameSize = sorted.find((candidate) => normalize(candidate.size) === normalize(tire.size));
  return sameSize || sorted[0] || null;
}

function getPriority(score) {
  if (score >= 72) {
    return 'ALTA';
  }

  if (score >= 45) {
    return 'MEDIA';
  }

  return 'BAJA';
}

function scoreFleetTire(tire, tireMovements, daysInCurrentPlace, brandAnalytics) {
  const repairScore = tire.state === TIRE_STATE.REPARADA ? (tire.repairType || 1) * 20 : tire.state === TIRE_STATE.USADA ? 12 : 0;
  const placeScore = Math.min(32, Math.round(daysInCurrentPlace / 3));
  const movementScore = Math.min(16, tireMovements.length * 2);
  const averageRepair = brandAnalytics?.averageDaysToRepair || null;
  const averageDiscard = brandAnalytics?.averageDaysToDiscard || null;
  const overRepairAverage = averageRepair && daysInCurrentPlace > averageRepair ? 14 : 0;
  const nearDiscardAverage = averageDiscard && daysInCurrentPlace > averageDiscard * 0.75 ? 18 : 0;

  return repairScore + placeScore + movementScore + overRepairAverage + nearDiscardAverage;
}

function buildFleetRecommendations(fleetTires, depositCandidates, movementsByTire, analyticsByBrand, now) {
  const usedReplacementIds = new Set();
  const scored = fleetTires
    .map((tire) => {
      const tireMovements = movementsByTire.get(tire.id) || [];
      const lastArrival = findLastArrivalToCurrentPlace(tire, tireMovements);
      const daysInCurrentPlace = daysBetween(lastArrival?.createdAt || tire.createdAt, now);
      const brandAnalytics = analyticsByBrand.get(cleanBrand(tire.brand));
      const score = scoreFleetTire(tire, tireMovements, daysInCurrentPlace, brandAnalytics);

      return {
        tire,
        tireMovements,
        daysInCurrentPlace,
        brandAnalytics,
        score,
      };
    })
    .filter((item) => item.score >= 28 || item.tire.state === TIRE_STATE.REPARADA || item.daysInCurrentPlace >= 45)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_RECOMMENDATIONS).map((item) => {
    const replacement = pickReplacement(item.tire, depositCandidates, usedReplacementIds, analyticsByBrand);
    if (replacement) {
      usedReplacementIds.add(replacement.id);
    }

    const currentPlace = getLocationLabel(item.tire);
    const targetPlace = item.tire.state === TIRE_STATE.REPARADA && (item.tire.repairType || 0) >= 3 ? 'Baja o revision final' : 'Gomeria';
    const action = replacement
      ? `Cambiar goma ${item.tire.code} desde ${currentPlace} hacia ${targetPlace} y colocar goma ${replacement.code} en ${currentPlace}.`
      : `Revisar goma ${item.tire.code} en ${currentPlace} y preparar un reemplazo compatible antes de mandarla a ${targetPlace}.`;

    return {
      id: `fleet-${item.tire.id}`,
      category: 'ROTACION',
      priority: getPriority(item.score),
      title: `Rotar goma ${item.tire.code}`,
      action,
      reason: `Lleva ${item.daysInCurrentPlace} dias en ${currentPlace}, estado ${formatState(item.tire)} y ${item.tireMovements.length} movimientos registrados.`,
      from: currentPlace,
      to: targetPlace,
      tire: tireSummary(item.tire),
      replacementTire: replacement ? tireSummary(replacement) : null,
      confidence: item.brandAnalytics?.confidence || 'MEDIA',
      evidence: {
        daysInCurrentPlace: item.daysInCurrentPlace,
        movementCount: item.tireMovements.length,
        brandAverageDaysToRepair: item.brandAnalytics?.averageDaysToRepair || null,
        brandAverageDaysToDiscard: item.brandAnalytics?.averageDaysToDiscard || null,
        score: item.score,
      },
    };
  });
}

function buildGomeriaRecommendations(gomeriaTires, movementsByTire, now) {
  return gomeriaTires
    .map((tire) => {
      const tireMovements = movementsByTire.get(tire.id) || [];
      const lastArrival = findLastArrivalToCurrentPlace(tire, tireMovements);
      const daysInGomeria = daysBetween(lastArrival?.createdAt || tire.updatedAt || tire.createdAt, now);

      return {
        tire,
        daysInGomeria,
      };
    })
    .filter((item) => item.daysInGomeria >= 14)
    .sort((a, b) => b.daysInGomeria - a.daysInGomeria)
    .slice(0, 3)
    .map((item) => ({
      id: `gomeria-${item.tire.id}`,
      category: 'GOMERIA',
      priority: item.daysInGomeria >= 30 ? 'ALTA' : 'MEDIA',
      title: `Resolver goma ${item.tire.code} en gomeria`,
      action: `Si la goma ${item.tire.code} ya esta lista, moverla a deposito; si no recupera, evaluarla para baja.`,
      reason: `Permanece hace ${item.daysInGomeria} dias en gomeria.`,
      from: 'Gomeria',
      to: 'Deposito o baja',
      tire: tireSummary(item.tire),
      replacementTire: null,
      confidence: 'MEDIA',
      evidence: {
        daysInCurrentPlace: item.daysInGomeria,
        movementCount: (movementsByTire.get(item.tire.id) || []).length,
        brandAverageDaysToRepair: null,
        brandAverageDaysToDiscard: null,
        score: item.daysInGomeria,
      },
    }));
}

function formatState(tire) {
  if (tire.state === TIRE_STATE.REPARADA) {
    return tire.repairType ? `REPARADA ${tire.repairType}` : 'REPARADA';
  }

  return tire.state;
}

function buildFallbackRecommendation(tires, movements) {
  return {
    id: 'weekly-control',
    category: 'CONTROL',
    priority: 'BAJA',
    title: 'Sin cambios urgentes esta semana',
    action: 'Mantener las ubicaciones actuales y revisar nuevamente en el proximo cierre semanal.',
    reason: `El analisis tomo ${tires.length} gomas y ${movements.length} movimientos, sin detectar rotaciones criticas.`,
    from: null,
    to: null,
    tire: null,
    replacementTire: null,
    confidence: movements.length ? 'MEDIA' : 'BAJA',
    evidence: {
      daysInCurrentPlace: null,
      movementCount: movements.length,
      brandAverageDaysToRepair: null,
      brandAverageDaysToDiscard: null,
      score: 0,
    },
  };
}

async function generateSnapshotData(now) {
  const [tires, movements] = await Promise.all([
    prisma.tire.findMany({
      include: {
        currentDeposit: true,
        currentTractor: true,
        currentSemi: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.movement.findMany({
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const movementsByTire = groupMovementsByTire(movements);
  const brandAnalytics = buildBrandAnalytics(tires, movementsByTire, now);
  const analyticsByBrand = new Map(brandAnalytics.map((item) => [item.brand, item]));
  const activeTires = tires.filter((tire) => tire.state !== TIRE_STATE.BAJA);
  const fleetTires = activeTires.filter((tire) => tire.currentLocation === LOCATION_TYPE.TRACTOR || tire.currentLocation === LOCATION_TYPE.SEMI);
  const depositCandidates = activeTires.filter((tire) => tire.currentLocation === LOCATION_TYPE.DEPOSIT && !isSpecialDeposit(tire));
  const gomeriaTires = activeTires.filter((tire) => tire.currentLocation === LOCATION_TYPE.DEPOSIT && isGomeriaDepositName(tire.currentDeposit?.name));
  const recommendations = [
    ...buildFleetRecommendations(fleetTires, depositCandidates, movementsByTire, analyticsByBrand, now),
    ...buildGomeriaRecommendations(gomeriaTires, movementsByTire, now),
  ].slice(0, MAX_RECOMMENDATIONS);

  return {
    recommendations: recommendations.length ? recommendations : [buildFallbackRecommendation(tires, movements)],
    brandAnalytics,
    sourceStats: {
      totalTires: tires.length,
      activeTires: activeTires.length,
      fleetTires: fleetTires.length,
      depositCandidates: depositCandidates.length,
      movements: movements.length,
      engine: 'weekly-local-ai-analysis',
    },
  };
}

function buildSummary(snapshot) {
  const recommendations = Array.isArray(snapshot.recommendations) ? snapshot.recommendations : [];
  const brandAnalytics = Array.isArray(snapshot.brandAnalytics) ? snapshot.brandAnalytics : [];
  return {
    recommendationsCount: recommendations.length,
    highPriorityCount: recommendations.filter((item) => item.priority === 'ALTA').length,
    brandsAnalyzed: brandAnalytics.length,
    nextRefreshAt: snapshot.validUntil,
  };
}

function serializeSnapshot(snapshot, wasGeneratedNow) {
  return {
    id: snapshot.id,
    weekKey: snapshot.weekKey,
    generatedAt: snapshot.generatedAt,
    validUntil: snapshot.validUntil,
    wasGeneratedNow,
    recommendations: snapshot.recommendations,
    brandAnalytics: snapshot.brandAnalytics,
    sourceStats: snapshot.sourceStats,
    summary: buildSummary(snapshot),
  };
}

async function getWeeklyRecommendations() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const validUntil = addDays(weekStart, 7);
  const weekKey = formatDateKey(weekStart);
  const existing = await prisma.aiRecommendationSnapshot.findUnique({ where: { weekKey } });

  if (existing) {
    return serializeSnapshot(existing, false);
  }

  const snapshotData = await generateSnapshotData(now);
  const snapshot = await prisma.aiRecommendationSnapshot.upsert({
    where: { weekKey },
    create: {
      weekKey,
      generatedAt: now,
      validUntil,
      recommendations: snapshotData.recommendations,
      brandAnalytics: snapshotData.brandAnalytics,
      sourceStats: snapshotData.sourceStats,
    },
    update: {
      generatedAt: now,
      validUntil,
      recommendations: snapshotData.recommendations,
      brandAnalytics: snapshotData.brandAnalytics,
      sourceStats: snapshotData.sourceStats,
    },
  });

  return serializeSnapshot(snapshot, true);
}

module.exports = {
  getWeeklyRecommendations,
};
