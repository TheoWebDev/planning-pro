import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DEFAULT_SETTINGS, type TollRate } from '../../core/models/planning';
import { ExportService } from '../../core/services/export.service';
import { FuelPriceService } from '../../core/services/fuel-price.service';
import { NotificationService } from '../../core/services/notification.service';
import { PlanningStore } from '../../core/services/planning-store';
import { readTextFile } from '../../core/utils/file';
import { formatDateTime, formatNumber } from '../../core/utils/format';

type DangerAction = 'year' | 'all';

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  private readonly fuelPrices = inject(FuelPriceService);
  protected readonly exporter = inject(ExportService);

  protected readonly settings = this.store.settings;
  protected readonly year = this.store.selectedYear;
  protected readonly entryCount = this.store.entryCount;
  protected readonly stats = this.store.yearStats;

  protected readonly pendingAction = signal<DangerAction | null>(null);
  protected readonly fuelPriceLoading = signal(false);
  protected readonly fuelPriceStamp = computed(() => {
    const iso = this.settings().fuelPriceReadAt;
    return iso ? formatDateTime(iso) : '';
  });

  protected readonly tollRates = computed(() => this.settings().tollRates);

  protected readonly isDefaultScale = computed(() => {
    const current = this.settings();
    return (
      current.taxRatePerKm === DEFAULT_SETTINGS.taxRatePerKm &&
      current.taxFixedAmount === DEFAULT_SETTINGS.taxFixedAmount
    );
  });

  protected updateNumber(
    key: 'defaultKm' | 'taxRatePerKm' | 'taxFixedAmount' | 'fuelConsumption' | 'fuelPricePerLiter',
    raw: string,
  ): void {
    const value = parseAmount(raw);
    if (value === null) {
      return;
    }
    this.store.updateSettings({ [key]: value });
  }

  /** Pré-remplit le prix au litre avec la moyenne SP98 relevée par l'open data. */
  protected async fetchSp98Price(): Promise<void> {
    this.fuelPriceLoading.set(true);
    try {
      const reading = await this.fuelPrices.readSp98();
      this.store.updateSettings({
        fuelPricePerLiter: reading.pricePerLiter,
        fuelPriceReadAt: new Date().toISOString(),
      });
      this.notifications.success(
        `SP98 à ${formatNumber(reading.pricePerLiter, 3)} €/L, moyenne de ${formatNumber(reading.stations)} stations.`,
      );
    } catch {
      this.notifications.error('Relevé indisponible : saisissez le prix au litre à la main.');
    } finally {
      this.fuelPriceLoading.set(false);
    }
  }

  protected updateTollAmount(index: number, raw: string): void {
    const amount = parseAmount(raw);
    if (amount === null) {
      return;
    }
    this.replaceTollRate(index, (rate) => ({ ...rate, amount }));
  }

  protected updateTollFrom(index: number, raw: string): void {
    if (!ISO_PATTERN.test(raw)) {
      return;
    }
    this.replaceTollRate(index, (rate) => ({ ...rate, from: raw }));
  }

  /** Le nouveau tarif reprend le dernier montant, au 1er janvier suivant. */
  protected addTollRate(): void {
    const rates = this.tollRates();
    const last = rates[rates.length - 1];
    const year = Math.max(Number(last.from.slice(0, 4)), new Date().getFullYear()) + 1;
    this.store.updateSettings({
      tollRates: [...rates, { from: `${year}-01-01`, amount: last.amount }],
    });
  }

  protected removeTollRate(index: number): void {
    const rates = this.tollRates();
    if (rates.length === 1) {
      return;
    }
    this.store.updateSettings({ tollRates: rates.filter((_, position) => position !== index) });
  }

  private replaceTollRate(index: number, change: (rate: TollRate) => TollRate): void {
    this.store.updateSettings({
      tollRates: this.tollRates().map((rate, position) =>
        position === index ? change(rate) : rate,
      ),
    });
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

function parseAmount(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}
