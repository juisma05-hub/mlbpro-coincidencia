// clima-cache.js
// PIEZA 4b - jalador de clima con cache.

const CLIMA_CACHE_KEY = "MLBPRO_CLIMA_CACHE_2026";
const CLIMA_START_FIJO = "2026-03-26";
const CLIMA_DIAS_RESOLAPE = 3;
const OPENMETEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

function climaLeerCache() {
  try {
    const raw = localStorage.getItem(CLIMA_CACHE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function climaGuardarCache(records) {
  localStorage.setItem(CLIMA_CACHE_KEY, JSON.stringify(records));
}

function climaAyerISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
}

function climaStartDesde(records) {
  if (!records || records.length === 0) return CLIMA_START_FIJO;
  const d = new Date();
  d.setDate(d.getDate() - 1 - CLIMA_DIAS_RESOLAPE);
  const reSolape = d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
  return reSolape < CLIMA_START_FIJO ? CLIMA_START_FIJO : reSolape;
}

function climaKeyTZ(utcISO, tz) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(utcISO));
  function g(t) { for (let i = 0; i < p.length; i++) if (p[i].type === t) return p[i].value; }
  return g("year") + "-" + g("month") + "-" + g("day") + "T" + g("hour") + ":00";
}

async function climaFetchWeather(s, start, end) {
  const url = OPENMETEO_ARCHIVE +
    "?latitude=" + s.lat + "&longitude=" + s.lon +
    "&start_date=" + start + "&end_date=" + end +
    "&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
    "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=mm" +
    "&timezone=" + encodeURIComponent(s.timezone);
  const res = await fetch(url);
  if (!res.ok) throw new Error("OPENMETEO HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error("OPENMETEO: " + (data.reason || "?"));
  const h = data.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error("OPENMETEO sin horas");
  const m = new Map();
  for (let i = 0; i < h.time.length; i++) {
    m.set(h.time[i], {
      temperature_f: h.temperature_2m[i],
      humidity_pct: h.relative_humidity_2m[i],
      precipitation_mm: h.precipitation[i],
      windspeed_mph: h.wind_speed_10m[i],
      wind_dir: h.wind_direction_10m[i]
    });
  }
  return m;
}

function climaMerge(viejos, nuevos) {
  const map = new Map();
  viejos.forEach(function (r) { map.set(r.game_id, r); });
  nuevos.forEach(function (r) { map.set(r.game_id, r); });
  return Array.from(map.values());
}

