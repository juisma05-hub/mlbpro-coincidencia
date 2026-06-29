// clima-cache.js
// PIEZA 4b - jalador de clima con cache (Migrado a WeatherAPI).

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
  // WeatherAPI usa formato "lat,lon" para geolocalizar
  const q = (s.latitude || s.lat) + "," + (s.longitude || s.lon);
  
  // Extrae de forma segura la API KEY desde las variables de entorno
  const apiKey = process.env.WEATHER_API_KEY; 
  if (!apiKey) throw new Error("Falta la variable de entorno WEATHER_API_KEY");

  // Consultamos el pronóstico de 2 días que incluye el tiempo real del día de hoy
  const url = "https://weatherapi.com" + apiKey + "&q=" + q + "&days=2&aqi=no&alerts=no";

  const res = await fetch(url);
  if (!res.ok) throw new Error("WEATHERAPI HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error("WEATHERAPI: " + (data.error.message || "?"));

  const fday = data.forecast.forecastday;
  if (!fday || !Array.isArray(fday)) throw new Error("WEATHERAPI sin datos de dias");

  const m = new Map();

  fday.forEach(function (day) {
    if (Array.isArray(day.hour)) {
      day.hour.forEach(function (h) {
        // Formateamos la hora para que coincida exactamente con lo que busca tu climaKeyTZ
        // Pasa de "2026-06-29 14:00" a "2026-06-29T14:00"
        const keyHora = h.time.replace(" ", "T");

        m.set(keyHora, {
          temperature_f: h.temp_f,
          humidity_pct: h.humidity,
          precipitation_mm: h.precip_mm,
          windspeed_mph: h.wind_mph,
          wind_dir: h.wind_dir
        });
      });
    }
  });

  return m;
}

function climaMerge(viejos, nuevos) {
  const map = new Map();
  viejos.forEach(function (r) { map.set(r.game_id, r); });
  nuevos.forEach(function (r) { map.set(r.game_id, r); });
  return Array.from(map.values());
}
