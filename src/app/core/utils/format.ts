const formatters = new Map<string, Intl.NumberFormat>();

/** Formateur `fr-FR` mémoïsé : espace insécable comme séparateur de milliers, virgule décimale. */
function formatter(
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): Intl.NumberFormat {
  const key = `${minimumFractionDigits}-${maximumFractionDigits}`;
  let instance = formatters.get(key);
  if (!instance) {
    instance = new Intl.NumberFormat('fr-FR', { minimumFractionDigits, maximumFractionDigits });
    formatters.set(key, instance);
  }
  return instance;
}

export function formatNumber(value: number, minDigits = 0, maxDigits = minDigits): string {
  return formatter(minDigits, maxDigits).format(value);
}

export function formatEuro(value: number): string {
  return `${formatter(2, 2).format(value)} €`;
}

export function formatKm(value: number, maxDigits = 0): string {
  return `${formatter(0, maxDigits).format(value)} km`;
}

let dateTimeFormatter: Intl.DateTimeFormat | undefined;

/** Date et heure locales, ex. « 01/10/2026 14:32 ». */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  dateTimeFormatter ??= new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return dateTimeFormatter.format(date);
}
