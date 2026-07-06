// jalar-linea-f5.js
// Jala los mercados F5 (primeras 5 entradas) de The Odds API para los juegos de MLB de hoy.
// h2h_1st_5_innings    = MoneyLine F5
// spreads_1st_5_innings = Run Line F5 (linea real, normalmente +/-0.5)
// totals_1st_5_innings  = Total F5 (over/under de las 5 primeras entradas)
//
// CORREGIDO 6 jul 2026: estos son "period markets" (no featured markets).
// The Odds API los rechaza con HTTP 422 / INVALID_MARKET si se piden en el
// endpoint masivo /v4/sports/{sport}/odds. El flujo correcto es en DOS pasos:
//   1) /v4/sports/baseball_mlb/events  -> trae los event_id de hoy (GRATIS)
//   2) /v4/sports/baseball_mlb/events/{eventId}/odds?markets=... -> F5 de ESE juego
//
// CORREGIDO 6 jul 2026 (parte 2): lineasF5BuscarEquipos(home, away) cruza por
// nombre de equipo en vez de venue (venue puede venir null del mapeo de la API).
//
// CORREGIDO 6 jul 2026 (parte 3) — CONGELAMIENTO DE LÍNEA PRE-JUEGO:
// Una vez el juego arranca, The Odds API deja de devolver la línea pre-juego
// y devuelve la línea EN VIVO (in-play), que cambia con el marcador. No hay
// forma de pedirle a ese mismo endpoint "la de antes". Por eso cada juego se
// congela MLB_F5_MINUTOS_CONGELAR minutos antes de su commence_time (valor
// configurable abajo). Desde ese momento en adelante, NUNCA se vuelve a jalar
// mercado para ese juego -- se reusa siempre la última línea guardada antes
// del corte. Si nunca se guardó una línea antes del corte (por ejemplo, si el
// caché se limpió después de que ya pasó ese punto), se marca honestamente
// como no disponible -- no se inventa ni se usa la de en vivo por error.

// Minutos antes del inicio del juego en que se congela la línea. Cambiar este
// número para ajustar (ej: 10, 15, 30). Una vez pasado ese punto, la línea
// de ese juego ya no se vuelve a tocar bajo ninguna circunstancia.
var MLB_F5_MINUTOS_CONGELAR = 30;

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

// Busca el juego F5 por nombre de equipo home + away.
function lineasF5BuscarEquipos(home, away) {
  var cache = lineasF5LeerCache();
  if (!cache || !cache.juegos) return null;
  var h = (home || "").trim().toLowerCase();
  var a = (away || "").trim().toLowerCase();
  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];
    var jh = (j.home || "").trim().toLowerCase();
    var ja = (j.away || "").trim().toLowerCase();
    if (jh === h && ja === a) return j;
  }
  return null;
}

function _claveHA(home, away) {
  return (home || "").trim().toLowerCase() + "|" + (away || "").trim().toLowerCase();
}

