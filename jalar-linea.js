// jalar-linea.js
// Jala el over/under (total) de The Odds API para los juegos de MLB de hoy.
// La llave NUNCA sale al cliente — la inyecta el Worker de Cloudflare.
// Guarda en localStorage bajo la clave "lineas_mercado_cache".
// Formato guardado: { fecha: "2026-06-29", juegos: [ { home, away, total, bookie }, ... ] }

var LINEAS_CACHE_KEY = "lineas_mercado_cache";

function lineasLeerCache() {
  try {
    var raw = localStorage.getItem(LINEAS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function lineasGuardarCache(obj) {
  try {
    localStorage.setItem(LINEAS_CACHE_KEY, JSON.stringify(obj));
  } catch(e) {}
}

// Devuelve el total (over/under) para un juego dado home+away.
// Busca en cache primero. Si el cache es de hoy, no vuelve a jalar.
function lineasBuscarJuego(home, away) {
  var cache = lineasLeerCache();
  if (!cache || !cache.juegos) return null;
  var h = (home || "").toLowerCase().trim();
  var a = (away || "").toLowerCase().trim();
  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];
    var jh = (j.home || "").toLowerCase().trim();
    var ja = (j.away || "").toLowerCase().trim();
    if (jh === h && ja === a) return j;
    if (jh === a && ja === h) return j; // por si vienen invertidos
  }
  return null;
}

// Función principal — llama una vez al día.
// logFn es opcional (para pintar en consola de la app).
async function jalarLineas(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  // Si ya tenemos cache de hoy, no jalamos de nuevo
  var cache = lineasLeerCache();
  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  if (cache && cache.fecha === hoy && cache.juegos && cache.juegos.length > 0) {
    log("Líneas de mercado: cache de hoy OK (" + cache.juegos.length + " juegos).");
    return cache;
  }

  log("Jalando líneas de mercado (totals)...");

  var oddsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=totals&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm";
  var proxyUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl);

  var resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error("Odds API HTTP " + resp.status);
  var data = await resp.json();

  if (!Array.isArray(data)) throw new Error("Odds API: respuesta inesperada");

  log("Juegos recibidos de Odds API: " + data.length);

  var juegos = [];
  for (var i = 0; i < data.length; i++) {
    var g = data[i];
    var home = g.home_team || "";
    var away = g.away_team || "";
    var total = null;
    var bookie = null;

    // Buscar el total en los bookmakers (preferimos DraftKings, luego FanDuel, luego BetMGM)
    var orden = ["draftkings", "fanduel", "betmgm"];
    for (var bo = 0; bo < orden.length && total === null; bo++) {
      for (var b = 0; b < g.bookmakers.length; b++) {
        if (g.bookmakers[b].key !== orden[bo]) continue;
        var mkts = g.bookmakers[b].markets || [];
        for (var m = 0; m < mkts.length; m++) {
          if (mkts[m].key !== "totals") continue;
          var outs = mkts[m].outcomes || [];
          for (var o = 0; o < outs.length; o++) {
            if (outs[o].name === "Over" && outs[o].point !== undefined) {
              total = outs[o].point;
              bookie = g.bookmakers[b].title;
              break;
            }
          }
          if (total !== null) break;
        }
        if (total !== null) break;
      }
    }

    juegos.push({ home: home, away: away, total: total, bookie: bookie });
    log("  " + away + " @ " + home + " → total: " + (total !== null ? total : "N/C") + (bookie ? " (" + bookie + ")" : ""));
  }

  var nuevo = { fecha: hoy, juegos: juegos };
  lineasGuardarCache(nuevo);
  log("Líneas de mercado guardadas en cache.");
  return nuevo;
}
