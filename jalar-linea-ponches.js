// jalar-linea-ponches.js
// PIEZA - trae la LINEA DE MERCADO de ponches (K) por pitcher, via The Odds API.
// Market: pitcher_strikeouts. Requiere 2 pasos: 1) events del dia, 2) odds por eventId.
// Misma API key que jalar-linea.js (Over/Under de carreras), distinto market.
// Cachea en localStorage por dia, igual logica que jalar-linea.js.
// NO inventa: si el market no esta disponible para ese juego/libro, queda NO_CONFIRMADO.

var LINEAS_PONCHES_CACHE_KEY = "lineas_ponches_cache_v1";

async function jalarLineasPonches(logFn) {
  function log(t){ if (typeof logFn === "function") logFn(t); }

  var hoy = new Date(Date.now() - 6*60*60*1000);
  var hoyISO = hoy.getFullYear()+"-"+("0"+(hoy.getMonth()+1)).slice(-2)+"-"+("0"+hoy.getDate()).slice(-2);

  // revisar cache del dia
  try {
    var cacheRaw = localStorage.getItem(LINEAS_PONCHES_CACHE_KEY);
    if (cacheRaw) {
      var cache = JSON.parse(cacheRaw);
      if (cache.fecha === hoyISO && cache.datos) {
        log("Líneas de ponches: cache de hoy OK ("+cache.datos.length+" pitchers).");
        return cache.datos;
      }
    }
  } catch(e) { /* cache corrupto, sigue a jalar de nuevo */ }

  // 1. eventos del dia (mismo formato que jalar-linea.js)
  var eventsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey=" + MLB_ROUTES.ODDS_API_KEY;
  var resEvents = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(eventsUrl));
  if (!resEvents.ok) throw new Error("ODDS_API_EVENTS_HTTP_" + resEvents.status);
  var events = await resEvents.json();
  log("Eventos MLB encontrados: " + events.length);

  var resultado = [];

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    try {
      var oddsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/events/" + ev.id +
        "/odds?regions=us&markets=pitcher_strikeouts&oddsFormat=american&apiKey=" + MLB_ROUTES.ODDS_API_KEY;
      var resOdds = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl));
      if (!resOdds.ok) { log("AVISO: sin odds K para " + ev.away_team + " @ " + ev.home_team); continue; }
      var dataOdds = await resOdds.json();

      var bookmakers = dataOdds.bookmakers || [];
      for (var b = 0; b < bookmakers.length; b++) {
        var bk = bookmakers[b];
        var markets = bk.markets || [];
        for (var m = 0; m < markets.length; m++) {
          if (markets[m].key !== "pitcher_strikeouts") continue;
          var outcomes = markets[m].outcomes || [];
          // agrupar por nombre de pitcher (description), Over/Under vienen separados
          var porPitcher = {};
          outcomes.forEach(function(o) {
            var nombre = o.description || "NO_CONFIRMADO";
            if (!porPitcher[nombre]) porPitcher[nombre] = { pitcher: nombre, over: null, under: null, point: o.point !== undefined ? o.point : null };
            if (o.name === "Over") porPitcher[nombre].over = o.price;
            if (o.name === "Under") porPitcher[nombre].under = o.price;
          });
          Object.keys(porPitcher).forEach(function(nom) {
            resultado.push({
              pitcher: nom,
              away_team: ev.away_team,
              home_team: ev.home_team,
              total_k: porPitcher[nom].point,
              over_price: porPitcher[nom].over,
              under_price: porPitcher[nom].under,
              bookie: bk.title
            });
          });
          break; // solo el primer bookie con el market, evita duplicar
        }
        if (resultado.length) break;
      }
    } catch (eEv) {
      log("AVISO evento " + ev.away_team + " @ " + ev.home_team + ": " + (eEv && eEv.message ? eEv.message : eEv));
    }
  }

  try {
    localStorage.setItem(LINEAS_PONCHES_CACHE_KEY, JSON.stringify({ fecha: hoyISO, datos: resultado }));
  } catch(e) { /* localStorage lleno o bloqueado, no es critico */ }

  log("Líneas de ponches jaladas: " + resultado.length);
  return resultado;
}

// Helper: busca la linea de K de un pitcher por nombre (cruce por nombre, no por id,
// porque el market de Odds API no trae player_id de MLB).
function lineaPonchesBuscarPitcher(nombreCompleto, datosLineas) {
  if (!datosLineas || !datosLineas.length || !nombreCompleto) return null;
  var normalizado = nombreCompleto.trim().toLowerCase();
  for (var i = 0; i < datosLineas.length; i++) {
    if (datosLineas[i].pitcher && datosLineas[i].pitcher.trim().toLowerCase() === normalizado) {
      return datosLineas[i];
    }
  }
  return null;
}
