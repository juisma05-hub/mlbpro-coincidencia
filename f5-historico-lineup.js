/*
  MLBPro · f5-historico-lineup.js

  FUNCIÓN:
  Captura, de juegos históricos REALES ya jugados, el lineup titular real
  (9 bateadores confirmados) de cada equipo. Es la segunda pieza de
  captura de datos crudos que hace falta antes de poder calibrar
  honestamente f5-carreraje.js: sin el lineup real de cada juego pasado no
  se puede reconstruir el woba_esperado de ESE cruce específico, y sin eso
  no hay backtest posible (bloqueo ya identificado al auditar
  f5-calibracion-carreraje.js). Esta pieza NO calcula woba_esperado, NO
  cruza contra ARSENAL_MASTER_2026/BATTERS_VSPITCH_2026, NO calibra nada
  — solo captura el lineup real, crudo, por juego.

  ENTRADAS:
  logFn (function, opcional) — callback para mostrar progreso en consola.
  Internamente: schedule de MLB StatsAPI (mismo rango que
  f5-historico-carreraje.js) y boxscore de cada juego individual, todo vía
  MLB_ROUTES.WORKER_BASE. Rango recorrido: desde 2026-03-26 hasta AYER en
  horario oficial MLB (America/New_York). HOY se excluye siempre, sin
  excepción, igual que en f5-historico-carreraje.js.

  SALIDAS / MODIFICACIONES:
  Escribe su PROPIA caché en localStorage, llave exacta:
    "F5_HISTORICO_LINEUP_2026"
  Esta llave es distinta y NO se mezcla con "F5_HISTORICO_CARRERAJE_2026"
  (carreras/pitchers, pieza hermana), ni con "MLBPRO_CLIMA_CACHE_2026"
  (clima), ni con "lineas_f5_mercado_cache" (mercado F5). Cada registro
  guardado:
    { gamePk, date,
      lineup_home: [{orden, player_id, nombre}, ... 9],
      lineup_away: [{orden, player_id, nombre}, ... 9],
      status: "Final" }
  Un juego solo se guarda si: su status real es "Final", su fecha es
  anterior a hoy (America/New_York), y se pueden confirmar EXACTAMENTE 9
  titulares reales (battingOrder múltiplo de 100, el mismo criterio que ya
  usa extraerLineup() en jalar-lineup.js) para AMBOS equipos. Si un lado
  tiene menos o más de 9, o si falta el boxscore, el juego se rechaza con
  el motivo exacto y NO se guarda — nunca se completa un lineup incompleto
  ni se inventan bateadores.
  gamePk es clave única: un juego ya guardado se reemplaza, nunca se
  duplica.

  DEPENDENCIAS:
  MLB_ROUTES.WORKER_BASE (mlb-routes.js) — única dependencia externa.
  No depende de f5-historico-carreraje.js, clima-cache.js, jalar-clima.js,
  jalar-lineup.js, estadios.js ni de ningún otro módulo del repo: es una
  pieza autónoma (misma filosofía que su pieza hermana), aunque recorre el
  mismo tipo de rango de fechas.
  Endpoints reales usados:
    - https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=...&endDate=...
    - https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore

  NO TOCA:
  clima-cache.js, jalar-clima.js, f5-carreraje.js, factor-arsenal-lineup.js,
  f5-automatico.js, f5-moneyline.js (MoneyLine), f5-historico-carreraje.js,
  f5-calibracion-carreraje.js (todavía no existe), K6, brújula. No lee ni
  escribe ninguna de sus cachés, incluida "F5_HISTORICO_CARRERAJE_2026"
  (su pieza hermana) — son independientes a propósito.

  UTC / HORA LOCAL DEL ESTADIO:
  No aplica. Igual que f5-historico-carreraje.js: no usa horarios de
  juego ni timezone de estadio en ningún cálculo, solo la fecha de
  calendario oficial (day.date) y el battingOrder (un número de orden,
  no una hora). La única conversión de zona horaria que necesita es
  America/New_York para saber cuál es "hoy" y excluirlo siempre.

  ESTADO:
  Pieza de captura de datos, NO es una fórmula de calibración. Junta la
  materia prima (lineup real) que, sumada a f5-historico-carreraje.js
  (carreras + pitchers), es la que hace falta para que
  f5-calibracion-carreraje.js algún día pueda calcular woba_esperado real
  por juego histórico y hacer un backtest honesto.
  NO_CONFIRMADO — pendiente de correr la página de prueba.

  FECHA:
  12 jul 2026.
*/

