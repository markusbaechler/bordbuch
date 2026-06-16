/**
 * BORDBUCH – Google Apps Script API  (v2 – Zählerstand-Modell, Ascona / Lago Maggiore)
 * Gebunden an die Tabelle, Tabellenblatt "Logbuch".
 * Endpunkte:
 *   GET  ?action=list&token=...                    -> alle Einträge
 *   POST {action:'create'|'update'|'delete', ...}  -> CRUD
 * Antwort immer: { ok: boolean, data?: ..., error?: string }
 */

const SHEET_NAME = 'Logbuch';

// Spaltenreihenfolge MUSS exakt der Header-Zeile entsprechen.
const HEADERS = [
  'id', 'createdAt', 'updatedAt',
  'date', 'harborFrom', 'harborTo',
  'engineHours',
  'fuelLiters', 'fuelCostChf',
  'paidBy', 'notes',
  'weatherTempC', 'weatherWindKn', 'weatherWindDir', 'weatherDesc'
];

// Felder, die der Client setzen darf (Rest wird serverseitig vergeben).
const USER_FIELDS = [
  'date', 'harborFrom', 'harborTo',
  'engineHours', 'fuelLiters', 'fuelCostChf',
  'paidBy', 'notes'
];

const DEFAULT_HARBOR_FROM = 'Ascona, Porto Patriziale';

// Hafen -> Koordinaten für die Wetter-Anreicherung (Lago Maggiore). Erweiterbar.
const HARBORS = {
  'Ascona, Porto Patriziale': { lat: 46.152, lon: 8.768 },
  'Ascona':                   { lat: 46.155, lon: 8.771 },
  'Locarno':                  { lat: 46.166, lon: 8.794 },
  'Brissago':                 { lat: 46.122, lon: 8.717 },
  'Magadino':                 { lat: 46.150, lon: 8.852 },
  'Cannobio':                 { lat: 46.067, lon: 8.692 },
  'Luino':                    { lat: 46.000, lon: 8.742 }
};
const DEFAULT_COORDS = HARBORS[DEFAULT_HARBOR_FROM]; // Ascona als Fallback


/* ============================ ENDPUNKTE ============================ */

