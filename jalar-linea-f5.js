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
// y devuelve la línea EN VIVO (in-play), que cambia con el marcador. Por eso
// cada juego se congela MLB_F5_MINUTOS_CONGELAR minutos antes de su
// commence_time. Desde ese momento en adelante, NUNCA se vuelve a jalar
// mercado para ese juego -- se reusa siempre la última línea guardada antes
// del corte. Si nunca se guardó una línea antes del corte, se marca
// honestamente como no disponible -- no se inventa ni se usa la de en vivo.
//
// CORREGIDO 20 jul 2026 (ronda 1) — FUSIÓN EN VEZ DE REEMPLAZO DESTRUCTIVO:
// jalarLineasF5() reconstruía `juegos` SOLO con los eventos de la corrida
// actual y reemplazaba TODA la caché con ese array. CORREGIDO: caché por
// FUSIÓN sobre un mapa indexado por clave home|away.
//
// CORREGIDO 20 jul 2026 (ronda 2) — fecha vía climaHoyISO(); validación
// estricta por mercado; una sola casa por juego con prioridad
// DraftKings→FanDuel→BetMGM; trazabilidad con commence_time, captured_at,
// congelada, notaActualizacion.
//
// CORREGIDO 20 jul 2026 (ronda 3) — _f5NumFinito ya no convierte faltantes
// en 0 (rechaza null/undefined/string vacío/booleanos antes de Number());
// la fusión nunca mezcla mercados de sportsbooks distintos entre corridas
// (se compara integridad completa con _f5ContarMercadosValidos(), gana la
// previa en empate); Run Line exige simetría exacta awayPt === -homePt
// cuando ambos vienen de la API, y solo deriva el opuesto cuando el
// visitante realmente no trae point propio.
//
// CORREGIDO 20 jul 2026 (ronda 4, auditoría de ruta completa) — 2 puntos:
//
//   1) FALLO GENERAL DE /events: antes, cualquier fallo al traer /events
//      (fetch roto, HTTP no ok, JSON inválido, respuesta que no es array)
//      lanzaba error de inmediato. f5-automatico.js atrapaba ese error y
//      dejaba lineasF5=null, así que nunca llamaba a
//      lineasF5BuscarEquipos() — la línea pregame desaparecía visualmente
//      por un fallo TEMPORAL de la API, aunque localStorage todavía
//      tuviera una caché válida de hoy. CORREGIDO: si existe cacheViejo
//      válido del mismo día (fecha === hoy, juegos es array con al menos
//      1 elemento) y /events falla por cualquiera de esas cuatro vías, se
//      devuelve ese cacheViejo SIN modificarlo ni volver a guardarlo — se
//      le agrega únicamente una nota general (notaGeneral) al objeto
//      devuelto en memoria, sin tocar los mercados de ningún juego. Se
//      registra ERROR_GENERAL_NO_BORRA_CACHE. Solo se lanza error si no
//      hay ninguna caché válida de hoy que se pueda devolver en su lugar.
//
//   2) CACHÉ HEREDADA SIN BOOKMAKER: la condición anterior
//      (!previoTieneCasaPropia || mismaCasa) permitía fusionar mercado por
//      mercado una captura nueva con un registro previo que no tenía
//      bookmaker_key confirmado — inseguro, porque ese registro previo
//      pudo haber sido escrito por una versión anterior que sí mezclaba
//      casas. CORREGIDO: si previo.bookmaker_key existe y coincide con
//      parsed.bookmaker_key, se fusiona mercado por mercado igual que
//      antes. Si existe y es diferente, se compara integridad completa sin
//      mezclar (sin cambios respecto a la ronda 3). Si previo.bookmaker_key
//      NO existe (caché heredada, "CACHE_HEREDADA_DE_CASA_NO_CONFIRMADA"),
//      sus mercados NUNCA se usan para completar la captura nueva: si
//      parsed trae algo válido, se adopta ÍNTEGRAMENTE parsed (bookmaker
//      real, no mezclado); si parsed no trae nada válido, se conserva
//      temporalmente el previo pero con bookmaker_key: null,
//      bookmaker_title: "NO_CONFIRMADO" y
//      notaActualizacion: "CACHE_HEREDADA_CONSERVADA_SIN_FUSION" — nunca
//      se le atribuyen esos mercados heredados a una casa nueva.
//
// Se mantiene intacto todo lo ya corregido: fecha vía climaHoyISO();
// faltantes nunca se convierten en 0; Moneyline exige ambos precios; Total
// exige mismo point en Over/Under y ambas cuotas; Run Line exige simetría;
// una sola casa por fotografía dentro de una misma llamada; fusión por
// clave home|away; evento no listado en /events conserva su línea previa;
// un error nuevo nunca borra un dato bueno; commence_time; captured_at;
// congelamiento 30 minutos antes del inicio; nunca se usa línea en vivo.

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
  if (typeof stadiumCanonName === "function") {
    vReal = stadiumCanonName(venue);
  } else if (typeof STADIUM_ALIAS_2026 !== "undefined" && STADIUM_ALIAS_2026[venue]) {
    vReal = STADIUM_ALIAS_2026[venue];
  }
  var v = (vReal || "").trim().toLowerCase();
  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];
    var jVenue = j.venue || "";
    if (typeof stadiumCanonName === "function") {
      jVenue = stadiumCanonName(jVenue);
    }
    if ((jVenue || "").trim().toLowerCase() === v) return j;
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

