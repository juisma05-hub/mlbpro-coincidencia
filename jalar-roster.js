// jalar-roster.js
// PIEZA - trae pitcher, catcher y umpire REALES de UN juego usando su game_id.
// Misma ruta que jalar-condition.js (feed/live via MLB_ROUTES.WORKER_BASE).
// NO inventa datos: si un campo no viene, devuelve "NO_CONFIRMADO".
// Devuelve IDs numericos para pitcher y catcher (cruzan con pitchers-master / catchers-master)
// y NOMBRE para umpire de plato (cruza con el archivo de umpires, que es por nombre).

async function jalarRoster(gamePk) {
  const salida = {
    game_id: gamePk,
    pitcher_away_id: "NO_CONFIRMADO",
    pitcher_home_id: "NO_CONFIRMADO",
    catcher_away_id: "NO_CONFIRMADO",
    catcher_home_id: "NO_CONFIRMADO",
    umpire_home: "NO_CONFIRMADO",
    error: null
  };

  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1.1/game/" + gamePk + "/feed/live";
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) { salida.error = "ERR:FEEDLIVE_HTTP_" + res.status; return salida; }
    const data = await res.json();

    // ---- PITCHERS (probables del gameData) ----
    const pp = data && data.gameData && data.gameData.probablePitchers;
    if (pp) {
      if (pp.away && pp.away.id != null) salida.pitcher_away_id = pp.away.id;
      if (pp.home && pp.home.id != null) salida.pitcher_home_id = pp.home.id;
    }

    // ---- CATCHERS (titular por equipo: posicion "C" con el battingOrder mas bajo) ----
    // PENDIENTE_VERIFICAR: confirmar en pantalla que el titular sale correcto.
    // En el feed, cada player trae position.abbreviation y battingOrder (string "100","200"...).
    // El titular es el catcher con el battingOrder numerico mas pequeno de su equipo.
    const box = data && data.liveData && data.liveData.boxscore;
    if (box && box.teams) {
      salida.catcher_away_id = catcherTitular(box.teams.away);
      salida.catcher_home_id = catcherTitular(box.teams.home);
    }

    // ---- UMPIRE DE PLATO (officials, tipo "Home Plate") ----
    if (box && Array.isArray(box.officials)) {
      for (let i = 0; i < box.officials.length; i++) {
        const o = box.officials[i];
        const tipo = o && o.officialType ? o.officialType : "";
        if (tipo === "Home Plate" && o.official && o.official.fullName) {
          salida.umpire_home = o.official.fullName;
          break;
        }
      }
    }

    return salida;
  } catch (err) {
    salida.error = "ERR:" + err.message;
    return salida;
  }
}

// Helper: devuelve el id del catcher titular de un equipo del boxscore, o "NO_CONFIRMADO".
function catcherTitular(team) {
  if (!team || !team.players) return "NO_CONFIRMADO";
  let mejorId = "NO_CONFIRMADO";
  let mejorOrden = Infinity;
  const keys = Object.keys(team.players);
  for (let i = 0; i < keys.length; i++) {
    const p = team.players[keys[i]];
    const pos = p && p.position && p.position.abbreviation ? p.position.abbreviation : "";
    if (pos !== "C") continue;
    // battingOrder llega como string tipo "200"; si no hay, se ignora para el orden.
    const ordenRaw = p.battingOrder;
    const orden = (ordenRaw !== undefined && ordenRaw !== null && ordenRaw !== "")
      ? parseInt(ordenRaw, 10)
      : Infinity;
    const id = (p.person && p.person.id != null) ? p.person.id : null;
    if (id == null) continue;
    if (orden < mejorOrden) { mejorOrden = orden; mejorId = id; }
    // si ningun catcher tiene battingOrder, toma el primero que aparezca
    if (mejorId === "NO_CONFIRMADO") mejorId = id;
  }
  return mejorId;
}
