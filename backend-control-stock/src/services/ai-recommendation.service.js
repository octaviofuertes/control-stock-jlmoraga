const prisma = require('../config/prisma');
const { LOCATION_TYPE, TIRE_STATE } = require('../utils/constants');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RECOMMENDATIONS = 10;

// La operacion es en Argentina (UTC-3). La semana se corta el lunes 00:00 hora local
// para que "semana" coincida con el calendario del taller y no con UTC.
const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

// Si se cambia la forma del snapshot hay que subir esta version: los snapshots
// viejos se regeneran solos en vez de quedar servidos con campos faltantes.
const SNAPSHOT_SCHEMA_VERSION = 2;

const GOMERIA_STALE_DAYS = 14;
const GOMERIA_CRITICAL_DAYS = 30;

function pad(value) {
  return String(value).padStart(2, '0');
}

function getWeekInfo(date) {
  const shifted = new Date(date.getTime() + AR_OFFSET_MS);
  const daysFromMonday = (shifted.getUTCDay() + 6) % 7;
  shifted.setUTCDate(shifted.getUTCDate() - daysFromMonday);
  shifted.setUTCHours(0, 0, 0, 0);

  const weekKey = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  const weekStart = new Date(shifted.getTime() - AR_OFFSET_MS);
  const validUntil = new Date(weekStart.getTime() + 7 * MS_PER_DAY);

  return { weekKey, weekStart, validUntil };
}

