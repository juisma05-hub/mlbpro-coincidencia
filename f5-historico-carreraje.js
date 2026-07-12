/*
  MLBPro · f5-historico-carreraje.js

  FUNCIÓN:
  Captura, de juegos históricos REALES ya jugados, las carreras anotadas en
  las primeras 5 entradas (F5) de cada equipo. Es una pieza de CAPTURA de
  datos crudos — no calcula ninguna proyección, no calibra ninguna fórmula,
  no toca la lógica de Carreraje/MoneyLine. Su único propósito es empezar a
  acumular la evidencia real que hoy no existe en ningún lado del repo
  (carreras por entrada, no por juego completo), necesaria para calibrar
  f5-carreraje.js más adelante con datos, no con coeficientes inventados.

  ENTRADAS:
  logFn (function, opcional) — callback para mostrar progreso en consola.
  Internamente: schedule de MLB StatsAPI (rango de fechas), linescore y
  boxscore de cada juego individual, todo vía MLB_ROUTES.WORKER_BASE.
  Rango recorrido: desde 2026-03-26 (fecha fija de inicio de temporada, la
  misma que usa clima-cache.js para su histórico) hasta AYER en horario
  oficial MLB (America/New_York). El día de HOY se excluye siempre, sin
  excepción, incluso si algún juego de hoy ya apareciera como "Final".

  SALIDAS / MODIFICACIONES:
  Escribe su PROPIA caché en localStorage, llave exacta:
    "F5_HISTORICO_CARRERAJE_2026"
  Esta llave es distinta y no se mezcla con "MLBPRO_CLIMA_CACHE_2026" (clima)
  ni con "lineas_f5_mercado_cache" (mercado F5). Cada registro guardado:
    { gamePk, date, home_team_id, away_team_id,
      home_pitcher_id, away_pitcher_id,
      f5_runs_home, f5_runs_away, status: "Final" }
  Un juego solo se guarda si: su status real es "Final", su fecha es
  anterior a hoy (America/New_York), tiene al menos 5 entradas jugadas por
  ambos equipos en el linescore real (nunca se rellenan entradas
  faltantes con 0), y tiene un abridor REAL CONFIRMADO para ambos equipos
  — no el primer pitcher de una lista, sino el único jugador cuyas
  estadísticas reales de ESE juego traen gamesStarted===1
  (boxscore.teams.X.players["ID..."].stats.pitching.gamesStarted). Si no
  se puede confirmar para alguno de los dos equipos, el juego se rechaza
  con SIN_ABRIDOR_REAL_CONFIRMADO y no se guarda. Si falta cualquier otra
  de esas condiciones, el juego también se cuenta como rechazado (con
  motivo) y NO se guarda — nunca con carreras o pitcher inventados.
  gamePk es clave única: un juego ya guardado se reemplaza, nunca se
  duplica.

  CORRECCIÓN (misma sesión, antes de la primera corrida real):
  La primera versión tomaba boxscore.teams.X.pitchers[0] — el primer id de
  un arreglo, que NO garantiza ser el abridor. Se corrigió a
  abridorRealDeF5() buscando gamesStarted===1, pero esa segunda versión
  devolvía el PRIMERO que encontraba con esa condición, sin confirmar que
  fuera el único — contradecía su propio comentario ("el único jugador").
  Corregido de nuevo: ahora reúne TODOS los candidatos con
  gamesStarted===1 y solo devuelve un id cuando encuentra EXACTAMENTE UNO.
  Si encuentra cero o más de uno, devuelve null y el juego se rechaza con
  SIN_ABRIDOR_REAL_CONFIRMADO — nunca se asume el primero de la lista ni
  se elige entre varios candidatos.

  DEPENDENCIAS:
  MLB_ROUTES.WORKER_BASE (mlb-routes.js) — única dependencia externa.
  No depende de clima-cache.js, jalar-clima.js, estadios.js ni de ningún
  otro módulo del repo: es una pieza autónoma, para no cruzarse por
  accidente con la cadena de Coincidencia/clima.
  Endpoints reales usados:
    - https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=...&endDate=...
    - https://statsapi.mlb.com/api/v1/game/{gamePk}/linescore
    - https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore

  NO TOCA:
  clima-cache.js, jalar-clima.js, f5-carreraje.js, factor-arsenal-lineup.js,
  f5-automatico.js, f5-moneyline.js (MoneyLine), K6, brújula (casar-series-
  test.html / medir-orientacion.html). No lee ni escribe ninguna de sus
  cachés. No calcula wOBA, no calcula factor, no calibra coeficiente
  alguno — solo guarda carreras reales de F5 por juego.

  UTC / HORA LOCAL DEL ESTADIO:
  No aplica. Este archivo no usa horarios de juego ni timezone de estadio
  en ningún cálculo: solo usa la fecha de calendario oficial que ya trae
  el schedule (day.date, formato YYYY-MM-DD, el mismo que MLB asigna
  oficialmente al juego) y el número de entrada (índice 0–4 del array de
  innings), nunca una hora. La única conversión de zona horaria que
  necesita es America/New_York para saber cuál es "hoy" y excluirlo — sin
  esto, no habría forma segura de trazar el corte.

  ESTADO:
  Pieza de captura de datos, NO es una fórmula de calibración. No
  determina si un woba_esperado alto o bajo predice más o menos carreras
  de F5 — solo junta la materia prima real para que, cuando haya
  suficiente volumen, esa relación se pueda calibrar con evidencia.
  NO_CONFIRMADO — corregido el abridor real (gamesStarted===1), pendiente
  de una corrida real para confirmar cuántos juegos captura de verdad.

  FECHA:
  12 jul 2026.
*/

