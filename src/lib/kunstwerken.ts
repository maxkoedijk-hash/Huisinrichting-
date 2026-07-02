export interface Kunstwerk {
  titel: string;
  url: string;
}

const SITE_URL = process.env.KUNST_SITE_URL ?? "https://www.mindofmaxi.com";
const CACHE_MS = 10 * 60 * 1000;
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
};

let cache: { werken: Kunstwerk[]; ts: number } | null = null;

function siteHost(): string {
  return new URL(SITE_URL).hostname.replace(/^www\./, "");
}

/** Alleen afbeeldingen van de eigen site mogen geproxied worden. */
export function isToegestaneAfbeeldingsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.replace(/^www\./, "");
    return host === siteHost() || host.endsWith(`.${siteHost()}`);
  } catch {
    return false;
  }
}

function schoonTitel(ruw: string): string {
  return ruw
    .replace(/<[^>]*>/g, "")
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\.(jpe?g|png|webp|gif)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lijktKunstwerk(url: string): boolean {
  const laag = url.toLowerCase();
  if (!/\.(jpe?g|png|webp)(\?|$)/.test(laag)) return false;
  const ruis = ["logo", "icon", "favicon", "avatar", "gravatar", "placeholder", "banner-", "sprite"];
  return !ruis.some((r) => laag.includes(r));
}

/** WordPress-formaatsuffix (bijv. -300x300) strippen zodat we de volle resolutie krijgen. */
function volleResolutie(url: string): string {
  return url.replace(/-\d{2,4}x\d{2,4}(?=\.(jpe?g|png|webp|gif))/i, "");
}

async function fetchTekst(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Poging 1: WordPress REST API (mediabibliotheek). */
async function viaWordPressApi(): Promise<Kunstwerk[]> {
  const tekst = await fetchTekst(
    `${SITE_URL}/wp-json/wp/v2/media?per_page=100&media_type=image`
  );
  if (!tekst) return [];
  try {
    const media = JSON.parse(tekst);
    if (!Array.isArray(media)) return [];
    return media
      .filter((m) => typeof m?.source_url === "string" && lijktKunstwerk(m.source_url))
      .map((m) => ({
        titel: schoonTitel(m?.title?.rendered ?? "") || "Zonder titel",
        url: m.source_url as string,
      }));
  } catch {
    return [];
  }
}

function extraheerAfbeeldingen(html: string, basisUrl: string): Kunstwerk[] {
  const werken: Kunstwerk[] = [];
  const imgRegex = /<img\b[^>]*>/gi;
  for (const tag of html.match(imgRegex) ?? []) {
    // Lazy-loading varianten eerst, daarna gewone src
    const srcMatch =
      tag.match(/\bdata-(?:lazy-)?src=["']([^"']+)["']/i) ??
      tag.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    let src = srcMatch[1];
    if (src.startsWith("data:")) continue;
    try {
      src = new URL(src, basisUrl).toString();
    } catch {
      continue;
    }
    if (!isToegestaneAfbeeldingsUrl(src) || !lijktKunstwerk(src)) continue;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    werken.push({
      titel: schoonTitel(altMatch?.[1] ?? "") || schoonTitel(src.split("/").pop() ?? "") || "Zonder titel",
      url: volleResolutie(src),
    });
  }
  return werken;
}

function extraheerInterneLinks(html: string, basisUrl: string): string[] {
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], basisUrl);
      const host = u.hostname.replace(/^www\./, "");
      if (host !== siteHost()) continue;
      if (/\.(jpe?g|png|webp|gif|pdf|zip)$/i.test(u.pathname)) continue;
      if (/\/(cart|checkout|winkelmand|afrekenen|my-account|wp-admin|wp-login)/i.test(u.pathname)) continue;
      u.hash = "";
      u.search = "";
      links.add(u.toString());
    } catch {
      // ongeldige link overslaan
    }
  }
  return [...links];
}

/** Poging 2: homepage + interne pagina's scrapen op <img>-tags. */
async function viaHtmlScrape(): Promise<Kunstwerk[]> {
  const home = await fetchTekst(SITE_URL);
  if (!home) return [];

  const werken = extraheerAfbeeldingen(home, SITE_URL);
  const paginas = extraheerInterneLinks(home, SITE_URL).slice(0, 12);
  const resultaten = await Promise.all(paginas.map((p) => fetchTekst(p)));
  for (let i = 0; i < resultaten.length; i++) {
    const html = resultaten[i];
    if (html) werken.push(...extraheerAfbeeldingen(html, paginas[i]));
  }
  return werken;
}

function dedupe(werken: Kunstwerk[]): Kunstwerk[] {
  const gezien = new Set<string>();
  const uniek: Kunstwerk[] = [];
  for (const w of werken) {
    const sleutel = volleResolutie(w.url);
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uniek.push({ ...w, url: sleutel });
  }
  return uniek;
}

export async function haalKunstwerkenOp(): Promise<Kunstwerk[]> {
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.werken;

  let werken = await viaWordPressApi();
  if (werken.length === 0) werken = await viaHtmlScrape();
  werken = dedupe(werken).slice(0, 60);

  if (werken.length > 0) cache = { werken, ts: Date.now() };
  return werken;
}
