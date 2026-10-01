import { inject, Injectable } from '@angular/core';
import { DAY_TYPE_MAP } from '../models/planning';
import { MONTH_LABELS } from '../utils/date';
import { downloadText, toCsv } from '../utils/file';
import { PlanningStore } from './planning-store';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly store = inject(PlanningStore);

  /** Récapitulatif mensuel, totaux et calcul fiscal — ouvrable directement dans Excel. */
  downloadSummaryCsv(): void {
    const stats = this.store.yearStats();
    const settings = this.store.settings();

    const rows: (string | number)[][] = [
      [
        'Mois',
        'Jours travaillés',
        'Sur site',
        'Télétravail',
        'Congés',
        'Fériés',
        'Kilomètres',
        'Péages (€)',
      ],
      ...stats.months.map((month) => [
        MONTH_LABELS[month.month],
        month.workedDays,
        month.onsiteDays,
        month.remoteDays,
        month.leaveDays,
        month.holidayDays,
        month.km,
        month.toll,
      ]),
      [
        'Total',
        stats.workedDays,
        stats.onsiteDays,
        stats.remoteDays,
        stats.leaveDays,
        stats.holidayDays,
        stats.km,
        stats.toll,
      ],
      ['Moyenne / mois', '', '', '', '', '', stats.kmPerMonth, stats.tollPerMonth],
      [],
      [
        'Barème kilométrique',
        `(${stats.km} × ${decimalComma(settings.taxRatePerKm)}) + ${settings.taxFixedAmount}`,
      ],
      ['Déduction à déclarer (€)', stats.taxDeduction],
      ['Péages de l’année (€)', stats.toll],
      ['Montant total (€)', stats.totalDeclared],
    ];

    downloadText(`planning-${stats.year}-recapitulatif.csv`, toCsv(rows), 'text/csv');
  }

  /** Détail journalier de l'année, une ligne par jour. */
  downloadDaysCsv(): void {
    const year = this.store.selectedYear();
    const rows: (string | number)[][] = [
      ['Date', 'Jour', 'Type', 'Kilomètres', 'Péage (€)', 'Jour férié', 'Note'],
      ...this.store
        .days()
        .map((day) => [
          day.iso,
          MONTH_LABELS[day.month],
          DAY_TYPE_MAP[day.type].label,
          day.km,
          day.toll,
          day.holidayName ?? '',
          day.note,
        ]),
    ];
    downloadText(`planning-${year}-journalier.csv`, toCsv(rows), 'text/csv');
  }

  /** Sauvegarde complète réimportable (réglages + journées de toutes les années). */
  downloadBackup(): void {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(
      `planning-pro-sauvegarde-${stamp}.json`,
      JSON.stringify(this.store.snapshot(), null, 2),
      'application/json',
    );
  }
}

/** Virgule décimale pour les nombres insérés dans un libellé textuel. */
function decimalComma(value: number): string {
  return String(value).replace('.', ',');
}