var F5_HISTORICO_CACHE_KEY = "F5_HISTORICO_CARRERAJE_2026";
var F5_HISTORICO_START_FIJO = "2026-03-26";

function f5HistoricoLeerCache() {
  try {
    var raw = localStorage.getItem(F5_HISTORICO_CACHE_KEY);
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function f5HistoricoGuardarCache(records) {
  try {
    localStorage.setItem(F5_HISTORICO_CACHE_KEY, JSON.stringify(Array.isArray(records) ? records : []));
    return true;
  } catch (e) {
    return false;
  }
}

// Fecha de hoy en horario oficial MLB (America/New_York). Autónomo: no
// depende de climaHoyISO() de clima-cache.js.
function fechaHoyMLBF5() {
  var partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());

  var v = {};
  partes.forEach(function (p) { if (p.type !== "literal") v[p.type] = p.value; });
  return v.year + "-" + v.month + "-" + v.day;
}

function restarDiasF5(fechaISO, n) {
  var d = new Date(fechaISO + "T00:00:00Z");
  if (isNaN(d.getTime())) return fechaISO;
  d.setUTCDate(d.getUTCDate() - n);
  return d.getUTCFullYear() + "-" +
    ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getUTCDate()).slice(-2);
}

// Valida que una fecha "YYYY-MM-DD" sea una fecha REAL (no una que Date()
// haya normalizado, ej. "2026-02-30" -> 2026-03-02).
function fechaISOValidaF5(iso) {
  if (typeof iso !== "string") return false;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;

  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var d = parseInt(m[3], 10);

  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;

  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(dt.getTime())) return false;

  return dt.getUTCFullYear() === y &&
    (dt.getUTCMonth() + 1) === mo &&
    dt.getUTCDate() === d;
}

