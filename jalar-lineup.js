// jalar-lineup.js
// PIEZA - trae el LINEUP confirmado (9 bateadores titulares) de un juego usando su game_id.
// Misma ruta que jalar-roster.js (feed/live via MLB_ROUTES.WORKER_BASE).
// NO inventa datos: si el lineup no esta publicado (MLB lo publica ~1-2h antes del juego),
// devuelve lineup_away / lineup_home como arrays vacios y confirmado=false.
// Devuelve IDs numericos (cruzan con BATTERS_VSPITCH_2026 por player_id).

async function jalarLineup(gamePk) {
  const salida = {
    game_id: gamePk,
    lineup_away: [],
    lineup_home: [],
    confirmado_away: false,
    confirmado_home: false,
    error: null
  };

  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1.1/game/" + gamePk + "/feed/live";
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) { salida.error = "ERR:FEEDLIVE_HTTP_" + res.status; return salida; }
    const data = await res.json();

    const box = data && data.liveData && data.liveData.boxscore;
    if (!box || !box.teams) { salida.error = "ERR:SIN_BOXSCORE"; return salida; }

    const away = extraerLineup(box.teams.away);
    const home = extraerLineup(box.teams.home);

    salida.lineup_away = away.lineup;
    salida.lineup_home = home.lineup;
    salida.confirmado_away = away.lineup.length === 9;
    salida.confirmado_home = home.lineup.length === 9;

    return salida;
  } catch (err) {
    salida.error = "ERR:" + err.message;
    return salida;
  }
}

// Helper: extrae los 9 titulares de un equipo, ordenados por battingOrder (100,200,300...900).
// battingOrder llega como string. Los suplentes/bullpen no tienen battingOrder valido de titular
// (vienen con valores tipo "201","202" para sustitutos in-game, que se ignoran aqui).
function extraerLineup(team) {
  if (!team || !team.players) return { lineup: [] };

  var candidatos = [];
  var keys = Object.keys(team.players);
  for (var i = 0; i < keys.length; i++) {
    var p = team.players[keys[i]];
    var ordenRaw = p && p.battingOrder;
    if (ordenRaw === undefined || ordenRaw === null || ordenRaw === "") continue;

    // Solo titulares: terminacion "00" (100,200,...,900). Sustitutos in-game traen "101","202", etc.
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
