// rellenar-carreras.js
// PASADA ÚNICA - rellena home_runs/away_runs/total_runs en los juegos viejos del cache.
// Usa: clima-cache.js (climaLeerCache, climaGuardarCache), mlb-routes.js (WORKER_BASE)
// Campo confirmado: linescore teams.home.runs / teams.away.runs
// No inventa: si falla un juego, lo deja sin carreras (null) y sigue.

async function rellenarCarreras(logFn) {
  function log(t){ if(typeof logFn==="function") logFn(t); }

  var cache = climaLeerCache();
  if(!cache || !cache.length){ log("Cache vacio. Nada que rellenar."); return; }

  // solo los que estan Final y NO tienen carreras todavia
  var pendientes = cache.filter(function(j){
    var esFinal = (j.status === "Final");
    var yaTiene = (j.home_runs !== undefined && j.home_runs !== null);
    return esFinal && !yaTiene && j.game_id;
  });

  log("Cache: " + cache.length + " juegos. Por rellenar: " + pendientes.length);
  if(pendientes.length === 0){ log("Nada pendiente. Todos ya tienen carreras."); return; }

  var ok = 0, fail = 0;
  for(var i=0;i<pendientes.length;i++){
    var j = pendientes[i];
    try {
      log("Carreras " + (i+1) + "/" + pendientes.length + ": " + j.game_id);
      var mlbUrl = "https://statsapi.mlb.com/api/v1/game/" + j.game_id + "/linescore";
      var resp = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl));
      if(!resp.ok) throw new Error("LINESCORE HTTP " + resp.status);
      var d = await resp.json();
      if(!d.teams || !d.teams.home || !d.teams.away) throw new Error("SIN teams.runs");

      var hr = d.teams.home.runs;
      var ar = d.teams.away.runs;
      if(typeof hr !== "number" || typeof ar !== "number") throw new Error("runs no numerico");

      j.home_runs = hr;
      j.away_runs = ar;
      j.total_runs = hr + ar;
      ok++;
    } catch(err) {
      log("FALLO " + j.game_id + ": " + err.message);
      fail++;
    }
  }

  climaGuardarCache(cache);
  log("LISTO. Rellenados: " + ok + " · Fallaron: " + fail + " · Total cache: " + cache.length);
}
