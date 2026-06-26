// bullpen-parse.js
// PIEZA - funcion pura. Recibe el JSON crudo del boxscore MLB
// (statsapi .../game/{gamePk}/boxscore) y devuelve un arreglo limpio
// por lanzador (abridor + relevos de AMBOS equipos).
//
// Campos confirmados en pantalla (gamePk 822961, boxscore real):
//   gamesStarted, inningsPitched, numberOfPitches, strikes, hits, runs,
//   earnedRuns, baseOnBalls, strikeOuts, homeRuns, battersFaced,
//   saves, holds, blownSaves, inheritedRunners, inheritedRunnersScored
//
// NO incluye (capa siguiente, PENDIENTE): role, descanso, disponibilidad,
// setup/cerrador real. El orden donde lanzo sale del feed/live, no del boxscore.
//
// No depende de ningun otro archivo. No toca el DOM. No jala red.
// IP CRUDA: se conserva tal cual ("6.0" = 6 innings completos, ".1"=1 out,
// ".2"=2 outs, el .3 no existe). No se redondea ni se convierte aqui.

function bullpenParse(boxscoreJSON) {
  var out = { ok: false, error: null, pitchers: [] };

  if (!boxscoreJSON || typeof boxscoreJSON !== "object") {
    out.error = "ERR:BOXSCORE_VACIO";
    return out;
  }
  if (!boxscoreJSON.teams) {
    out.error = "ERR:SIN_TEAMS";
    return out;
  }

  function num(v) {
    return (typeof v === "number") ? v : null;
  }
  function ipCruda(v) {
    return (typeof v === "string" && v.length > 0) ? v : null;
  }

  var lados = [
    ["away", boxscoreJSON.teams.away],
    ["home", boxscoreJSON.teams.home]
  ];

  for (var L = 0; L < lados.length; L++) {
    var ladoNombre = lados[L][0];
    var t = lados[L][1];
    if (!t) { continue; }

    var teamName = (t.team && t.team.name) ? t.team.name : "";
    var ordenPitchers = t.pitchers;
    var players = t.players || {};

    if (!ordenPitchers || !ordenPitchers.length) { continue; }

    for (var p = 0; p < ordenPitchers.length; p++) {
      var pid = ordenPitchers[p];
      var pl = players["ID" + pid];
      if (!pl) { continue; }

      var pit = (pl.stats && pl.stats.pitching) ? pl.stats.pitching : null;
      if (!pit) { continue; }

      var nombre = (pl.person && pl.person.fullName) ? pl.person.fullName : "";
      var esAbridor = (num(pit.gamesStarted) === 1);

      out.pitchers.push({
        team_side: ladoNombre,
        team_name: teamName,
        pitcher_id: pid,
        pitcher_name: nombre,
        esAbridor: esAbridor,
        ip: ipCruda(pit.inningsPitched),
        pitches: num(pit.numberOfPitches),
        strikes: num(pit.strikes),
        hits: num(pit.hits),
        runs: num(pit.runs),
        earnedRuns: num(pit.earnedRuns),
        bb: num(pit.baseOnBalls),
        k: num(pit.strikeOuts),
        hr: num(pit.homeRuns),
        battersFaced: num(pit.battersFaced),
        saves: num(pit.saves),
        holds: num(pit.holds),
        blownSaves: num(pit.blownSaves),
        inheritedRunners: num(pit.inheritedRunners),
        inheritedRunnersScored: num(pit.inheritedRunnersScored)
      });
    }
  }

  out.ok = true;
  return out;
}
