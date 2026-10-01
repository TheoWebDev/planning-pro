import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from './app.mjs';

const directory = mkdtempSync(join(tmpdir(), 'planning-pro-'));
const databasePath = join(directory, 'planning.sqlite');

/** @type {ReturnType<typeof createApp>} */
let app;
let baseUrl;

const sample = {
  version: 2,
  settings: {
    defaultKm: 80,
    tollRates: [
      { from: '2020-01-01', amount: 6 },
      { from: '2027-02-01', amount: 9.4 },
    ],
    defaultWeekdayType: 'remote',
    taxRatePerKm: 0.394,
    taxFixedAmount: 1515,
  },
  days: {
    '2026-03-02': { type: 'onsite', km: 95 },
  },
  selectedYear: 2026,
};

before(async () => {
  app = createApp({ databasePath });
  await listen(app);
});

after(async () => {
  await app.close();
  rmSync(directory, { recursive: true, force: true });
});

test('une base vide répond sans état', async () => {
  const response = await fetch(`${baseUrl}/api/state`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { state: null });
});

test('enregistre puis relit la même saisie', async () => {
  const saved = await fetch(`${baseUrl}/api/state`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sample),
  });
  assert.equal(saved.status, 200);

  const loaded = await fetch(`${baseUrl}/api/state`);
  assert.deepEqual(await loaded.json(), { state: sample });
});

test('refuse un état invalide sans écraser la base', async () => {
  const rejected = await fetch(`${baseUrl}/api/state`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: 2, days: {} }),
  });
  assert.equal(rejected.status, 400);

  const loaded = await fetch(`${baseUrl}/api/state`);
  assert.deepEqual(await loaded.json(), { state: sample });
});

test('retrouve les saisies après un redémarrage du serveur', async () => {
  await app.close();
  app = createApp({ databasePath });
  await listen(app);

  const loaded = await fetch(`${baseUrl}/api/state`);
  assert.deepEqual(await loaded.json(), { state: sample });
});

function listen(instance) {
  return new Promise((resolve) => {
    instance.server.listen(0, '127.0.0.1', () => {
      const address = instance.server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}
