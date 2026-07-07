// jalar-lineup.js
// PIEZA - trae el LINEUP confirmado (9 bateadores titulares) de un juego usando su game_id.
// USA /feed/game (no /feed/live) para que no cambie durante el juego.
// NO inventa datos: si el lineup no esta publicado devuelve arrays vacios y confirmado=false.

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
    const mlbUrl = "https://statsapi.mlb.com/api/v1.1/game/" + gamePk + "/feed/game";
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) { salida.error = "ERR:FEEDGAME_HTTP_" + res.status; return salida; }
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
