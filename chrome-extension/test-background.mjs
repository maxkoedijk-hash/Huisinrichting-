/**
 * End-to-end simulation of background.js with stubbed chrome.* and fetch.
 * Scenarios: slow/failing sources must not block the race; cache must be
 * used on the second lookup; all-sources-down must yield a fast error.
 *
 * Run: node test-background.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let storage = {};
let messageListener = null;

function makeChromeStub() {
  return {
    storage: {
      local: {
        get: async (key) => {
          if (key === null) return { ...storage };
          const keys = Array.isArray(key) ? key : [key];
          const out = {};
          for (const k of keys) if (k in storage) out[k] = storage[k];
          return out;
        },
        set: async (obj) => Object.assign(storage, obj),
        remove: async (keys) => {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete storage[k];
        },
      },
    },
    runtime: {
      onMessage: { addListener: (fn) => (messageListener = fn) },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
    },
  };
}

// --- fake servers ---
const NEAR = { lat: 52.4005, lon: 4.9333 }; // ~McDonald's Buikslotermeerplein
const overpassBody = JSON.stringify({
  elements: [
    {
      type: 'node',
      id: 1,
      lat: NEAR.lat,
      lon: NEAR.lon,
      tags: {
        name: "McDonald's",
        'addr:street': 'Buikslotermeerplein',
        'addr:housenumber': '15',
        'addr:postcode': '1025 ES',
        'addr:city': 'Amsterdam',
      },
    },
    { type: 'way', id: 2, center: { lat: 52.3105, lon: 4.9469 }, tags: { name: "McDonald's" } },
  ],
});
const locatorBody = JSON.stringify({
  features: [
    {
      geometry: { coordinates: [NEAR.lon, NEAR.lat] },
      properties: { addressLine1: 'Buikslotermeerplein 15', addressLine3: 'Amsterdam', postcode: '1025 ES' },
    },
  ],
});
const nominatimBody = JSON.stringify([{ lat: '52.3942', lon: '4.9577' }]);

function hangingFetch(signal) {
  return new Promise((_, reject) => {
    const onAbort = () => reject(new DOMException('signal timed out', 'AbortError'));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort);
  });
}

function makeFetch(scenario) {
  return (url, opts = {}) => {
    const u = String(url);
    if (u.includes('nominatim')) {
      return Promise.resolve(new Response(nominatimBody, { status: 200 }));
    }
    if (u.includes('overpass') || u.includes('mail.ru')) {
      if (scenario.overpass === 'hang') return hangingFetch(opts.signal);
      if (scenario.overpass === '504') {
        return Promise.resolve(new Response('gateway timeout', { status: 504 }));
      }
      if (u.includes('kumi') || u.includes('coffee')) return hangingFetch(opts.signal); // 2 slow mirrors
      return new Promise((resolve) =>
        setTimeout(() => resolve(new Response(overpassBody, { status: 200 })), 80)
      );
    }
    if (u.includes('mcdonalds.com')) {
      if (scenario.locator === 'down') {
        return Promise.resolve(new Response('forbidden', { status: 403 }));
      }
      return new Promise((resolve) =>
        setTimeout(() => resolve(new Response(locatorBody, { status: 200 })), 40)
      );
    }
    return Promise.reject(new Error('unexpected url ' + u));
  };
}

function loadWorker(scenario) {
  storage = {};
  messageListener = null;
  const context = vm.createContext({
    chrome: makeChromeStub(),
    fetch: makeFetch(scenario),
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    AbortController,
    AbortSignal,
    Promise,
    Response,
    DOMException,
    Number,
    Math,
    Date,
    JSON,
  });
  vm.runInContext(readFileSync(new URL('./background.js', import.meta.url), 'utf8'), context);
  if (!messageListener) throw new Error('onMessage listener not registered');
}

function lookup(postcode) {
  return new Promise((resolve) => {
    const keepOpen = messageListener(
      { type: 'mcd-lookup', postcode },
      {},
      (response) => resolve(response)
    );
    if (keepOpen !== true) throw new Error('listener must return true (async sendResponse)');
  });
}

let failures = 0;
function check(label, ok, detail) {
  if (ok) console.log('PASS:', label, detail ?? '');
  else {
    failures++;
    console.error('FAIL:', label, detail ?? '');
  }
}

// Scenario 1: two Overpass mirrors hang, the others respond → fast result.
loadWorker({});
let t0 = Date.now();
let res = await lookup('1024 ML');
let elapsed = Date.now() - t0;
check('result has distance', typeof res.distanceKm === 'number', JSON.stringify(res));
check('distance plausible (~0.5–3 km)', res.distanceKm > 0.3 && res.distanceKm < 3, res.distanceKm?.toFixed(2) + ' km');
check('address present', !!res.address, res.address);
check('fast despite 2 hanging mirrors', elapsed < 3000, elapsed + ' ms');

// Second lookup must come from cache (no fetch latency at all).
t0 = Date.now();
res = await lookup('1024ml');
check('postcode normalized + cached', typeof res.distanceKm === 'number' && Date.now() - t0 < 50, Date.now() - t0 + ' ms');

// Scenario 2: ALL Overpass instances return 504 → locator API saves the day.
loadWorker({ overpass: '504' });
res = await lookup('1024 ML');
check('locator fallback wins when all Overpass return 504', typeof res.distanceKm === 'number', JSON.stringify(res));

// Scenario 3: Overpass hangs AND locator is down → clear error, bounded time.
loadWorker({ overpass: 'hang', locator: 'down' });
t0 = Date.now();
res = await lookup('1024 ML');
elapsed = Date.now() - t0;
check('clear Dutch error when everything is down', !!res.error, res.error);
check('error within timeout budget', elapsed < 15000, elapsed + ' ms');

process.exit(failures ? 1 : 0);
