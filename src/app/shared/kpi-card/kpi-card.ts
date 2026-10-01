import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { InfoTip } from '../info-tip/info-tip';

@Component({
  selector: 'app-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InfoTip],
  host: { '[class.kpi--highlight]': 'highlight()', class: 'kpi' },
  template: `
    <span class="kpi__label">
      @if (accent()) {
        <i class="kpi__dot" [style.background]="accent()"></i>
      }
      {{ label() }}
      @if (info()) {
        <app-info-tip [text]="info()" />
      }
    </span>
    <strong class="kpi__value">
      {{ value() }}
      @if (unit()) {
        <small>{{ unit() }}</small>
      }
    </strong>
    @if (hint()) {
      <span class="kpi__hint">{{ hint() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      overflow: visible;
      padding: 0.9rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }

    :host(.kpi--highlight) {
      background: linear-gradient(160deg, var(--accent-soft), var(--surface) 70%);
      border-color: #3b4a7a;
    }

    :host:has(:focus-within) {
      z-index: 5;
    }

    .kpi__label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 500;
    }

    .kpi__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex: none;
    }

    .kpi__value {
      font-size: clamp(1.25rem, 1rem + 1vw, 1.6rem);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .kpi__value small {
      margin-left: 0.15rem;
      color: var(--text-muted);
      font-size: 0.72em;
      font-weight: 500;
    }

    .kpi__hint {
      color: var(--text-faint);
      font-size: 0.74rem;
    }
  `,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number | null>();
  readonly unit = input<string>('');
  readonly hint = input<string>('');
  /** Texte de la bulle d'information affichée à côté du libellé. */
  readonly info = input<string>('');
  /** Couleur de la puce affichée devant le libellé. */
  readonly accent = input<string>('');
  readonly highlight = input(false);
}
