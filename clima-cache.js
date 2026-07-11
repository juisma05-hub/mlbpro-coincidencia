// clima-cache.js
//
// RUTA: Capa central de clima. Recibe datos de WeatherAPI/Open-Meteo y
// entrega clima histórico y clima de hoy al resto de MLBPro.
//
// RECIBE DE: mlb-routes.js, estadios.js mediante stadiumGet(), WeatherAPI
// vía Worker y Open-Meteo Archive.
//
// ENTREGA A: jalar-clima.js, calcular-coincidencia.js,
// casar-series-test.html, Over/Under y F5 como lector.
//
// NO TOCA: K6, F5, Moneyline, fórmulas de Coincidencia ni Data Madre de
// pitchers. F5 solo puede leer; nunca modificar esta capa.
//
// REGLA MADRE: El juego de hoy nunca entra al histórico. Hoy vive solo en
// memoria temporal. Al histórico únicamente entran fechas anteriores a
// hoy, status Final, carreras numéricas finitas y parque reconocido.
//
// DEPENDENCIAS OBLIGATORIAS: MLB_ROUTES.WORKER_BASE y stadiumGet() de
// estadios.js para escribir histórico.
//
// SALIDA: climaLeerCache(), climaGuardarCache(), climaHoyGuardar(),
// climaHoyLeer(), climaFetchWeather(), climaKeyTZ(),
// climaBuscarHoraCercana() y climaMerge().
//
// SI ESTE ARCHIVO FALLA: no se actualiza el histórico, no llega el clima
// de hoy y Coincidencia, Over/Under y F5 quedan sin datos climáticos.

const CLIMA_CACHE_KEY = "MLBPRO_CLIMA_CACHE_2026";
const CLIMA_START_FIJO = "2026-03-26";
const CLIMA_DIAS_RESOLAPE = 3;
const CLIMA_TZ_MLB = "America/New_York"; // [FIX-1] corte oficial del día MLB

// ===== [FIX-2] MUNDO HOY: memoria temporal, nunca localStorage =====
// Las pantallas de hoy (F5, Over/Under, brújula) leen de aquí.
// Se pierde al recargar la página: correcto, el clima de hoy se vuelve a consultar.
const CLIMA_HOY_MEM = new Map(); // key: game_id -> registro de hoy

function climaHoyGuardar(rec) {
  if (!rec || rec.game_id == null) return false;
  CLIMA_HOY_MEM.set(rec.game_id, rec);
  return true;
}

function climaHoyLeer(gameId) {
  if (gameId == null) return Array.from(CLIMA_HOY_MEM.values());
  return CLIMA_HOY_MEM.get(gameId) || null;
}

function climaHoyLimpiar() {
  CLIMA_HOY_MEM.clear();
}

// Valida que una fecha "YYYY-MM-DD" sea una fecha REAL, no una que
// Date() haya normalizado (ej. "2026-02-30" -> 2026-03-02).
function fechaISOValida(iso) {
  if (typeof iso !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;

  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);

  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;

  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(dt.getTime())) return false;

  return dt.getUTCFullYear() === y &&
    (dt.getUTCMonth() + 1) === mo &&
    dt.getUTCDate() === d;
}

