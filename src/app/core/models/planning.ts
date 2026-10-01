/** Nature d'une journée du calendrier. */
export type DayType = 'onsite' | 'remote' | 'leave' | 'holiday' | 'weekend' | 'other';

/** Types que l'utilisateur peut assigner manuellement à une journée. */
export type AssignableDayType = Exclude<DayType, 'holiday' | 'weekend'>;

export interface DayTypeMeta {
  readonly id: DayType;
  readonly label: string;
  readonly short: string;
  /** Variable CSS porteuse de la couleur du type. */
  readonly color: string;
  /** Compte comme une journée travaillée. */
  readonly worked: boolean;
  /** Génère un trajet (km + péage). */
  readonly commute: boolean;
}

export const DAY_TYPES: readonly DayTypeMeta[] = [
  {
    id: 'onsite',
    label: 'Sur site',
    short: 'S',
    color: 'var(--c-onsite)',
    worked: true,
    commute: true,
  },
  {
    id: 'remote',
    label: 'Télétravail',
    short: 'T',
    color: 'var(--c-remote)',
    worked: true,
    commute: false,
  },
  {
    id: 'leave',
    label: 'Congés',
    short: 'C',
    color: 'var(--c-leave)',
    worked: false,
    commute: false,
  },
  {
    id: 'other',
    label: 'Absence',
    short: 'A',
    color: 'var(--c-other)',
    worked: false,
    commute: false,
  },
  {
    id: 'holiday',
    label: 'Férié',
    short: 'F',
    color: 'var(--c-holiday)',
    worked: false,
    commute: false,
  },
  {
    id: 'weekend',
    label: 'Week-end',
    short: 'W',
    color: 'var(--c-weekend)',
    worked: false,
    commute: false,
  },
];

export const DAY_TYPE_MAP: Readonly<Record<DayType, DayTypeMeta>> = Object.freeze(
  Object.fromEntries(DAY_TYPES.map((meta) => [meta.id, meta])) as Record<DayType, DayTypeMeta>,
);

/** Types proposés dans l'éditeur de journée, dans l'ordre d'affichage. */
export const ASSIGNABLE_DAY_TYPES: readonly DayTypeMeta[] = DAY_TYPES.filter(
  (meta): meta is DayTypeMeta & { id: AssignableDayType } => meta.id !== 'weekend',
);

/**
 * Journée explicitement saisie. Seules les journées qui diffèrent de la valeur
 * déduite du calendrier sont stockées, ce qui garde les données compactes et
 * permet aux réglages par défaut de rester appliqués rétroactivement.
 */
export interface DayEntry {
  readonly type: DayType;
  /** Surcharge de la distance du trajet (km aller-retour). */
  readonly km?: number;
  /** Surcharge du coût de péage du trajet (aller-retour). */
  readonly toll?: number;
  readonly note?: string;
}

/** Tarif de péage aller-retour entrant en vigueur à une date donnée. */
export interface TollRate {
  /** Date ISO (yyyy-MM-dd) à partir de laquelle le montant s'applique. */
  readonly from: string;
  /** Péage aller-retour, en euros. */
  readonly amount: number;
}

export interface PlanningSettings {
  /** Distance aller-retour par défaut d'un jour sur site. */
  readonly defaultKm: number;
  /**
   * Péages aller-retour par date d'entrée en vigueur, triés par date croissante
   * et jamais vides. Garder l'historique évite qu'une hausse de tarif ne
   * recalcule les années déjà déclarées.
   */
  readonly tollRates: readonly TollRate[];
  /** Nature appliquée aux jours ouvrés non saisis. */
  readonly defaultWeekdayType: 'remote' | 'onsite';
  /** Barème kilométrique : montant par km. */
  readonly taxRatePerKm: number;
  /** Barème kilométrique : forfait ajouté au total. */
  readonly taxFixedAmount: number;
  /** Consommation moyenne du véhicule, en litres aux 100 km. */
  readonly fuelConsumption: number;
  /** Prix du carburant, en euros par litre. */
  readonly fuelPricePerLiter: number;
  /** Instant ISO du dernier relevé SP98 ; `null` si le prix a été saisi à la main. */
  readonly fuelPriceReadAt: string | null;
}

export const DEFAULT_SETTINGS: PlanningSettings = {
  defaultKm: 80,
  tollRates: [{ from: '2020-01-01', amount: 6 }],
  defaultWeekdayType: 'remote',
  taxRatePerKm: 0.394,
  taxFixedAmount: 1515,
  fuelConsumption: 6.4,
  fuelPricePerLiter: 1.95,
  fuelPriceReadAt: null,
};

/**
 * Péage en vigueur à une date. Le tarif le plus ancien couvre aussi les
 * journées qui précèdent sa date d'effet, pour qu'aucune journée ne reste sans
 * montant.
 */
export function tollRateFor(iso: string, rates: readonly TollRate[]): number {
  let amount = rates.length ? rates[0].amount : 0;
  for (const rate of rates) {
    if (rate.from > iso) {
      break;
    }
    amount = rate.amount;
  }
  return amount;
}

export const STATE_VERSION = 2;

export interface PlanningState {
  readonly version: number;
  readonly settings: PlanningSettings;
  /** Journées saisies, indexées par date ISO (yyyy-MM-dd). */
  readonly days: Readonly<Record<string, DayEntry>>;
  readonly selectedYear: number;
}

/** Journée calculée, prête à être affichée. */
export interface ResolvedDay {
  readonly iso: string;
  readonly year: number;
  /** Mois 0-indexé. */
  readonly month: number;
  readonly dayOfMonth: number;
  /** 0 = lundi … 6 = dimanche. */
  readonly weekday: number;
  readonly type: DayType;
  readonly km: number;
  readonly toll: number;
  readonly note: string;
  readonly holidayName: string | null;
  /** Une saisie explicite existe pour cette journée. */
  readonly isOverridden: boolean;
  readonly isToday: boolean;
}
