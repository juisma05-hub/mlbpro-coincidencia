// clima-cache.js
// HOY/RECIENTE(ayer)/VENIDEROS(3 dias) = WeatherAPI (via Worker, plan gratis).
// VIEJO (mas de 1 dia atras) = Open-Meteo Archive.

const CLIMA_CACHE_KEY = "MLBPRO_CLIMA_CACHE_2026";
const CLIMA_START_FIJO = "2026-03-26";
const CLIMA_DIAS_RESOLAPE = 3;

function climaLeerCache() {
  try {
    const raw = localStorage.getItem(CLIMA_CACHE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function climaGuardarCache(records) {
  localStorage.setItem(CLIMA_CACHE_KEY, JSON.stringify(records));
}

function climaAyerISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
}

function climaHoyISO() {
  const d = new Date();
  return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
}

function climaStartDesde(records) {
  if (!records || records.length === 0) return CLIMA_START_FIJO;
  const d = new Date();
  d.setDate(d.getDate() - 1 - CLIMA_DIAS_RESOLAPE);
  const reSolape = d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
  return reSolape < CLIMA_START_FIJO ? CLIMA_START_FIJO : reSolape;
}

function climaKeyTZ(utcISO, tz) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23"
  }).formatToParts(new Date(utcISO));
  function g(t){ for (let i=0;i<p.length;i++) if (p[i].type===t) return p[i].value; }
  return g("year")+"-"+g("month")+"-"+g("day")+"T"+g("hour")+":00";
}

function climaSumarDias(fecha, n) {
  const d = new Date(fecha + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
}

// ===== HOY/FUTURO (3 dias) + AYER (1 dia) — WeatherAPI vía Worker (plan gratis) =====
async function climaFetchForecastConPasado(s) {
  const lat = s.lat || s.latitude;
  const lon = s.lon || s.longitude;
  const q = lat + "," + lon;
  const m = new Map();

  function volcarHoras(hours) {
    hours.forEach(function(h) {
      const key = h.time.replace(" ", "T"); // "2026-06-29 14:00" -> "2026-06-29T14:00"
      m.set(key, {
        temperature_f: h.temp_f,
        humidity_pct: h.humidity,
        precipitation_mm: h.precip_mm,
        windspeed_mph: h.wind_mph,
        wind_dir: h.wind_degree
      });
    });
  }

  // Ayer (limite del plan gratis: solo 1 dia de historial)
  try {
    const ayer = climaAyerISO();
    const urlHist = "https://api.weatherapi.com/v1/history.json?q=" + encodeURIComponent(q) + "&dt=" + ayer;
    const resHist = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(urlHist));
    if (resHist.ok) {
      const dHist = await resHist.json();
      const fd = dHist.forecast && dHist.forecast.forecastday && dHist.forecast.forecastday[0];
      if (fd && fd.hour) volcarHoras(fd.hour);
    }
  } catch (eH) { /* si falla ayer, seguimos igual con hoy/futuro */ }

  // Hoy + 2 dias mas (limite del plan gratis: 3 dias de forecast)
  const urlFc = "https://api.weatherapi.com/v1/forecast.json?q=" + encodeURIComponent(q) + "&days=3";
  const resFc = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(urlFc));
  if (!resFc.ok) throw new Error("WEATHERAPI FC HTTP " + resFc.status);
  const dFc = await resFc.json();
  const days = (dFc.forecast && dFc.forecast.forecastday) ? dFc.forecast.forecastday : [];
  days.forEach(function(day) { if (day.hour) volcarHoras(day.hour); });

  return m;
}

// ===== VIEJO (mas de 1 dia atras) — Open-Meteo Archive =====
async function climaFetchArchive(s, start, end) {
  const lat = s.lat || s.latitude;
  const lon = s.lon || s.longitude;
  const tz = s.timezone || "America/New_York";
  const url = "https://archive-api.open-meteo.com/v1/archive" +
    "?latitude=" + lat + "&longitude=" + lon +
    "&start_date=" + start + "&end_date=" + end +
    "&hourly=temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,winddirection_10m" +
    "&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=" + encodeURIComponent(tz);

  const res = await fetch(url);
  if (!res.ok) throw new Error("OPENMETEO ARCH HTTP " + res.status);
  const data = await res.json();
  if (!data.hourly || !Array.isArray(data.hourly.time)) throw new Error("OPENMETEO ARCH sin hourly");

  const m = new Map();
  const H = data.hourly;
  for (let i = 0; i < H.time.length; i++) {
    m.set(H.time[i], {
      temperature_f: H.temperature_2m[i],
      humidity_pct: H.relativehumidity_2m[i],
      precipitation_mm: H.precipitation[i],
      windspeed_mph: H.windspeed_10m[i],
      wind_dir: H.winddirection_10m[i]
    });
  }
  return m;
}

// ===== ENRUTADOR =====
async function climaFetchWeather(s, start, end) {
  const hoy = climaHoyISO();
  const corte = climaSumarDias(hoy, -1); // mas de 1 dia atras = archive (limite plan gratis WeatherAPI)

  if (end < corte) {
    return await climaFetchArchive(s, start, end);
  }
  if (start >= corte) {
    return await climaFetchForecastConPasado(s);
  }
  // mixto: viejo + (ayer/hoy/futuro)
  const mViejo = await climaFetchArchive(s, start, climaSumarDias(corte, -1));
  const mNuevo = await climaFetchForecastConPasado(s);
  const merged = new Map(mViejo);
  mNuevo.forEach(function(v,k){ merged.set(k,v); });
  return merged;
}

function climaMerge(viejos, nuevos) {
  const map = new Map();
  viejos.forEach(function(r){ map.set(r.game_id, r); });
  nuevos.forEach(function(r){ map.set(r.game_id, r); });
  return Array.from(map.values());
}
