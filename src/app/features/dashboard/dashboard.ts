import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DAY_TYPE_MAP } from '../../core/models/planning';
import { PlanningStore } from '../../core/services/planning-store';
import { MONTH_SHORT } from '../../core/utils/date';
import { formatEuro, formatKm, formatNumber } from '../../core/utils/format';
import { BarChart, type ChartSeries } from '../../shared/bar-chart/bar-chart';
import { DonutChart, type DonutSlice } from '../../shared/donut-chart/donut-chart';
import { InfoTip } from '../../shared/info-tip/info-tip';
import { KpiCard } from '../../shared/kpi-card/kpi-card';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, BarChart, DonutChart, InfoTip, KpiCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly store = inject(PlanningStore);

  protected readonly stats = this.store.yearStats;
  protected readonly settings = this.store.settings;
  protected readonly year = this.store.selectedYear;
  protected readonly types = DAY_TYPE_MAP;
  protected readonly months = MONTH_SHORT;

  protected readonly onsiteHint = computed(
    () => `${formatNumber(this.stats().onsiteShare, 0, 1)} % des jours travaillés`,
  );
  protected readonly kmPerTripHint = computed(
    () => `${formatKm(this.stats().kmPerTrip, 1)} par trajet`,
  );
  protected readonly tollPerTripHint = computed(
    () => `${formatEuro(this.stats().tollPerTrip)} par trajet`,
  );
  protected readonly fuelHint = computed(() => {
    const settings = this.settings();
    const liters = formatNumber(this.stats().fuelLiters, 0);
    return `${liters} L à ${formatNumber(settings.fuelPricePerLiter, 2, 3)} €/L`;
  });
  protected readonly fuelInfo = computed(() => {
    const stats = this.stats();
    const consumption = formatNumber(this.settings().fuelConsumption, 1, 1);
    return `${formatNumber(stats.km, 0)} km × ${consumption} L/100 km = ${formatNumber(stats.fuelLiters, 0)} L`;
  });

  protected readonly kmSeries = computed<ChartSeries[]>(() => [
    {
      label: 'Kilomètres',
      color: 'var(--c-onsite)',
      values: this.stats().months.map((month) => month.km),
    },
  ]);

  protected readonly tollSeries = computed<ChartSeries[]>(() => [
    {
      label: 'Péages',
      color: 'var(--accent)',
      values: this.stats().months.map((month) => month.toll),
    },
  ]);

  protected readonly dayTypeSeries = computed<ChartSeries[]>(() => {
    const months = this.stats().months;
    return [
      {
        label: 'Sur site',
        color: 'var(--c-onsite)',
        values: months.map((month) => month.onsiteDays),
      },
      {
        label: 'Télétravail',
        color: 'var(--c-remote)',
        values: months.map((month) => month.remoteDays),
      },
      { label: 'Congés', color: 'var(--c-leave)', values: months.map((month) => month.leaveDays) },
      {
        label: 'Fériés',
        color: 'var(--c-holiday)',
        values: months.map((month) => month.holidayDays),
      },
    ];
  });

  protected readonly breakdown = computed<DonutSlice[]>(() => {
    const stats = this.stats();
    return [
      { label: 'Sur site', color: 'var(--c-onsite)', value: stats.onsiteDays },
      { label: 'Télétravail', color: 'var(--c-remote)', value: stats.remoteDays },
      { label: 'Congés', color: 'var(--c-leave)', value: stats.leaveDays },
      { label: 'Jours fériés', color: 'var(--c-holiday)', value: stats.holidayDays },
      { label: 'Absences', color: 'var(--c-other)', value: stats.otherDays },
    ];
  });

  protected readonly hasActivity = computed(() => this.stats().onsiteDays > 0);
}
