// clima-cache.js
// PIEZA 4b - jalador de clima con cache.
// HOY/VENIDEROS = WeatherAPI (pasa por worker). PASADOS = Open-Meteo Archive (pasa por worker... 
// ojo: el worker solo permite statsapi.mlb.com y api.weatherapi.com — Open-Meteo Archive es publico, sin llave, va directo).

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

// Convierte direccion de viento de texto a grados numericos (WeatherAPI da texto "N","NNE",etc.)
function windDirToGrados(dir) {
  const tabla = {
    "N":0,"NNE":22,"NE":45,"ENE":67,"E":90,"ESE":112,"SE":135,"SSE":157,
    "S":180,"SSW":202,"SW":225,"WSW":247,"W":270,"WNW":292,"NW":315,"NNW":337
  };
  const d = String(dir || "").trim().toUpperCase();
  return tabla[d] !== undefined ? tabla[d] : null;
}

// ===== HOY / VENIDEROS — WeatherAPI (pasa por el worker, llave protegida) =====
async function climaFetchWeatherAPI(s) {
  const lat = s.lat || s.latitude;
  const lon = s.lon || s.longitude;
  const q = lat + "," + lon;

  const weatherUrl = "https://api.weatherapi.com/v1/forecast.json?q=" + q +
    "&days=3&aqi=no&alerts=no";

  const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(weatherUrl);

  const res = await fetch(url);
  if (!res.ok) throw new Error("WEATHERAPI HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error("WEATHERAPI: " + (data.error.message || "?"));

  const fday = data.forecast && data.forecast.forecastday;
  if (!fday || !Array.isArray(fday)) throw new Error("WEATHERAPI sin forecastday");

  const m = new Map();
  fday.forEach(function(day) {
    if (!Array.isArray(day.hour)) return;
    day.hour.forEach(function(h) {
      const key = h.time.replace(" ", "T");
      const grados = windDirToGrados(h.wind_dir);
      m.set(key, {
        temperature_f: h.temp_f,
        humidity_pct: h.humidity,
        precipitation_mm: h.precip_mm,
        windspeed_mph: h.wind_mph,
        wind_dir: grados !== null ? grados : h.wind_dir
      });
    });
  });

  return m;
}

// ===== PASADOS — Open-Meteo Archive (historial real, sin llave, publico) =====
async function climaFetchArchive(s, start, end) {
  const lat = s.lat || s.latitude;
  const lon = s.lon || s.longitude;
  const tz = s.timezone || "America/New_York";

  const archiveUrl = "https://archive-api.open-meteo.com/v1/archive" +
    "?latitude=" + lat + "&longitude=" + lon +
    "&start_date=" + start + "&end_date=" + end +
    "&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,winddirection_10m" +
    "&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=" + encodeURIComponent(tz);

  const res = await fetch(archiveUrl);
  if (!res.ok) throw new Error("OPENMETEO HTTP " + res.status);
  const data = await res.json();
  if (!data.hourly || !Array.isArray(data.hourly.time)) throw new Error("OPENMETEO sin hourly");

  const m = new Map();
  const H = data.hourly;
  for (let i = 0; i < H.time.length; i++) {
    const key = H.time[i]; // ya viene "2026-03-26T14:00" en timezone local
    m.set(key, {
      temperature_f: H.temperature_2m[i],
      humidity_pct: H.relativehumidity_2m[i],
      precipitation_mm: H.precipitation[i],
      windspeed_mph: H.windspeed_10m[i],
      wind_dir: H.winddirection_10m[i]
    });
  }
  return m;
}

// ===== ENRUTADOR — decide cual usar segun la fecha pedida =====
async function climaFetchWeather(s, start, end) {
  const hoy = climaHoyISO();

  if (end < hoy) {
    // todo el rango es pasado -> archive
    return await climaFetchArchive(s, start, end);
  }
  if (start >= hoy) {
    // todo el rango es hoy/futuro -> weatherapi
    return await climaFetchWeatherAPI(s);
  }

  // rango mixto: parte pasada (archive) + parte hoy/futuro (weatherapi)
  const ayer = climaAyerISO();
  const mPasado = await climaFetchArchive(s, start, ayer);
  const mFuturo = await climaFetchWeatherAPI(s);
  const merged = new Map(mPasado);
  mFuturo.forEach(function(v, k) { merged.set(k, v); });
  return merged;
}

function climaMerge(viejos, nuevos) {
  const map = new Map();
  viejos.forEach(function(r) { map.set(r.game_id, r); });
  nuevos.forEach(function(r) { map.set(r.game_id, r); });
  return Array.from(map.values());
}
