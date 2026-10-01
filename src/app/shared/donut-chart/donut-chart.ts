import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSlice {
  readonly label: string;
  readonly color: string;
  readonly value: number;
}

const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Répartition en anneau, construite avec `stroke-dasharray` (aucune dépendance). */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut">
      <div class="donut__ring">
        <svg viewBox="0 0 140 140" role="img" [attr.aria-label]="ariaLabel()">
          <circle cx="70" cy="70" [attr.r]="radius" class="track" />
          @for (arc of arcs(); track arc.label) {
            <circle
              cx="70"
              cy="70"
              [attr.r]="radius"
              [attr.stroke]="arc.color"
              [attr.stroke-dasharray]="arc.dash"
              [attr.stroke-dashoffset]="arc.offset"
              class="arc"
            >
              <title>{{ arc.label }} : {{ arc.value }} ({{ arc.percent }} %)</title>
            </circle>
          }
        </svg>
        <div class="donut__center">
          <strong>{{ total() }}</strong>
          <span>{{ centerLabel() }}</span>
        </div>
      </div>
      <ul class="donut__legend">
        @for (arc of arcs(); track arc.label) {
          <li>
            <i [style.background]="arc.color"></i>
            <span class="donut__name">{{ arc.label }}</span>
            <span class="donut__value">{{ arc.value }}</span>
            <span class="donut__percent">{{ arc.percent }} %</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .donut {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.5rem;
    }

    .donut__ring {
      position: relative;
      flex: none;
      width: 150px;
      height: 150px;
    }

    svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    circle {
      fill: none;
      stroke-width: 16;
    }

    .track {
      stroke: var(--surface-2);
    }

    .arc {
      transition: opacity 0.15s ease;
    }

    .arc:hover {
      opacity: 0.75;
    }

    .donut__center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.1rem;
      pointer-events: none;
    }

    .donut__center strong {
      font-size: 1.5rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    .donut__center span {
      color: var(--text-faint);
      font-size: 0.72rem;
    }

    .donut__legend {
      flex: 1 1 190px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .donut__legend li {
      display: grid;
      grid-template-columns: 10px 1fr auto auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.3rem 0;
      font-size: 0.84rem;
    }

    .donut__legend li + li {
      border-top: 1px solid var(--border);
    }

    .donut__legend i {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }

    .donut__name {
      color: var(--text-muted);
    }

    .donut__value {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    .donut__percent {
      min-width: 3.4rem;
      color: var(--text-faint);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
  `,
})
export class DonutChart {
  readonly slices = input.required<readonly DonutSlice[]>();
  readonly centerLabel = input('jours');

  protected readonly radius = RADIUS;

  protected readonly total = computed(() =>
    this.slices().reduce((sum, slice) => sum + Math.max(0, slice.value), 0),
  );

  protected readonly arcs = computed(() => {
    const total = this.total();
    let consumed = 0;
    return this.slices()
      .filter((slice) => slice.value > 0)
      .map((slice) => {
        const ratio = total ? slice.value / total : 0;
        const length = ratio * CIRCUMFERENCE;
        const offset = -consumed;
        consumed += length;
        return {
          label: slice.label,
          color: slice.color,
          value: slice.value,
          percent: Math.round(ratio * 1000) / 10,
          dash: `${length} ${CIRCUMFERENCE - length}`,
          offset,
        };
      });
  });

  protected readonly ariaLabel = computed(
    () =>
      `Répartition : ${this.arcs()
        .map((arc) => `${arc.label} ${arc.value} (${arc.percent} %)`)
        .join(', ')}`,
  );
}
