// jalar-linea.js
// Jala únicamente la línea PREGAME de MLB desde The Odds API.
// Incluye TOTAL (O/U) y MONEYLINE.
//
// REGLA OBLIGATORIA:
// - Nunca guarda ni muestra líneas de juegos que ya comenzaron.
// - Una vez guardada la línea pregame del día, no vuelve a actualizarla.
// - Los mercados en vivo quedan completamente rechazados.
// - La llave NUNCA sale al cliente: la inyecta el Worker de Cloudflare.

var LINEAS_CACHE_KEY = "lineas_mercado_pregame_v3";

// Mapeo: nombre de equipo como viene de The Odds API → venue exacto.
var ODDS_TEAM_TO_VENUE = {
  "Baltimore Orioles":       "Oriole Park at Camden Yards",
  "Boston Red Sox":          "Fenway Park",
  "New York Yankees":        "Yankee Stadium",
  "Tampa Bay Rays":          "Tropicana Field",
  "Toronto Blue Jays":       "Rogers Centre",
  "Chicago White Sox":       "Rate Field",
  "Chi White Sox":           "Rate Field",
  "Cleveland Guardians":     "Progressive Field",
  "Detroit Tigers":          "Comerica Park",
  "Kansas City Royals":      "Kauffman Stadium",
  "Minnesota Twins":         "Target Field",
  "Houston Astros":          "Daikin Park",
  "Los Angeles Angels":      "Angel Stadium",
  "LA Angels":               "Angel Stadium",
  "Los Angeles Angels of Anaheim": "Angel Stadium",
  "Oakland Athletics":       "Sutter Health Park",
  "Athletics":               "Sutter Health Park",
  "Sacramento Athletics":    "Sutter Health Park",
  "A's":                     "Sutter Health Park",
  "Seattle Mariners":        "T-Mobile Park",
  "Texas Rangers":           "Globe Life Field",
  "Atlanta Braves":          "Truist Park",
  "Miami Marlins":           "loanDepot Park",
  "New York Mets":           "Citi Field",
  "Philadelphia Phillies":   "Citizens Bank Park",
  "Washington Nationals":    "Nationals Park",
  "Chicago Cubs":            "Wrigley Field",
  "Cincinnati Reds":         "Great American Ball Park",
  "Milwaukee Brewers":       "American Family Field",
  "Pittsburgh Pirates":      "PNC Park",
  "St. Louis Cardinals":     "Busch Stadium",
  "Arizona Diamondbacks":    "Chase Field",
  "Arizona D-backs":         "Chase Field",
  "Colorado Rockies":        "Coors Field",
  "Los Angeles Dodgers":     "Dodger Stadium",
  "LA Dodgers":              "Dodger Stadium",
  "San Diego Padres":        "Petco Park",
  "San Francisco Giants":    "Oracle Park"
};

function lineasFechaMLB() {
  try {
    var partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    var mapa = {};

    for (var i = 0; i < partes.length; i++) {
      mapa[partes[i].type] = partes[i].value;
    }

    return mapa.year + "-" + mapa.month + "-" + mapa.day;
  } catch (e) {
    var d = new Date();
    return d.getFullYear() +
      "-" + ("0" + (d.getMonth() + 1)).slice(-2) +
      "-" + ("0" + d.getDate()).slice(-2);
  }
}

function lineasLeerCache() {
  try {
    var raw = localStorage.getItem(LINEAS_CACHE_KEY);

    if (!raw) return null;

    var obj = JSON.parse(raw);

    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.juegos)) return null;

    return obj;
  } catch (e) {
    return null;
  }
}

function lineasGuardarCache(obj) {
  try {
    localStorage.setItem(LINEAS_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {}
}

function lineasCanonVenue(venue) {
  var vReal = venue || "";

  if (typeof stadiumCanonName === "function") {
    vReal = stadiumCanonName(vReal);
  } else if (
    typeof STADIUM_ALIAS_2026 !== "undefined" &&
    STADIUM_ALIAS_2026[vReal]
  ) {
    vReal = STADIUM_ALIAS_2026[vReal];
  }

  return String(vReal || "").trim().toLowerCase();
}

function lineasNormTeam(x) {
  return String(x || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lineasBuscarVenue(venue) {
  var cache = lineasLeerCache();

  if (!cache || !cache.juegos) return null;

  var v = lineasCanonVenue(venue);

  if (!v) return null;

  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];
    var jVenue = lineasCanonVenue(j.venue);

    if (jVenue && jVenue === v) return j;
  }

  return null;
}

function lineasBuscarJuego(away, home, venue) {
  var cache = lineasLeerCache();

  if (!cache || !cache.juegos) return null;

  var a = lineasNormTeam(away);
  var h = lineasNormTeam(home);

  // Primero cruza por ambos equipos.
  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];

    var ja = lineasNormTeam(j.away);
    var jh = lineasNormTeam(j.home);

    if (ja === a && jh === h) return j;
  }

  // Venue queda únicamente como fallback.
  return lineasBuscarVenue(venue);
}

function lineasFormatoML(n) {
  if (n === null || n === undefined || n === "") return "N/C";

  var num = Number(n);

  if (!Number.isFinite(num)) return "N/C";

  return num > 0 ? "+" + num : String(num);
}

function lineasEventoYaComenzo(commenceTime) {
  var inicioMs = Date.parse(commenceTime || "");

  // Sin hora válida no se permite guardar la línea.
  if (!Number.isFinite(inicioMs)) return true;

  return Date.now() >= inicioMs;
}