// Numero finito real o null. Rechaza EXPLICITAMENTE null, undefined,
// string vacio/solo espacios y booleanos ANTES de llamar Number() -- de lo
// contrario Number(null)===0, Number("")===0 y Number(false)===0 convierten
// silenciosamente un faltante en un cero real. Nunca un faltante puede
// volverse 0 aqui.
function _f5NumFinito(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "boolean") return null;
  if (typeof x === "string" && x.trim() === "") return null;
  var n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Cuenta cuantos de los tres mercados F5 son validos (no null) en un
// registro. Se usa para decidir, cuando dos fotografias vienen de casas
// distintas CONFIRMADAS, cual fotografia completa es mas completa -- nunca
// para mezclar mercados individuales entre casas distintas.
function _f5ContarMercadosValidos(obj) {
  if (!obj) return 0;
  var n = 0;
  if (obj.moneylineF5) n++;
  if (obj.runlineF5) n++;
  if (obj.totalF5) n++;
  return n;
}

// Extrae los tres mercados F5 de UN SOLO bookmaker (nunca mezcla con otro
// bookmaker DENTRO de esta funcion). Aplica las reglas estrictas de validez
// de cada mercado, incluida la simetria exacta del Run Line.
function _f5ExtraerDeUnBookmaker(bookmaker, home, away) {
  var mkts = bookmaker.markets || [];
  var moneylineF5 = null, runlineF5 = null, totalF5 = null;

  for (var m = 0; m < mkts.length; m++) {
    var mkt = mkts[m];

    if (mkt.key === "h2h_1st_5_innings" && moneylineF5 === null) {
      var outs = mkt.outcomes || [];
      var homeP = null, awayP = null;
      for (var o1 = 0; o1 < outs.length; o1++) {
        if (outs[o1].name === home) homeP = _f5NumFinito(outs[o1].price);
        if (outs[o1].name === away) awayP = _f5NumFinito(outs[o1].price);
      }
      // Moneyline F5 solo es valida si AMBOS lados son numericos reales.
      if (homeP !== null && awayP !== null) {
        moneylineF5 = { home_price: homeP, away_price: awayP };
      }
    }

    if (mkt.key === "spreads_1st_5_innings" && runlineF5 === null) {
      var outsR = mkt.outcomes || [];
      var homePt = null, homePr = null, awayPt = null, awayPr = null;
      for (var o2 = 0; o2 < outsR.length; o2++) {
        if (outsR[o2].name === home) { homePt = _f5NumFinito(outsR[o2].point); homePr = _f5NumFinito(outsR[o2].price); }
        if (outsR[o2].name === away) { awayPt = _f5NumFinito(outsR[o2].point); awayPr = _f5NumFinito(outsR[o2].price); }
      }

      // Simetria del Run Line: si AMBOS points vienen de la API, deben ser
      // opuestos exactos (awayPt === -homePt); si no, el mercado es
      // invalido. Solo se deriva awayPt = -homePt cuando el visitante
      // REALMENTE no trae point propio y si existen ambos precios.
      var awayPtFinal = null;
      if (awayPt !== null && homePt !== null) {
        awayPtFinal = (awayPt === -homePt) ? awayPt : null;
      } else if (awayPt === null && homePt !== null && homePr !== null && awayPr !== null) {
        awayPtFinal = -homePt;
      }

      if (homePt !== null && awayPtFinal !== null && homePr !== null && awayPr !== null) {
        runlineF5 = { point: homePt, away_point: awayPtFinal, home_price: homePr, away_price: awayPr };
      }
    }

    if (mkt.key === "totals_1st_5_innings" && totalF5 === null) {
      var outsT = mkt.outcomes || [];
      var pointOver = null, pointUnder = null, overPr = null, underPr = null;
      for (var o3 = 0; o3 < outsT.length; o3++) {
        if (outsT[o3].name === "Over") { pointOver = _f5NumFinito(outsT[o3].point); overPr = _f5NumFinito(outsT[o3].price); }
        if (outsT[o3].name === "Under") { pointUnder = _f5NumFinito(outsT[o3].point); underPr = _f5NumFinito(outsT[o3].price); }
      }
      // Total F5 solo es valido si Over y Under comparten EXACTAMENTE el
      // mismo point, y ambas cuotas son numericas reales.
      if (pointOver !== null && pointUnder !== null && pointOver === pointUnder && overPr !== null && underPr !== null) {
        totalF5 = { point: pointOver, over_price: overPr, under_price: underPr };
      }
    }
  }

  return { moneylineF5: moneylineF5, runlineF5: runlineF5, totalF5: totalF5 };
}

