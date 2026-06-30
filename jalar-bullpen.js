// jalar-bullpen.js
// PIEZA - trae TODOS los pitchers que usó un equipo en su ULTIMO juego (ayer).
// Sirve para saber quien NO esta disponible hoy: el que tiro 1+ inning completo ayer
// normalmente no repite al dia siguiente.
// Misma ruta MLB_ROUTES.WORKER_BASE. NO inventa: si falta el dato, NO_CONFIRMADO.

async function jalarBullpenAyer(teamId, fechaHoyISO) {
  const salida = {
    team_id: teamId,
    fecha_juego_anterior: null,
    pitchers_usados_ayer: [], // [{player_id, nombre, outs_pitched}]
    error: null
  };

  try {
    // 1. buscar el ultimo juego de este equipo ANTES de hoy
    const fechaDesde = restarDias(fechaHoyISO, 5); // ventana de 5 dias atras por si hubo descanso
    const mlbUrlSchedule = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=" + teamId +
      "&startDate=" + fechaDesde + "&endDate=" + restarDias(fechaHoyISO, 1);
    const urlSchedule = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrlSchedule);
    const resSchedule = await fetch(urlSchedule);
    if (!resSchedule.ok) { salida.error = "ERR:SCHEDULE_HTTP_" + resSchedule.status; return salida; }
    const dataSchedule = await resSchedule.json();

    // tomar el juego mas reciente con status Final
    let ultimoGamePk = null;
    let ultimaFecha = null;
    if (dataSchedule && Array.isArray(dataSchedule.dates)) {
      for (let i = 0; i < dataSchedule.dates.length; i++) {
        const day = dataSchedule.dates[i];
        for (let j = 0; j < (day.games || []).length; j++) {
          const g = day.games[j];
          const status = g.status ? g.status.detailedState : "";
          if (status === "Final") {
            ultimoGamePk = g.gamePk;
            ultimaFecha = day.date;
          }
        }
      }
    }

    if (!ultimoGamePk) {
      salida.error = "SIN_JUEGO_ANTERIOR_EN_VENTANA";
      return salida;
    }
    salida.fecha_juego_anterior = ultimaFecha;

    // 2. traer el boxscore de ese juego
    const mlbUrlBox = "https://statsapi.mlb.com/api/v1.1/game/" + ultimoGamePk + "/feed/live";
    const urlBox = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrlBox);
    const resBox = await fetch(urlBox);
    if (!resBox.ok) { salida.error = "ERR:FEEDLIVE_HTTP_" + resBox.status; return salida; }
    const dataBox = await resBox.json();

    const box = dataBox && dataBox.liveData && dataBox.liveData.boxscore;
    if (!box || !box.teams) { salida.error = "ERR:SIN_BOXSCORE"; return salida; }

    // identificar cual lado (home/away) es nuestro teamId
    const teams = box.teams;
    let ladoEquipo = null;
    if (teams.away && teams.away.team && teams.away.team.id === teamId) ladoEquipo = teams.away;
    else if (teams.home && teams.home.team && teams.home.team.id === teamId) ladoEquipo = teams.home;

    if (!ladoEquipo) { salida.error = "ERR:TEAM_NO_ENCONTRADO_EN_BOX"; return salida; }

    const pitcherIds = ladoEquipo.pitchers || []; // array de player_id en orden de uso
    const players = ladoEquipo.players || {};

    for (let k = 0; k < pitcherIds.length; k++) {
      const pid = pitcherIds[k];
      const key = "ID" + pid;
      const p = players[key];
      if (!p) continue;
      const stats = p.stats && p.stats.pitching;
      const outs = stats && stats.outs !== undefined ? stats.outs : null;
      salida.pitchers_usados_ayer.push({
        player_id: pid,
        nombre: p.person && p.person.fullName ? p.person.fullName : "NO_CONFIRMADO",
        outs_pitched: outs
      });
    }

    return salida;
  } catch (err) {
    salida.error = "ERR:" + err.message;
    return salida;
  }
}

// Helper: resta dias a una fecha ISO (YYYY-MM-DD), devuelve ISO.
function restarDias(fechaISO, dias) {
  const d = new Date(fechaISO + "T00:00:00");
  d.setDate(d.getDate() - dias);
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
}

// Helper: dado el resultado de jalarBullpenAyer, devuelve los player_id que
// PROBABLEMENTE NO estan disponibles hoy (tiraron 3+ outs = 1 inning completo o mas ayer).
// Esto es DEDUCCION, no dato confirmado por MLB. Se marca como tal en el campo "tipo".
function pitchersNoDisponiblesHoy(bullpenAyer) {
  if (!bullpenAyer || !bullpenAyer.pitchers_usados_ayer) return [];
  return bullpenAyer.pitchers_usados_ayer
    .filter(function(p) { return p.outs_pitched !== null && p.outs_pitched >= 3; })
    .map(function(p) { return { player_id: p.player_id, nombre: p.nombre, tipo: "DEDUCCION_NO_CONFIRMADO" }; });
}
