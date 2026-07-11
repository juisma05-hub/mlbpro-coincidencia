// jalar-clima.js
// PIEZA 4c - jalado completo: schedule + clima + carreras + cache.
//
// REGLA MADRE:
// El juego de hoy JAMAS entra al historico.
// Solo se guarda en Data Madre:
// 1. juego de fecha anterior a hoy;
// 2. estado Final;
// 3. carreras finales disponibles.
//
// Los juegos de hoy pueden consultarse para clima en vivo,
// pero NO se guardan en MLBPRO_CLIMA_CACHE_2026.
//
// CORREGIDO 6 jul 2026: se agrega el pitcher abridor (home/away) de cada
// juego Final, jalado del boxscore de MLB StatsAPI.
//
// CORREGIDO 9 jul 2026: gameDate de MLB viene en UTC. Para buscar clima
// por hora, se convierte a hora local del parque usando climaKeyTZ().
//
// CORREGIDO 9 jul 2026: si la hora exacta no existe, se busca una hora
// cercana dentro de un maximo de ±3 horas.
//
// CORRECCION CRITICA 10 jul 2026:
// - Se elimina del cache cualquier juego de hoy o futuro.
// - Se elimina cualquier registro que no tenga estado Final.
// - Se impide guardar nuevamente juegos de hoy.
// - Se exigen carreras finales numericas antes de incorporar un juego.
// - No se toca la conversion horaria, clima, viento ni pitchers.

