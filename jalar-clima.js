/*
  MLBPro · jalar-clima.js

  FUNCIÓN:
  Orquestador principal del clima. Trae el schedule de MLB en un rango,
  cruza clima real por parque (vía clima-cache.js), cruza carreras y
  abridores reales por juego (vía MLB StatsAPI), aplica la Regla Madre
  (hoy nunca entra al histórico) y guarda: histórico validado en la Data
  Madre (climaGuardarCache) y clima de hoy en memoria (climaHoyGuardar).

  ENTRADAS:
  logFn (function, opcional) — callback de progreso. Internamente:
  MLB_ROUTES.WORKER_BASE (mlb-routes.js); stadiumNorm/STADIUM_INDEX
  (estadios.js); climaHoyISO, climaLeerCache, climaStartDesde,
  climaFetchWeather, climaKeyTZ, climaBuscarHoraCercana, climaHoyGuardar,
  climaGuardarCache, climaMerge (clima-cache.js).

  SALIDAS / MODIFICACIONES:
  Escribe localStorage["MLBPRO_CLIMA_CACHE_2026"] (histórico, vía
  climaGuardarCache) y CLIMA_HOY_MEM en RAM (hoy, vía climaHoyGuardar).
  Devuelve el array totalHistorico (mismo que queda en la Data Madre).

  DEPENDENCIAS:
  mlb-routes.js, estadios.js, clima-cache.js.

  NO TOCA:
  K6, F5, MoneyLine directamente — solo deja clima de hoy disponible en
  memoria para que esos módulos lo lean si quieren, nunca escribe ni
  modifica nada de esos módulos.

  UTC / HORA LOCAL DEL ESTADIO:
  Ambas. g.gameDate (de MLB StatsAPI) es UTC. Se convierte a hora LOCAL
  del estadio con climaKeyTZ(g.gameDate, tz) antes de cruzar contra el
  mapa de clima (que está indexado en hora local). El corte de "hoy" usa
  climaHoyISO() (America/New_York, definido en clima-cache.js).

  QUÉ HACE: trae schedule, clima, carreras y abridor confirmado por
  juego; guarda histórico validado y clima de hoy en memoria.

  QUÉ NO HACE: no calcula Coincidencia, no toca lineups del rival, no
  calibra ninguna fórmula. No inventa clima, carreras ni abridor cuando
  no puede confirmarlos — usa códigos ERR:... o null y sigue.

  QUÉ AFECTA: la Data Madre completa (histórico) y el clima de hoy en
  memoria — de ahí dependen Coincidencia, Over/Under, F5 (lectura),
  brújula, series por parque.

  QUÉ NO AFECTA: K6, MoneyLine, lineups, mercado — no los escribe ni
  los modifica.

  CORRECCIÓN ACTUAL (Bloque 2, Problema #7 — confirmado por código,
  mismo patrón que ya se corrigió antes en f5-historico-carreraje.js):
  Antes, home_pitcher_id/away_pitcher_id se tomaban como
  homePitchers[0]/awayPitchers[0] — el primer id de un arreglo
  (dBox.teams.X.pitchers), sin ninguna garantía de que fuera el abridor
  real. Corregido: ahora se recorre dBox.teams.X.players (objeto por
  jugador) y se exige EXACTAMENTE UN jugador con
  stats.pitching.gamesStarted === 1 para ese lado. Si no hay ninguno o
  hay más de uno, el pitcher_id de ese lado queda null (NO_CONFIRMADO
  para cualquier consumidor aguas abajo que ya trata null como abridor
  no confirmado, ej. f5-historico-carreraje.js). Nunca se asume el
  primero de la lista ni se inventa un abridor.

  ESTADO:
  NO_CONFIRMADO — corregido el Problema #7, pendiente de ejecución real
  para confirmar con evidencia (¿cuántos juegos quedan con pitcher_id
  null que antes tenían un valor tomado del primer elemento?).

  FECHA:
  12 jul 2026.
*/

