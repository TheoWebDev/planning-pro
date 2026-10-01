export const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

export const MONTH_SHORT = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
] as const;

/** Semaine commençant le lundi. */
export const WEEKDAY_LABELS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;
export const WEEKDAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
export const WEEKDAY_ABBR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

/** Index des jours ouvrés (lundi → vendredi) dans une semaine commençant le lundi. */
export const WORKWEEK = [0, 1, 2, 3, 4] as const;

const pad = (value: number) => String(value).padStart(2, '0');

/** Date ISO locale (yyyy-MM-dd), sans décalage de fuseau horaire. */
export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isoFrom(year: number, month: number, dayOfMonth: number): string {
  return toIso(new Date(year, month, dayOfMonth));
}

/** Parse une date ISO en date locale à minuit. */
export function fromIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function isWeekend(date: Date): boolean {
  return weekdayIndex(date) >= 5;
}

export function isoListOfMonth(year: number, month: number): string[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) =>
    isoFrom(year, month, index + 1),
  );
}

export function isoListOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, month) => isoListOfMonth(year, month)).flat();
}

/** Bornes incluses, dans l'ordre chronologique. Renvoie [] si l'intervalle est invalide. */
export function isoListBetween(fromIsoDate: string, toIsoDate: string): string[] {
  const start = fromIso(fromIsoDate);
  const end = fromIso(toIsoDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const result: string[] = [];
  for (const cursor = start; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    result.push(toIso(cursor));
  }
  return result;
}

/** Nombre de cases vides à insérer avant le 1er du mois dans une grille lundi → dimanche. */
export function leadingBlanks(year: number, month: number): number {
  return weekdayIndex(new Date(year, month, 1));
}

export function formatLongDate(iso: string): string {
  const date = fromIso(iso);
  return `${WEEKDAY_LABELS[weekdayIndex(date)]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()].toLowerCase()} ${date.getFullYear()}`;
}
