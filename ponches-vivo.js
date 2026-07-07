// ponches-vivo.js
// Jala cuántos ponches lleva CADA abridor en tiempo real, directo del
// boxscore de MLB StatsAPI (no de The Odds API, así que esto SÍ se puede
// actualizar en vivo sin ningún problema -- es dato de juego, no línea de
// mercado).
// No inventa nada: si el pitcher todavía no ha lanzado o el juego no ha
// empezado, sale null (el HTML lo muestra como "—" o "aún sin lanzar").

async function jalarPonchesVivo(gamePk, pitcherHomeId, pitcherAwayId) {
  if (!gamePk) return { kHome: null, kAway: null, error: "SIN_GAMEPK" };

  var urlBox = "https://statsapi.mlb.com/api/v1/game/" + gamePk + "/boxscore";
  var proxyUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(urlBox);
  var resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error("BOXSCORE HTTP " + resp.status);
  var data = await resp.json();

  function kDe(lado, pid) {
    if (!pid) return null;
    var players = data.teams && data.teams[lado] && data.teams[lado].players;
    if (!players) return null;
    var p = players["ID" + pid];
    if (!p || !p.stats || !p.stats.pitching) return null;
    var k = p.stats.pitching.strikeOuts;
    return (typeof k === "number") ? k : null;
  }

  return {
    kHome: kDe("home", pitcherHomeId),
    kAway: kDe("away", pitcherAwayId)
  };
}

if (typeof module !== "undefined") { module.exports = { jalarPonchesVivo: jalarPonchesVivo }; }
