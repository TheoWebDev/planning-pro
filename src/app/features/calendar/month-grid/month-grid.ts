import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DAY_TYPE_MAP, type ResolvedDay } from '../../../core/models/planning';
import { leadingBlanks, MONTH_LABELS, WEEKDAY_ABBR, WEEKDAY_SHORT } from '../../../core/utils/date';

/** Grille d'un mois, du lundi au dimanche. Deux densités : compacte ou détaillée. */
@Component({
  selector: 'app-month-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.grid--compact]': 'compact()' },
  templateUrl: './month-grid.html',
  styleUrl: './month-grid.scss',
})
export class MonthGrid {
  readonly month = input.required<number>();
  readonly days = input.required<readonly ResolvedDay[]>();
  readonly compact = input(false);
  readonly selectedIso = input<string | null>(null);

  readonly daySelected = output<string>();

  protected readonly types = DAY_TYPE_MAP;
  protected readonly weekdays = computed(() => (this.compact() ? WEEKDAY_SHORT : WEEKDAY_ABBR));
  protected readonly monthLabel = computed(() => MONTH_LABELS[this.month()]);
  protected readonly blanks = computed(() => {
    const first = this.days()[0];
    return first ? Array.from({ length: leadingBlanks(first.year, first.month) }) : [];
  });

  protected ariaLabel(day: ResolvedDay): string {
    const type = this.types[day.type].label;
    const commute = day.type === 'onsite' ? `, ${day.km} kilomètres, péage ${day.toll} euros` : '';
    return `${day.dayOfMonth} ${this.monthLabel()} — ${type}${commute}`;
  }
}