var F5_LINEUP_CACHE_KEY = "F5_HISTORICO_LINEUP_2026";
var F5_LINEUP_START_FIJO = "2026-03-26";

function f5LineupLeerCache() {
  try {
    var raw = localStorage.getItem(F5_LINEUP_CACHE_KEY);
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function f5LineupGuardarCache(records) {
  try {
    localStorage.setItem(F5_LINEUP_CACHE_KEY, JSON.stringify(Array.isArray(records) ? records : []));
    return true;
  } catch (e) {
    return false;
  }
}

// Fecha de hoy en horario oficial MLB (America/New_York). Autonomo: no
// depende de climaHoyISO() ni de fechaHoyMLBF5() de f5-historico-carreraje.js.
function fechaHoyMLBLineupHist() {
  var partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());

  var v = {};
  partes.forEach(function (p) { if (p.type !== "literal") v[p.type] = p.value; });
  return v.year + "-" + v.month + "-" + v.day;
}

function restarDiasLineupHist(fechaISO, n) {
  var d = new Date(fechaISO + "T00:00:00Z");
  if (isNaN(d.getTime())) return fechaISO;
  d.setUTCDate(d.getUTCDate() - n);
  return d.getUTCFullYear() + "-" +
    ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getUTCDate()).slice(-2);
}

