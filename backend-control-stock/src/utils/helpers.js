const { LOCATION_TYPE } = require('./constants');
const { AppError } = require('./errors');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireFields(payload, fields) {
  for (const field of fields) {
    if (!normalizeText(payload[field])) {
      throw new AppError(`El campo '${field}' es obligatorio.`);
    }
  }
}

function sanitizeNullable(value) {
  const cleaned = normalizeText(value);
  return cleaned || null;
}

function formatLocationLabel(locationType) {
  if (locationType === LOCATION_TYPE.DEPOSIT) return 'Deposito';
  if (locationType === LOCATION_TYPE.TRACTOR) return 'Tractor';
  if (locationType === LOCATION_TYPE.SEMI) return 'Semi';
  return locationType;
}

module.exports = {
  normalizeText,
  requireFields,
  sanitizeNullable,
  formatLocationLabel,
};
