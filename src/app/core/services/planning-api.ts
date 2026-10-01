import { Injectable } from '@angular/core';
import type { PlanningState } from '../models/planning';

/**
 * Accès à l'état stocké dans SQLite. L'URL est relative : le serveur de
 * développement et le conteneur Docker exposent tous les deux `/api`.
 */
@Injectable({ providedIn: 'root' })
export class PlanningApi {
  async load(): Promise<unknown> {
    const response = await fetch('/api/state');
    if (!response.ok) {
      throw new Error(`Lecture impossible (${response.status}).`);
    }
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || !('state' in body)) {
      throw new Error('Réponse invalide.');
    }
    return body.state;
  }

  async save(state: PlanningState): Promise<void> {
    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!response.ok) {
      throw new Error(`Écriture impossible (${response.status}).`);
    }
  }
}