// Regla madre de este archivo: un registro solo es valido si es realmente
// Final, de fecha anterior a hoy, con F5 real completo y pitchers reales.
function f5HistoricoRegistroValido(r, hoyNY) {
  if (!r || r.gamePk == null) return "SIN_GAMEPK";
  if (!fechaISOValidaF5(r.date)) return "SIN_FECHA_VALIDA";
  if (r.date >= hoyNY) return "NO_INCORPORADO_HOY_O_FUTURO";
  if (r.status !== "Final") return "NO_INCORPORADO_NO_FINAL";
  if (typeof r.f5_runs_home !== "number" || !Number.isFinite(r.f5_runs_home)) return "F5_RUNS_HOME_INVALIDO";
  if (typeof r.f5_runs_away !== "number" || !Number.isFinite(r.f5_runs_away)) return "F5_RUNS_AWAY_INVALIDO";
  if (r.home_pitcher_id == null || r.away_pitcher_id == null) return "SIN_ABRIDOR_REAL_CONFIRMADO";
  if (r.home_team_id == null || r.away_team_id == null) return "SIN_TEAM_ID";
  return null; // valido
}

// Confirma el abridor REAL de un equipo en ESTE juego: recorre
// boxscore.teams.X.players (objeto keyed por "ID...") y reune TODOS los
// jugadores cuyas estadisticas reales de ESE juego traen
// stats.pitching.gamesStarted === 1. Solo devuelve un id si encuentra
// EXACTAMENTE UNO -- si encuentra cero o mas de uno, devuelve null (nunca
// asume el primero de la lista ni adivina cual es el real).
function abridorRealDeF5(players) {
  if (!players || typeof players !== "object") return null;

  var candidatos = [];
  var keys = Object.keys(players);

  for (var i = 0; i < keys.length; i++) {
    var p = players[keys[i]];
    var gs = p && p.stats && p.stats.pitching ? p.stats.pitching.gamesStarted : undefined;

    if (Number(gs) === 1 && p.person && p.person.id != null) {
      candidatos.push(p.person.id);
    }
  }

  if (candidatos.length !== 1) return null;

  return candidatos[0];
}