// jalar-clima.js
//
// RUTA: Orquestador que jala el schedule de MLB, cruza clima (vía
//   clima-cache.js) y carreras/pitchers (vía MLB StatsAPI), y alimenta
//   tanto el histórico como el clima de hoy en memoria. Se ubica entre
//   MLB StatsAPI/clima-cache.js/estadios.js y el resto de la cadena de
//   Coincidencia (casar-series-test.html, calcular-coincidencia.js).
//
// RECIBE DE: MLB_ROUTES.WORKER_BASE (proxy para StatsAPI
//   schedule/linescore/boxscore); clima-cache.js (climaHoyISO,
//   climaLeerCache, climaStartDesde, climaFetchWeather, climaKeyTZ,
//   climaBuscarHoraCercana, climaHoyGuardar, climaGuardarCache,
//   climaMerge); estadios.js (stadiumNorm, STADIUM_INDEX — el índice ya
//   incluye alias resueltos por estadios.js al cargar, así que
//   STADIUM_INDEX.get(stadiumNorm(venue)) resuelve el mismo nombre maestro
//   que stadiumGet(venue); confirmado por auditoría, ver DEPENDENCIAS).
//
// ENTREGA A: climaGuardarCache() (histórico persistido en
//   MLBPRO_CLIMA_CACHE_2026) y climaHoyGuardar() (memoria temporal de
//   hoy), que a su vez alimentan casar-series-test.html,
//   calcular-coincidencia.js (y transitivamente score-match.js), y
//   Over/Under. F5 puede leer climaHoyLeer() si lo necesita.
//
// NO TOCA: K6, F5, Moneyline directamente (solo deja el clima de hoy
//   disponible en memoria para que esos módulos lo lean si quieren; no
//   escribe ni modifica nada de esos módulos).
//
// REGLA MADRE: El juego de hoy JAMÁS entra al histórico — solo pasa por
//   climaHoyGuardar() (memoria temporal), nunca por climaGuardarCache().
//   Al histórico (climaGuardarCache()) solo puede llegar un candidato que
//   cumpla TODAS estas condiciones:
//     - fecha (date) anterior a hoy (comparación de string ISO, más la
//       barrera propia de climaGuardarCache() en clima-cache.js);
//     - status === "Final";
//     - home_runs y away_runs numéricos Y finitos (Number.isFinite, no
//       solo typeof "number" — NaN también es typeof "number");
//     - parque resuelto contra el nombre maestro de estadios.js (si no se
//       resuelve, el registro queda con marcadores ERR:VENUE_NOT_IN_TABLE
//       en los campos de clima y es rechazado aguas abajo por
//       climaGuardarCache()/climaRegistroValido() como
//       VENUE_NO_RECONOCIDO — nunca se persiste en localStorage).
//   Ningún registro mezcla datos de un parque con el clima/orientación de
//   otro: el clima se busca siempre con la clave del propio parque del
//   juego (stadiumNorm(g.venue)).
//
// DEPENDENCIAS OBLIGATORIAS: MLB_ROUTES.WORKER_BASE; stadiumNorm() y
//   STADIUM_INDEX (de estadios.js — confirmado que STADIUM_INDEX ya trae
//   los alias de STADIUM_ALIAS_2026 fusionados al cargar, por lo que
//   equivale a stadiumGet() para resolver nombre maestro); climaHoyISO,
//   climaLeerCache, climaStartDesde, climaFetchWeather, climaKeyTZ,
//   climaBuscarHoraCercana, climaHoyGuardar, climaGuardarCache,
//   climaMerge (de clima-cache.js).
//
// SALIDA: array totalHistorico (el mismo que queda guardado en el caché
//   histórico tras climaGuardarCache(), ya filtrado por su propia
//   barrera). Efecto secundario: los registros de hoy quedan en memoria
//   vía climaHoyGuardar().
//
// SI ESTE ARCHIVO FALLA: el histórico no se actualiza
//   (casar-series-test.html y calcular-coincidencia.js siguen con datos
//   viejos), y el clima de hoy no llega a memoria (F5 y pantallas de hoy
//   pueden quedarse sin clima actual, repitiendo el cruce original).
//
// HISTORIAL: pitcher abridor desde boxscore (6 jul); gameDate UTC ->
//   climaKeyTZ() (9 jul); hora cercana ±3h (9 jul); limpieza crítica de
//   hoy/futuro/no-Final/carreras incompletas (10 jul); climaHoyGuardar()
//   agregado para juegos de hoy sin tocar el filtro histórico ni
//   climaGuardarCache() (11 jul, aprobado); CORREGIDO 11 jul 2026
//   (auditoría de integración completa): las tres validaciones de
//   carreras que solo comprobaban typeof "number" (en runsMap, en el
//   guardia de nuevosHistoricos, y en el filtro final de totalHistorico)
//   ahora exigen además Number.isFinite() — un NaN sigue siendo typeof
//   "number" y antes podía colarse en teoría. CORREGIDO 12 jul 2026
//   (auditoría Bloque 2, Problema #7): abridor confirmado por
//   gamesStarted===1 en vez de pitchers[0] (primer elemento del arreglo,
//   sin garantía de ser el abridor real). Ningún otro comportamiento
//   cambia: misma fecha de corte, mismo criterio Final, mismo manejo de
//   clima/carreras/venue no reconocido.