function parseMarketsF5(bookmakers, home, away) {
  var moneylineF5 = null;
  var runlineF5 = null;
  var totalF5 = null;

  var orden = ["draftkings", "fanduel", "betmgm"];

  for (var bo = 0; bo < orden.length; bo++) {
    for (var b = 0; b < (bookmakers||[]).length; b++) {
      if (bookmakers[b].key !== orden[bo]) continue;
      var mkts = bookmakers[b].markets || [];
      var bookieTitle = bookmakers[b].title;

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

  return { moneylineF5: moneylineF5, runlineF5: runlineF5, totalF5: totalF5 };
}

async function jalarLineasF5(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  var cacheViejo = lineasF5LeerCache();
  var congeladosMapa = {};
  if (cacheViejo && cacheViejo.fecha === hoy && cacheViejo.juegos) {
    cacheViejo.juegos.forEach(function(j) {
      congeladosMapa[_claveHA(j.home, j.away)] = j;
    });
  }

  log("Paso 1/2: trayendo eventos de MLB de hoy...");
  var eventsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/events/";
  var proxyEventsUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(eventsUrl);
  var respEvents = await fetch(proxyEventsUrl);
  if (!respEvents.ok) throw new Error("Odds API /events HTTP " + respEvents.status);
  var events = await respEvents.json();
  if (!Array.isArray(events)) throw new Error("Odds API /events: respuesta inesperada");
  log("Eventos recibidos: " + events.length);

  var ahora = Date.now();
  var margenMs = MLB_F5_MINUTOS_CONGELAR * 60 * 1000;

  log("Paso 2/2: pidiendo mercados F5 evento por evento (congelamiento: " + MLB_F5_MINUTOS_CONGELAR + " min antes)...");
  var juegos = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var home = ev.home_team || "";
    var away = ev.away_team || "";
    var eventId = ev.id;
    var venue = (typeof ODDS_TEAM_TO_VENUE !== "undefined" && ODDS_TEAM_TO_VENUE[home]) ? ODDS_TEAM_TO_VENUE[home] : null;
    var commenceMs = ev.commence_time ? new Date(ev.commence_time).getTime() : null;
    var puntoCorte = (commenceMs !== null) ? (commenceMs - margenMs) : null;
    var yaSeDebeCongelar = (puntoCorte !== null) && (ahora >= puntoCorte);

    var previo = congeladosMapa[_claveHA(home, away)];

    if (yaSeDebeCongelar) {
      if (previo && (previo.moneylineF5 || previo.runlineF5 || previo.totalF5)) {
        previo.congelada = true;
        juegos.push(previo);
        log("  " + away + " @ " + home + " -> dentro de la ventana de congelamiento (" + MLB_F5_MINUTOS_CONGELAR + " min antes). Usando línea CONGELADA.");
      } else {
        juegos.push({
          home: home, away: away, venue: venue,
          moneylineF5: null, runlineF5: null, totalF5: null,
          congelada: false,
          error: "SIN_LINEA_ANTES_DEL_CORTE"
        });
        log("  " + away + " @ " + home + " -> ya pasó el punto de congelamiento y no había línea guardada antes. NO se jala en vivo.");
      }
      continue;
    }

    try {
      var oddsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/events/" + eventId +
        "/odds?regions=us&markets=h2h_1st_5_innings,spreads_1st_5_innings,totals_1st_5_innings&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm";
      var proxyUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl);
      var resp = await fetch(proxyUrl);
      if (!resp.ok) {
        var textoErr = await resp.text();
        log("  " + away + " @ " + home + " -> ERROR HTTP " + resp.status + ": " + textoErr);
        juegos.push({ home: home, away: away, venue: venue, moneylineF5: null, runlineF5: null, totalF5: null, congelada: false, error: "HTTP_" + resp.status });
        continue;
      }
      var data = await resp.json();
      var parsed = parseMarketsF5(data.bookmakers, home, away);

      juegos.push({
        home: home, away: away, venue: venue,
        moneylineF5: parsed.moneylineF5, runlineF5: parsed.runlineF5, totalF5: parsed.totalF5,
        congelada: false
      });

      log("  " + away + " @ " + home + " -> venue: " + (venue||"N/C") +
          " . ML F5: " + (parsed.moneylineF5 ? "OK" : "N/C") +
          " . RunLine F5: " + (parsed.runlineF5 ? parsed.runlineF5.point : "N/C") +
          " . Total F5: " + (parsed.totalF5 ? parsed.totalF5.point : "N/C"));
    } catch (eEvento) {
      log("  " + away + " @ " + home + " -> ERROR REAL: " + (eEvento && eEvento.message ? eEvento.message : eEvento));
      juegos.push({ home: home, away: away, venue: venue, moneylineF5: null, runlineF5: null, totalF5: null, congelada: false, error: "ERROR_REAL" });
    }
  }

  var nuevo = { fecha: hoy, juegos: juegos };
  lineasF5GuardarCache(nuevo);
  log("Lineas F5 guardadas en cache.");
  return nuevo;
}
