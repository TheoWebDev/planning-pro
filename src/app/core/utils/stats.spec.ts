import { DEFAULT_SETTINGS, type DayType, type ResolvedDay } from '../models/planning';
import { computePeriodStats, computeYearStats, type MonthStats } from './stats';

function day(type: DayType, km = 0, toll = 0): ResolvedDay {
  return {
    iso: '2026-01-01',
    year: 2026,
    month: 0,
    dayOfMonth: 1,
    weekday: 3,
    type,
    km,
    toll,
    note: '',
    holidayName: null,
    isOverridden: false,
    isToday: false,
  };
}

function monthStats(month: number, partial: Partial<MonthStats>): MonthStats {
  return {
    month,
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
    ...partial,
  };
}

describe('computePeriodStats', () => {
  it('compte les jours travaillés comme la somme « sur site + télétravail »', () => {
    const stats = computePeriodStats([
      day('onsite', 80, 6),
      day('remote'),
      day('leave'),
      day('holiday'),
      day('weekend'),
    ]);

    expect(stats.workedDays).toBe(2);
    expect(stats.onsiteDays).toBe(1);
    expect(stats.remoteDays).toBe(1);
    expect(stats.leaveDays).toBe(1);
    expect(stats.totalDays).toBe(5);
  });

  it('ne cumule les kilomètres et péages que sur les jours sur site', () => {
    const stats = computePeriodStats([
      day('onsite', 80, 6.5),
      day('onsite', 120, 9.25),
      day('remote', 80, 6),
    ]);

    expect(stats.km).toBe(200);
    expect(stats.toll).toBe(15.75);
  });

  it('renvoie des totaux nuls pour une période vide', () => {
    const stats = computePeriodStats([]);

    expect(stats.totalDays).toBe(0);
    expect(stats.km).toBe(0);
    expect(stats.toll).toBe(0);
  });
});

describe('computeYearStats', () => {
  it('applique le barème (km × taux) + forfait puis ajoute les péages', () => {
    const months = [
      monthStats(0, { onsiteDays: 10, workedDays: 10, km: 1000, toll: 60, totalDays: 31 }),
    ];

    const stats = computeYearStats(2026, months, DEFAULT_SETTINGS);

    // (1000 × 0,394) + 1515 = 1909
    expect(stats.taxDeduction).toBe(1909);
    expect(stats.totalDeclared).toBe(1969);
  });

  it('calcule les moyennes sur les seuls mois ayant de l’activité', () => {
    const months = [
      monthStats(0, { onsiteDays: 10, workedDays: 10, km: 800, toll: 60, totalDays: 31 }),
      monthStats(1, { onsiteDays: 10, workedDays: 10, km: 400, toll: 30, totalDays: 28 }),
      monthStats(2, {}),
    ];

    const stats = computeYearStats(2026, months, DEFAULT_SETTINGS);

    expect(stats.km).toBe(1200);
    expect(stats.kmPerMonth).toBe(600);
    expect(stats.tollPerMonth).toBe(45);
  });

  it('calcule les moyennes par trajet et la part de présence sur site', () => {
    const months = [
      monthStats(0, { onsiteDays: 8, remoteDays: 12, workedDays: 20, km: 640, toll: 48 }),
    ];

    const stats = computeYearStats(2026, months, DEFAULT_SETTINGS);

    expect(stats.kmPerTrip).toBe(80);
    expect(stats.tollPerTrip).toBe(6);
    expect(stats.onsiteShare).toBe(40);
  });

  it('calcule le carburant à partir de la consommation et du prix au litre', () => {
    const months = [
      monthStats(0, { onsiteDays: 10, workedDays: 10, km: 1000, toll: 60, totalDays: 31 }),
    ];
    const settings = { ...DEFAULT_SETTINGS, fuelConsumption: 6, fuelPricePerLiter: 2 };

    const stats = computeYearStats(2026, months, settings);

    // 1000 km à 6 L/100 km = 60 L, à 2 €/L = 120 €
    expect(stats.fuelLiters).toBe(60);
    expect(stats.fuelCost).toBe(120);
    expect(stats.commuteCost).toBe(180);
  });

  it('laisse le carburant hors du montant déclaré, déjà couvert par le barème', () => {
    const months = [
      monthStats(0, { onsiteDays: 10, workedDays: 10, km: 1000, toll: 60, totalDays: 31 }),
    ];
    const settings = { ...DEFAULT_SETTINGS, fuelConsumption: 6, fuelPricePerLiter: 2 };

    const stats = computeYearStats(2026, months, settings);

    expect(stats.totalDeclared).toBe(1969);
  });

  it('évite toute division par zéro sans aucun trajet', () => {
    const stats = computeYearStats(2026, [monthStats(0, {})], DEFAULT_SETTINGS);

    expect(stats.kmPerTrip).toBe(0);
    expect(stats.tollPerTrip).toBe(0);
    expect(stats.onsiteShare).toBe(0);
    expect(stats.taxDeduction).toBe(DEFAULT_SETTINGS.taxFixedAmount);
  });
});