// Confirma el abridor REAL de un equipo en ESTE juego: recorre
// dBox.teams.X.players (objeto keyed por "ID...") y reune TODOS los
// jugadores cuyas estadisticas reales de ESE juego traen
// stats.pitching.gamesStarted === 1. Solo devuelve un id si encuentra
// EXACTAMENTE UNO -- si encuentra cero o mas de uno, devuelve null (nunca
// asume el primero de la lista ni adivina cual es el real). Mismo
// criterio ya validado en f5-historico-carreraje.js.
function jalarClimaAbridorConfirmado(players) {
  if (!players || typeof players !== "object") return null;

  const candidatos = [];
  const keys = Object.keys(players);

  for (let i = 0; i < keys.length; i++) {
    const p = players[keys[i]];
    const gs = p && p.stats && p.stats.pitching ? p.stats.pitching.gamesStarted : undefined;

    if (Number(gs) === 1 && p.person && p.person.id != null) {
      candidatos.push(p.person.id);
    }
  }

  return candidatos.length === 1 ? candidatos[0] : null;
}

async function jalarClima(logFn) {
  function log(t) {
    if (typeof logFn === "function") logFn(t);
  }

  const hoy = climaHoyISO();
  const cacheOriginal = climaLeerCache();

  // LIMPIEZA CRITICA:
  // El cache historico solo puede contener juegos anteriores a hoy,
  // Final y con carreras completas y finitas.
  const cacheViejo = cacheOriginal.filter(function(r) {
    if (!r || !r.date) return false;
    if (r.date >= hoy) return false;
    if (r.status !== "Final") return false;

    const homeRunsValidas =
      typeof r.home_runs === "number" &&
      Number.isFinite(r.home_runs);

    const awayRunsValidas =
      typeof r.away_runs === "number" &&
      Number.isFinite(r.away_runs);

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
        typeof hr !== "number" || !Number.isFinite(hr) ||
        typeof ar !== "number" || !Number.isFinite(ar)
      ) {
        throw new Error("runs no numerico o no finito");
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

      // CORREGIDO (Problema #7): antes se tomaba pitchers[0] (primer id
      // de un arreglo, sin garantia de ser el abridor). Ahora se exige
      // gamesStarted===1 confirmado en players, igual que
      // f5-historico-carreraje.js.
      const homePlayers =
        dBox &&
        dBox.teams &&
        dBox.teams.home &&
        dBox.teams.home.players
          ? dBox.teams.home.players
          : {};

      const awayPlayers =
        dBox &&
        dBox.teams &&
        dBox.teams.away &&
        dBox.teams.away.players
          ? dBox.teams.away.players
          : {};

      const homePitcherId = jalarClimaAbridorConfirmado(homePlayers);
      const awayPitcherId = jalarClimaAbridorConfirmado(awayPlayers);

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

  // ===== NUEVO 11 jul 2026: HOY -> climaHoyGuardar() (memoria temporal) =====
  // Solo juegos de hoy (g.date === hoy). No toca el filtro historico de arriba,
  // no llama climaGuardarCache(), no cambia runsMap/pitchersMap ni su logica.
  // Reusa el mismo mapa "weather" y la misma resolucion de hora ya calculados.
  let hoyGuardados = 0;

  games.forEach(function(g) {
    if (!g.date || g.date !== hoy) {
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
        const gameLocal = climaKeyTZ(g.gameDate, tz);

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

    // Pitchers: solo si ya vienen disponibles (este loop no los busca,
    // el boxscore de hoy normalmente aun no tiene abridores confirmados).
    const pit = pitchersMap.get(g.game_id);

    const registroHoy = {
      game_id: g.game_id,
      date: g.date,
      status: g.status,
      venue: g.venue,
      gameDate: g.gameDate,

      temperature_f: w.temperature_f,
      windspeed_mph: w.windspeed_mph,
      wind_dir: w.wind_dir,
      precipitation_mm: w.precipitation_mm,
      humidity_pct: w.humidity_pct,

      roof: roof,
      timezone: tz,

      home_team: g.home_team,
      away_team: g.away_team,

      home_pitcher_id:
        pit
          ? pit.home_pitcher_id
          : null,

      away_pitcher_id:
        pit
          ? pit.away_pitcher_id
          : null
    };

    if (climaHoyGuardar(registroHoy)) {
      hoyGuardados++;
    }
  });

  if (hoyGuardados > 0) {
    log(
      "HOY: " +
      hoyGuardados +
      " juego(s) guardado(s) en memoria temporal (climaHoyGuardar), no en historico."
    );
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

    // Un juego no entra hasta tener carreras finales completas y finitas.
    if (
      !rc ||
      typeof rc.home_runs !== "number" || !Number.isFinite(rc.home_runs) ||
      typeof rc.away_runs !== "number" || !Number.isFinite(rc.away_runs)
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
        typeof r.home_runs === "number" && Number.isFinite(r.home_runs) &&
        typeof r.away_runs === "number" && Number.isFinite(r.away_runs)
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