// Selecciona UNA sola casa por juego, en orden de prioridad
// DraftKings -> FanDuel -> BetMGM. Toma de esa casa TODOS los mercados F5
// validos que tenga. Si esa casa no tiene ningun mercado utilizable, pasa
// a la siguiente. Nunca completa un registro mezclando casas distintas
// DENTRO de esta llamada.
function parseMarketsF5(bookmakers, home, away) {
  var orden = ["draftkings", "fanduel", "betmgm"];
  var lista = bookmakers || [];

  for (var bo = 0; bo < orden.length; bo++) {
    for (var b = 0; b < lista.length; b++) {
      if (lista[b].key !== orden[bo]) continue;

      var extraido = _f5ExtraerDeUnBookmaker(lista[b], home, away);
      var tieneAlgo = !!(extraido.moneylineF5 || extraido.runlineF5 || extraido.totalF5);

      if (tieneAlgo) {
        var titulo = lista[b].title || lista[b].key;
        if (extraido.moneylineF5) extraido.moneylineF5.bookie = titulo;
        if (extraido.runlineF5) extraido.runlineF5.bookie = titulo;
        if (extraido.totalF5) extraido.totalF5.bookie = titulo;

        return {
          moneylineF5: extraido.moneylineF5,
          runlineF5: extraido.runlineF5,
          totalF5: extraido.totalF5,
          bookmaker_key: lista[b].key,
          bookmaker_title: titulo
        };
      }
      break; // esta casa no tuvo ningun bloque utilizable -> probar la siguiente prioridad
    }
  }

  return { moneylineF5: null, runlineF5: null, totalF5: null, bookmaker_key: null, bookmaker_title: null };
}