// Valida que una fecha "YYYY-MM-DD" sea una fecha REAL (no una que Date()
// haya normalizado, ej. "2026-02-30" -> 2026-03-02).
function fechaISOValidaLineupHist(iso) {
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

// Extrae el lineup titular REAL de un equipo desde boxscore.teams.X, con
// el MISMO criterio que ya usa extraerLineup() en jalar-lineup.js:
// battingOrder multiplo de 100 = titular. No se toca ni se copia esa
// funcion (este archivo es autonomo), pero el criterio es identico a
// proposito, para no inventar un criterio nuevo de "quien es titular".
function extraerLineupHistorico(team) {
  if (!team || !team.players) return [];

  var candidatos = [];
  var keys = Object.keys(team.players);

  for (var i = 0; i < keys.length; i++) {
    var p = team.players[keys[i]];
    var ordenRaw = p && p.battingOrder;

    if (ordenRaw === undefined || ordenRaw === null || ordenRaw === "") continue;

    var ordenNum = parseInt(ordenRaw, 10);
    if (isNaN(ordenNum) || ordenNum % 100 !== 0) continue;

    var id = p.person && p.person.id != null ? p.person.id : null;
    var nombre = p.person && p.person.fullName ? p.person.fullName : "NO_CONFIRMADO";

    if (id == null) continue;

    candidatos.push({ orden: ordenNum, player_id: id, nombre: nombre });
  }

  candidatos.sort(function (a, b) { return a.orden - b.orden; });

  return candidatos;
}

// Regla madre de este archivo: un registro solo es valido si es Final, de
// fecha anterior a hoy, y con EXACTAMENTE 9 titulares reales por lado.
function f5LineupRegistroValido(r, hoyNY) {
  if (!r || r.gamePk == null) return "SIN_GAMEPK";
  if (!fechaISOValidaLineupHist(r.date)) return "SIN_FECHA_VALIDA";
  if (r.date >= hoyNY) return "NO_INCORPORADO_HOY_O_FUTURO";
  if (r.status !== "Final") return "NO_INCORPORADO_NO_FINAL";
  if (!Array.isArray(r.lineup_home) || r.lineup_home.length !== 9) return "LINEUP_HOME_INCOMPLETO";
  if (!Array.isArray(r.lineup_away) || r.lineup_away.length !== 9) return "LINEUP_AWAY_INCOMPLETO";
  return null; // valido
}

async function jalarF5HistoricoLineup(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = fechaHoyMLBLineupHist();
  var desde = F5_LINEUP_START_FIJO;
  var hasta = restarDiasLineupHist(hoy, 1);

  var reporte = {
    guardados: 0,
    rechazados: [],
    total_en_cache: 0,
    rango: { desde: desde, hasta: hasta }
  };

  if (hasta < desde) {
    log("Aun no hay rango historico disponible (hoy es demasiado temprano en temporada).");
    reporte.total_en_cache = f5LineupLeerCache().length;
    return reporte;
  }

  log("Recorriendo lineups F5 historicos: " + desde + " -> " + hasta + " (hoy excluido siempre: " + hoy + ")");

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
      candidatos.push({ gamePk: g.gamePk, date: day.date });
    });
  });

  log("Juegos Final en el rango: " + candidatos.length);

  var cacheViejo = f5LineupLeerCache();
  var mapaExistente = new Map();
  cacheViejo.forEach(function (r) {
    var motivo = f5LineupRegistroValido(r, hoy);
    if (motivo === null) mapaExistente.set(r.gamePk, r);
    else reporte.rechazados.push({ gamePk: r && r.gamePk, motivo: motivo, origen: "cache_previo" });
  });

  var procesados = 0;

  for (var i = 0; i < candidatos.length; i++) {
    var c = candidatos[i];
    procesados++;

    if (mapaExistente.has(c.gamePk)) {
      continue; // ya guardado y valido, no se vuelve a jalar.
    }

    try {
      log("Procesando " + procesados + "/" + candidatos.length + ": gamePk " + c.gamePk + " (" + c.date + ")");

      var urlBox = MLB_ROUTES.WORKER_BASE + encodeURIComponent(
        "https://statsapi.mlb.com/api/v1/game/" + c.gamePk + "/boxscore"
      );
      var resBox = await fetch(urlBox);
      if (!resBox.ok) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: "BOXSCORE_HTTP_" + resBox.status, origen: "entrante" });
        continue;
      }
      var dBox = await resBox.json();

      var teamHome = (dBox && dBox.teams && dBox.teams.home) ? dBox.teams.home : null;
      var teamAway = (dBox && dBox.teams && dBox.teams.away) ? dBox.teams.away : null;

      var lineupHome = extraerLineupHistorico(teamHome);
      var lineupAway = extraerLineupHistorico(teamAway);

      var registro = {
        gamePk: c.gamePk,
        date: c.date,
        lineup_home: lineupHome,
        lineup_away: lineupAway,
        status: "Final"
      };

      var motivo = f5LineupRegistroValido(registro, hoy);
      if (motivo !== null) {
        reporte.rechazados.push({ gamePk: c.gamePk, motivo: motivo, origen: "entrante" });
        continue;
      }

      mapaExistente.set(c.gamePk, registro);
      reporte.guardados++;
    } catch (err) {
      reporte.rechazados.push({ gamePk: c.gamePk, motivo: "ERROR_REAL: " + (err && err.message ? err.message : err), origen: "entrante" });
    }
  }

  var totalFinal = Array.from(mapaExistente.values());
  f5LineupGuardarCache(totalFinal);
  reporte.total_en_cache = totalFinal.length;

  log(
    "LISTO. Guardados nuevos: " + reporte.guardados +
    " | Rechazados: " + reporte.rechazados.length +
    " | Total en cache F5 lineup historico: " + reporte.total_en_cache
  );

  return reporte;
}
