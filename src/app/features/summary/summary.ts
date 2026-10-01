import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ExportService } from '../../core/services/export.service';
import { PlanningStore } from '../../core/services/planning-store';
import { MONTH_LABELS } from '../../core/utils/date';

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
}