function lineasTotalValido(n) {
  var num = Number(n);

  if (!Number.isFinite(num)) return false;

  // Protección contra run lines, F5, props y totales en vivo residuales.
  return num >= 5 && num <= 20;
}

async function jalarLineas(logFn) {
  function log(t) {
    if (typeof logFn === "function") logFn(t);
  }

  var hoy = lineasFechaMLB();
  var cache = lineasLeerCache();

  // La captura pregame del día queda congelada.
  if (
    cache &&
    cache.fecha === hoy &&
    cache.tipo === "PREGAME" &&
    Array.isArray(cache.juegos) &&
    cache.juegos.length > 0
  ) {
    log(
      "Líneas PREGAME congeladas: cache de hoy OK (" +
      cache.juegos.length +
      " juegos)."
    );

    return cache;
  }

  log("Jalando líneas PREGAME: totals + moneyline...");

  var oddsUrl =
    "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?" +
    "regions=us" +
    "&markets=totals,h2h" +
    "&oddsFormat=american" +
    "&bookmakers=draftkings,fanduel,betmgm";

  var proxyUrl =
    MLB_ROUTES.WORKER_BASE +
    encodeURIComponent(oddsUrl);

  var resp = await fetch(proxyUrl);

  if (!resp.ok) {
    throw new Error("Odds API HTTP " + resp.status);
  }

  var data = await resp.json();

  if (!Array.isArray(data)) {
    throw new Error("Odds API: respuesta inesperada");
  }

  log("Eventos recibidos de Odds API: " + data.length);

  var juegos = [];
  var orden = ["draftkings", "fanduel", "betmgm"];

  for (var i = 0; i < data.length; i++) {
    var g = data[i];

    // Rechazo absoluto de eventos ya comenzados.
    if (lineasEventoYaComenzo(g.commence_time)) {
      log(
        "  RECHAZADO EN VIVO: " +
        (g.away_team || "N/C") +
        " @ " +
        (g.home_team || "N/C")
      );

      continue;
    }

    var home = g.home_team || "";
    var away = g.away_team || "";
    var venue = ODDS_TEAM_TO_VENUE[home] || null;

    if (typeof stadiumCanonName === "function" && venue) {
      venue = stadiumCanonName(venue);
    }

    var total = null;
    var totalBookie = null;

    var mlHome = null;
    var mlAway = null;
    var mlBookie = null;

    var bookmakers = Array.isArray(g.bookmakers)
      ? g.bookmakers
      : [];

    for (var bo = 0; bo < orden.length; bo++) {
      var bookieKey = orden[bo];

      for (var b = 0; b < bookmakers.length; b++) {
        var bookmaker = bookmakers[b];

        if (bookmaker.key !== bookieKey) continue;

        var mkts = Array.isArray(bookmaker.markets)
          ? bookmaker.markets
          : [];

        for (var m = 0; m < mkts.length; m++) {
          var market = mkts[m];

          if (market.key === "totals" && total === null) {
            var outsTotal = Array.isArray(market.outcomes)
              ? market.outcomes
              : [];

            for (var o = 0; o < outsTotal.length; o++) {
              var totalOut = outsTotal[o];

              if (
                totalOut.name === "Over" &&
                lineasTotalValido(totalOut.point)
              ) {
                total = Number(totalOut.point);
                totalBookie = bookmaker.title || bookmaker.key;
                break;
              }
            }
          }

          if (
            market.key === "h2h" &&
            (mlHome === null || mlAway === null)
          ) {
            var outsML = Array.isArray(market.outcomes)
              ? market.outcomes
              : [];

            for (var x = 0; x < outsML.length; x++) {
              var out = outsML[x];

              if (
                out.name === home &&
                out.price !== undefined &&
                Number.isFinite(Number(out.price))
              ) {
                mlHome = Number(out.price);
              }

              if (
                out.name === away &&
                out.price !== undefined &&
                Number.isFinite(Number(out.price))
              ) {
                mlAway = Number(out.price);
              }
            }

            if (mlHome !== null || mlAway !== null) {
              mlBookie = bookmaker.title || bookmaker.key;
            }
          }
        }
      }

      if (
        total !== null &&
        mlHome !== null &&
        mlAway !== null
      ) {
        break;
      }
    }

    // Sin total pregame válido, el evento no entra al cache.
    if (total === null) {
      log(
        "  SIN TOTAL PREGAME VÁLIDO: " +
        away +
        " @ " +
        home
      );

      continue;
    }

    juegos.push({
      event_id: g.id || null,
      commence_time: g.commence_time || null,

      home: home,
      away: away,
      venue: venue,

      total: total,
      bookie: totalBookie,

      moneyline_home: mlHome,
      moneyline_away: mlAway,
      moneyline_home_txt: lineasFormatoML(mlHome),
      moneyline_away_txt: lineasFormatoML(mlAway),
      moneyline_bookie: mlBookie,

      tipo_linea: "PREGAME"
    });

    log(
      "  " + away + " @ " + home +
      " → PREGAME" +
      " · venue: " + (venue || "N/C") +
      " · total: " + total +
      " · ML away: " + lineasFormatoML(mlAway) +
      " · ML home: " + lineasFormatoML(mlHome)
    );
  }

  var nuevo = {
    fecha: hoy,
    tipo: "PREGAME",
    capturado_en: new Date().toISOString(),
    juegos: juegos
  };

  lineasGuardarCache(nuevo);

  log(
    "Líneas PREGAME guardadas y congeladas: " +
    juegos.length +
    " juegos."
  );

  return nuevo;
}
