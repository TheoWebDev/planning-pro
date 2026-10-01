const VALID_TYPES = new Set(['onsite', 'remote', 'leave', 'holiday', 'weekend', 'other']);
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SETTING_KEYS = ['defaultKm', 'taxRatePerKm', 'taxFixedAmount'];
/** Réglages arrivés après la version 2 : absents des états enregistrés avant. */
const OPTIONAL_SETTING_KEYS = ['fuelConsumption', 'fuelPricePerLiter'];

/** Refuse un corps qui ne ressemble pas à un état Planning Pro, sans le réécrire. */
export function validateState(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'Objet JSON attendu.' };
  }

  if (input.version !== 2) {
    return { ok: false, error: 'Version inconnue.' };
  }

  const settings = input.settings;
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    return { ok: false, error: 'Réglages manquants.' };
  }
  for (const key of SETTING_KEYS) {
    const value = settings[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: `Réglage invalide : ${key}.` };
    }
  }
  for (const key of OPTIONAL_SETTING_KEYS) {
    const value = settings[key];
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    ) {
      return { ok: false, error: `Réglage invalide : ${key}.` };
    }
  }
  if (
    settings.fuelPriceReadAt !== undefined &&
    settings.fuelPriceReadAt !== null &&
    (typeof settings.fuelPriceReadAt !== 'string' ||
      Number.isNaN(Date.parse(settings.fuelPriceReadAt)))
  ) {
    return { ok: false, error: 'Réglage invalide : fuelPriceReadAt.' };
  }
  if (settings.defaultWeekdayType !== 'onsite' && settings.defaultWeekdayType !== 'remote') {
    return { ok: false, error: 'Type de jour ouvré invalide.' };
  }
  if (!Array.isArray(settings.tollRates) || settings.tollRates.length === 0) {
    return { ok: false, error: 'Barème de péage manquant.' };
  }
  for (const rate of settings.tollRates) {
    if (
      typeof rate !== 'object' ||
      rate === null ||
      !ISO_PATTERN.test(rate.from) ||
      typeof rate.amount !== 'number' ||
      !Number.isFinite(rate.amount) ||
      rate.amount < 0
    ) {
      return { ok: false, error: 'Tarif de péage invalide.' };
    }
  }

  if (typeof input.days !== 'object' || input.days === null || Array.isArray(input.days)) {
    return { ok: false, error: 'Journées manquantes.' };
  }
  for (const [iso, entry] of Object.entries(input.days)) {
    if (
      !ISO_PATTERN.test(iso) ||
      typeof entry !== 'object' ||
      entry === null ||
      !VALID_TYPES.has(entry.type)
    ) {
      return { ok: false, error: `Journée invalide : ${iso}.` };
    }
  }

  if (
    !Number.isInteger(input.selectedYear) ||
    input.selectedYear < 1970 ||
    input.selectedYear > 2200
  ) {
    return { ok: false, error: 'Année invalide.' };
  }

  return { ok: true };
}
