// clima-cache.js
// HOY/VENIDEROS = WeatherAPI forecast. RECIENTE (3-4 dias atras) = WeatherAPI history.
// VIEJO (antes de eso) = Open-Meteo Archive (publico, sin llave).

const CLIMA_CACHE_KEY = "MLBPRO_CLIMA_CACHE_2026";
const CLIMA_START_FIJO = "2026-03-26";
const CLIMA_DIAS_RESOLAPE = 3;

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

function climaHoyISO() {
  const d = new Date();
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

function windDirToGrados(dir) {
  const tabla = {
    "N":0,"NNE":22,"NE":45,"ENE":67,"E":90,"ESE":112,"SE":135,"SSE":157,
    "S":180,"SSW":202,"SW":225,"WSW":247,"W":270,"WNW":292,"NW":315,"NNW":337
  };
  const d = String(dir || "").trim().toUpperCase();
  return tabla[d] !== undefined ? tabla[d] : null;
}

function climaSumar