async function jalarF5HistoricoCarreraje(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = fechaHoyMLBF5();
  var desde = F5_HISTORICO_START_FIJO;
  var hasta = restarDiasF5(hoy, 1);

  var reporte = {
    guardados: 0,
    rechazados: [],
    total_en_cache: 0,
    rango: { desde: desde, hasta: hasta }
  };

  if (hasta < desde) {
    log("Aun no hay rango historico disponible (hoy es demasiado temprano en temporada).");
    reporte.total_en_cache = f5HistoricoLeerCache().length;
    return reporte;
  }

  log("Recorriendo juegos F5 historicos: " + desde + " -> " + hasta + " (hoy excluido siempre: " + hoy + ")");

  var mlbUrlSched =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=" + desde + "&endDate=" + hasta;
  var urlSched = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrlSched);
  var respSched = await fetch(urlSched);
  if (!respSched.ok) throw new Error("SCHEDULE HTTP " + respSched.status);

  var dataSched = await respSched.json();
  if (!dataSched || !Array.isArray(dataSched.dates)) throw new Error("El proxy no devolvio el calendario esperado.");

  var candidatos = [];
  dataSched.dates.forEach(function (day) {
    if (!day.date || day.date >= hoy) return; // hoy y futuro, fuera, siempre.
    (day.games || []).forEach(function (g) {
      var esFinal = g.status && g.status.detailedState === "Final";
      if (!esFinal) return;
      candidatos.push({
        gamePk: g.gamePk,
        date: day.date,
        home_team_id: (g.teams && g.teams.home && g.teams.home.team) ? g.teams.home.team.id : null,
        away_team_id: (g.teams && g.teams.away && g.teams.away.team) ? g.teams.away.team.id : null
      });
    });
  });

  log("Juegos Final en el rango: " + candidatos.length);

  var cacheViejo = f5HistoricoLeerCache();
  var mapaExistente = new Map();
  cacheViejo.forEach(function (r) {
    var motivo = f5HistoricoRegistroValido(r, hoy);
    if (motivo === null) mapaExistente.set(r.gamePk, r);
    else reporte.rechazados.push({ gamePk: r && r.gamePk, motivo: motivo, origen: "cache_previo" });
  });

  var procesados = 0;

  for (var i = 0; i < candidatos.length; i++) {
    var c = candidatos[i];
    procesados++;

    if (mapaExistente.has(c.gamePk)) {
      // Ya esta guardado y valido: no se vuelve a jalar (no gasta llamadas).
      continue;
    }

    try {
      log("Procesando " + procesados + "/" + candidatos.length + ": gamePk " + c.gamePk + " (" + c.date + ")");

      var urlLs = MLB_ROUTES.WORKER_BASE + encodeURIComponent(
        "https://statsapi.mlb.com/api/v1/game/" + c.gamePk + "/linescore"
      );
      var resLs = await fetch(urlLs);
      if (!resLs.ok) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: "LINESCORE_HTTP_" + resLs.status, origen: "entrante" });
        continue;
      }
      var dLs = await resLs.json();
      var innings = Array.isArray(dLs.innings) ? dLs.innings : [];

      if (innings.length < 5) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: "MENOS_DE_5_INNINGS_REALES", origen: "entrante" });
        continue;
      }

      var f5Home = 0, f5Away = 0, entradasOk = true;
      for (var inn = 0; inn < 5; inn++) {
        var h = innings[inn] && innings[inn].home ? innings[inn].home.runs : undefined;
        var a = innings[inn] && innings[inn].away ? innings[inn].away.runs : undefined;
        if (typeof h !== "number" || !Number.isFinite(h) || typeof a !== "number" || !Number.isFinite(a)) {
          entradasOk = false;
          break;
        }
        f5Home += h;
        f5Away += a;
      }

      if (!entradasOk) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: "CARRERAS_POR_ENTRADA_INCOMPLETAS", origen: "entrante" });
        continue;
      }

      var urlBox = MLB_ROUTES.WORKER_BASE + encodeURIComponent(
        "https://statsapi.mlb.com/api/v1/game/" + c.gamePk + "/boxscore"
      );
      var resBox = await fetch(urlBox);
      if (!resBox.ok) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: "BOXSCORE_HTTP_" + resBox.status, origen: "entrante" });
        continue;
      }
      var dBox = await resBox.json();

      var homePlayers = (dBox && dBox.teams && dBox.teams.home && dBox.teams.home.players)
        ? dBox.teams.home.players : {};
      var awayPlayers = (dBox && dBox.teams && dBox.teams.away && dBox.teams.away.players)
        ? dBox.teams.away.players : {};

      // Abridor REAL confirmado: gamesStarted===1 en las estadisticas reales
      // de ESE jugador en ESE juego (boxscore.teams.X.players["ID..."].stats.
      // pitching.gamesStarted). Nunca se asume por posicion de arreglo.
      var homePitcherId = abridorRealDeF5(homePlayers);
      var awayPitcherId = abridorRealDeF5(awayPlayers);

      if (homePitcherId == null || awayPitcherId == null) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: "SIN_ABRIDOR_REAL_CONFIRMADO", origen: "entrante" });
        continue;
      }

      var registro = {
        gamePk: c.gamePk,
        date: c.date,
        home_team_id: c.home_team_id,
        away_team_id: c.away_team_id,
        home_pitcher_id: homePitcherId,
        away_pitcher_id: awayPitcherId,
        f5_runs_home: f5Home,
        f5_runs_away: f5Away,
        status: "Final"
      };

      var motivoFinal = f5HistoricoRegistroValido(registro, hoy);
      if (motivoFinal !== null) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: motivoFinal, origen: "entrante" });
        continue;
      }

      mapaExistente.set(c.gamePk, registro);
      reporte.guardados++;
    } catch (err) {
      reporte.rechazados.push({ gamePk: c.gamePk, motivo: "ERROR_REAL: " + (err && err.message ? err.message : err), origen: "entrante" });
    }
  }

  var totalFinal = Array.from(mapaExistente.values());
  f5HistoricoGuardarCache(totalFinal);
  reporte.total_en_cache = totalFinal.length;

  log(
    "LISTO. Guardados nuevos: " + reporte.guardados +
    " | Rechazados: " + reporte.rechazados.length +
    " | Total en cache F5 historico: " + reporte.total_en_cache
  );

  return reporte;
}
