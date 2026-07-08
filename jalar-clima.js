// jalar-clima.js
// MLBPro · Jalar clima de hoy por parque
// Usa Open-Meteo + schedule MLB.
// No usa Data Madre. No inventa datos.

async function climaFetchWeather(stadium, fechaInicio, fechaFin) {
  if (!stadium) throw new Error("climaFetchWeather: stadium vacío");

  var lat = stadium.lat || stadium.latitude;
  var lon = stadium.lon || stadium.lng || stadium.longitude;
  var tz = stadium.timezone || "America/New_York";

  if (lat === undefined || lon === undefined) {
    throw new Error("climaFetchWeather: estadio sin lat/lon");
  }

  var url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph" +
    "&precipitation_unit=mm" +
    "&timezone=" + encodeURIComponent(tz) +
    "&start_date=" + encodeURIComponent(fechaInicio) +
    "&end_date=" + encodeURIComponent(fechaFin);

  var resp = await fetch(url);
  if (!resp.ok) throw new Error("Open-Meteo HTTP " + resp.status);

  var data = await resp.json();
  var h = data.hourly || {};
  var times = h.time || [];

  var map = new Map();

  for (var i = 0; i < times.length; i++) {
    map.set(times[i], {
      time: times[i],
      temperature_f: h.temperature_2m ? h.temperature_2m[i] : null,
      humidity_pct: h.relative_humidity_2m ? h.relative_humidity_2m[i] : null,
      precipitation_mm: h.precipitation ? h.precipitation[i] : null,
      windspeed_mph: h.wind_speed_10m ? h.wind_speed_10m[i] : null,
      wind_dir: h.wind_direction_10m ? h.wind_direction_10m[i] : null
    });
  }

  return map;
}

function climaKeyTZ(gameDateISO, timezone) {
  try {
    var d = new Date(gameDateISO);
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(d);

    var obj = {};
    for (var i = 0; i < parts.length; i++) {
      obj[parts[i].type] = parts[i].value;
    }

    var hh = obj.hour;
    if (hh === "24") hh = "00";

    return obj.year + "-" + obj.month + "-" + obj.day + "T" + hh + ":" + obj.minute;
  } catch(e) {
    return String(gameDateISO || "").replace("Z", "").slice(0, 16);
  }
}

function climaBuscarHoraCercana(map, key) {
  if (!map || !key) return null;
  if (map.get(key)) return map.get(key);

  var base = new Date(key);
  if (isNaN(base.getTime())) return null;

  var mejor = null;
  var mejorDif = Infinity;

  map.forEach(function(val, k) {
    var d = new Date(k);
    if (isNaN(d.getTime())) return;

    var dif = Math.abs(d.getTime() - base.getTime());
    if (dif < mejorDif) {
      mejorDif = dif;
      mejor = val;
    }
  });

  return mejor;
}

function climaGuardarFilaHoy(fila) {
  try {
    if (typeof climaLeerCache !== "function" || typeof climaGuardarCache !== "function") return;

    var cache = climaLeerCache() || [];

    var existe = false;
    for (var i = 0; i < cache.length; i++) {
      if (cache[i] && cache[i].game_id === fila.game_id && cache[i].date === fila.date) {
        cache[i] = fila;
        existe = true;
        break;
      }
    }

    if (!existe) cache.push(fila);

    climaGuardarCache(cache);
  } catch(e) {}
}

async function jalarClima(logFn) {
  function log(t) {
    if (typeof logFn === "function") logFn(t);
  }

  var hoy = (function(){
    var d = new Date(Date.now() - 6 * 60 * 60 * 1000);
    return d.getFullYear() + "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
      ("0" + d.getDate()).slice(-2);
  })();

  log("Jalando clima de hoy: " + hoy);

  var mlbUrl =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" +
    hoy +
    "&hydrate=probablePitcher";

  var resp = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl));
  if (!resp.ok) throw new Error("Schedule clima HTTP " + resp.status);

  var data = await resp.json();
  var games = (data.dates && data.dates[0]) ? data.dates[0].games : [];

  log("Juegos para clima: " + games.length);

  for (var i = 0; i < games.length; i++) {
    var g = games[i];

    var venue = g.venue ? g.venue.name : "";
    var away = g.teams && g.teams.away && g.teams.away.team ? g.teams.away.team.name : "";
    var home = g.teams && g.teams.home && g.teams.home.team ? g.teams.home.team.name : "";

    var stadium = null;

    if (typeof stadiumGet === "function") {
      stadium = stadiumGet(venue);
    } else if (typeof STADIUM_INDEX !== "undefined" && typeof stadiumNorm === "function") {
      stadium = STADIUM_INDEX.get(stadiumNorm(venue));
    }

    if (!stadium) {
      log("  " + away + " @ " + home + " · " + venue + " → estadio NO_CONFIRMADO");
      continue;
    }

    var wmap = await climaFetchWeather(stadium, hoy, hoy);

    var keyTZ = climaKeyTZ(g.gameDate, stadium.timezone);
    var hit = climaBuscarHoraCercana(wmap, keyTZ);

    if (!hit) {
      log("  " + away + " @ " + home + " · " + venue + " → clima N/C");
      continue;
    }

    var fila = {
      date: hoy,
      game_id: g.gamePk,
      venue: venue,
      away_team: away,
      home_team: home,
      game_time: keyTZ,

      temperature_f: hit.temperature_f,
      windspeed_mph: hit.windspeed_mph,
      wind_dir: hit.wind_dir,
      humidity_pct: hit.humidity_pct,
      precipitation_mm: hit.precipitation_mm,

      source: "open-meteo", no
      tipo: "HOY"
    };

    climaGuardarFilaHoy(fila);

    log(
      "  " + away + " @ " + home +
      " · " + venue +
      " → " + hit.temperature_f + "°" +
      " · viento " + hit.windspeed_mph +
      " · dir " + hit.wind_dir +
      " · hum " + hit.humidity_pct + "%"
    );
  }

  log("Clima de hoy listo.");
  return true;
}
