import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DEFAULT_SETTINGS } from '../../core/models/planning';
import { ExportService } from '../../core/services/export.service';
import { NotificationService } from '../../core/services/notification.service';
import { PlanningStore } from '../../core/services/planning-store';
import { readTextFile } from '../../core/utils/file';

type DangerAction = 'year' | 'all';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly store = inject(PlanningStore);
  private readonly notifications = inject(NotificationService);
  protected readonly exporter = inject(ExportService);

  protected readonly settings = this.store.settings;
  protected readonly year = this.store.selectedYear;
  protected readonly entryCount = this.store.entryCount;
  protected readonly stats = this.store.yearStats;

  protected readonly pendingAction = signal<DangerAction | null>(null);

  protected readonly isDefaultScale = computed(() => {
    const current = this.settings();
    return (
      current.taxRatePerKm === DEFAULT_SETTINGS.taxRatePerKm &&
      current.taxFixedAmount === DEFAULT_SETTINGS.taxFixedAmount
    );
  });

  protected updateNumber(
    key: 'defaultKm' | 'defaultToll' | 'taxRatePerKm' | 'taxFixedAmount',
    raw: string,
  ): void {
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.store.updateSettings({ [key]: value });
  }

  protected updateWeekdayType(raw: string): void {
    this.store.updateSettings({ defaultWeekdayType: raw === 'onsite' ? 'onsite' : 'remote' });
  }

  protected restoreDefaultScale(): void {
    this.store.updateSettings({
      taxRatePerKm: DEFAULT_SETTINGS.taxRatePerKm,
      taxFixedAmount: DEFAULT_SETTINGS.taxFixedAmount,
    });
    this.notifications.info('Barème par défaut rétabli.');
  }

  protected async onImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    try {
      this.store.importState(await readTextFile(file));
      this.notifications.success('Sauvegarde importée.');
    } catch {
      this.notifications.error('Import impossible : le fichier n’est pas une sauvegarde valide.');
    }
  }

  protected requestReset(action: DangerAction): void {
    this.pendingAction.set(this.pendingAction() === action ? null : action);
  }

  protected confirmReset(): void {
    const action = this.pendingAction();
    this.pendingAction.set(null);
    if (action === 'year') {
      const removed = this.store.resetYear(this.year());
      this.notifications.success(`${removed} journée(s) effacée(s) pour ${this.year()}.`);
    } else if (action === 'all') {
      this.store.resetAll();
      this.notifications.success('Toutes les données ont été effacées.');
    }
  }
}
