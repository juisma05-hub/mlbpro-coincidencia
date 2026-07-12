/*
  MLBPro · jalar-lineup.js

  FUNCIÓN:
  Trae el lineup titular (9 bateadores) de cada equipo para un juego. Si el
  lineup de HOY todavía no está confirmado por MLB, cae al último lineup
  CONFIRMADO real del mismo equipo (su juego Final más reciente) como
  reemplazo temporal — nunca inventa un lineup, nunca usa proyecciones
  externas ni páginas de periodistas.

  ENTRADAS:
  gamePk (Number/String) — id del juego de hoy.
  awayTeamId (Number, opcional) — id del equipo visitante, para el fallback.
  homeTeamId (Number, opcional) — id del equipo local, para el fallback.

  SALIDAS / MODIFICACIONES:
  Objeto:
    { game_id, lineup_away[], lineup_home[],
      confirmado_away, confirmado_home,   // EXCLUSIVAMENTE: ¿el lineup de
                                           // HOY ya es oficial? No indica si
                                           // hay datos reales utilizables.
      lineup_disponible_away,             // ¿lineup_away trae 9 titulares
      lineup_disponible_home,             // reales, sea de hoy o del
                                           // ULTIMO_CONFIRMADO? Esto es lo
                                           // que debe mirar cualquier
                                           // consumidor que solo necesite
                                           // saber si hay datos reales.
      fuente_away, fuente_home,           // "LINEUP_CONFIRMADO" |
                                           // "LINEUP_ULTIMO_CONFIRMADO" |
                                           // "NO_CONFIRMADO"
      fecha_origen_away, fecha_origen_home,
      gamePk_origen_away, gamePk_origen_home,
      error }
  Cada lineup[] es una lista ordenada de {orden, player_id, nombre}.
  No escribe cache ni localStorage.

  DEPENDENCIAS:
  MLB_ROUTES.WORKER_BASE (mlb-routes.js).
  Endpoints reales:
    - https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live (lineup de
      hoy y de cualquier juego pasado consultado).
    - https://statsapi.mlb.com/api/v1/schedule?teamId=...&startDate=...&endDate=...
      (para localizar el último juego Final real del equipo).

  NO TOCA:
  clima-cache.js, jalar-clima.js, score-match.js, calcular-coincidencia.js,
  jalar-condition.js, jalar-linea.js (mercado), K6, F5. No escribe cache.

  CORRECCIÓN ACTUAL:
  Antes, si el lineup de hoy no estaba confirmado, la app se quedaba con
  arrays vacíos hasta que MLB lo publicara. Ahora, mientras eso pasa, usa el
  lineup real del último juego Final de ese equipo (vía schedule?teamId=),
  marcado explícitamente como LINEUP_ULTIMO_CONFIRMADO con fecha y gamePk de
  origen. En cuanto MLB publica el lineup oficial de hoy, la siguiente
  llamada lo detecta sola y vuelve a LINEUP_CONFIRMADO — reemplazo
  automático, sin pasos manuales. Ventana de búsqueda: 15 días atrás; si no
  hay ningún Final real en ese rango, queda NO_CONFIRMADO (nunca inventado).

  CORRECCIÓN ADICIONAL (misma sesión): se detectó que un consumidor podía
  rechazar un LINEUP_ULTIMO_CONFIRMADO real solo porque confirmado_away/
  confirmado_home seguían en false (ese campo significa específicamente "el
  de HOY ya es oficial", por diseño no cambia). Se agregaron
  lineup_disponible_away/lineup_disponible_home, true si hay 9 titulares
  reales sin importar la fuente. Cualquier archivo que necesite saber "¿hay
  lineup real utilizable?" debe mirar estos dos campos, no confirmado_*.

  FECHA:
  12 jul 2026.

  ESTADO:
  NO_CONFIRMADO — pendiente de tu aprobación tras este ajuste.
*/

