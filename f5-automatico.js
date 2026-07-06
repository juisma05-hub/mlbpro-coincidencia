// f5-automatico.js — MLBPro F5 · Pieza Automática
// Junta schedule de hoy + clima + lineup + cruce arsenal + línea F5 real.
// Histórico = juego pasado más reciente en el mismo parque (climaLeerCache).
// No inventa datos. Si falta algo, se marca SIN_DATOS/PENDIENTE, no se rellena.
//
// CORREGIDO 6 jul 2026: lineaMercadoF5 salía null en todos los juegos porque
// el cruce era por venue, y el venue del cache de líneas F5 venía null
// (ODDS_TEAM_TO_VENUE no encontraba el equipo). Ahora se cruza por nombre de
// equipo (home/away), que sí coincide siempre entre The Odds API y MLB StatsAPI.

async function f5AutomaticoHoy(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();

  log("Trayendo clima + juegos...");
  await jalarClima(log);

  log("Trayendo líneas F5 de mercado...");
  var lineasF5 = null;
  try { lineasF5 = await jalarLineasF5(log); } catch(e) { log("AVISO líneas F5: "+(e&&e.message?e.message:e)); }
  log("DIAGNOSTICO lineasF5: " + JSON.stringify(lineasF5));

  log("Trayendo schedule de hoy...");
  var mlbUrl = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date="+hoy+"&hydrate=probablePitcher";
  var resp = await fetch(MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl));
  if (!resp.ok) throw new Error("Schedule HTTP "+resp.status);
  var data = await resp.json();
  var games = (data.dates && data.dates[0]) ? data.dates[0].games : [];
  log("Juegos hoy: "+games.length);

  var cache = climaLeerCache();
  var resultados = [];

  for (var i=0; i<games.length; i++) {
    var g = games[i];
    var venue = g.venue ? g.venue.name : "";
    var home = (g.teams && g.teams.home && g.teams.home.team) ? g.teams.home.team.name : "?";
    var away = (g.teams && g.teams.away && g.teams.away.team) ? g.teams.away.team.name : "?";
    var pitcherHomeId = (g.teams && g.teams.home && g.teams.home.probablePitcher) ? g.teams.home.probablePitcher.id : null;
    var pitcherAwayId = (g.teams && g.teams.away && g.teams.away.probablePitcher) ? g.teams.away.probablePitcher.id : null;

    log("Procesando: "+away+" @ "+home);

    // --- clima de hoy ---
    var s = STADIUM_INDEX.get(stadiumNorm(venue));
    var today = { venue: venue, roof: s?s.roof:null, tempF: null, vientoMph: null, direccionViento: null };
    if (s) {
      try {
        var w = await climaFetchWeather(s, hoy, hoy);
        var hit = w.get(climaKeyTZ(g.gameDate, s.timezone));
        if (hit) {
          today.tempF = (typeof hit.temperature_f === "number") ? hit.temperature_f : null;
          today.vientoMph = (typeof hit.windspeed_mph === "number") ? hit.windspeed_mph : null;
          today.direccionViento = hit.wind_dir || null;
        }
      } catch(e) { log("AVISO clima hoy: "+(e&&e.message?e.message:e)); }
    }

    // --- histórico: juego pasado más reciente en el mismo parque, con clima real ---
    var histCandidatos = cache.filter(function(x){
      return x && x.venue && stadiumNorm(x.venue)===stadiumNorm(venue) &&
        x.status==="Final" && typeof x.temperature_f==="number";
    });
    histCandidatos.sort(function(a,b){ return a.date<b.date?1:-1; });
    var hist = histCandidatos[0] || null;

    var datosHistorico = hist ? {
      venue: hist.venue, roof: hist.roof||null, tempF: hist.temperature_f,
      vientoMph: (typeof hist.windspeed_mph==="number")?hist.windspeed_mph:null,
      direccionViento: hist.wind_dir||null, perfilPitcher: null
    } : { venue: null, roof: null, tempF: null, vientoMph: null, direccionViento: null, perfilPitcher: null };

    var datosHoy = {
      juego: away+" @ "+home, venue: venue, roof: today.roof,
      tempF: today.tempF, vientoMph: today.vientoMph, direccionViento: today.direccionViento,
      perfilPitcher: null
    };

    var coincidencia = f5Coincidencia(datosHoy, datosHistorico);

    // --- lineup de hoy (mismo juego) ---
    var lineupData = null;
    try { lineupData = await jalarLineup(g.gamePk); } catch(e) { log("AVISO lineup: "+(e&&e.message?e.message:e)); }

    // --- cruce arsenal vs lineup rival (Carreraje) ---
    // CORREGIDO: cruce por equipo (home/away), ya no por venue.
    var lineaF5Juego = lineasF5 ? lineasF5BuscarEquipos(home, away) : null;
    var lineaCarreraje = (lineaF5Juego && lineaF5Juego.runlineF5) ? lineaF5Juego.runlineF5.point : 0.5;

    var carrerajeHome = { pieza:"F5_CARRERAJE", estado:"SIN_DATOS", detalle:"Sin pitcher o lineup rival." };
    var carrerajeAway = { pieza:"F5_CARRERAJE", estado:"SIN_DATOS", detalle:"Sin pitcher o lineup rival." };

    if (pitcherHomeId && lineupData && lineupData.lineup_away && lineupData.lineup_away.length) {
      var cruceHome = calcularFactorArsenalLineup(pitcherHomeId, lineupData.lineup_away);
      var cruceArsenalHome = cruceHome.confirmado
        ? { estado:"OK", woba_esperado: cruceHome.woba_esperado }
        : { estado: cruceHome.bateadores_usados>0 ? "PENDIENTE" : "NO_CONFIRMADO", woba_esperado: cruceHome.woba_esperado };
      carrerajeHome = f5Carreraje(cruceArsenalHome, lineaCarreraje);
    }
    if (pitcherAwayId && lineupData && lineupData.lineup_home && lineupData.lineup_home.length) {
      var cruceAway = calcularFactorArsenalLineup(pitcherAwayId, lineupData.lineup_home);
      var cruceArsenalAway = cruceAway.confirmado
        ? { estado:"OK", woba_esperado: cruceAway.woba_esperado }
        : { estado: cruceAway.bateadores_usados>0 ? "PENDIENTE" : "NO_CONFIRMADO", woba_esperado: cruceAway.woba_esperado };
      carrerajeAway = f5Carreraje(cruceArsenalAway, lineaCarreraje);
    }

    var moneyline = f5MoneyLine(carrerajeHome, carrerajeAway);

    resultados.push({
      juego: away+" @ "+home,
      venue: venue,
      pitcherHomeId: pitcherHomeId, pitcherAwayId: pitcherAwayId,
      coincidencia: coincidencia,
      carrerajeHome: carrerajeHome,
      carrerajeAway: carrerajeAway,
      moneyline: moneyline,
      lineaMercadoF5: lineaF5Juego
    });
  }

  log("LISTO. "+resultados.length+" juego(s) procesado(s).");
  return resultados;
}
