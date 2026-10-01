import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearFuelPriceCache, fetchSp98Price } from './fuel-price.mjs';

function respond(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const sample = { results: [{ moyenne: 1.8734567, stations: 7155 }] };

beforeEach(() => clearFuelPriceCache());

test('arrondit la moyenne au millième et retient le nombre de stations', async () => {
  const reading = await fetchSp98Price({ fetchImpl: async () => respond(sample) });

  assert.equal(reading.pricePerLiter, 1.873);
  assert.equal(reading.stations, 7155);
  assert.equal(reading.fuel, 'SP98');
});

test('ne réinterroge pas l’open data tant que le cache est valide', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return respond(sample);
  };

  await fetchSp98Price({ fetchImpl, now: 0 });
  await fetchSp98Price({ fetchImpl, now: 60_000 });
  assert.equal(calls, 1);

  await fetchSp98Price({ fetchImpl, now: 2 * 60 * 60 * 1000 });
  assert.equal(calls, 2);
});

test('rejette une réponse sans moyenne exploitable', async () => {
  await assert.rejects(
    fetchSp98Price({ fetchImpl: async () => respond({ results: [{ moyenne: null }] }) }),
    /Prix moyen absent/,
  );
});

test('rejette une erreur HTTP de l’open data', async () => {
  await assert.rejects(
    fetchSp98Price({ fetchImpl: async () => respond({}, 503) }),
    /Open data indisponible/,
  );
});
