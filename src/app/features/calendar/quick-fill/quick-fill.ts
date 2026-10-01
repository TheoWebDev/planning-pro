import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { ASSIGNABLE_DAY_TYPES, type DayType } from '../../../core/models/planning';
import { NotificationService } from '../../../core/services/notification.service';
import { PlanningStore, type RangeOptions } from '../../../core/services/planning-store';
import { isoFrom, MONTH_LABELS, WEEKDAY_ABBR, WORKWEEK } from '../../../core/utils/date';

/**
 * Deux outils de saisie de masse : un rythme hebdomadaire récurrent (par exemple
 * « sur site le lundi et le jeudi ») et l'application d'un type sur une période.
 */
@Component({
  selector: 'app-quick-fill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-fill.html',
  styleUrl: './quick-fill.scss',
})
export class QuickFill {
  /** Mois affiché, utilisé par la portée « mois en cours ». */
  readonly activeMonth = input.required<number>();

  private readonly store = inject(PlanningStore);
  private readonly notifications = inject(NotificationService);

  protected readonly dayTypes = ASSIGNABLE_DAY_TYPES;
  protected readonly workweek = WORKWEEK;
  protected readonly weekdayLabels = WEEKDAY_ABBR;
  protected readonly year = this.store.selectedYear;
  protected readonly activeMonthLabel = computed(() => MONTH_LABELS[this.activeMonth()]);

  // Rythme hebdomadaire
  protected readonly selectedWeekdays = signal<readonly number[]>([]);
  protected readonly patternType = signal<DayType>('onsite');
  protected readonly patternScope = signal<'year' | 'month'>('year');

  // Période
  protected readonly rangeFrom = linkedSignal(() => isoFrom(this.store.selectedYear(), 0, 1));
  protected readonly rangeTo = linkedSignal(() => isoFrom(this.store.selectedYear(), 0, 1));
  protected readonly rangeType = signal<DayType>('leave');

  // Options communes
  protected readonly skipNonWorkingDays = signal(true);
  protected readonly keepExistingEntries = signal(false);

  protected readonly yearStart = computed(() => isoFrom(this.year(), 0, 1));
  protected readonly yearEnd = computed(() => isoFrom(this.year(), 11, 31));

  protected toggleWeekday(index: number): void {
    this.selectedWeekdays.update((days) =>
      days.includes(index) ? days.filter((day) => day !== index) : [...days, index],
    );
  }

  protected applyPattern(): void {
    const weekdays = this.selectedWeekdays();
    if (!weekdays.length) {
      this.notifications.error('Sélectionnez au moins un jour de la semaine.');
      return;
    }
    const month = this.patternScope() === 'month' ? this.activeMonth() : undefined;
    const count = this.store.applyWeeklyPattern(
      weekdays,
      this.patternType(),
      this.options(),
      month,
    );
    this.report(count);
  }

  protected applyRange(): void {
    const count = this.store.applyToRange(
      this.rangeFrom(),
      this.rangeTo(),
      this.rangeType(),
      this.options(),
    );
    this.report(count);
  }

  private options(): RangeOptions {
    return {
      skipNonWorkingDays: this.skipNonWorkingDays(),
      keepExistingEntries: this.keepExistingEntries(),
    };
  }

  private report(count: number): void {
    if (count === 0) {
      this.notifications.info('Aucune journée modifiée : vérifiez la période et les options.');
    } else {
      this.notifications.success(
        `${count} journée${count > 1 ? 's' : ''} mise${count > 1 ? 's' : ''} à jour.`,
      );
    }
  }
}