// jalar-lineup.js
// PIEZA - trae el LINEUP confirmado (9 bateadores titulares) de un juego usando su game_id.
// ENDPOINT REAL: /api/v1.1/game/{gamePk}/feed/live
// (el endpoint /feed/game NO EXISTE en la API de MLB — daba HTTP 404 en todos los parques).
// NO inventa datos: si el lineup no esta publicado devuelve arrays vacios y confirmado=false.
//
// CORREGIDO: antes, si el lineup de hoy no estaba confirmado todavia, la app
// se quedaba sin nada (arrays vacios) hasta que MLB publicara el titular.
// Ahora, cuando el lineup de HOY no esta confirmado, se busca el ULTIMO
// lineup CONFIRMADO REAL del mismo equipo (su juego anterior con status
// "Final"), via /api/v1/schedule?teamId=... (parametro real y documentado
// de MLB Stats API, no inventado). Solo se usa un lineup de un juego que
// realmente se jugo y quedo Final — nunca una proyeccion externa, nunca un
// dato de periodistas, nunca un valor inventado. Prioridad exacta:
//   1) LINEUP_CONFIRMADO      -> lineup real de HOY, 9 titulares confirmados
//   2) LINEUP_ULTIMO_CONFIRMADO -> lineup real del ULTIMO juego Final de ese
//      equipo (fecha y gamePk de origen quedan expuestos para que la UI lo
//      marque distinto de un confirmado de hoy)
//   3) NO_CONFIRMADO          -> no hay ningun lineup real disponible
// En cuanto MLB publique el lineup oficial de hoy (9 titulares en el
// boxscore de HOY), esta misma funcion lo detecta sola en la siguiente
// llamada y vuelve a LINEUP_CONFIRMADO automaticamente — no hace falta
// ningun cambio adicional, el reemplazo es automatico porque cada llamada
// vuelve a intentar primero el lineup de hoy.

async function jalarLineup(gamePk, awayTeamId, homeTeamId) {
  const salida = {
    game_id: gamePk,
    lineup_away: [],
    lineup_home: [],
    confirmado_away: false,
    confirmado_home: false,
    fuente_away: "NO_CONFIRMADO",
    fuente_home: "NO_CONFIRMADO",
    fecha_origen_away: null,
    fecha_origen_home: null,
    gamePk_origen_away: null,
    gamePk_origen_home: null,
    error: null
  };

  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1.1/game/" + gamePk + "/feed/live";
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);

    if (!res.ok) {
      salida.error = "ERR:FEEDLIVE_HTTP_" + res.status;
    } else {
      const data = await res.json();
      const box = data && data.liveData && data.liveData.boxscore;

      if (!box || !box.teams) {
        salida.error = "ERR:SIN_BOXSCORE";
      } else {
        const away = extraerLineup(box.teams.away);
        const home = extraerLineup(box.teams.home);

        salida.lineup_away = away.lineup;
        salida.lineup_home = home.lineup;
        salida.confirmado_away = away.lineup.length === 9;
        salida.confirmado_home = home.lineup.length === 9;

        if (salida.confirmado_away) salida.fuente_away = "LINEUP_CONFIRMADO";
        if (salida.confirmado_home) salida.fuente_home = "LINEUP_CONFIRMADO";
      }
    }
  } catch (err) {
    salida.error = "ERR:" + err.message;
  }

  // Fallback real: solo si el lineup de HOY no quedo confirmado (9 titulares).
  if (!salida.confirmado_away && awayTeamId) {
    try {
      const previo = await ultimoLineupConfirmadoDeEquipo(awayTeamId, gamePk);
      if (previo) {
        salida.lineup_away = previo.lineup;
        salida.fuente_away = "LINEUP_ULTIMO_CONFIRMADO";
        salida.fecha_origen_away = previo.fecha;
        salida.gamePk_origen_away = previo.gamePk;
      }
    } catch (errA) {
      // No se pudo confirmar el ultimo lineup real: se queda en NO_CONFIRMADO, nunca se inventa.
    }
  }

  if (!salida.confirmado_home && homeTeamId) {
    try {
      const previo = await ultimoLineupConfirmadoDeEquipo(homeTeamId, gamePk);
      if (previo) {
        salida.lineup_home = previo.lineup;
        salida.fuente_home = "LINEUP_ULTIMO_CONFIRMADO";
        salida.fecha_origen_home = previo.fecha;
        salida.gamePk_origen_home = previo.gamePk;
      }
    } catch (errH) {
      // No se pudo confirmar el ultimo lineup real: se queda en NO_CONFIRMADO, nunca se inventa.
    }
  }

  // Señal separada e inequívoca para cualquier archivo consumidor:
  // confirmado_away/confirmado_home significan EXCLUSIVAMENTE "el lineup de
  // HOY ya es oficial" (por diseño, no cambia). Eso NO alcanza para decidir
  // si hay un lineup real utilizable, porque un LINEUP_ULTIMO_CONFIRMADO
  // real deja confirmado_*=false a proposito. lineup_disponible_away/home
  // es true si lineup_away/home trae 9 titulares reales, sin importar si
  // vinieron de hoy o del ultimo Final del equipo. Un consumidor que
  // necesite saber "¿hay datos reales que puedo usar?" debe mirar esto, no
  // confirmado_away/confirmado_home.
  salida.lineup_disponible_away = salida.lineup_away.length === 9;
  salida.lineup_disponible_home = salida.lineup_home.length === 9;

  return salida;
}

