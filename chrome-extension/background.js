/**
 * Background service worker.
 *
 * Per postal code: geocode via Nominatim, then find nearby McDonald's by
 * racing several independent data sources in parallel — four public
 * Overpass (OpenStreetMap) instances and the official McDonald's store
 * locator API. The first source that answers wins and the rest are
 * aborted, so one slow or overloaded server never blocks the result.
 * Results are cached per postal code in chrome.storage.local.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const MCD_LOCATOR_URL = 'https://www.mcdonalds.com/googleappsv2/geolocation';
const SEARCH_RADIUS_M = 30000;
const FETCH_TIMEOUT_MS = 12000;
const CACHE_PREFIX = 'mcd:';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NOMINATIM_MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/sec

const inFlight = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'mcd-lookup' && typeof message.postcode === 'string') {
    handleLookup(normalizePostcode(message.postcode)).then(
      sendResponse,
      (err) => {
        console.warn('Lookup mislukt voor', message.postcode, err);
        sendResponse({ error: err && err.message ? err.message : 'Onbekende fout' });
      }
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
  const origin = await geocode(postcode);
  const locations = await findNearbyLocations(origin.lat, origin.lon);

  let best = null;
  for (const loc of locations) {
    const distanceKm = haversineKm(origin.lat, origin.lon, loc.lat, loc.lon);
    if (!best || distanceKm < best.distanceKm) {
      best = { distanceKm, ...loc };
    }
  }
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
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
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

// --- McDonald's locations: race all sources, first useful answer wins ---

const EMPTY_RESULT = 'EMPTY_RESULT';

async function findNearbyLocations(lat, lon) {
  const controllers = [];
  const withTimeout = (run) => {
    const controller = new AbortController();
    controllers.push(controller);
    const timer = setTimeout(
      () => controller.abort(new Error('timeout')),
      FETCH_TIMEOUT_MS
    );
    return run(controller.signal)
      .finally(() => clearTimeout(timer))
      .then((list) => {
        if (!list || list.length === 0) throw new Error(EMPTY_RESULT);
        return list;
      });
  };

  const attempts = [
    ...OVERPASS_ENDPOINTS.map((endpoint) =>
      withTimeout((signal) => overpassNearby(endpoint, lat, lon, signal))
    ),
    withTimeout((signal) => mcdonaldsLocator(lat, lon, signal)),
  ];

  try {
    const winner = await Promise.any(attempts);
    // A source answered; stop the others.
    controllers.forEach((c) => c.abort());
    return winner;
  } catch (aggregate) {
    const errors = (aggregate && aggregate.errors) || [];
    for (const err of errors) console.warn('Databron mislukt:', err);
    if (errors.some((err) => err.message === EMPTY_RESULT)) {
      throw new Error(
        `Geen McDonald’s gevonden binnen ${SEARCH_RADIUS_M / 1000} km van deze postcode.`
      );
    }
    throw new Error(
      'Geen van de databronnen was bereikbaar. Controleer je internetverbinding of probeer het later opnieuw.'
    );
  }
}

async function overpassNearby(endpoint, lat, lon, signal) {
  // Two cheap, indexed equality matches; no regex, no area computation.
  // "out center;" (body mode) returns tags AND coordinates — never use
  // "out tags", which omits node coordinates.
  const query = `[out:json][timeout:20];
(
  nwr["brand:wikidata"="Q38076"](around:${SEARCH_RADIUS_M},${lat},${lon});
  nwr["brand"="McDonald's"](around:${SEARCH_RADIUS_M},${lat},${lon});
);
out center 50;`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal,
  });
  if (!res.ok) throw new Error(`Overpass ${endpoint}: HTTP ${res.status}`);
  const json = await res.json();
  const list = [];
  for (const element of json.elements || []) {
    const elLat = element.lat ?? element.center?.lat;
    const elLon = element.lon ?? element.center?.lon;
    if (elLat == null || elLon == null) continue;
    const tags = element.tags || {};
    list.push({
      lat: elLat,
      lon: elLon,
      name: tags.name || "McDonald's",
      address: formatOsmAddress(tags),
    });
  }
  return list;
}

async function mcdonaldsLocator(lat, lon, signal) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    radius: '50',
    maxResults: '10',
    country: 'nl',
    language: 'nl-nl',
  });
  const res = await fetch(`${MCD_LOCATOR_URL}?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`mcdonalds.com: HTTP ${res.status}`);
  const json = await res.json();
  const list = [];
  for (const feature of json.features || []) {
    const coords = feature.geometry && feature.geometry.coordinates;
    const props = feature.properties || {};
    if (!coords || coords.length < 2) continue;
    const [fLon, fLat] = coords.map(Number);
    if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) continue;
    const city = props.addressLine3 || props.addressLine2 || '';
    const postcode = props.postcode || '';
    list.push({
      lat: fLat,
      lon: fLon,
      name: "McDonald's",
      address: ["McDonald's", props.addressLine1, [postcode, city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', '),
    });
  }
  return list;
}

function formatOsmAddress(tags) {
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
