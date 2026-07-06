// jalar-linea-f5.js
// Jala los mercados F5 (primeras 5 entradas) de The Odds API para los juegos de MLB de hoy.
// h2h_1st_5_innings   = MoneyLine F5
// spreads_1st_5_innings = Run Line F5 (línea real, normalmente ±0.5)
// totals_1st_5_innings  = Total F5 (over/under de las 5 primeras entradas)
// La llave NUNCA sale al cliente — la inyecta el Worker de Cloudflare (mismo patrón que jalar-linea.js).
// Reutiliza ODDS_TEAM_TO_VENUE de jalar-linea.js, no se duplica el mapeo.

var LINEAS_F5_CACHE_KEY = "lineas_f5_mercado_cache";

function lineasF5LeerCache() {
  try {
    var raw = localStorage.getItem(LINEAS_F5_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function lineasF5GuardarCache(obj) {
  try {
    localStorage.setItem(LINEAS_F5_CACHE_KEY, JSON.stringify(obj));
  } catch(e) {}
}

// Busca el juego F5 por venue del parque local.
// Reutiliza STADIUM_ALIAS_2026 si existe (mismo criterio que lineasBuscarVenue en jalar-linea.js).
function lineasF5BuscarVenue(venue) {
  var cache = lineasF5LeerCache();
  if (!cache || !cache.juegos) return null;
  var vReal = venue;
  if (typeof STADIUM_ALIAS_2026 !== "undefined" && STADIUM_ALIAS_2026[venue]) {
    vReal = STADIUM_ALIAS_2026[venue];
  }
  var v = (vReal || "").trim().toLowerCase();
  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];
    if ((j.venue || "").trim().toLowerCase() === v) return j;
  }
  return null;
}

async function jalarLineasF5(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  var cache = lineasF5LeerCache();
  if (cache && cache.fecha === hoy && cache.juegos && cache.juegos.length > 0) {
    log("Líneas F5: cache de hoy OK (" + cache.juegos.length + " juegos).");
    return cache;
  }

  log("Jalando líneas F5 (h2h_1st_5_innings, spreads_1st_5_innings, totals_1st_5_innings)...");

  var oddsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=h2h_1st_5_innings,spreads_1st_5_innings,totals_1st_5_innings&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm";
  var proxyUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl);

  var resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error("Odds API F5 HTTP " + resp.status);
  var data = await resp.json();
  if (!Array.isArray(data)) throw new Error("Odds API F5: respuesta inesperada");

  log("Juegos recibidos de Odds API (F5): " + data.length);

  var juegos = [];
  for (var i = 0; i < data.length; i++) {
    var g = data[i];
    var home = g.home_team || "";
    var away = g.away_team || "";
    var venue = (typeof ODDS_TEAM_TO_VENUE !== "undefined" && ODDS_TEAM_TO_VENUE[home]) ? ODDS_TEAM_TO_VENUE[home] : null;

    var moneylineF5 = null;   // { home_price, away_price, bookie }
    var runlineF5 = null;     // { point, home_price, away_price, bookie }
    var totalF5 = null;       // { point, over_price, under_price, bookie }

    var orden = ["draftkings", "fanduel", "betmgm"];

    for (var bo = 0; bo < orden.length; bo++) {
      for (var b = 0; b < (g.bookmakers||[]).length; b++) {
        if (g.bookmakers[b].key !== orden[bo]) continue;
        var mkts = g.bookmakers[b].markets || [];
        var bookieTitle = g.bookmakers[b].title;

        for (var m = 0; m < mkts.length; m++) {
          var mkt = mkts[m];

          if (mkt.key === "h2h_1st_5_innings" && moneylineF5 === null) {
            var outs = mkt.outcomes || [];
            var homeP = null, awayP = null;
            for (var o1 = 0; o1 < outs.length; o1++) {
              if (outs[o1].name === home) homeP = outs[o1].price;
              if (outs[o1].name === away) awayP = outs[o1].price;
            }
            if (homeP !== null || awayP !== null) {
              moneylineF5 = { home_price: homeP, away_price: awayP, bookie: bookieTitle };
            }
          }

          if (mkt.key === "spreads_1st_5_innings" && runlineF5 === null) {
            var outsR = mkt.outcomes || [];
            var homePt = null, homePr = null, awayPr = null;
            for (var o2 = 0; o2 < outsR.length; o2++) {
              if (outsR[o2].name === home) { homePt = outsR[o2].point; homePr = outsR[o2].price; }
              if (outsR[o2].name === away) { awayPr = outsR[o2].price; }
            }
            if (homePt !== null) {
              runlineF5 = { point: homePt, home_price: homePr, away_price: awayPr, bookie: bookieTitle };
            }
          }

          if (mkt.key === "totals_1st_5_innings" && totalF5 === null) {
            var outsT = mkt.outcomes || [];
            var point = null, overPr = null, underPr = null;
            for (var o3 = 0; o3 < outsT.length; o3++) {
              if (outsT[o3].name === "Over") { point = outsT[o3].point; overPr = outsT[o3].price; }
              if (outsT[o3].name === "Under") { underPr = outsT[o3].price; }
            }
            if (point !== null) {
              totalF5 = { point: point, over_price: overPr, under_price: underPr, bookie: bookieTitle };
            }
          }
        }
      }
    }

    juegos.push({
      home: home,
      away: away,
      venue: venue,
      moneylineF5: moneylineF5,
      runlineF5: runlineF5,
      totalF5: totalF5
    });

    log("  " + away + " @ " + home + " → venue: " + (venue||"N/C") +
        " · ML F5: " + (moneylineF5 ? "OK" : "N/C") +
        " · RunLine F5: " + (runlineF5 ? runlineF5.point : "N/C") +
        " · Total F5: " + (totalF5 ? totalF5.point : "N/C"));
  }

  var nuevo = { fecha: hoy, juegos: juegos };
  lineasF5GuardarCache(nuevo);
  log("Líneas F5 guardadas en cache.");
  return nuevo;
}