function daysBetween(start, end) {
  if (!start || !end) {
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

function averageDecimal(values) {
  if (!values.length) {
    return null;
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value) {
  return (value || '').trim().toLowerCase();
}

function normalizeSize(value) {
  return (value || '').toUpperCase().replace(/[\s.]/g, '');
}

// Las marcas se cargan a mano, asi que "MICHELIN" y "michelin" son la misma marca.
function brandKey(brand) {
  return (brand || '').trim().toUpperCase().replace(/\s+/g, ' ') || 'SIN MARCA';
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

function formatState(state, repairType) {
  if (!state) {
    return 'Sin estado';
  }

  if (state === TIRE_STATE.REPARADA) {
    return repairType ? `Reparada ${repairType}` : 'Reparada';
  }

  return state.charAt(0) + state.slice(1).toLowerCase();
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
    if (matchesCurrentPlace(tire, tireMovements[index])) {
      return tireMovements[index];
    }
  }

  return null;
}

/**
 * Estado con el que la goma entro al sistema. Sirve para separar las
 * reparaciones que ya traia de fabrica/uso previo de las que registro el sistema.
 */
function getInitialState(tire, tireMovements) {
  const first = tireMovements[0];
  if (first && first.previousState) {
    return first.previousState;
  }

  return tire.state;
}

function isRepairEvent(movement) {
  if (movement.newState !== TIRE_STATE.REPARADA) {
    return false;
  }

  if (movement.previousState !== TIRE_STATE.REPARADA) {
    return true;
  }

  // Ya estaba reparada: solo cuenta si subio de nivel (Reparada 1 -> 2, etc.).
  return (movement.newRepairType || 0) > (movement.previousRepairType || 0);
}

/**
 * Historia de una goma resumida en los numeros que despues se agregan por marca.
 */
function buildTireHistory(tire, tireMovements, now) {
  const initialState = getInitialState(tire, tireMovements);
  const repairEvents = tireMovements.filter(isRepairEvent);
  const firstRepair = repairEvents[0] || null;
  const discardMovement = tireMovements.find((movement) => movement.newState === TIRE_STATE.BAJA) || null;
  const discardedAt = discardMovement ? discardMovement.createdAt : null;
  const discarded = tire.state === TIRE_STATE.BAJA || Boolean(discardMovement);

  const arrivedRepaired = initialState === TIRE_STATE.REPARADA;
  const everRepaired = arrivedRepaired || repairEvents.length > 0 || tire.state === TIRE_STATE.REPARADA;

  const observedDays = daysBetween(tire.createdAt, discardedAt || now);

  // Solo es medible de punta a punta cuando entro NUEVA y el sistema vio la reparacion.
  const daysToFirstRepair =
    initialState === TIRE_STATE.NUEVA && firstRepair ? daysBetween(tire.createdAt, firstRepair.createdAt) : null;

  const daysToDiscard = discardedAt ? daysBetween(tire.createdAt, discardedAt) : null;

  // Dias que aguanto sin ningun incidente registrado.
  const firstIncidentAt = firstRepair?.createdAt || discardedAt || null;
  const daysWithoutIncident = arrivedRepaired ? null : daysBetween(tire.createdAt, firstIncidentAt || now);

  return {
    tire,
    tireMovements,
    initialState,
    repairEventCount: repairEvents.length,
    arrivedRepaired,
    everRepaired,
    discarded,
    observedDays,
    daysToFirstRepair,
    daysToDiscard,
    daysWithoutIncident,
    hadIncident: Boolean(firstIncidentAt),
  };
}

/**
 * La confianza depende de la exposicion observada (gomas x dias), no de la
 * cantidad de incidentes: una marca sin fallas pero con 11 gomas seguidas
 * durante 3 meses es evidencia fuerte de que dura, no evidencia debil.
 */
function getConfidence(tireCount, observedTireDays) {
  if (tireCount >= 8 && observedTireDays >= 600) {
    return 'ALTA';
  }

  if (tireCount >= 3 && observedTireDays >= 150) {
    return 'MEDIA';
  }

  return 'BAJA';
}

function buildBrandInsight(item) {
  const parts = [`${item.tireCount} ${item.tireCount === 1 ? 'goma' : 'gomas'} en el sistema`];

  if (item.tireCount) {
    parts.push(`${item.repairShare}% paso por reparacion`);
  }

  if (item.averageRepairLevel) {
    parts.push(`nivel promedio de reparacion ${item.averageRepairLevel}`);
  }

  if (item.discardedCount) {
    parts.push(`${item.discardedCount} ${item.discardedCount === 1 ? 'baja' : 'bajas'}`);
  } else {
    parts.push('sin bajas');
  }

  if (item.averageDaysWithoutIncident !== null) {
    parts.push(`aguantan ${item.averageDaysWithoutIncident} dias sin incidentes en promedio`);
  }

  return `${item.brand}: ${parts.join(', ')}. Confianza ${item.confidence.toLowerCase()}.`;
}

function buildBrandAnalytics(histories) {
  const stats = new Map();

  for (const history of histories) {
    const brand = brandKey(history.tire.brand);
    const existing = stats.get(brand) || {
      brand,
      rawNames: new Set(),
      tireCount: 0,
      everRepairedCount: 0,
      arrivedRepairedCount: 0,
      trackedRepairEvents: 0,
      discardedCount: 0,
      repairLevels: [],
      timeToRepairSamples: [],
      timeToDiscardSamples: [],
      withoutIncidentSamples: [],
      observedTireDays: 0,
      longestTire: null,
    };

    existing.rawNames.add((history.tire.brand || '').trim() || 'Sin marca');
    existing.tireCount += 1;
    existing.observedTireDays += history.observedDays;
    existing.trackedRepairEvents += history.repairEventCount;

    if (history.everRepaired) {
      existing.everRepairedCount += 1;
    }

    if (history.arrivedRepaired) {
      existing.arrivedRepairedCount += 1;
    }

    if (history.discarded) {
      existing.discardedCount += 1;
    }

    if (history.tire.state === TIRE_STATE.REPARADA && history.tire.repairType) {
      existing.repairLevels.push(history.tire.repairType);
    }

    if (history.daysToFirstRepair !== null) {
      existing.timeToRepairSamples.push(history.daysToFirstRepair);
    }

    if (history.daysToDiscard !== null) {
      existing.timeToDiscardSamples.push(history.daysToDiscard);
    }

    if (history.daysWithoutIncident !== null) {
      existing.withoutIncidentSamples.push(history.daysWithoutIncident);

      const isBetter = !existing.longestTire || history.daysWithoutIncident > existing.longestTire.days;
      if (isBetter && !history.hadIncident) {
        existing.longestTire = {
          code: history.tire.code,
          brand: history.tire.brand,
          model: history.tire.model,
          size: history.tire.size,
          days: history.daysWithoutIncident,
          state: history.tire.state,
          location: getLocationLabel(history.tire),
        };
      }
    }

    stats.set(brand, existing);
  }

  return Array.from(stats.values())
    .map((item) => {
      const repairShare = item.tireCount ? Math.round((item.everRepairedCount / item.tireCount) * 100) : 0;
      const discardShare = item.tireCount ? Math.round((item.discardedCount / item.tireCount) * 100) : 0;
      const averageRepairLevel = averageDecimal(item.repairLevels);

      // Puntaje 0-100: penaliza cuantas gomas necesitaron reparacion, cuantas
      // terminaron de baja y que tan castigadas estan las que se repararon.
      const durabilityScore = Math.round(
        clamp(
          100 - repairShare * 0.45 - discardShare * 0.35 - (averageRepairLevel ? (averageRepairLevel - 1) * 12 : 0),
          0,
          100,
        ),
      );

      const enriched = {
        brand: item.brand,
        aliases: Array.from(item.rawNames).sort(),
        tireCount: item.tireCount,
        repairedCount: item.everRepairedCount,
        arrivedRepairedCount: item.arrivedRepairedCount,
        trackedRepairEvents: item.trackedRepairEvents,
        discardedCount: item.discardedCount,
        repairShare,
        discardShare,
        averageRepairLevel,
        averageDaysToRepair: average(item.timeToRepairSamples),
        averageDaysToRepairSample: item.timeToRepairSamples.length,
        averageDaysToDiscard: average(item.timeToDiscardSamples),
        averageDaysToDiscardSample: item.timeToDiscardSamples.length,
        averageDaysWithoutIncident: average(item.withoutIncidentSamples),
        averageObservedDays: item.tireCount ? Math.round(item.observedTireDays / item.tireCount) : 0,
        observedTireDays: item.observedTireDays,
        durabilityScore,
        confidence: getConfidence(item.tireCount, item.observedTireDays),
        longestTire: item.longestTire,
      };

      return { ...enriched, insight: buildBrandInsight(enriched) };
    })
    .sort((a, b) => {
      if (b.durabilityScore !== a.durabilityScore) {
        return b.durabilityScore - a.durabilityScore;
      }

      if (b.tireCount !== a.tireCount) {
        return b.tireCount - a.tireCount;
      }

      return a.brand.localeCompare(b.brand);
    });
}

/**
 * Podio de marcas. Solo entran las que tienen exposicion suficiente: una marca
 * con 8 gomas cargadas hace 15 dias puntua 100 y no significa nada todavia.
 */
function buildBrandRanking(brandAnalytics) {
  const eligible = brandAnalytics.filter((item) => item.confidence !== 'BAJA' && item.brand !== 'SIN MARCA');
  const best = eligible.slice(0, 3);
  const bestNames = new Set(best.map((item) => item.brand));

  return {
    best,
    worst: eligible
      .slice(-3)
      .reverse()
      .filter((item) => !bestNames.has(item.brand)),
    eligibleCount: eligible.length,
    excludedForLowEvidence: brandAnalytics.length - eligible.length,
  };
}

function letterSignature(value) {
  return value.replace(/[^A-Z0-9]/g, '').split('').sort().join('');
}

function levenshtein(a, b) {
  if (a === b) {
    return 0;
  }

  const previous = Array.from({ length: b.length + 1 }, (_unused, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const temporary = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = temporary;
    }
  }

  return previous[b.length];
}

/**
 * Marcas que casi seguro son la misma escrita distinto (KUMHO/KHUMO, HAWKA/HAKWA).
 * No se unifican solas: se avisan para que alguien las corrija a mano.
 */
function findPossibleBrandDuplicates(brandAnalytics) {
  const pairs = [];

  for (let i = 0; i < brandAnalytics.length; i += 1) {
    for (let j = i + 1; j < brandAnalytics.length; j += 1) {
      const a = brandAnalytics[i];
      const b = brandAnalytics[j];

      if (a.brand === 'SIN MARCA' || b.brand === 'SIN MARCA') {
        continue;
      }

      if (Math.min(a.brand.length, b.brand.length) < 4) {
        continue;
      }

      const sameLetters = letterSignature(a.brand) === letterSignature(b.brand);
      const closeSpelling = levenshtein(a.brand, b.brand) <= 1;

      if (!sameLetters && !closeSpelling) {
        continue;
      }

      const [main, duplicate] = a.tireCount >= b.tireCount ? [a, b] : [b, a];
      pairs.push({
        brand: main.brand,
        possibleDuplicate: duplicate.brand,
        brandTires: main.tireCount,
        duplicateTires: duplicate.tireCount,
        message: `"${duplicate.brand}" (${duplicate.tireCount} ${duplicate.tireCount === 1 ? 'goma' : 'gomas'}) parece un error de tipeo de "${main.brand}" (${main.tireCount} gomas). Unificarlas mejora el analisis por marca.`,
      });
    }
  }

  return pairs;
}

function stateWeight(tire) {
  if (tire.state === TIRE_STATE.NUEVA) {
    return 100;
  }

  if (tire.state === TIRE_STATE.USADA) {
    return 70;
  }

  if (tire.state === TIRE_STATE.REPARADA) {
    return Math.max(10, 55 - (tire.repairType || 1) * 12);
  }

  return 0;
}

/**
 * Reemplazo: SIEMPRE de la misma medida. Antes podia devolver una goma de otra
 * medida y la recomendacion quedaba inaplicable.
 */
function pickReplacement(tire, depositCandidates, usedReplacementIds, analyticsByBrand) {
  return depositCandidates
    .filter(
      (candidate) =>
        candidate.id !== tire.id &&
        !usedReplacementIds.has(candidate.id) &&
        normalizeSize(candidate.size) === normalizeSize(tire.size),
    )
    .sort((a, b) => {
      const scoreA = stateWeight(a) + (analyticsByBrand.get(brandKey(a.brand))?.durabilityScore || 0) / 4;
      const scoreB = stateWeight(b) + (analyticsByBrand.get(brandKey(b.brand))?.durabilityScore || 0) / 4;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      return a.code.localeCompare(b.code);
    })[0] || null;
}

function getPriority(score) {
  if (score >= 70) {
    return 'ALTA';
  }

  if (score >= 42) {
    return 'MEDIA';
  }

  return 'BAJA';
}

function scoreFleetTire(history, daysInCurrentPlace, brandAnalytics) {
  const tire = history.tire;

  let score = 0;

  if (tire.state === TIRE_STATE.REPARADA) {
    score += (tire.repairType || 1) * 22;
  } else if (tire.state === TIRE_STATE.USADA) {
    score += 14;
  }

  score += Math.min(30, Math.round(daysInCurrentPlace / 3));
  score += Math.min(14, history.repairEventCount * 7);

  // Marca con mal historial: adelantar la revision.
  if (brandAnalytics && brandAnalytics.confidence !== 'BAJA' && brandAnalytics.durabilityScore < 55) {
    score += 10;
  }

  return score;
}

function buildFleetRecommendations(fleetHistories, depositCandidates, analyticsByBrand, now) {
  const usedReplacementIds = new Set();

  return fleetHistories
    .map((history) => {
      const lastArrival = findLastArrivalToCurrentPlace(history.tire, history.tireMovements);
      const daysInCurrentPlace = daysBetween(lastArrival?.createdAt || history.tire.createdAt, now);
      const brandAnalytics = analyticsByBrand.get(brandKey(history.tire.brand)) || null;

      return {
        history,
        daysInCurrentPlace,
        brandAnalytics,
        score: scoreFleetTire(history, daysInCurrentPlace, brandAnalytics),
      };
    })
    .filter((item) => item.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((item) => {
      const tire = item.history.tire;
      const replacement = pickReplacement(tire, depositCandidates, usedReplacementIds, analyticsByBrand);
      if (replacement) {
        usedReplacementIds.add(replacement.id);
      }

      const currentPlace = getLocationLabel(tire);
      const atRepairLimit = tire.state === TIRE_STATE.REPARADA && (tire.repairType || 0) >= 3;
      const targetPlace = atRepairLimit ? 'Gomeria (evaluar baja)' : 'Gomeria';

      const action = replacement
        ? `Sacar la goma ${tire.code} de ${currentPlace}, mandarla a ${targetPlace} y montar en su lugar la goma ${replacement.code} (${replacement.brand} ${replacement.size}, ${formatState(replacement.state, replacement.repairType)}) que esta en deposito.`
        : `Sacar la goma ${tire.code} de ${currentPlace} y mandarla a ${targetPlace}. No hay en deposito ninguna goma libre de medida ${tire.size}: conseguir el reemplazo antes de bajarla.`;

      const reasonParts = [
        `Esta ${formatState(tire.state, tire.repairType)}`,
        `lleva ${item.daysInCurrentPlace} dias en ${currentPlace}`,
      ];

      if (item.history.repairEventCount) {
        reasonParts.push(
          `acumula ${item.history.repairEventCount} ${item.history.repairEventCount === 1 ? 'reparacion registrada' : 'reparaciones registradas'}`,
        );
      }

      if (item.brandAnalytics && item.brandAnalytics.confidence !== 'BAJA' && item.brandAnalytics.durabilityScore < 55) {
        reasonParts.push(`la marca ${item.brandAnalytics.brand} viene con ${item.brandAnalytics.repairShare}% de reparaciones`);
      }

      return {
        id: `fleet-${tire.id}`,
        // DESCARTE y no BAJA para no confundir la categoria con la prioridad BAJA.
        category: atRepairLimit ? 'DESCARTE' : 'ROTACION',
        priority: getPriority(item.score),
        title: `${atRepairLimit ? 'Evaluar baja de' : 'Rotar'} goma ${tire.code}`,
        action,
        reason: `${reasonParts.join(', ')}.`,
        from: currentPlace,
        to: targetPlace,
        tire: tireSummary(tire),
        replacementTire: replacement ? tireSummary(replacement) : null,
        confidence: item.brandAnalytics?.confidence || 'BAJA',
        evidence: {
          daysInCurrentPlace: item.daysInCurrentPlace,
          movementCount: item.history.tireMovements.length,
          repairEvents: item.history.repairEventCount,
          brandDurabilityScore: item.brandAnalytics?.durabilityScore ?? null,
          brandAverageDaysToRepair: item.brandAnalytics?.averageDaysToRepair ?? null,
          brandAverageDaysToDiscard: item.brandAnalytics?.averageDaysToDiscard ?? null,
          score: item.score,
        },
      };
    });
}

function buildGomeriaRecommendations(gomeriaHistories, now) {
  return gomeriaHistories
    .map((history) => {
      const lastArrival = findLastArrivalToCurrentPlace(history.tire, history.tireMovements);
      const daysInGomeria = daysBetween(lastArrival?.createdAt || history.tire.createdAt, now);
      return { history, daysInGomeria };
    })
    .filter((item) => item.daysInGomeria >= GOMERIA_STALE_DAYS)
    .sort((a, b) => b.daysInGomeria - a.daysInGomeria)
    .slice(0, 4)
    .map((item) => {
      const tire = item.history.tire;
      const critical = item.daysInGomeria >= GOMERIA_CRITICAL_DAYS;

      return {
        id: `gomeria-${tire.id}`,
        category: 'GOMERIA',
        priority: critical ? 'ALTA' : 'MEDIA',
        title: `Destrabar goma ${tire.code} en gomeria`,
        action: `La goma ${tire.code} (${tire.brand} ${tire.size}) lleva ${item.daysInGomeria} dias en gomeria. Si ya esta reparada, devolverla a deposito para que vuelva a estar disponible; si no tiene arreglo, darla de baja.`,
        reason: `Sin movimientos desde hace ${item.daysInGomeria} dias, ocupando gomeria y sin sumar al stock disponible.`,
        from: 'Gomeria',
        to: 'Deposito o baja',
        tire: tireSummary(tire),
        replacementTire: null,
        confidence: 'ALTA',
        evidence: {
          daysInCurrentPlace: item.daysInGomeria,
          movementCount: item.history.tireMovements.length,
          repairEvents: item.history.repairEventCount,
          brandDurabilityScore: null,
          brandAverageDaysToRepair: null,
          brandAverageDaysToDiscard: null,
          score: item.daysInGomeria,
        },
      };
    });
}

/**
 * Medidas que estan rodando en la flota y no tienen ni una goma de repuesto libre
 * en deposito. Es el aviso que evita quedar a pie cuando se pincha una.
 */
function buildStockRecommendations(fleetHistories, depositCandidates) {
  const stockBySize = new Map();
  for (const candidate of depositCandidates) {
    const size = normalizeSize(candidate.size);
    stockBySize.set(size, (stockBySize.get(size) || 0) + 1);
  }

  const fleetBySize = new Map();
  for (const history of fleetHistories) {
    const size = normalizeSize(history.tire.size);
    const existing = fleetBySize.get(size) || { size: history.tire.size, count: 0 };
    existing.count += 1;
    fleetBySize.set(size, existing);
  }

  return Array.from(fleetBySize.entries())
    .filter(([size]) => !stockBySize.get(size))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 2)
    .map(([size, info]) => ({
      id: `stock-${size}`,
      category: 'STOCK',
      priority: info.count >= 8 ? 'ALTA' : 'MEDIA',
      title: `Sin repuesto para medida ${info.size}`,
      action: `Comprar o liberar al menos una goma medida ${info.size} para deposito. Hoy hay ${info.count} rodando en la flota y ninguna disponible como reemplazo.`,
      reason: `${info.count} gomas de esta medida en tractores/semis y 0 libres en deposito.`,
      from: null,
      to: 'Deposito',
      tire: null,
      replacementTire: null,
      confidence: 'ALTA',
      evidence: {
        daysInCurrentPlace: null,
        movementCount: null,
        repairEvents: null,
        brandDurabilityScore: null,
        brandAverageDaysToRepair: null,
        brandAverageDaysToDiscard: null,
        score: info.count,
      },
    }));
}

function buildFallbackRecommendation(tires, movements) {
  return {
    id: 'weekly-control',
    category: 'CONTROL',
    priority: 'BAJA',
    title: 'Sin cambios urgentes esta semana',
    action: 'Mantener las ubicaciones actuales y volver a revisar en el proximo cierre semanal.',
    reason: `Se analizaron ${tires.length} gomas y ${movements.length} movimientos sin detectar rotaciones criticas.`,
    from: null,
    to: null,
    tire: null,
    replacementTire: null,
    confidence: movements.length ? 'MEDIA' : 'BAJA',
    evidence: {
      daysInCurrentPlace: null,
      movementCount: movements.length,
      repairEvents: null,
      brandDurabilityScore: null,
      brandAverageDaysToRepair: null,
      brandAverageDaysToDiscard: null,
      score: 0,
    },
  };
}

const PRIORITY_ORDER = { ALTA: 0, MEDIA: 1, BAJA: 2 };

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
    prisma.movement.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  const movementsByTire = groupMovementsByTire(movements);
  const histories = tires.map((tire) => buildTireHistory(tire, movementsByTire.get(tire.id) || [], now));

  const brandAnalytics = buildBrandAnalytics(histories);
  const analyticsByBrand = new Map(brandAnalytics.map((item) => [item.brand, item]));

  const activeHistories = histories.filter((history) => history.tire.state !== TIRE_STATE.BAJA);
  const fleetHistories = activeHistories.filter(
    (history) =>
      history.tire.currentLocation === LOCATION_TYPE.TRACTOR || history.tire.currentLocation === LOCATION_TYPE.SEMI,
  );
  const depositCandidates = activeHistories
    .filter((history) => history.tire.currentLocation === LOCATION_TYPE.DEPOSIT && !isSpecialDeposit(history.tire))
    .map((history) => history.tire);
  const gomeriaHistories = activeHistories.filter(
    (history) =>
      history.tire.currentLocation === LOCATION_TYPE.DEPOSIT && isGomeriaDepositName(history.tire.currentDeposit?.name),
  );

  // Se limita cada categoria para que la lista no quede tapada por un solo tipo
  // de problema y el encargado vea flota, gomeria y stock en la misma pantalla.
  const recommendations = [
    ...buildFleetRecommendations(fleetHistories, depositCandidates, analyticsByBrand, now).slice(0, 5),
    ...buildGomeriaRecommendations(gomeriaHistories, now).slice(0, 3),
    ...buildStockRecommendations(fleetHistories, depositCandidates).slice(0, 2),
  ]
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.evidence.score - a.evidence.score)
    .slice(0, MAX_RECOMMENDATIONS);

  const trackingStart = tires.length ? tires[0].createdAt : null;

  return {
    recommendations: recommendations.length ? recommendations : [buildFallbackRecommendation(tires, movements)],
    brandAnalytics,
    brandRanking: buildBrandRanking(brandAnalytics),
    dataQuality: {
      possibleBrandDuplicates: findPossibleBrandDuplicates(brandAnalytics),
    },
    sourceStats: {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      totalTires: tires.length,
      activeTires: activeHistories.length,
      fleetTires: fleetHistories.length,
      depositCandidates: depositCandidates.length,
      gomeriaTires: gomeriaHistories.length,
      movements: movements.length,
      trackingStart,
      trackingDays: trackingStart ? daysBetween(trackingStart, now) : 0,
      engine: 'weekly-local-analysis-v2',
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
    brandRanking: snapshot.sourceStats?.brandRanking || { best: [], worst: [], eligibleCount: 0, excludedForLowEvidence: 0 },
    dataQuality: snapshot.sourceStats?.dataQuality || { possibleBrandDuplicates: [] },
    sourceStats: snapshot.sourceStats,
    summary: buildSummary(snapshot),
  };
}

function isStale(snapshot) {
  return (snapshot.sourceStats?.schemaVersion || 1) !== SNAPSHOT_SCHEMA_VERSION;
}

async function persistSnapshot(weekKey, validUntil, now) {
  const snapshotData = await generateSnapshotData(now);
  const payload = {
    generatedAt: now,
    validUntil,
    recommendations: snapshotData.recommendations,
    brandAnalytics: snapshotData.brandAnalytics,
    // brandRanking y dataQuality viajan dentro de sourceStats (Json) para no
    // tener que migrar la tabla en produccion por campos derivados.
    sourceStats: {
      ...snapshotData.sourceStats,
      brandRanking: snapshotData.brandRanking,
      dataQuality: snapshotData.dataQuality,
    },
  };

  return prisma.aiRecommendationSnapshot.upsert({
    where: { weekKey },
    create: { weekKey, ...payload },
    update: payload,
  });
}

async function getWeeklyRecommendations() {
  const now = new Date();
  const { weekKey, validUntil } = getWeekInfo(now);
  const existing = await prisma.aiRecommendationSnapshot.findUnique({ where: { weekKey } });

  if (existing && !isStale(existing)) {
    return serializeSnapshot(existing, false);
  }

  const snapshot = await persistSnapshot(weekKey, validUntil, now);
  return serializeSnapshot(snapshot, true);
}

async function regenerateWeeklyRecommendations() {
  const now = new Date();
  const { weekKey, validUntil } = getWeekInfo(now);
  const snapshot = await persistSnapshot(weekKey, validUntil, now);
  return serializeSnapshot(snapshot, true);
}

module.exports = {
  getWeeklyRecommendations,
  regenerateWeeklyRecommendations,
  // Expuesto para inspeccion/diagnostico sin escribir en la base.
  generateSnapshotData,
};
