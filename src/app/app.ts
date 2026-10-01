import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlanningStore } from './core/services/planning-store';
import { ToastHost } from './shared/toast-host/toast-host';

interface NavLink {
  readonly path: string;
  readonly label: string;
  readonly short: string;
  /** Tracé SVG de l'icône (24 × 24, dessinée en contour). */
  readonly icon: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHost],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly store = inject(PlanningStore);

  protected readonly links: readonly NavLink[] = [
    {
      path: '/tableau-de-bord',
      label: 'Tableau de bord',
      short: 'Synthèse',
      icon: 'M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z',
    },
    {
      path: '/calendrier',
      label: 'Calendrier',
      short: 'Calendrier',
      icon: 'M8 3v3M16 3v3M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5z',
    },
    {
      path: '/recapitulatif',
      label: 'Récapitulatif',
      short: 'Récap',
      icon: 'M4 6h16M4 12h16M4 18h9',
    },
    {
      path: '/reglages',
      label: 'Réglages',
      short: 'Réglages',
      icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M8 14.5v5',
    },
  ];

  protected shiftYear(delta: number): void {
    this.store.selectYear(this.store.selectedYear() + delta);
  }

  protected onYearChange(value: string): void {
    this.store.selectYear(Number(value));
  }
}
