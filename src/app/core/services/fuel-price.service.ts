import { Injectable } from '@angular/core';

/** Relevé instantané du prix moyen du SP98. */
export interface FuelPriceReading {
  readonly fuel: string;
  readonly pricePerLiter: number;
  /** Nombre de stations entrant dans la moyenne. */
  readonly stations: number;
  readonly readAt: string;
}

/**
 * L'open data du ministère autorise CORS (`Access-Control-Allow-Origin: *`) :
 * le navigateur peut l'interroger. On passe d'abord par `/api/fuel-price` pour
 * profiter du cache d'une heure du serveur, puis on retombe sur l'open data
 * si le conteneur n'a pas encore cette route (404) ou s'il est arrêté.
 */
const OPEN_DATA_URL =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets' +
  '/prix-des-carburants-en-france-flux-instantane-v2/records?' +
  new URLSearchParams({
    select: 'avg(sp98_prix) as moyenne, count(*) as stations',
    where: 'sp98_prix is not null',
    limit: '1',
  }).toString();

const TIMEOUT_MS = 8000;

@Injectable({ providedIn: 'root' })
export class FuelPriceService {
  async readSp98(): Promise<FuelPriceReading> {
    const local = await this.readFromLocalApi();
    if (local) {
      return local;
    }
    return this.readFromOpenData();
  }

  private async readFromLocalApi(): Promise<FuelPriceReading | null> {
    try {
      const response = await fetch('/api/fuel-price', { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) {
        return null;
      }
      return parseLocalReading(await response.json());
    } catch {
      return null;
    }
  }

  private async readFromOpenData(): Promise<FuelPriceReading> {
    const response = await fetch(OPEN_DATA_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Open data indisponible (${response.status}).`);
    }
    const reading = parseOpenDataReading(await response.json());
    if (!reading) {
      throw new Error('Relevé invalide.');
    }
    return reading;
  }
}

function parseLocalReading(body: unknown): FuelPriceReading | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const price = (body as Partial<FuelPriceReading>).pricePerLiter;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  return body as FuelPriceReading;
}

function parseOpenDataReading(body: unknown): FuelPriceReading | null {
  const record = (body as { results?: { moyenne?: unknown; stations?: unknown }[] })?.results?.[0];
  const price = Number(record?.moyenne);
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }
  return {
    fuel: 'SP98',
    pricePerLiter: Math.round(price * 1000) / 1000,
    stations: Number(record?.stations) || 0,
    readAt: new Date().toISOString(),
  };
}
