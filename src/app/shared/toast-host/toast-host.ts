import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of notifications.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.tone">
          <span>{{ toast.message }}</span>
          <button
            type="button"
            class="toast__close"
            aria-label="Fermer"
            (click)="notifications.dismiss(toast.id)"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: min(360px, calc(100vw - 2rem));
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      background: var(--surface-3);
      border: 1px solid var(--border-strong);
      border-left-width: 3px;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow);
      font-size: 0.85rem;
      pointer-events: auto;
      animation: slide-in 0.18s ease-out;
    }

    .toast--success {
      border-left-color: var(--positive);
    }

    .toast--error {
      border-left-color: var(--danger);
    }

    .toast--info {
      border-left-color: var(--accent);
    }

    .toast__close {
      flex: none;
      margin: -0.2rem -0.2rem 0 auto;
      padding: 0 0.3rem;
      border: none;
      background: none;
      color: var(--text-faint);
      font-size: 1.1rem;
      line-height: 1.2;
      cursor: pointer;
    }

    .toast__close:hover {
      color: var(--text);
    }

    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
  `,
})
export class ToastHost {
  protected readonly notifications = inject(NotificationService);
}
