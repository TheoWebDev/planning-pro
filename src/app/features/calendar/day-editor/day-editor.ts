import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ASSIGNABLE_DAY_TYPES, DAY_TYPE_MAP, type DayType } from '../../../core/models/planning';
import { PlanningStore } from '../../../core/services/planning-store';
import { formatLongDate, fromIso, toIso } from '../../../core/utils/date';

/** Panneau latéral d'édition d'une journée. Chaque modification est appliquée immédiatement. */
@Component({
  selector: 'app-day-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Modifier la journée',
    '(document:keydown.escape)': 'closed.emit()',
  },
  templateUrl: './day-editor.html',
  styleUrl: './day-editor.scss',
})
export class DayEditor {
  readonly iso = input.required<string>();
  readonly closed = output<void>();
  readonly isoChange = output<string>();

  private readonly store = inject(PlanningStore);

  protected readonly dayTypes = ASSIGNABLE_DAY_TYPES;
  protected readonly types = DAY_TYPE_MAP;
  protected readonly settings = this.store.settings;

  protected readonly day = computed(() => this.store.resolve(this.iso()));
  protected readonly title = computed(() => formatLongDate(this.iso()));
  /** Péage du barème à cette date, affiché comme valeur de repli. */
  protected readonly defaultToll = computed(() => this.store.tollRateAt(this.iso()));

  protected setType(type: DayType): void {
    this.store.setDay(this.iso(), { type });
  }

  protected setKm(value: string): void {
    this.store.setDay(this.iso(), { km: parseAmount(value) });
  }

  protected setToll(value: string): void {
    this.store.setDay(this.iso(), { toll: parseAmount(value) });
  }

  protected setNote(value: string): void {
    this.store.setDay(this.iso(), { note: value });
  }

  /** Repasse la journée sur les valeurs déduites du calendrier et des réglages. */
  protected reset(): void {
    this.store.clearDay(this.iso());
  }

  protected shiftDay(delta: number): void {
    const date = fromIso(this.iso());
    date.setDate(date.getDate() + delta);
    this.isoChange.emit(toIso(date));
  }
}

/** Une valeur vide signifie « utiliser la valeur par défaut des réglages ». */
function parseAmount(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
