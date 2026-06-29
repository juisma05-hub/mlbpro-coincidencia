// jalar-clima.js
// PIEZA 4c - jalado completo: schedule + clima + carreras + cache.
// Migrado a WeatherAPI. Incluye hoy (climaHoyISO).

async function jalarClima(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  const cacheViejo = climaLeerCache();
  const start = climaStartDesde(cacheViejo);
  const end = climaHoyISO(); // incluye hoy

  log("Cache: " + cacheViejo.length + " filas. Jalando " + start + " -> " + end);

  const mlbUrl = "https://statsapi.mlb.com/api/v1/schedule?sportId=1" +
    "&startDate=" + start + "&endDate=" + end;
  const urlSched = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);

  const resSched = await fetch(urlSched);
  if (!resSched.ok) throw new Error("SCHEDULE HTTP " + resSched.status);
  const dataSched = await resSched.json();
  if (!dataSched || !Array.isArray(dataSched.dates)) {
    throw new Error("El proxy no devolvio el calendario esperado.");
  }

  const games = [];
  dataSched.dates.forEach(function(day) {
    (day.games || []).forEach(function(g) {
      games.push({
        date: day.date,
        gameDate: g.gameDate,
        game_id: g.gamePk,
        home_team: g.teams?.home?.team?.name || "",
        away_team: g.teams?.away?.team?.name || "",
        venue: g.venue ? g.venue.name : "",
        status: g.status ? g.status.detailedState : ""
      });
    });
  });
  log("Juegos en rango: " + games.length);

  const present = new Map();
  games.forEach(function(g) {
    const k = stadiumNorm(g.venue);
    if (STADIUM_INDEX.has(k)) present.set(k, STADIUM_INDEX.get(k));
  });
  log("Estadios a consultar: " + present.size);

  const weather = new Map();
  let n = 0;
  for (const e of present) {
    const k = e[0], s = e[1]; n++;
    try {
      log("Clima " + n + "/" + present.size + ": " + s.venue);
      weather.set(k, await climaFetchWeather(s, start, end));
    } catch (err) {
      weather.set(k, { error: err.message });
      log("FALLO " + s.venue + ": " + err.message);
    }
  }

  const runsMap = new Map();
  let m = 0;
  for (const g of games) {
    m++;
    if (g.status !== "Final") { continue; }
    try {
      log("Carreras " + m + "/" + games.length + ": " + g.game_id);
      const urlLs = MLB_ROUTES.WORKER_BASE +
        encodeURIComponent("https://statsapi.mlb.com/api/v1/game/" + g.game_id + "/linescore");
      const resLs = await fetch(urlLs);
      if (!resLs.ok) throw new Error("LINESCORE HTTP " + resLs.status);
      const dLs = await resLs.json();
      if (!dLs.teams || !dLs.teams.home || !dLs.teams.away) throw new Error("SIN teams.runs");
      const hr = dLs.teams.home.runs;
      const ar = dLs.teams.away.runs;
      if (typeof hr !== "number" || typeof ar !== "number") throw new Error("runs no numerico");
      runsMap.set(g.game_id, { home_runs: hr, away_runs: ar });
    } catch (err) {
      log("FALLO carreras " + g.game_id + ": " + err.message);
    }
  }

  const nuevos = [];
  games.forEach(function(g) {
    const k = stadiumNorm(g.venue);
    const s = STADIUM_INDEX.get(k);
    let w = { temperature_f: "", windspeed_mph: "", wind_dir: "", precipitation_mm: "", humidity_pct: "" };
    let roof = "", tz = "";

    if (!s) {
      const e1 = "ERR:VENUE_NOT_IN_TABLE";
      w = { temperature_f: e1, windspeed_mph: e1, wind_dir: e1, precipitation_mm: e1, humidity_pct: e1 };
    } else {
      roof = s.roof; tz = s.timezone;
      const c = weather.get(k);
      if (c && c.error) {
        const e2 = "ERR:WEATHERAPI";
        w = { temperature_f: e2, windspeed_mph: e2, wind_dir: e2, precipitation_mm: e2, humidity_pct: e2 };
      } else {
        // WeatherAPI da hora local — usar directamente sin convertir timezone
        const gameLocal = g.gameDate.replace("Z","").slice(0,16); // "2026-06-29T14:00"
        const hit = c.get(gameLocal) || c.get(climaKeyTZ(g.gameDate, tz));
        if (!hit) {
          const e3 = "ERR:NO_HOUR_MATCH";
          w = { temperature_f: e3, windspeed_mph: e3, wind_dir: e3, precipitation_mm: e3, humidity_pct: e3 };
        } else {
          w = hit;
        }
      }
    }

    const rc = runsMap.get(g.game_id);
    nuevos.push({
      date: g.date, game_id: g.game_id,
      home_team: g.home_team, away_team: g.away_team,
      venue: g.venue, status: g.status,
      temperature_f: w.temperature_f, windspeed_mph: w.windspeed_mph,
      wind_dir: w.wind_dir, precipitation_mm: w.precipitation_mm,
      humidity_pct: w.humidity_pct, roof: roof, timezone: tz,
      home_runs: rc ? rc.home_runs : null,
      away_runs: rc ? rc.away_runs : null,
      total_runs: rc ? (rc.home_runs + rc.away_runs) : null
    });
  });

  const total = climaMerge(cacheViejo, nuevos);
  climaGuardarCache(total);
  log("LISTO. Total en cache: " + total.length + " filas (" + nuevos.length + " jaladas esta vez).");

  return total;
}
