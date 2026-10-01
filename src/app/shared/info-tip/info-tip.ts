import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-info-tip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="info" [attr.aria-label]="text()">
      <span class="info__icon" aria-hidden="true">i</span>
      <span class="info__bubble">{{ text() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      position: relative;
      z-index: 4;
      flex: none;
    }

    :host:hover,
    :host:focus-within {
      z-index: 20;
    }

    .info {
      position: relative;
      display: inline-flex;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: help;
      color: inherit;
    }

    .info__icon {
      display: grid;
      place-items: center;
      width: 14px;
      height: 14px;
      border: 1px solid var(--border-strong);
      border-radius: 50%;
      color: var(--text-muted);
      font-size: 0.62rem;
      font-style: italic;
      font-weight: 600;
      line-height: 1;
    }

    .info__bubble {
      position: absolute;
      top: 50%;
      left: calc(100% + 8px);
      z-index: 4;
      width: max-content;
      max-width: 16rem;
      padding: 0.35rem 0.55rem;
      background: var(--surface-3);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow);
      color: var(--text);
      font-size: 0.74rem;
      font-style: normal;
      font-weight: 500;
      line-height: 1.35;
      white-space: normal;
      text-align: left;
      transform: translateY(-50%);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition:
        opacity 0.12s ease,
        visibility 0.12s ease;
    }

    :host:hover .info__bubble,
    :host:focus-within .info__bubble,
    .info:hover .info__bubble,
    .info:focus .info__bubble,
    .info:focus-visible .info__bubble {
      opacity: 1;
      visibility: visible;
    }
  `,
})
export class InfoTip {
  readonly text = input.required<string>();
}
