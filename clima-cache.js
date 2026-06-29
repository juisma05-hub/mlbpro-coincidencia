// clima-cache.js
// PIEZA 4b - jalador de clima con cache (WeatherAPI - corregido).

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

// Convierte direccion de viento de texto a grados numericos
// WeatherAPI devuelve "N", "NNE", "NE", etc. — el sistema necesita grados (0-360)
function windDirToGrados(dir) {
  const tabla = {
    "N":0,"NNE":22,"NE":45,"ENE":67,"E":90,"ESE":112,"SE":135,"SSE":157,
    "S":180,"SSW":202,"SW":225,"WSW":247,"W":270,"WNW":292,"NW":315,"NNW":337
  };
  const d = String(dir || "").trim().toUpperCase();
  return tabla[d] !== undefined ? tabla[d] : null;
}

async function climaFetchWeather(s, start, end) {
  const lat = s.lat || s.latitude;
  const lon = s.lon || s.longitude;
  const q = lat + "," + lon;

  // La llave va aqui — reemplaza TU_LLAVE_WEATHERAPI con la tuya
  // IMPORTANTE: cuando tengas el worker, mueve la llave ahi para protegerla
  const apiKey = "TU_LLAVE_WEATHERAPI";

  // URL correcta de WeatherAPI — forecast da datos de hoy + historico reciente
  const url = "https://api.weatherapi.com/v1/forecast.json?key=" + apiKey +
    "&q=" + q + "&days=2&aqi=no&alerts=no";

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
      // WeatherAPI da "2026-06-29 14:00" — convertir a "2026-06-29T14:00"
      // SIN agregar Z (no es UTC, es hora local del parque)
      const key = h.time.replace(" ", "T");
      const grados = windDirToGrados(h.wind_dir);
      m.set(key, {
        temperature_f: h.temp_f,
        humidity_pct: h.humidity,
        precipitation_mm: h.precip_mm,
        windspeed_mph: h.wind_mph,
        wind_dir: grados !== null ? grados : h.wind_dir  // grados si hay, texto si no
      });
    });
  });

  return m;
}

function climaMerge(viejos, nuevos) {
  const map = new Map();
  viejos.forEach(function(r) { map.set(r.game_id, r); });
  nuevos.forEach(function(r) { map.set(r.game_id, r); });
  return Array.from(map.values());
}
