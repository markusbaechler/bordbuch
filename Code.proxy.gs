/**
 * Bordbuch · Read-Proxy — Erweiterung des bestehenden Apps Script.
 *
 * Holt Live-Daten, die im Browser an CORS scheitern, serverseitig ab und gibt
 * sie als sauberes JSON zurück. Quelle: Alplakes-Simstrat-1D-Modell (Eawag) —
 * diese API sendet KEINE CORS-Header und ist deshalb nur serverseitig abrufbar.
 *
 * Open-Meteo (Wind) und existenz.ch (Pegel, auch der 30-Tage-Verlauf) brauchen
 * den Proxy NICHT — die ruft das Frontend weiterhin direkt auf.
 *
 * Endpunkte (alle GET, ?type=…):
 *   watertemp           Einzelwert „jetzt" (unverändert).
 *   watertemp-series    Tagesreihe der letzten N Tage (&days=30). Cache 3 h.
 *   watertemp-year      Aktuelles Jahr (mit Höchstwert) + Vorjahre. Cache 24 h.
 *
 * Deployment: Web App als NEUE Version bereitstellen
 *   ("Ausführen als: ich", "Zugriff: Jeder, auch anonym").
 *   UrlFetchApp verlangt beim ersten Lauf einmalig eine Autorisierung.
 */

var ALPLAKES = 'https://alplakes-api.eawag.ch/simulations/1d/point/simstrat/maggiore/';
var PAST_YEARS = 3; // Anzahl Vorjahre im Jahresvergleich

// Diese Logik in euer bestehendes doGet einbauen: zuerst auf `type` prüfen,
// sonst eure bisherige list-Logik ausführen.
function doGet(e) {
  var p = (e && e.parameter) || {};

  // Read-only, nur öffentliche Seedaten -> bewusst KEIN Token in der URL
  // (Query-Strings werden geloggt; ein Secret gehört da nicht rein).
  if (p.type === 'watertemp') {
    return jsonOut_(getWaterTemp_());
  }
  if (p.type === 'watertemp-series') {
    return jsonOut_(safe_(function () { return getWaterTempSeries_(p.days); }));
  }
  if (p.type === 'watertemp-year') {
    return jsonOut_(safe_(getWaterTempYear_));
  }

  // --- ab hier EURE bestehende list-Logik einsetzen ---
  // return jsonOut_(listTrips_());
  return jsonOut_({ ok: false, error: 'unknown type' });
}

/** Aktuelle Oberflächentemperatur des Lago Maggiore (Simstrat 1D, Tiefe 1 m). */
function getWaterTemp_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('watertemp');
  if (hit) return JSON.parse(hit);

  var now = new Date();
  var start = new Date(now.getTime() - 48 * 3600 * 1000); // 2 Tage Puffer
  var end   = new Date(now.getTime() +  6 * 3600 * 1000); // inkl. kurze Vorhersage

  var raw = fetchAlplakes_(start, end);
  if (!raw.temps.length) return { ok: false, error: 'empty' };

  // Messwert mit Zeitstempel am nächsten zu "jetzt".
  var target = now.getTime(), best = 0, bestDiff = Infinity;
  for (var i = 0; i < raw.times.length; i++) {
    var diff = Math.abs(new Date(raw.times[i]).getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }

  var out = {
    ok: true,
    value: Math.round(raw.temps[best] * 10) / 10,
    unit: 'degC',
    time: raw.times[best],
    source: 'alplakes'
  };
  cache.put('watertemp', JSON.stringify(out), 3600); // 1 h cachen
  return out;
}

/** Tagesreihe der letzten N Tage: { ok, unit, series:[{date, t}] }. Cache 3 h. */
function getWaterTempSeries_(daysParam) {
  var days = parseInt(daysParam, 10) || 30;
  if (days < 1) days = 1;
  if (days > 400) days = 400;

  var cache = CacheService.getScriptCache();
  var ck = 'wt-series-' + days;
  var hit = cache.get(ck);
  if (hit) return JSON.parse(hit);

  var now = new Date();
  var start = new Date(now.getTime() - days * 86400000);
  var daily = aggregateDaily_(start, now); // [{date, t}]

  var out = { ok: true, unit: 'degC', series: daily };
  cache.put(ck, JSON.stringify(out), 3 * 3600);
  return out;
}

/**
 * Jahresvergleich. Aktuelles Jahr (1.1.–heute) mit Tag-im-Jahr, Datum und
 * Höchstwert; dazu die letzten PAST_YEARS Vorjahre (nur doy + t). Cache 24 h.
 */
function getWaterTempYear_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('wt-year');
  if (hit) return JSON.parse(hit);

  var now = new Date();
  var cy = now.getUTCFullYear();

  // Aktuelles Jahr
  var curDaily = aggregateDaily_(new Date(Date.UTC(cy, 0, 1)), now);
  var maxV = -Infinity, maxDate = null;
  var cur = curDaily.map(function (d) {
    if (d.t > maxV) { maxV = d.t; maxDate = d.date; }
    return { doy: doy_(d.date), date: d.date, t: d.t };
  });
  var current = {
    year: cy,
    daily: cur,
    max: { value: maxV === -Infinity ? null : maxV, date: maxDate }
  };

  // Vorjahre (einzeln; ein fehlendes Jahr überspringen, nicht alles abbrechen).
  var past = [];
  for (var k = 1; k <= PAST_YEARS; k++) {
    var y = cy - k;
    try {
      var dd = aggregateDaily_(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31, 23, 59)));
      if (dd.length) {
        past.push({
          year: y,
          daily: dd.map(function (d) { return { doy: doy_(d.date), t: d.t }; })
        });
      }
    } catch (err) { /* Jahr überspringen */ }
  }

  var out = { ok: true, currentYear: current, pastYears: past };
  cache.put('wt-year', JSON.stringify(out), 24 * 3600);
  return out;
}

/* ----------------------------- Helfer ----------------------------- */

/** Roh-Zeitreihe (3-stündlich) von Alplakes holen: { times:[], temps:[] }. */
function fetchAlplakes_(start, end) {
  var fmt = function (d) { return Utilities.formatDate(d, 'UTC', 'yyyyMMddHHmm'); };
  var url = ALPLAKES + fmt(start) + '/' + fmt(end) + '/1';
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('alplakes ' + res.getResponseCode());
  }
  var data = JSON.parse(res.getContentText());
  return {
    times: data.time || [],
    temps: (data.variables && data.variables.T && data.variables.T.data) || []
  };
}

/** Alplakes-Reihe holen und auf UTC-Tagesmittel reduzieren: [{date:"YYYY-MM-DD", t}]. */
function aggregateDaily_(start, end) {
  var raw = fetchAlplakes_(start, end);
  var agg = {}; // "YYYY-MM-DD" -> {sum, n}
  for (var i = 0; i < raw.times.length; i++) {
    var t = raw.temps[i];
    if (t === null || t === undefined) continue;
    var key = String(raw.times[i]).slice(0, 10); // ISO-Datum (UTC)
    if (!agg[key]) agg[key] = { sum: 0, n: 0 };
    agg[key].sum += t;
    agg[key].n += 1;
  }
  return Object.keys(agg).sort().map(function (key) {
    return { date: key, t: Math.round(agg[key].sum / agg[key].n * 10) / 10 };
  });
}

/** Tag-im-Jahr (1..366) aus "YYYY-MM-DD". */
function doy_(dateStr) {
  var d = new Date(dateStr + 'T00:00:00Z');
  var start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

/** Funktion ausführen und Fehler als { ok:false, error } zurückgeben. */
function safe_(fn) {
  try {
    return fn();
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
