import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

export interface ChartSeries {
  readonly label: string;
  /** Couleur CSS (variable ou valeur littérale). */
  readonly color: string;
  readonly values: readonly number[];
}

interface Bar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly tooltip: string;
}

const PAD = { top: 14, right: 8, bottom: 24, left: 44 } as const;
const TICKS = 4;
const MIN_WIDTH = 300;

/**
 * Histogramme SVG sans dépendance externe. Le `viewBox` suit la largeur réelle
 * du conteneur, ce qui évite toute déformation du texte et garde des libellés
 * nets sur mobile comme sur grand écran.
 */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasData()) {
      <svg
        [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        [attr.width]="width()"
        [attr.height]="height()"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        @for (line of gridLines(); track line.y) {
          <line
            [attr.x1]="PAD.left"
            [attr.x2]="width()"
            [attr.y1]="line.y"
            [attr.y2]="line.y"
            class="grid"
          />
          <text [attr.x]="PAD.left - 8" [attr.y]="line.y + 4" class="axis axis--y">
            {{ line.label }}
          </text>
        }
        @for (bar of bars(); track $index) {
          <rect
            [attr.x]="bar.x"
            [attr.y]="bar.y"
            [attr.width]="bar.width"
            [attr.height]="bar.height"
            [attr.fill]="bar.color"
            rx="2"
          >
            <title>{{ bar.tooltip }}</title>
          </rect>
        }
        @for (label of categoryLabels(); track label.x) {
          <text [attr.x]="label.x" [attr.y]="height() - 7" class="axis axis--x">
            {{ label.text }}
          </text>
        }
      </svg>
      @if (series().length > 1) {
        <ul class="legend">
          @for (serie of series(); track serie.label) {
            <li><i [style.background]="serie.color"></i>{{ serie.label }}</li>
          }
        </ul>
      }
    } @else {
      <p class="empty">Aucune donnée à afficher.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    svg {
      display: block;
      max-width: 100%;
    }

    .grid {
      stroke: var(--border);
      stroke-width: 1;
    }

    .axis {
      fill: var(--text-faint);
      font-family: var(--font);
      font-size: 11px;
    }

    .axis--y {
      text-anchor: end;
    }

    .axis--x {
      text-anchor: middle;
    }

    rect {
      transition: opacity 0.15s ease;
    }

    rect:hover {
      opacity: 0.72;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin: 0.75rem 0 0;
      padding: 0;
      color: var(--text-muted);
      font-size: 0.78rem;
      list-style: none;
    }

    .legend li {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .legend i {
      width: 9px;
      height: 9px;
      border-radius: 2px;
    }

    .empty {
      padding: 2.5rem 0;
      color: var(--text-faint);
      font-size: 0.85rem;
      text-align: center;
    }
  `,
})
export class BarChart {
  readonly categories = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly stacked = input(false);
  /** Unité affichée dans les infobulles, ex. « km » ou « € ». */
  readonly unit = input('');
  readonly caption = input('');
  readonly height = input(210);

  protected readonly PAD = PAD;

  private readonly hostWidth = signal(MIN_WIDTH);
  protected readonly width = computed(() => Math.max(MIN_WIDTH, Math.round(this.hostWidth())));

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      this.hostWidth.set(entry?.contentRect.width ?? MIN_WIDTH);
    });
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  private readonly plotHeight = computed(() => this.height() - PAD.top - PAD.bottom);
  private readonly plotWidth = computed(() => this.width() - PAD.left - PAD.right);

  private readonly columnTotals = computed(() =>
    this.categories().map((_, index) =>
      this.series().reduce((sum, serie) => sum + Math.max(0, serie.values[index] ?? 0), 0),
    ),
  );

  protected readonly hasData = computed(() => this.columnTotals().some((total) => total > 0));

  private readonly scaleMax = computed(() => {
    const peak = this.stacked()
      ? Math.max(...this.columnTotals(), 0)
      : Math.max(
          ...this.series().flatMap((serie) => serie.values.map((value) => Math.max(0, value))),
          0,
        );
    // La borne haute est un multiple du pas, pour obtenir des graduations rondes.
    return niceStep(peak / TICKS) * TICKS;
  });

  protected readonly gridLines = computed(() =>
    Array.from({ length: TICKS + 1 }, (_, index) => {
      const ratio = index / TICKS;
      return {
        y: PAD.top + this.plotHeight() * ratio,
        label: formatCompact(this.scaleMax() * (1 - ratio)),
      };
    }),
  );

  protected readonly bars = computed<Bar[]>(() => {
    const categories = this.categories();
    const series = this.series();
    const max = this.scaleMax();
    const plotHeight = this.plotHeight();
    const baseline = PAD.top + plotHeight;
    const band = this.plotWidth() / Math.max(1, categories.length);
    const stacked = this.stacked();
    const groupWidth = band * 0.66;
    const barWidth = Math.max(2, groupWidth / (stacked ? 1 : series.length));
    const bars: Bar[] = [];

    categories.forEach((category, index) => {
      const bandStart = PAD.left + band * index + (band - groupWidth) / 2;
      let stackBottom = baseline;

      series.forEach((serie, serieIndex) => {
        const value = Math.max(0, serie.values[index] ?? 0);
        if (value <= 0) {
          return;
        }
        const barHeight = (value / max) * plotHeight;
        bars.push({
          x: stacked ? bandStart : bandStart + barWidth * serieIndex,
          y: stacked ? stackBottom - barHeight : baseline - barHeight,
          width: stacked ? groupWidth : barWidth,
          height: barHeight,
          color: serie.color,
          tooltip: `${category} — ${serie.label} : ${formatValue(value)} ${this.unit()}`.trim(),
        });
        if (stacked) {
          stackBottom -= barHeight;
        }
      });
    });

    return bars;
  });

  protected readonly categoryLabels = computed(() => {
    const categories = this.categories();
    const band = this.plotWidth() / Math.max(1, categories.length);
    // Sur écran étroit, on n'affiche qu'un libellé sur deux pour éviter les chevauchements.
    const stride = band < 26 ? 2 : 1;
    return categories
      .map((text, index) => ({ text, x: PAD.left + band * index + band / 2, index }))
      .filter((label) => label.index % stride === 0);
  });

  protected readonly ariaLabel = computed(() => {
    const totals = this.columnTotals();
    const detail = this.categories()
      .map((category, index) =>
        `${category} : ${formatValue(totals[index] ?? 0)} ${this.unit()}`.trim(),
      )
      .join(', ');
    return `${this.caption() || 'Graphique'}. ${detail}`;
  });
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

/** Arrondit un pas de graduation à la valeur « ronde » immédiatement supérieure. */
function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (NICE_STEPS.find((step) => normalized <= step) ?? 10) * magnitude;
}

const compactFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const valueFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

function formatCompact(value: number): string {
  return value >= 10000
    ? `${compactFormatter.format(value / 1000)} k`
    : compactFormatter.format(value);
}

function formatValue(value: number): string {
  return valueFormatter.format(value);
}
