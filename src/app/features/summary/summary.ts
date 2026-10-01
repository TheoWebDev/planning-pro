import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ExportService } from '../../core/services/export.service';
import { PlanningStore } from '../../core/services/planning-store';
import { MONTH_LABELS } from '../../core/utils/date';
import { fuelCostFor } from '../../core/utils/stats';

@Component({
  selector: 'app-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './summary.html',
  styleUrl: './summary.scss',
})
export class Summary {
  private readonly store = inject(PlanningStore);
  protected readonly exporter = inject(ExportService);

  protected readonly stats = this.store.yearStats;
  protected readonly settings = this.store.settings;
  protected readonly year = this.store.selectedYear;
  protected readonly monthLabels = MONTH_LABELS;

  protected readonly fuelCostPerTrip = computed(() =>
    fuelCostFor(this.stats().kmPerTrip, this.settings()),
  );

  /** Le carburant dépend des réglages, que `MonthStats` ne connaît pas. */
  protected readonly rows = computed(() => {
    const settings = this.settings();
    return this.stats().months.map((month) => ({
      ...month,
      fuelCost: fuelCostFor(month.km, settings),
    }));
  });
}
