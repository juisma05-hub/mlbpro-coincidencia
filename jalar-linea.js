// jalar-linea.js
// Jala línea de mercado MLB de hoy desde The Odds API.
// Incluye TOTAL (O/U) y MONEYLINE.
// La llave NUNCA sale al cliente — la inyecta el Worker de Cloudflare.

var LINEAS_CACHE_KEY = "lineas_mercado_cache_v2";

// Mapeo: nombre de equipo (como viene de The Odds API) → venue exacto del estadio
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

function lineasLeerCache() {
  try {
    var raw = localStorage.getItem(LINEAS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) {
    return null;
  }
}

function lineasGuardarCache(obj) {
  try {
    localStorage.setItem(LINEAS_CACHE_KEY, JSON.stringify(obj));
  } catch(e) {}
}

function lineasCanonVenue(venue) {
  var vReal = venue || "";

  if (typeof stadiumCanonName === "function") {
    vReal = stadiumCanonName(vReal);
  } else if (typeof STADIUM_ALIAS_2026 !== "undefined" && STADIUM_ALIAS_2026[vReal]) {
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

  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];
    var jVenue = lineasCanonVenue(j.venue);

    if (jVenue === v) return j;
  }

  return null;
}

function lineasBuscarJuego(away, home, venue) {
  var cache = lineasLeerCache();
  if (!cache || !cache.juegos) return null;

  var byVenue = lineasBuscarVenue(venue);
  if (byVenue) return byVenue;

  var a = lineasNormTeam(away);
  var h = lineasNormTeam(home);

  for (var i = 0; i < cache.juegos.length; i++) {
    var j = cache.juegos[i];

    var ja = lineasNormTeam(j.away);
    var jh = lineasNormTeam(j.home);

    if (ja === a && jh === h) return j;
  }

  return null;
}

function lineasFormatoML(n) {
  if (n === null || n === undefined || n === "") return "N/C";
  var num = Number(n);
  if (!Number.isFinite(num)) return "N/C";
  return num > 0 ? "+" + num : String(num);
}

async function jalarLineas(logFn) {
  function log(t) {
    if (typeof logFn === "function") logFn(t);
  }

  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  var cache = lineasLeerCache();

  if (cache && cache.fecha === hoy && cache.juegos && cache.juegos.length > 0) {
    log("Líneas de mercado: cache de hoy OK (" + cache.juegos.length + " juegos).");
    return cache;
  }

  log("Jalando líneas de mercado: totals + moneyline...");

  var oddsUrl =
    "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?" +
    "regions=us&markets=totals,h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm";

  var proxyUrl = MLB_ROUTES.WORKER_BASE + encodeURIComponent(oddsUrl);

  var resp = await fetch(proxyUrl);

  if (!resp.ok) {
    throw new Error("Odds API HTTP " + resp.status);
  }

  var data = await resp.json();

  if (!Array.isArray(data)) {
    throw new Error("Odds API: respuesta inesperada");
  }

  log("Juegos recibidos de Odds API: " + data.length);

  var juegos = [];
  var orden = ["draftkings", "fanduel", "betmgm"];

  for (var i = 0; i < data.length; i++) {
    var g = data[i];

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

    for (var bo = 0; bo < orden.length; bo++) {
      var bookmakers = g.bookmakers || [];

      for (var b = 0; b < bookmakers.length; b++) {
        if (bookmakers[b].key !== orden[bo]) continue;

        var mkts = bookmakers[b].markets || [];

        for (var m = 0; m < mkts.length; m++) {
          var market = mkts[m];

          if (market.key === "totals" && total === null) {
            var outsTotal = market.outcomes || [];

            for (var o = 0; o < outsTotal.length; o++) {
              if (outsTotal[o].name === "Over" && outsTotal[o].point !== undefined) {
                total = outsTotal[o].point;
                totalBookie = bookmakers[b].title;
                break;
              }
            }
          }

          if (market.key === "h2h" && (mlHome === null || mlAway === null)) {
            var outsML = market.outcomes || [];

            for (var x = 0; x < outsML.length; x++) {
              var out = outsML[x];

              if (out.name === home && out.price !== undefined) {
                mlHome = out.price;
              }

              if (out.name === away && out.price !== undefined) {
                mlAway = out.price;
              }
            }

            if (mlHome !== null || mlAway !== null) {
              mlBookie = bookmakers[b].title;
            }
          }
        }
      }

      if (total !== null && mlHome !== null && mlAway !== null) break;
    }

    juegos.push({
      home: home,
      away: away,
      venue: venue,

      total: total,
      bookie: totalBookie,

      moneyline_home: mlHome,
      moneyline_away: mlAway,
      moneyline_home_txt: lineasFormatoML(mlHome),
      moneyline_away_txt: lineasFormatoML(mlAway),
      moneyline_bookie: mlBookie
    });

    log(
      "  " + away + " @ " + home +
      " → venue: " + (venue || "N/C") +
      " · total: " + (total !== null ? total : "N/C") +
      " · ML away: " + lineasFormatoML(mlAway) +
      " · ML home: " + lineasFormatoML(mlHome)
    );
  }

  var nuevo = {
    fecha: hoy,
    juegos: juegos
  };

  lineasGuardarCache(nuevo);

  log("Líneas de mercado guardadas en cache.");

  return nuevo;
}
