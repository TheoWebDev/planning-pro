/**
 * Prix moyen du SP98 relevé par les stations françaises, via l'open data du
 * ministère de l'Économie (aucune clé d'API). La valeur est un relevé instantané :
 * elle sert à pré-remplir le réglage, pas à être rejouée à chaque calcul.
 */
const ENDPOINT =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets' +
  '/prix-des-carburants-en-france-flux-instantane-v2/records';

const QUERY = new URLSearchParams({
  select: 'avg(sp98_prix) as moyenne, count(*) as stations',
  where: 'sp98_prix is not null',
  limit: '1',
});

/** L'open data n'est rafraîchi que quelques fois par jour : inutile d'interroger plus souvent. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

let cache = null;

export async function fetchSp98Price({ now = Date.now(), fetchImpl = fetch } = {}) {
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const response = await fetchImpl(`${ENDPOINT}?${QUERY}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Open data indisponible (${response.status}).`);
  }

  const body = await response.json();
  const record = body?.results?.[0];
  const price = Number(record?.moyenne);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Prix moyen absent de la réponse.');
  }

  const value = {
    fuel: 'SP98',
    pricePerLiter: Math.round(price * 1000) / 1000,
    stations: Number(record?.stations) || 0,
    readAt: new Date(now).toISOString(),
  };
  cache = { fetchedAt: now, value };
  return value;
}

/** Utilisé par les tests pour repartir d'un cache vide. */
export function clearFuelPriceCache() {
  cache = null;
}