// ===== [FIX-1] FECHAS: siempre America/New_York para el corte MLB =====
// Protegida contra timezone invalida: si Intl.DateTimeFormat truena con la
// tz recibida, cae a CLIMA_TZ_MLB en vez de propagar la excepcion.
function climaFechaEnTZ(tz, offsetDias) {
  const tzSegura = (typeof tz === "string" && tz.trim()) ? tz : CLIMA_TZ_MLB;

  let p;
  try {
    p = new Intl.DateTimeFormat("en-US", {
      timeZone: tzSegura, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
  } catch (e) {
    // Timezone invalida (ej. string corrupto): usar la zona MLB oficial
    // como fallback seguro en vez de lanzar excepcion.
    p = new Intl.DateTimeFormat("en-US", {
      timeZone: CLIMA_TZ_MLB, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
  }

  function g(t) { for (let i = 0; i < p.length; i++) if (p[i].type === t) return p[i].value; }
  const hoyEnTZ = g("year") + "-" + g("month") + "-" + g("day");
  return offsetDias ? climaSumarDias(hoyEnTZ, offsetDias) : hoyEnTZ;
}

function climaHoyISO() {
  return climaFechaEnTZ(CLIMA_TZ_MLB, 0);
}

function climaAyerISO() {
  return climaFechaEnTZ(CLIMA_TZ_MLB, -1);
}

function climaStartDesde(records) {
  if (!records || records.length === 0) return CLIMA_START_FIJO;
  const reSolape = climaFechaEnTZ(CLIMA_TZ_MLB, -1 - CLIMA_DIAS_RESOLAPE);
  return reSolape < CLIMA_START_FIJO ? CLIMA_START_FIJO : reSolape;
}

// ===== MUNDO HISTÓRICO: localStorage auditado =====
function climaLeerCache() {
  try {
    const raw = localStorage.getItem(CLIMA_CACHE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

// [FIX-3] Regla madre aplicada AQUÍ, en la puerta del histórico.
// Un registro solo entra si:
//   - r.date es una fecha ISO REAL (fechaISOValida) y < hoy (New York)
//   - status === "Final"
//   - home_runs y away_runs numéricos Y finitos (Number.isFinite)
//   - stadiumGet() DEBE existir como función (dependencia obligatoria de
//     escritura histórica) y el parque debe resolverse contra ella
// Duplicados: game_id es clave única, el nuevo reemplaza al viejo.
function climaRegistroValido(r, hoyNY) {
  if (!r || r.game_id == null) return "SIN_GAME_ID";
  if (!fechaISOValida(r.date)) return "SIN_FECHA";
  if (r.date >= hoyNY) return "NO_INCORPORADO_HOY";
  if (r.status !== "Final") return "NO_INCORPORADO_NO_FINAL";
  if (typeof r.home_runs !== "number" || !Number.isFinite(r.home_runs) ||
      typeof r.away_runs !== "number" || !Number.isFinite(r.away_runs)) return "NO_INCORPORADO_SIN_CARRERAS";
  if (typeof stadiumGet !== "function") return "DEPENDENCIA_STADIUMGET_FALTANTE";
  if (!stadiumGet(r.venue)) return "VENUE_NO_RECONOCIDO";
  return null; // válido
}

function climaGuardarCache(records) {
  const hoyNY = climaHoyISO();
  const entrantes = Array.isArray(records) ? records : [];
  const reporte = { guardados: 0, rechazados: [], total_entrantes: entrantes.length };

  const map = new Map();
  // Base: lo ya guardado también se re-filtra (limpia contaminación previa al vuelo)
  climaLeerCache().forEach(function (r) {
    const motivo = climaRegistroValido(r, hoyNY);
    if (motivo === null) map.set(r.game_id, r);
    else reporte.rechazados.push({ game_id: r && r.game_id, motivo: motivo, origen: "cache_previo" });
  });

  entrantes.forEach(function (r) {
    const motivo = climaRegistroValido(r, hoyNY);
    if (motivo === null) { map.set(r.game_id, r); reporte.guardados++; }
    else reporte.rechazados.push({ game_id: r && r.game_id, motivo: motivo, origen: "entrante" });
  });

  localStorage.setItem(CLIMA_CACHE_KEY, JSON.stringify(Array.from(map.values())));
  return reporte; // auditable: fuente, motivo y filas rechazadas
}

// ===== HORAS =====
// Protegida contra timezone/fecha invalida: si la fecha UTC no es
// parseable o la timezone truena, devuelve null en vez de lanzar
// excepcion (los llamadores ya tratan un keyTZ null/falsy con gracia).
function climaKeyTZ(utcISO, tz) {
  const fecha = new Date(utcISO);
  if (isNaN(fecha.getTime())) return null;

  const tzSegura = (typeof tz === "string" && tz.trim()) ? tz : null;
  if (!tzSegura) return null;

  let p;
  try {
    p = new Intl.DateTimeFormat("en-US", {
      timeZone: tzSegura, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23"
    }).formatToParts(fecha);
  } catch (e) {
    return null; // timezone invalida: no se puede resolver clave horaria
  }

  function g(t){ for (let i=0;i<p.length;i++) if (p[i].type===t) return p[i].value; }
  return g("year")+"-"+g("month")+"-"+g("day")+"T"+g("hour")+":00";
}

// Busca la hora mas cercana en el mapa de clima cuando la hora exacta no existe.
// Honesta: busca maximo ±3 horas alrededor de keyTZ. Si no hay nada en ese rango,
// devuelve null (NO inventa clima de horas lejanas).
// keyTZ debe venir en formato "YYYY-MM-DDTHH:00" (el mismo que produce climaKeyTZ).
function climaBuscarHoraCercana(m, keyTZ) {
  if (!m || typeof m.get !== "function") return null;
  if (!keyTZ || typeof keyTZ !== "string" || keyTZ.length < 13) return null;

  const y  = parseInt(keyTZ.slice(0, 4), 10);
  const mo = parseInt(keyTZ.slice(5, 7), 10);
  const dd = parseInt(keyTZ.slice(8, 10), 10);
  const hh = parseInt(keyTZ.slice(11, 13), 10);
  if (isNaN(y) || isNaN(mo) || isNaN(dd) || isNaN(hh)) return null;

  const exacto = m.get(keyTZ);
  if (exacto) return exacto;

  const baseUTC = Date.UTC(y, mo - 1, dd, hh, 0, 0);
  const offsets = [1, -1, 2, -2, 3, -3];

  for (let i = 0; i < offsets.length; i++) {
    const d = new Date(baseUTC + offsets[i] * 3600000);
    const k = d.getUTCFullYear() + "-" +
      ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" +
      ("0" + d.getUTCDate()).slice(-2) + "T" +
      ("0" + d.getUTCHours()).slice(-2) + ":00";
    const hit = m.get(k);
    if (hit) return hit;
  }

  return null;
}

// Protegida contra fecha base invalida: si "fecha" no es parseable, cae a
// CLIMA_START_FIJO en vez de propagar "NaN-NaN-NaN".
function climaSumarDias(fecha, n) {
  const d = new Date(fecha + "T00:00:00Z");
  if (isNaN(d.getTime())) return CLIMA_START_FIJO;
  d.setUTCDate(d.getUTCDate() + n);
  return d.getUTCFullYear() + "-" + ("0"+(d.getUTCMonth()+1)).slice(-2) + "-" + ("0"+d.getUTCDate()).slice(-2);
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
    const tzEstadio = s.timezone || CLIMA_TZ_MLB;
    const ayer = climaFechaEnTZ(tzEstadio, -1);
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
  const hoy = climaFechaEnTZ(s.timezone || CLIMA_TZ_MLB, 0);
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

// Tolerante: si "viejos" o "nuevos" no son arrays, se tratan como vacios
// en vez de lanzar excepcion en .forEach().
function climaMerge(viejos, nuevos) {
  const viejosArr = Array.isArray(viejos) ? viejos : [];
  const nuevosArr = Array.isArray(nuevos) ? nuevos : [];
  const map = new Map();
  viejosArr.forEach(function(r){ if (r && r.game_id != null) map.set(r.game_id, r); });
  nuevosArr.forEach(function(r){ if (r && r.game_id != null) map.set(r.game_id, r); });
  return Array.from(map.values());
}
