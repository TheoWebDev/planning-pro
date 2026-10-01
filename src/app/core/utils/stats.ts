import {
  DAY_TYPE_MAP,
  type DayType,
  type PlanningSettings,
  type ResolvedDay,
} from '../models/planning';

export interface PeriodStats {
  readonly totalDays: number;
  readonly workedDays: number;
  readonly onsiteDays: number;
  readonly remoteDays: number;
  readonly leaveDays: number;
  readonly holidayDays: number;
  readonly weekendDays: number;
  readonly otherDays: number;
  readonly km: number;
  readonly toll: number;
}

export interface MonthStats extends PeriodStats {
  /** Mois 0-indexé. */
  readonly month: number;
}

export interface YearStats extends PeriodStats {
  readonly year: number;
  readonly months: readonly MonthStats[];
  readonly kmPerMonth: number;
  readonly tollPerMonth: number;
  readonly tollPerTrip: number;
  readonly kmPerTrip: number;
  /** Part des jours travaillés passés sur site, en pourcentage. */
  readonly onsiteShare: number;
  /** Barème kilométrique : (km × taux) + forfait. */
  readonly taxDeduction: number;
  /** Déduction kilométrique + péages de l'année. */
  readonly totalDeclared: number;
  /** Carburant brûlé par les trajets de l'année, en litres. */
  readonly fuelLiters: number;
  /** Budget carburant de l'année, en euros. */
  readonly fuelCost: number;
  /** Budget carburant moyen par mois ayant de l'activité. */
  readonly fuelCostPerMonth: number;
  /**
   * Dépense réelle des trajets : carburant + péages. À ne pas confondre avec
   * `totalDeclared`, dont le barème couvre déjà le carburant de façon forfaitaire.
   */
  readonly commuteCost: number;
}

const EMPTY_COUNTS: Record<DayType, number> = {
  onsite: 0,
  remote: 0,
  leave: 0,
  holiday: 0,
  weekend: 0,
  other: 0,
};

export function computePeriodStats(days: readonly ResolvedDay[]): PeriodStats {
  const counts = { ...EMPTY_COUNTS };
  let km = 0;
  let toll = 0;

  for (const day of days) {
    counts[day.type] += 1;
    if (DAY_TYPE_MAP[day.type].commute) {
      km += day.km;
      toll += day.toll;
    }
  }

  return {
    totalDays: days.length,
    workedDays: counts.onsite + counts.remote,
    onsiteDays: counts.onsite,
    remoteDays: counts.remote,
    leaveDays: counts.leave,
    holidayDays: counts.holiday,
    weekendDays: counts.weekend,
    otherDays: counts.other,
    km: round(km, 2),
    toll: round(toll, 2),
  };
}

export function computeMonthStats(daysByMonth: readonly (readonly ResolvedDay[])[]): MonthStats[] {
  return daysByMonth.map((days, month) => ({ month, ...computePeriodStats(days) }));
}

/** Litres brûlés sur une distance, à la consommation moyenne réglée. */
export function fuelLitersFor(km: number, settings: PlanningSettings): number {
  return round((km * settings.fuelConsumption) / 100, 2);
}

/** Coût du carburant sur une distance : litres × prix au litre. */
export function fuelCostFor(km: number, settings: PlanningSettings): number {
  return round(fuelLitersFor(km, settings) * settings.fuelPricePerLiter, 2);
}

export function computeYearStats(
  year: number,
  months: readonly MonthStats[],
  settings: PlanningSettings,
): YearStats {
  const total = sumStats(months);
  const activeMonths = months.filter((month) => month.totalDays > 0).length || 1;
  const taxDeduction = round(total.km * settings.taxRatePerKm + settings.taxFixedAmount, 2);
  const fuelCost = fuelCostFor(total.km, settings);

  return {
    year,
    ...total,
    months,
    kmPerMonth: round(total.km / activeMonths, 2),
    tollPerMonth: round(total.toll / activeMonths, 2),
    tollPerTrip: total.onsiteDays ? round(total.toll / total.onsiteDays, 2) : 0,
    kmPerTrip: total.onsiteDays ? round(total.km / total.onsiteDays, 2) : 0,
    onsiteShare: total.workedDays ? round((total.onsiteDays / total.workedDays) * 100, 1) : 0,
    taxDeduction,
    totalDeclared: round(taxDeduction + total.toll, 2),
    fuelLiters: fuelLitersFor(total.km, settings),
    fuelCost,
    fuelCostPerMonth: round(fuelCost / activeMonths, 2),
    commuteCost: round(fuelCost + total.toll, 2),
  };
}

function sumStats(parts: readonly PeriodStats[]): PeriodStats {
  return parts.reduce<PeriodStats>(
    (acc, part) => ({
      totalDays: acc.totalDays + part.totalDays,
      workedDays: acc.workedDays + part.workedDays,
      onsiteDays: acc.onsiteDays + part.onsiteDays,
      remoteDays: acc.remoteDays + part.remoteDays,
      leaveDays: acc.leaveDays + part.leaveDays,
      holidayDays: acc.holidayDays + part.holidayDays,
      weekendDays: acc.weekendDays + part.weekendDays,
      otherDays: acc.otherDays + part.otherDays,
      km: round(acc.km + part.km, 2),
      toll: round(acc.toll + part.toll, 2),
    }),
    {
      totalDays: 0,
      workedDays: 0,
      onsiteDays: 0,
      remoteDays: 0,
      leaveDays: 0,
      holidayDays: 0,
      weekendDays: 0,
      otherDays: 0,
      km: 0,
      toll: 0,
    },
  );
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
