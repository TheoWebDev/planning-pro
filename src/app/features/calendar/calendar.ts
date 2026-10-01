import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DAY_TYPES } from '../../core/models/planning';
import { PlanningStore } from '../../core/services/planning-store';
import { MONTH_LABELS } from '../../core/utils/date';
import { DayEditor } from './day-editor/day-editor';
import { MonthGrid } from './month-grid/month-grid';
import { QuickFill } from './quick-fill/quick-fill';

type CalendarView = 'year' | 'month';

@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MonthGrid, DayEditor, QuickFill],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar {
  protected readonly store = inject(PlanningStore);

  protected readonly legend = DAY_TYPES;
  protected readonly monthLabels = MONTH_LABELS;

  protected readonly view = signal<CalendarView>('year');
  protected readonly activeMonth = signal(new Date().getMonth());
  protected readonly selectedIso = signal<string | null>(null);
  protected readonly toolsOpen = signal(false);

  protected readonly activeMonthDays = computed(
    () => this.store.monthDays()[this.activeMonth()] ?? [],
  );
  protected readonly activeMonthStats = computed(() => this.store.monthStats()[this.activeMonth()]);

  protected setView(view: CalendarView): void {
    this.view.set(view);
  }

  protected openMonth(month: number): void {
    this.activeMonth.set(month);
    this.view.set('month');
  }

  protected shiftMonth(delta: number): void {
    const target = this.activeMonth() + delta;
    if (target < 0) {
      this.store.selectYear(this.store.selectedYear() - 1);
      this.activeMonth.set(11);
    } else if (target > 11) {
      this.store.selectYear(this.store.selectedYear() + 1);
      this.activeMonth.set(0);
    } else {
      this.activeMonth.set(target);
    }
  }

  protected monthHeadLabel(month: number): string {
    const stats = this.store.monthStats()[month];
    const parts = [`Détailler ${MONTH_LABELS[month]} ${this.store.selectedYear()}`];
    if (!stats) {
      return parts[0];
    }
    if (stats.onsiteDays) {
      parts.push(`${stats.onsiteDays} sur site`);
    }
    if (stats.remoteDays) {
      parts.push(`${stats.remoteDays} en télétravail`);
    }
    if (stats.leaveDays) {
      parts.push(`${stats.leaveDays} congés`);
    }
    return parts.join(', ');
  }

  protected selectDay(iso: string): void {
    this.selectedIso.set(iso);
  }

  /** Suit la journée éditée quand l'utilisateur navigue d'un jour à l'autre. */
  protected moveSelection(iso: string): void {
    this.selectedIso.set(iso);
    const day = this.store.resolve(iso);
    if (day.year !== this.store.selectedYear()) {
      this.store.selectYear(day.year);
    }
    this.activeMonth.set(day.month);
  }
}
