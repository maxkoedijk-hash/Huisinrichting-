/**
 * Background service worker: geocodes Dutch postal codes via Nominatim and
 * computes the distance to the nearest McDonald's locally, using a
 * country-wide list of all Dutch McDonald's locations fetched once from
 * Overpass (OpenStreetMap) and cached in chrome.storage.local.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Public Overpass instances; the main one regularly returns 429/504 under
// load, so we fall back to mirrors and retry.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const OVERPASS_ATTEMPTS = 3;
const CACHE_PREFIX = 'mcd:';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // per-postcode results: 30 days
const LOCATIONS_KEY = 'mcd:locations';
const LOCATIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // location list: 7 days
const NOMINATIM_MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/sec

const inFlight = new Map();
let locationsPromise = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'mcd-lookup' && typeof message.postcode === 'string') {
    handleLookup(normalizePostcode(message.postcode)).then(
      sendResponse,
      (err) => sendResponse({ error: err && err.message ? err.message : 'Onbekende fout' })
    );
    return true; // keep the message channel open for the async response
  }
});

function normalizePostcode(raw) {
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  return `${compact.slice(0, 4)} ${compact.slice(4, 6)}`;
}

async function handleLookup(postcode) {
  const key = CACHE_PREFIX + postcode;
  const stored = await chrome.storage.local.get(key);
  const cached = stored[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  if (inFlight.has(postcode)) return inFlight.get(postcode);
  const promise = lookup(postcode);
  inFlight.set(postcode, promise);
  try {
    const data = await promise;
    await chrome.storage.local.set({ [key]: { ts: Date.now(), data } });
    return data;
  } finally {
    inFlight.delete(postcode);
  }
}

async function lookup(postcode) {
  // Fetch both in parallel: the location list usually comes straight from
  // cache, Nominatim is the only real network call per postcode.
  const [origin, locations] = await Promise.all([
    geocode(postcode),
    getMcDonaldsLocations(),
  ]);

  let best = null;
  for (const loc of locations) {
    const distanceKm = haversineKm(origin.lat, origin.lon, loc.lat, loc.lon);
    if (!best || distanceKm < best.distanceKm) {
      best = { distanceKm, ...loc };
    }
  }
  if (!best) throw new Error('Geen McDonald’s-locaties beschikbaar.');
  return {
    distanceKm: best.distanceKm,
    address: best.address,
    name: best.name,
    location: { lat: best.lat, lon: best.lon },
  };
}

// --- Nominatim (geocoding), throttled to 1 request per second ---

let nominatimQueue = Promise.resolve();
let lastNominatimCall = 0;

function throttledFetchJson(url) {
  const result = nominatimQueue.then(async () => {
    const wait = lastNominatimCall + NOMINATIM_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimCall = Date.now();
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Geocodering mislukt (HTTP ${res.status}).`);
    return res.json();
  });
  // Keep the queue alive even when a request fails.
  nominatimQueue = result.catch(() => {});
  return result;
}

async function geocode(postcode) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'nl',
    postalcode: postcode,
  });
  const results = await throttledFetchJson(`${NOMINATIM_URL}?${params}`);
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`Postcode ${postcode} niet gevonden.`);
  }
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

// --- McDonald's locations: one country-wide Overpass query, cached 7 days ---

async function getMcDonaldsLocations() {
  const stored = await chrome.storage.local.get(LOCATIONS_KEY);
  const cached = stored[LOCATIONS_KEY];
  if (cached && Date.now() - cached.ts < LOCATIONS_TTL_MS && cached.list.length) {
    return cached.list;
  }

  if (!locationsPromise) {
    locationsPromise = fetchMcDonaldsLocations()
      .then(async (list) => {
        await chrome.storage.local.set({
          [LOCATIONS_KEY]: { ts: Date.now(), list },
        });
        return list;
      })
      .finally(() => {
        locationsPromise = null;
      });
  }
  const fresh = await locationsPromise.catch((err) => {
    // Fall back to a stale cached list rather than failing outright.
    if (cached && cached.list && cached.list.length) return cached.list;
    throw err;
  });
  return fresh;
}

async function fetchMcDonaldsLocations() {
  // Note: "out center;" (default body mode) returns tags AND coordinates.
  // Do not use "out center tags;": tags-mode omits node coordinates, which
  // makes every node location unusable.
  const query = `[out:json][timeout:30];
area["ISO3166-1"="NL"][admin_level=2]->.nl;
(
  nwr["brand:wikidata"="Q38076"](area.nl);
  nwr["amenity"="fast_food"]["name"~"mcdonald",i](area.nl);
);
out center;`;
  const json = await overpassRequest(query);
  const list = [];
  for (const element of json.elements || []) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = element.tags || {};
    list.push({
      lat,
      lon,
      name: tags.name || "McDonald's",
      address: formatAddress(tags),
    });
  }
  if (list.length === 0) {
    // An overloaded Overpass instance can return HTTP 200 with a "remark"
    // and no elements; treat that as a transient failure, never as
    // "no McDonald's exists".
    throw new Error(
      'De McDonald’s-locatielijst kon niet worden geladen (server overbelast). Probeer het over een minuut opnieuw.'
    );
  }
  return list;
}

/**
 * Runs an Overpass query, rotating over the available mirrors with a short
 * exponential backoff. 429 (rate limited) and 5xx (overloaded/timeout)
 * responses are treated as retryable.
 */
async function overpassRequest(query) {
  let lastError = null;
  for (let attempt = 0; attempt < OVERPASS_ATTEMPTS; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return await res.json();
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) break; // not retryable
    } catch (err) {
      lastError = err; // network error: try the next mirror
    }
  }
  throw new Error(
    `De McDonald’s-zoekserver (Overpass) is momenteel overbelast (${
      lastError ? lastError.message : 'onbekende fout'
    }). Probeer het over een minuut opnieuw.`
  );
}

function formatAddress(tags) {
  const street = [tags['addr:street'], tags['addr:housenumber']]
    .filter(Boolean)
    .join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const parts = [tags.name || "McDonald's", street, city].filter(Boolean);
  return parts.join(', ');
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
