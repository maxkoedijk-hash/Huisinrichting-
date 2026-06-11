# Postcode naar McDonald's (Chrome-extensie)

Manifest V3 Chrome-extensie die Nederlandse postcodes (formaat `1234 AB`) op
elke webpagina detecteert en per postcode de afstand toont tot de
dichtstbijzijnde McDonald's.

## Functionaliteit

- **Content script** (`content.js`) scant de DOM (inclusief dynamisch
  toegevoegde content via een `MutationObserver`) op Nederlandse postcodes met
  een regex. De niet-uitgegeven lettercombinaties `SA`, `SD` en `SS` worden
  overgeslagen.
- Na elke gevonden postcode wordt een klein McDonald's-icoontje geïnjecteerd.
- Bij hover of klik op het icoontje verschijnt een tooltip met de afstand in
  km en het adres van de dichtstbijzijnde McDonald's. Klikken pint de tooltip
  vast; nogmaals klikken (of ergens anders klikken) sluit hem.
- **Service worker** (`background.js`) doet de API-aanroepen:
  - [Nominatim](https://nominatim.org/release-docs/latest/api/Search/)
    geocodeert de postcode naar coördinaten (gethrottled op 1 verzoek/seconde
    conform de gebruiksvoorwaarden).
  - Via de [Overpass API](https://overpass-api.de/) wordt eenmalig de
    **complete lijst van alle McDonald's-vestigingen in Nederland**
    opgehaald (op `brand:wikidata=Q38076` en op naam) en 7 dagen gecached.
    De dichtstbijzijnde vestiging wordt daarna lokaal hemelsbreed
    (haversine) berekend — geen Overpass-aanroep per postcode meer.
    Bij een overbelaste server wordt geroteerd over mirrors met backoff,
    en valt de extensie terug op een eventueel verlopen gecachete lijst.
- Resultaten worden per postcode 30 dagen gecached in `chrome.storage.local`.
- Via de **popup** (`popup.html`/`popup.js`) kan de extensie aan/uit worden
  gezet en de cache worden gewist. De toggle werkt direct door op alle open
  tabbladen.

## Installatie (ontwikkelmodus)

1. Open `chrome://extensions` in Chrome.
2. Zet **Ontwikkelaarsmodus** aan (rechtsboven).
3. Klik op **Uitgepakte extensie laden** en kies deze map
   (`chrome-extension/`).

## Permissies

Alleen `activeTab` en `storage`. De API-aanroepen naar Nominatim en Overpass
hebben geen extra hostpermissies nodig omdat beide diensten CORS toestaan.

## Bestanden

| Bestand         | Rol                                            |
| --------------- | ---------------------------------------------- |
| `manifest.json` | Manifest V3-configuratie                       |
| `content.js`    | DOM-scan, icoontjes en tooltip                 |
| `content.css`   | Styling van icoontje en tooltip                |
| `background.js` | Geocoding, Overpass-zoekopdracht en caching    |
| `popup.html`    | Popup-UI (toggle + cache wissen)               |
| `popup.js`      | Popup-logica                                   |