function doGet(e) {
  try {
    if (!authorized(e.parameter.token)) return json({ ok: false, error: 'unauthorized' });
    if (e.parameter.action === 'list') return json({ ok: true, data: listRows() });
    return json({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  // CORS-Trick: Client sendet Content-Type text/plain -> kein Preflight.
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (!authorized(body.token)) return json({ ok: false, error: 'unauthorized' });

    switch (body.action) {
      case 'create': return json({ ok: true, data: createRow(body) });
      case 'update': return json({ ok: true, data: updateRow(body) });
      case 'delete': return json({ ok: true, data: deleteRow(body) });
      default:       return json({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}


/* ============================ CRUD ============================ */

function listRows() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  values.shift(); // Header weg
  return values.filter(row => row[0] !== '').map(rowToObject);
}

function createRow(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = new Date().toISOString();
    const obj = pickUserFields(body);
    if (!obj.harborFrom) obj.harborFrom = DEFAULT_HARBOR_FROM; // Default-Hafen
    obj.id = String(Date.now());
    obj.createdAt = now;
    obj.updatedAt = now;

    // Wetter automatisch anreichern (best effort; Fehler kippen den Eintrag nicht).
    const w = fetchWeather(obj.harborFrom, obj.date);
    obj.weatherTempC = w.tempC;
    obj.weatherWindKn = w.windKn;
    obj.weatherWindDir = w.windDir;
    obj.weatherDesc = w.desc;

    getSheet().appendRow(HEADERS.map(h => obj[h] === undefined ? '' : obj[h]));
    return obj;
  } finally {
    lock.releaseLock();
  }
}

function updateRow(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const rowIndex = findRowIndexById(sheet, body.id);
    if (rowIndex === -1) throw new Error('id not found: ' + body.id);

    const existing = rowToObject(sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0]);
    USER_FIELDS.forEach(f => { if (body[f] !== undefined) existing[f] = body[f]; });
    existing.updatedAt = new Date().toISOString();

    sheet.getRange(rowIndex, 1, 1, HEADERS.length)
         .setValues([HEADERS.map(h => existing[h] === undefined ? '' : existing[h])]);
    return existing;
  } finally {
    lock.releaseLock();
  }
}

function deleteRow(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const rowIndex = findRowIndexById(sheet, body.id);
    if (rowIndex === -1) throw new Error('id not found: ' + body.id);
    sheet.deleteRow(rowIndex);
    return { id: body.id, deleted: true };
  } finally {
    lock.releaseLock();
  }
}


/* ============================ WETTER ============================ */

/**
 * Tageswerte (Temperatur °C, Wind kn + Richtung, Wetterlage) für den Hafen am Datum.
 * Date-only -> wir nutzen den Open-Meteo "daily"-Endpunkt (kein Stunden-Picking noetig).
 * Waehlt automatisch Forecast- vs. Archiv-Endpunkt je nach Alter des Datums.
 */
function fetchWeather(harbor, date) {
  try {
    if (!date) return blankWeather();
    const c = HARBORS[harbor] || DEFAULT_COORDS;
    const d = String(date).slice(0, 10); // YYYY-MM-DD

    const ageDays = (Date.now() - new Date(d).getTime()) / 86400000;
    const base = ageDays > 5
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

    const url = base
      + '?latitude=' + c.lat + '&longitude=' + c.lon
      + '&daily=temperature_2m_mean,wind_speed_10m_max,wind_direction_10m_dominant,weather_code'
      + '&wind_speed_unit=kn&timezone=auto'
      + '&start_date=' + d + '&end_date=' + d;

    const res = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
    const day = res.daily;
    if (!day || !day.time || !day.time.length) return blankWeather();

    return {
      tempC: round1(day.temperature_2m_mean[0]),
      windKn: round1(day.wind_speed_10m_max[0]),
      windDir: numOrBlank(day.wind_direction_10m_dominant[0]),
      desc: wmoToText(day.weather_code[0])
    };
  } catch (err) {
    return blankWeather();
  }
}

function blankWeather() { return { tempC: '', windKn: '', windDir: '', desc: '' }; }

function wmoToText(code) {
  const m = {
    0: 'Klar', 1: 'Ueberwiegend klar', 2: 'Teilweise bewoelkt', 3: 'Bedeckt',
    45: 'Nebel', 48: 'Reifnebel',
    51: 'Leichter Niesel', 53: 'Niesel', 55: 'Starker Niesel',
    56: 'Gefrierender Niesel', 57: 'Gefrierender Niesel',
    61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen',
    66: 'Gefrierender Regen', 67: 'Gefrierender Regen',
    71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall',
    77: 'Schneegriesel',
    80: 'Leichte Schauer', 81: 'Schauer', 82: 'Heftige Schauer',
    85: 'Schneeschauer', 86: 'Schneeschauer',
    95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel'
  };
  return m[code] || '';
}


/* ============================ HELFER ============================ */

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Tabellenblatt "' + SHEET_NAME + '" nicht gefunden');
  return sheet;
}

function rowToObject(row) {
  const obj = {};
  HEADERS.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

function pickUserFields(body) {
  const obj = {};
  USER_FIELDS.forEach(f => { if (body[f] !== undefined) obj[f] = body[f]; });
  return obj;
}

function findRowIndexById(sheet, id) {
  const ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function authorized(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  return expected && token === expected;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function round1(n) { return (n === null || n === undefined) ? '' : Math.round(n * 10) / 10; }
function numOrBlank(n) { return (n === null || n === undefined) ? '' : Math.round(n); }


/* ============================ EINMALIGES SETUP ============================ */

function setupToken() {
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', 'HIER_DEIN_GEHEIMES_TOKEN');
}
