// jalar-linea-ponches.js
// Jala la linea de mercado de ponches (pitcher_strikeouts) de The Odds API.
// Mismo patron que jalar-linea.js: la llave NUNCA sale al cliente, la inyecta el Worker.
// Cachea en localStorage por dia.

var LINEAS_PONCHES_CACHE_KEY = "lineas_ponches_cache_v1";

function lineasPonchesLeerCache() {
  try {
    var raw = localStorage.getItem(LINEAS_PONCHES_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function lineasPonchesGuardarCache(obj) {
  try {
    localStorage.setItem(LINEAS_PONCHES_CACHE_KEY, JSON.stringify(obj));
  } catch(e) {}
}

// Busca la linea de K de un pitcher por nombre (Odds API no trae player_id de MLB,
// solo el nombre en "description", asi que el cruce es por nombre normalizado).
function lineaPonchesBuscarPitcher(nombreCompleto) {
  var cache = lineasPonchesLeerCache();
  if (!cache || !cache.pitchers || !nombreCompleto) return null;
  var v = nombreCompleto.trim().toLowerCase();
  for (var i = 0; i < cache.pitchers.length; i++) {
    if ((cache.pitchers[i].pitcher || "").trim().toLowerCase() === v) return cache.pitchers[i];
  }
  return null;
}

async function jalarLineasPonches(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  var cache = lineasPonchesLeerCache();
  if (cache && cache.fecha === hoy && cache.pitchers && cache.pitchers.length > 0) {
    log("Líneas de ponches: cache de hoy OK (" + cache.pitchers.length + " pitchers).");
    return cache;
  }

  log("Jalando líneas de mercado de ponches (pitcher_strikeouts)...");

  var oddsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=pitcher_strikeouts&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm";
  var proxyUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl);

  var resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error("Odds API K HTTP " + resp.status);
  var data = await resp.json();
  if (!Array.isArray(data)) throw new Error("Odds API K: respuesta inesperada");

  log("Juegos recibidos de Odds API (ponches): " + data.length);

  var pitchers = [];
  var orden = ["draftkings", "fanduel", "betmgm"];

  for (var i = 0; i < data.length; i++) {
    var g = data[i];
    var home = g.home_team || "";
    var away = g.away_team || "";
    var bookmakers = g.bookmakers || [];

    for (var bo = 0; bo < orden.length; bo++) {
      var bk = null;
      for (var b = 0; b < bookmakers.length; b++) {
        if (bookmakers[b].key === orden[bo]) { bk = bookmakers[b]; break; }
      }
      if (!bk) continue;

      var mkts = bk.markets || [];
      var encontrado = false;
      for (var m = 0; m < mkts.length; m++) {
        if (mkts[m].key !== "pitcher_strikeouts") continue;
        var outs = mkts[m].outcomes || [];
        var porNombre = {};
        outs.forEach(function(o) {
          var nom = o.description || "NO_CONFIRMADO";
          if (!porNombre[nom]) porNombre[nom] = { pitcher: nom, total_k: o.point !== undefined ? o.point : null, over_price: null, under_price: null };
          if (o.name === "Over") porNombre[nom].over_price = o.price;
          if (o.name === "Under") porNombre[nom].under_price = o.price;
        });
        Object.keys(porNombre).forEach(function(nom) {
          pitchers.push({
            pitcher: nom,
            away_team: away,
            home_team: home,
            total_k: porNombre[nom].total_k,
            over_price: porNombre[nom].over_price,
            under_price: porNombre[nom].under_price,
            bookie: bk.title
          });
        });
        encontrado = true;
      }
      if (encontrado) break;
    }
  }

  var nuevo = { fecha: hoy, pitchers: pitchers };
  lineasPonchesGuardarCache(nuevo);
  log("Líneas de ponches guardadas en cache: " + pitchers.length + " registros.");
  return nuevo;
}