async function jalarClima(logFn) {
  function log(t) {
    if (typeof logFn === "function") logFn(t);
  }

  const hoy = climaHoyISO();
  const cacheOriginal = climaLeerCache();

  // LIMPIEZA CRITICA:
  // El cache historico solo puede contener juegos anteriores a hoy,
  // Final y con carreras completas.
  const cacheViejo = cacheOriginal.filter(function(r) {
    if (!r || !r.date) return false;
    if (r.date >= hoy) return false;
    if (r.status !== "Final") return false;

    const homeRunsValidas =
      typeof r.home_runs === "number" &&
      !isNaN(r.home_runs);

    const awayRunsValidas =
      typeof r.away_runs === "number" &&
      !isNaN(r.away_runs);

    return homeRunsValidas && awayRunsValidas;
  });

  if (cacheViejo.length !== cacheOriginal.length) {
    log(
      "LIMPIEZA HISTORICA: eliminadas " +
      (cacheOriginal.length - cacheViejo.length) +
      " fila(s) contaminadas/no finales."
    );
  }

  const start = climaStartDesde(cacheViejo);

  // Se consulta hasta hoy para poder localizar clima actual,
  // pero hoy nunca se incorpora al cache historico.
  const end = hoy;

  log(
    "Cache historico limpio: " +
    cacheViejo.length +
    " filas. Consultando " +
    start +
    " -> " +
    end
  );

  const mlbUrl =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1" +
    "&startDate=" +
    start +
    "&endDate=" +
    end;

  const urlSched =
    MLB_ROUTES.WORKER_BASE +
    encodeURIComponent(mlbUrl);

  const resSched = await fetch(urlSched);

  if (!resSched.ok) {
    throw new Error("SCHEDULE HTTP " + resSched.status);
  }

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
        home_team:
          g.teams &&
          g.teams.home &&
          g.teams.home.team
            ? g.teams.home.team.name
            : "",
        away_team:
          g.teams &&
          g.teams.away &&
          g.teams.away.team
            ? g.teams.away.team.name
            : "",
        venue:
          g.venue && g.venue.name
            ? g.venue.name
            : "",
        status:
          g.status && g.status.detailedState
            ? g.status.detailedState
            : ""
      });
    });
  });

  log("Juegos consultados en rango: " + games.length);

  const present = new Map();

  games.forEach(function(g) {
    const k = stadiumNorm(g.venue);

    if (STADIUM_INDEX.has(k)) {
      present.set(k, STADIUM_INDEX.get(k));
    }
  });

  log("Estadios a consultar: " + present.size);

  const weather = new Map();
  let n = 0;

  for (const e of present) {
    const k = e[0];
    const s = e[1];
    n++;

    try {
      log("Clima " + n + "/" + present.size + ": " + s.venue);
      weather.set(
        k,
        await climaFetchWeather(s, start, end)
      );
    } catch (err) {
      weather.set(k, {
        error: err.message
      });

      log(
        "FALLO " +
        s.venue +
        ": " +
        err.message
      );
    }
  }

  const runsMap = new Map();
  const pitchersMap = new Map();

  let m = 0;

  for (const g of games) {
    m++;

    // Hoy no se procesa como historico aunque figure Final.
    if (g.date >= hoy) {
      continue;
    }

    if (g.status !== "Final") {
      continue;
    }

    try {
      log(
        "Carreras " +
        m +
        "/" +
        games.length +
        ": " +
        g.game_id
      );

      const urlLs =
        MLB_ROUTES.WORKER_BASE +
        encodeURIComponent(
          "https://statsapi.mlb.com/api/v1/game/" +
          g.game_id +
          "/linescore"
        );

      const resLs = await fetch(urlLs);

      if (!resLs.ok) {
        throw new Error(
          "LINESCORE HTTP " +
          resLs.status
        );
      }

      const dLs = await resLs.json();

      if (
        !dLs.teams ||
        !dLs.teams.home ||
        !dLs.teams.away
      ) {
        throw new Error("SIN teams.runs");
      }

      const hr = dLs.teams.home.runs;
      const ar = dLs.teams.away.runs;

      if (
        typeof hr !== "number" ||
        typeof ar !== "number"
      ) {
        throw new Error("runs no numerico");
      }

      runsMap.set(g.game_id, {
        home_runs: hr,
        away_runs: ar
      });
    } catch (err) {
      log(
        "FALLO carreras " +
        g.game_id +
        ": " +
        err.message
      );
    }

    try {
      const urlBox =
        MLB_ROUTES.WORKER_BASE +
        encodeURIComponent(
          "https://statsapi.mlb.com/api/v1/game/" +
          g.game_id +
          "/boxscore"
        );

      const resBox = await fetch(urlBox);

      if (!resBox.ok) {
        throw new Error(
          "BOXSCORE HTTP " +
          resBox.status
        );
      }

      const dBox = await resBox.json();

      const homePitchers =
        dBox &&
        dBox.teams &&
        dBox.teams.home &&
        Array.isArray(dBox.teams.home.pitchers)
          ? dBox.teams.home.pitchers
          : [];

      const awayPitchers =
        dBox &&
        dBox.teams &&
        dBox.teams.away &&
        Array.isArray(dBox.teams.away.pitchers)
          ? dBox.teams.away.pitchers
          : [];

      const homePitcherId =
        homePitchers.length > 0
          ? homePitchers[0]
          : null;

      const awayPitcherId =
        awayPitchers.length > 0
          ? awayPitchers[0]
          : null;

      if (homePitcherId || awayPitcherId) {
        pitchersMap.set(g.game_id, {
          home_pitcher_id: homePitcherId,
          away_pitcher_id: awayPitcherId
        });
      }
    } catch (err) {
      log(
        "FALLO boxscore/pitcher " +
        g.game_id +
        ": " +
        err.message
      );
    }
  }

  const nuevosHistoricos = [];

  games.forEach(function(g) {
    // BLOQUEO MADRE:
    // Hoy y fechas futuras no existen para el historico.
    if (!g.date || g.date >= hoy) {
      return;
    }

    if (g.status !== "Final") {
      return;
    }

    const rc = runsMap.get(g.game_id);

    // Un juego no entra hasta tener carreras finales completas.
    if (
      !rc ||
      typeof rc.home_runs !== "number" ||
      typeof rc.away_runs !== "number"
    ) {
      log(
        "NO INCORPORADO " +
        g.game_id +
        ": Final sin carreras completas."
      );

      return;
    }

    const k = stadiumNorm(g.venue);
    const s = STADIUM_INDEX.get(k);

    let w = {
      temperature_f: "",
      windspeed_mph: "",
      wind_dir: "",
      precipitation_mm: "",
      humidity_pct: ""
    };

    let roof = "";
    let tz = "";

    if (!s) {
      const e1 = "ERR:VENUE_NOT_IN_TABLE";

      w = {
        temperature_f: e1,
        windspeed_mph: e1,
        wind_dir: e1,
        precipitation_mm: e1,
        humidity_pct: e1
      };
    } else {
      roof = s.roof;
      tz = s.timezone;

      const c = weather.get(k);

      if (c && c.error) {
        const e2 = "ERR:WEATHERAPI";

        w = {
          temperature_f: e2,
          windspeed_mph: e2,
          wind_dir: e2,
          precipitation_mm: e2,
          humidity_pct: e2
        };
      } else if (c && typeof c.get === "function") {
        // MLB gameDate viene en UTC.
        // El clima usa hora local del estadio.
        const gameLocal =
          climaKeyTZ(g.gameDate, tz);

        const hit =
          c.get(gameLocal) ||
          climaBuscarHoraCercana(
            c,
            gameLocal
          );

        if (!hit) {
          const e3 = "ERR:NO_HOUR_MATCH";

          w = {
            temperature_f: e3,
            windspeed_mph: e3,
            wind_dir: e3,
            precipitation_mm: e3,
            humidity_pct: e3
          };
        } else {
          w = hit;
        }
      } else {
        const e4 = "ERR:WEATHER_MAP";

        w = {
          temperature_f: e4,
          windspeed_mph: e4,
          wind_dir: e4,
          precipitation_mm: e4,
          humidity_pct: e4
        };
      }
    }

    const pit = pitchersMap.get(g.game_id);

    nuevosHistoricos.push({
      date: g.date,
      game_id: g.game_id,
      game_time: g.gameDate,
      home_team: g.home_team,
      away_team: g.away_team,
      venue: g.venue,
      status: g.status,

      temperature_f: w.temperature_f,
      windspeed_mph: w.windspeed_mph,
      wind_dir: w.wind_dir,
      precipitation_mm: w.precipitation_mm,
      humidity_pct: w.humidity_pct,

      roof: roof,
      timezone: tz,

      home_runs: rc.home_runs,
      away_runs: rc.away_runs,
      total_runs:
        rc.home_runs +
        rc.away_runs,

      home_pitcher_id:
        pit
          ? pit.home_pitcher_id
          : null,

      away_pitcher_id:
        pit
          ? pit.away_pitcher_id
          : null
    });
  });

  const totalHistorico =
    climaMerge(
      cacheViejo,
      nuevosHistoricos
    ).filter(function(r) {
      // Ultima barrera antes de guardar.
      return (
        r &&
        r.date &&
        r.date < hoy &&
        r.status === "Final" &&
        typeof r.home_runs === "number" &&
        typeof r.away_runs === "number"
      );
    });

  climaGuardarCache(totalHistorico);

  log(
    "LISTO. Cache historico limpio: " +
    totalHistorico.length +
    " filas (" +
    nuevosHistoricos.length +
    " historicas incorporadas)."
  );

  return totalHistorico;
}