// Busca el lineup CONFIRMADO real del juego Final mas reciente de un equipo,
// dentro de una ventana de 15 dias hacia atras (suficiente para cubrir dias
// libres normales de temporada). Si no encuentra ningun Final con lineup de
// 9 titulares en esa ventana, devuelve null — NO_CONFIRMADO, nunca inventado.
async function ultimoLineupConfirmadoDeEquipo(teamId, gamePkHoy) {
  const hoy = fechaHoyMLBLineup();
  const hasta = restarDiasISOLineup(hoy, 1); // nunca incluye hoy
  const desde = restarDiasISOLineup(hoy, 15);

  const mlbUrlSched =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=" +
    teamId +
    "&startDate=" + desde +
    "&endDate=" + hasta;

  const urlSched = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrlSched);
  const resSched = await fetch(urlSched);
  if (!resSched.ok) return null;

  const dataSched = await resSched.json();
  const dates = Array.isArray(dataSched && dataSched.dates) ? dataSched.dates : [];

  const candidatos = [];
  dates.forEach(function (day) {
    (day.games || []).forEach(function (g) {
      const esFinal = g.status && g.status.detailedState === "Final";
      const gamePk = g.gamePk;
      const esHoyMismo = gamePkHoy != null && gamePk === gamePkHoy;
      if (!esFinal || esHoyMismo || !day.date || day.date >= hoy) return;

      const homeId = g.teams && g.teams.home && g.teams.home.team ? g.teams.home.team.id : null;
      const awayId = g.teams && g.teams.away && g.teams.away.team ? g.teams.away.team.id : null;

      let lado = null;
      if (homeId === teamId) lado = "home";
      else if (awayId === teamId) lado = "away";
      if (!lado) return;

      candidatos.push({ date: day.date, gameDate: g.gameDate || day.date, gamePk: gamePk, lado: lado });
    });
  });

  if (!candidatos.length) return null;

  candidatos.sort(function (a, b) {
    if (a.date === b.date) return a.gameDate < b.gameDate ? 1 : -1;
    return a.date < b.date ? 1 : -1;
  });

  // Prueba los mas recientes primero; si el boxscore de alguno no trae 9
  // titulares reales (dato incompleto), pasa al siguiente candidato real.
  for (let i = 0; i < candidatos.length && i < 3; i++) {
    const c = candidatos[i];

    try {
      const mlbUrlFeed = "https://statsapi.mlb.com/api/v1.1/game/" + c.gamePk + "/feed/live";
      const urlFeed = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrlFeed);
      const resFeed = await fetch(urlFeed);
      if (!resFeed.ok) continue;

      const dataFeed = await resFeed.json();
      const box = dataFeed && dataFeed.liveData && dataFeed.liveData.boxscore;
      if (!box || !box.teams) continue;

      const equipo = c.lado === "home" ? box.teams.home : box.teams.away;
      const extra = extraerLineup(equipo);

      if (extra.lineup.length === 9) {
        return { lineup: extra.lineup, fecha: c.date, gamePk: c.gamePk };
      }
    } catch (errFeed) {
      continue;
    }
  }

  return null;
}

// Fecha de hoy en horario oficial MLB (America/New_York), sin depender de
// otros archivos (jalar-lineup.js se mantiene autonomo, igual que antes).
function fechaHoyMLBLineup() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());

  const v = {};
  partes.forEach(function (p) { if (p.type !== "literal") v[p.type] = p.value; });
  return v.year + "-" + v.month + "-" + v.day;
}

function restarDiasISOLineup(fechaISO, n) {
  const d = new Date(fechaISO + "T00:00:00Z");
  if (isNaN(d.getTime())) return fechaISO;
  d.setUTCDate(d.getUTCDate() - n);
  return d.getUTCFullYear() + "-" +
    ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getUTCDate()).slice(-2);
}

function extraerLineup(team) {
  if (!team || !team.players) return { lineup: [] };

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

  candidatos.sort(function(a, b) { return a.orden - b.orden; });

  return { lineup: candidatos };
}