async function jalarLineasF5(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  if (typeof climaHoyISO !== "function") {
    throw new Error("climaHoyISO() no está disponible — no se puede determinar la fecha MLB de forma confiable. No se inventa otro offset de reemplazo.");
  }
  var hoy = climaHoyISO();

  var cacheViejo = lineasF5LeerCache();
  var congeladosMapa = {};
  if (cacheViejo && cacheViejo.fecha === hoy && cacheViejo.juegos) {
    cacheViejo.juegos.forEach(function(j) {
      congeladosMapa[_claveHA(j.home, j.away)] = j;
    });
  }

  var ahora = Date.now();
  var ahoraIso = new Date(ahora).toISOString();

  // ── Paso 1/2: eventos de hoy, con fallback si /events falla por completo ──
  log("Paso 1/2: trayendo eventos de MLB de hoy...");
  var eventsUrl = "https://api.the-odds-api.com/v4/sports/baseball_mlb/events/";
  var proxyEventsUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(eventsUrl);

  var events = null;
  var motivoFalloEvents = null;

  try {
    var respEvents = await fetch(proxyEventsUrl);
    if (!respEvents.ok) {
      motivoFalloEvents = "HTTP_" + respEvents.status;
    } else {
      var eventsData = await respEvents.json();
      if (!Array.isArray(eventsData)) {
        motivoFalloEvents = "RESPUESTA_NO_ES_ARRAY";
      } else {
        events = eventsData;
      }
    }
  } catch (eGeneral) {
    motivoFalloEvents = "ERROR_FETCH_O_JSON: " + (eGeneral && eGeneral.message ? eGeneral.message : eGeneral);
  }

  if (motivoFalloEvents !== null) {
    var cacheHoyValida = !!(cacheViejo && cacheViejo.fecha === hoy && Array.isArray(cacheViejo.juegos) && cacheViejo.juegos.length > 0);

    if (cacheHoyValida) {
      log("ERROR_GENERAL_NO_BORRA_CACHE: falló /events (" + motivoFalloEvents + "). Se devuelve la caché de hoy sin modificarla ni volver a guardarla.");
      return Object.assign({}, cacheViejo, {
        notaGeneral: "ERROR_GENERAL_NO_BORRA_CACHE: /events falló (" + motivoFalloEvents + ") el " + ahoraIso + ". Se devolvió la caché previa de " + cacheViejo.juegos.length + " juego(s) de hoy sin tocar sus mercados."
      });
    }

    throw new Error("Odds API /events falló (" + motivoFalloEvents + ") y no hay ninguna caché válida de hoy que se pueda devolver en su lugar.");
  }

  log("Eventos recibidos: " + events.length);

  var margenMs = MLB_F5_MINUTOS_CONGELAR * 60 * 1000;

  // mapaFinal se construye por FUSIÓN, indexado por clave home|away.
  var mapaFinal = {};
  var clavesVistasHoy = {};

  log("Paso 2/2: pidiendo mercados F5 evento por evento (congelamiento: " + MLB_F5_MINUTOS_CONGELAR + " min antes)...");

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var home = ev.home_team || "";
    var away = ev.away_team || "";
    var eventId = ev.id;
    var clave = _claveHA(home, away);
    clavesVistasHoy[clave] = true;

    var venue = (typeof ODDS_TEAM_TO_VENUE !== "undefined" && ODDS_TEAM_TO_VENUE[home]) ? ODDS_TEAM_TO_VENUE[home] : null;
    var commenceMs = ev.commence_time ? new Date(ev.commence_time).getTime() : null;
    var puntoCorte = (commenceMs !== null) ? (commenceMs - margenMs) : null;
    var yaSeDebeCongelar = (puntoCorte !== null) && (ahora >= puntoCorte);

    var previo = congeladosMapa[clave] || null;
    var previoTieneLinea = !!(previo && (previo.moneylineF5 || previo.runlineF5 || previo.totalF5));

    if (yaSeDebeCongelar) {
      if (previoTieneLinea) {
        mapaFinal[clave] = Object.assign({}, previo, {
          congelada: true,
          commence_time: ev.commence_time || (previo.commence_time || null),
          captured_at: previo.captured_at || null
        });
        log("  " + away + " @ " + home + " -> CONGELADA. Se conserva exactamente la línea guardada antes del corte (captured_at: " + (previo.captured_at || "N/C") + ").");
      } else {
        mapaFinal[clave] = {
          home: home, away: away, venue: venue, commence_time: ev.commence_time || null,
          moneylineF5: null, runlineF5: null, totalF5: null,
          bookmaker_key: null, bookmaker_title: null,
          congelada: false, captured_at: null,
          error: "SIN_LINEA_ANTES_DEL_CORTE"
        };
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
        if (previoTieneLinea) {
          mapaFinal[clave] = Object.assign({}, previo, {
            congelada: previo.congelada === true,
            notaActualizacion: "ERROR_NUEVO_NO_BORRA_PREVIO: HTTP_" + resp.status + " al intentar actualizar; se conservó la línea previa intacta.",
            commence_time: ev.commence_time || (previo.commence_time || null),
            captured_at: previo.captured_at || null
          });
          log("  " + away + " @ " + home + " -> ERROR_NUEVO_NO_BORRA_PREVIO: se conservó la línea previa (captured_at original: " + (previo.captured_at || "N/C") + ").");
        } else {
          mapaFinal[clave] = {
            home: home, away: away, venue: venue, commence_time: ev.commence_time || null,
            moneylineF5: null, runlineF5: null, totalF5: null,
            bookmaker_key: null, bookmaker_title: null,
            congelada: false, captured_at: null,
            error: "HTTP_" + resp.status
          };
        }
        continue;
      }

      var data = await resp.json();
      var parsed = parseMarketsF5(data.bookmakers, home, away);
      var hayAlgoNuevo = !!(parsed.moneylineF5 || parsed.runlineF5 || parsed.totalF5);

      // previoTieneCasaPropia: el registro previo tiene un bookmaker_key
      // CONFIRMADO. Si no lo tiene (caché heredada, escrita quizas por una
      // version anterior que si mezclaba casas), sus mercados NUNCA se
      // usan para completar la captura nueva -- ver bloques abajo.
      var previoTieneCasaPropia = !!(previo && previo.bookmaker_key);

      if (hayAlgoNuevo) {
        if (previoTieneCasaPropia && previo.bookmaker_key === parsed.bookmaker_key) {
          // Misma casa confirmada que la vez anterior: se permite
          // completar mercado por mercado.
          var fusionado = {
            home: home, away: away, venue: venue, commence_time: ev.commence_time || null,
            moneylineF5: parsed.moneylineF5 !== null ? parsed.moneylineF5 : previo.moneylineF5,
            runlineF5: parsed.runlineF5 !== null ? parsed.runlineF5 : previo.runlineF5,
            totalF5: parsed.totalF5 !== null ? parsed.totalF5 : previo.totalF5,
            bookmaker_key: parsed.bookmaker_key,
            bookmaker_title: parsed.bookmaker_title,
            congelada: false,
            captured_at: ahoraIso
          };
          mapaFinal[clave] = fusionado;
          log("  " + away + " @ " + home + " -> ACTUALIZADA_PREGAME. venue: " + (venue||"N/C") +
              " . Casa: " + (parsed.bookmaker_title || "N/C") +
              " . ML F5: " + (fusionado.moneylineF5 ? "OK" : "N/C") +
              " . RunLine F5: " + (fusionado.runlineF5 ? fusionado.runlineF5.point : "N/C") +
              " . Total F5: " + (fusionado.totalF5 ? fusionado.totalF5.point : "N/C"));
        } else if (previoTieneCasaPropia) {
          // Casa previa CONFIRMADA pero distinta de la nueva: nunca se
          // mezcla. Se compara integridad completa; en empate gana la previa.
          var countPrevio = _f5ContarMercadosValidos(previo);
          var countParsed = _f5ContarMercadosValidos(parsed);

          if (countParsed > countPrevio) {
            mapaFinal[clave] = {
              home: home, away: away, venue: venue, commence_time: ev.commence_time || null,
              moneylineF5: parsed.moneylineF5,
              runlineF5: parsed.runlineF5,
              totalF5: parsed.totalF5,
              bookmaker_key: parsed.bookmaker_key,
              bookmaker_title: parsed.bookmaker_title,
              congelada: false,
              captured_at: ahoraIso,
              notaActualizacion: "Reemplazo íntegro de casa: " + parsed.bookmaker_title + " (" + countParsed + " mercados válidos) sustituyó a " + previo.bookmaker_title + " (" + countPrevio + "). Nunca se mezclaron mercados de ambas casas."
            };
            log("  " + away + " @ " + home + " -> ACTUALIZADA_PREGAME (cambio de casa completo: " + previo.bookmaker_title + " -> " + parsed.bookmaker_title + ", " + countParsed + " vs " + countPrevio + " mercados válidos).");
          } else {
            mapaFinal[clave] = Object.assign({}, previo, {
              commence_time: ev.commence_time || (previo.commence_time || null),
              captured_at: previo.captured_at || null,
              notaActualizacion: "Casa nueva disponible (" + parsed.bookmaker_title + ", " + countParsed + " mercados) pero no supera a la previa (" + previo.bookmaker_title + ", " + countPrevio + "). Se conserva la previa íntegra para no cambiar de casa innecesariamente."
            });
            log("  " + away + " @ " + home + " -> CONSERVADA_DESDE_CACHE: casa distinta disponible (" + parsed.bookmaker_title + ") pero no más completa que la previa (" + previo.bookmaker_title + "); se mantiene la previa íntegra.");
          }
        } else {
          // El previo (si existe) NO tiene bookmaker_key confirmado --
          // caché heredada de casa no confirmada. Sus mercados NUNCA se
          // usan para completar: se adopta ÍNTEGRAMENTE la fotografía
          // nueva, sin mezclar nada heredado.
          mapaFinal[clave] = {
            home: home, away: away, venue: venue, commence_time: ev.commence_time || null,
            moneylineF5: parsed.moneylineF5,
            runlineF5: parsed.runlineF5,
            totalF5: parsed.totalF5,
            bookmaker_key: parsed.bookmaker_key,
            bookmaker_title: parsed.bookmaker_title,
            congelada: false,
            captured_at: ahoraIso,
            notaActualizacion: previo ? "CACHE_HEREDADA_DE_CASA_NO_CONFIRMADA reemplazada íntegramente por " + parsed.bookmaker_title + "; los mercados heredados sin bookmaker_key nunca se fusionaron con esta captura." : undefined
          };
          log("  " + away + " @ " + home + " -> ACTUALIZADA_PREGAME" + (previo ? " (caché heredada sin casa confirmada, reemplazada íntegra por " + parsed.bookmaker_title + ")" : "") + ".");
        }
      } else if (previoTieneLinea && previoTieneCasaPropia) {
        mapaFinal[clave] = Object.assign({}, previo, {
          commence_time: ev.commence_time || (previo.commence_time || null),
          captured_at: previo.captured_at || null
        });
        log("  " + away + " @ " + home + " -> CONSERVADA_DESDE_CACHE: ninguna casa (DraftKings/FanDuel/BetMGM, en ese orden) trajo un mercado F5 válido completo; se mantiene intacta la línea previa (captured_at original: " + (previo.captured_at || "N/C") + ").");
      } else if (previoTieneLinea && !previoTieneCasaPropia) {
        // Caché heredada sin bookmaker_key confirmado, y la captura nueva
        // tampoco trajo nada: se conserva TEMPORALMENTE, pero marcada
        // explícitamente como de casa no confirmada -- nunca se le
        // atribuye esa línea heredada a ninguna casa.
        mapaFinal[clave] = Object.assign({}, previo, {
          bookmaker_key: null,
          bookmaker_title: "NO_CONFIRMADO",
          commence_time: ev.commence_time || (previo.commence_time || null),
          captured_at: previo.captured_at || null,
          notaActualizacion: "CACHE_HEREDADA_CONSERVADA_SIN_FUSION"
        });
        log("  " + away + " @ " + home + " -> CACHE_HEREDADA_CONSERVADA_SIN_FUSION: la línea previa no tiene casa confirmada y la captura nueva no trajo nada válido; se conserva temporalmente marcada como NO_CONFIRMADO.");
      } else {
        mapaFinal[clave] = {
          home: home, away: away, venue: venue, commence_time: ev.commence_time || null,
          moneylineF5: null, runlineF5: null, totalF5: null,
          bookmaker_key: null, bookmaker_title: null,
          congelada: false, captured_at: null
        };
        log("  " + away + " @ " + home + " -> sin línea F5 confirmada todavía (ni nueva ni previa).");
      }
    } catch (eEvento) {
      log("  " + away + " @ " + home + " -> ERROR REAL: " + (eEvento && eEvento.message ? eEvento.message : eEvento));
      if (previoTieneLinea) {
        mapaFinal[clave] = Object.assign({}, previo, {
          congelada: previo.congelada === true,
          notaActualizacion: "ERROR_NUEVO_NO_BORRA_PREVIO: ERROR_REAL al intentar actualizar; se conservó la línea previa intacta.",
          commence_time: ev.commence_time || (previo.commence_time || null),
          captured_at: previo.captured_at || null
        });
        log("  " + away + " @ " + home + " -> ERROR_NUEVO_NO_BORRA_PREVIO: se conservó la línea previa (captured_at original: " + (previo.captured_at || "N/C") + ").");
      } else {
        mapaFinal[clave] = {
          home: home, away: away, venue: venue, commence_time: ev.commence_time || null,
          moneylineF5: null, runlineF5: null, totalF5: null,
          bookmaker_key: null, bookmaker_title: null,
          congelada: false, captured_at: null,
          error: "ERROR_REAL"
        };
      }
    }
  }

  // Juegos de cacheViejo que ya NO aparecen en /events (tipicamente porque
  // ya comenzaron y el endpoint dejo de listarlos): sobreviven tal cual,
  // marcados congelada:true, con su captured_at original intacto.
  Object.keys(congeladosMapa).forEach(function(clave) {
    if (clavesVistasHoy[clave]) return;
    var previo = congeladosMapa[clave];
    var previoTieneLinea = !!(previo && (previo.moneylineF5 || previo.runlineF5 || previo.totalF5));
    if (!previoTieneLinea) return;
    mapaFinal[clave] = Object.assign({}, previo, { congelada: true, captured_at: previo.captured_at || null });
    log("  " + (previo.away||"?") + " @ " + (previo.home||"?") + " -> EVENTO_YA_NO_LISTADO_CONSERVADO: ya no aparece en /events (indicador observado de que ya comenzó); se conserva su línea pregame congelada (captured_at original: " + (previo.captured_at || "N/C") + ").");
  });

  var juegos = Object.keys(mapaFinal).map(function(k) { return mapaFinal[k]; });

  var nuevo = { fecha: hoy, juegos: juegos };
  lineasF5GuardarCache(nuevo);
  log("Líneas F5 guardadas en caché por fusión (sin reemplazo destructivo ni mezcla de sportsbooks). Total juegos en caché: " + juegos.length);
  return nuevo;
}
