/*
  MLBPro · f5-automatico.js

  FUNCIÓN:
  Pieza automática de F5 (primeras 5 entradas). Junta, para cada juego real
  de HOY: schedule + clima de hoy + histórico del mismo parque + línea F5 de
  mercado + lineup rival + cruce arsenal-vs-lineup + Carreraje + MoneyLine
  propio de F5. No define ninguna fórmula propia de Coincidencia, Carreraje
  ni MoneyLine: solo orquesta y junta lo que devuelven f5-coincidencia.js,
  f5-carreraje.js, f5-moneyline.js, jalar-lineup.js y factor-arsenal-lineup.js.

  ENTRADAS:
  logFn (function, opcional) — callback para mostrar progreso en consola.
  Internamente: schedule de hoy (MLB StatsAPI vía MLB_ROUTES.WORKER_BASE,
  hydrate=probablePitcher), climaLeerCache() (histórico), climaFetchWeather()
  + climaKeyTZ() (clima de hoy), jalarLineasF5() (mercado F5),
  jalarLineup(gamePk, awayTeamId, homeTeamId) (lineup rival).

  SALIDAS / MODIFICACIONES:
  Array de objetos, uno por juego de hoy:
    { juego, venue, gamePk, pitcherHomeId, pitcherAwayId,
      coincidencia, carrerajeHome, carrerajeAway, moneyline,
      lineaMercadoF5, proyeccionTemprana,
      tempF, humedad, vientoMph, direccionViento, roof }
  No escribe cache propia. Dispara escrituras indirectas ya existentes en
  otros módulos: climaGuardarCache() (vía jalarClima(), histórico) y
  lineasF5GuardarCache() (vía jalarLineasF5(), caché de mercado F5).

  DEPENDENCIAS:
  mlb-routes.js, estadios.js, clima-cache.js, jalar-clima.js,
  jalar-linea-f5.js, jalar-lineup.js, arsenal-master.js, batters-vspitch.js,
  pitchers-master.js, factor-arsenal-lineup.js, perfil-pitcher-builder.js,
  proyeccion-pitcher-temprana.js, f5-estadio.js, f5-roof.js,
  f5-temperatura.js, f5-viento.js, f5-pitcher.js, f5-coincidencia.js,
  f5-carreraje.js, f5-moneyline.js (todos cargados como <script> en
  f5-automatico-test.html antes de este archivo).

  NO TOCA:
  clima-cache.js, jalar-clima.js (histórico y clima de hoy: solo los llama,
  no cambia su lógica), Coincidencia general (calcular-coincidencia.js,
  score-match.js — esto es F5, un motor aparte), K6, brújula, jalar-linea.js
  (mercado de línea completa, distinto de jalar-linea-f5.js). No escribe
  ninguna caché directamente.

  CORRECCIÓN ANTERIOR (misma cadena, sesión previa):
  jalarLineup(g.gamePk) se llamaba SIN awayTeamId/homeTeamId, así que el
  fallback real LINEUP_ULTIMO_CONFIRMADO (ya existente en jalar-lineup.js)
  nunca se activaba para F5. Se agregó la extracción de homeTeamId/
  awayTeamId y ahora se llama jalarLineup(g.gamePk, awayTeamId, homeTeamId).
  Las condiciones que deciden si hay lineup rival usable pasan de mirar
  solo ".length" a mirar lineup_disponible_away / lineup_disponible_home.
  Confirmado: ya no es el cuello de botella (evidencia: aparecen casos
  "PENDIENTE POR ACCESO" con wOBA/Dominio calculados).

  DIAGNÓSTICO TEMPORAL — RONDA 1 (sesión anterior, CERRADA):
  Se agregó diagnosticoArsenalLineup() para revisar si el mismatch de
  códigos FS/SV entre ARSENAL_MASTER_2026 y BATTERS_VSPITCH_2026 explicaba
  el SIN_DATOS. Evidencia real de la corrida: pitcher_sin_arsenal=false en
  los casos revisados, bateadores_encontrados y bateadores_usados en
  7/9, 8/9 y 9/9, nota=OK. CONFIRMADO: el cruce arsenal-vs-lineup sí se
  ejecuta correctamente. factor-arsenal-lineup.js queda descartado como
  cuello de botella — no se toca.

  DIAGNÓSTICO TEMPORAL — RONDA 2 (esta sesión, EN CURSO):
  Con factor-arsenal-lineup.js descartado, el diagnóstico se mueve a la
  entrada/salida real de f5Carreraje() (f5-carreraje.js), que es el
  siguiente eslabón de la cadena. Se agregó logging de: cruce.confirmado,
  cruce.woba_esperado, el objeto exacto que se envía a f5Carreraje()
  (cruceArsenalHome/cruceArsenalAway + lineaCarreraje), y el objeto
  completo que f5Carreraje() devuelve (carrerajeHome/carrerajeAway). No se
  modifica ninguna fórmula de f5-carreraje.js, factor-arsenal-lineup.js,
  Moneyline, clima, línea de mercado, K6 ni brújula. Todo el logging de la
  Ronda 1 se deja intacto para no perder el rastro completo de la cadena
  en una sola corrida.

  FECHA:
  12 jul 2026.

  ESTADO:
  NO_CONFIRMADO — con diagnóstico de entrada/salida de f5Carreraje()
  agregado. Pendiente de una corrida real de F5 Automático para ver el
  objeto exacto que devuelve f5Carreraje() y confirmar si el corte está
  ahí o más adelante en la cadena (f5MoneyLine()).
*/

// f5-automatico.js — MLBPro F5 · Pieza Automática
// Junta schedule de hoy + clima + lineup + cruce arsenal + línea F5 real.
// Histórico = juego pasado más reciente en el mismo parque (climaLeerCache).
// No inventa datos. Si falta algo, se marca SIN_DATOS/PENDIENTE, no se rellena.
//
// CORREGIDO 6 jul 2026: lineaMercadoF5 salía null en todos los juegos porque
// el cruce era por venue, y el venue del cache de líneas F5 venía null
// (ODDS_TEAM_TO_VENUE no encontraba el equipo). Ahora se cruza por nombre de
// equipo (home/away), que sí coincide siempre entre The Odds API y MLB StatsAPI.
//
// CORREGIDO 10 jul 2026: el clima de hoy (tempF, vientoMph, direccionViento,
// roof) se calculaba en la variable `today` pero nunca se agregaba al objeto
// de resultados.push(...) — se descartaba después de usarse solo para
// f5Coincidencia. Ahora se expone en el resultado para que
// f5-automatico-test.html pueda leerlo. Se agrega también `humedad`
// (hit.humidity_pct), que `today` no capturaba antes: es el mismo patrón
// exacto que ya usan tempF/vientoMph/direccionViento sobre el mismo objeto
// `hit`, no un cálculo nuevo ni una conversión inventada.
// DIAGNÓSTICO TEMPORAL — SOLO LECTURA.
// No modifica ARSENAL_MASTER_2026, BATTERS_VSPITCH_2026 ni
// calcularFactorArsenalLineup(). Solo inspecciona los mismos datos que esa
// función ya usa, para imprimir en consola por qué un cruce puede quedar
// sin bateadores válidos. Se puede quitar sin afectar ningún cálculo real.
function diagnosticoArsenalLineup(pitcherId, lineupRival, etiqueta, logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  if (!pitcherId) {
    log("  DIAGNOSTICO ARSENAL [" + etiqueta + "]: sin pitcherId (probable pitcher no confirmado).");
    return;
  }

  const arsenalData = (typeof ARSENAL_MASTER_2026 !== "undefined") ? ARSENAL_MASTER_2026[pitcherId] : null;
  const tieneArsenal = !!(arsenalData && arsenalData.arsenal && arsenalData.arsenal.length);

  const totalLineup = lineupRival ? lineupRival.length : 0;
  let bateadoresEncontrados = 0;
  if (lineupRival && typeof BATTERS_VSPITCH_2026 !== "undefined") {
    for (let i = 0; i < lineupRival.length; i++) {
      if (BATTERS_VSPITCH_2026[lineupRival[i].player_id]) bateadoresEncontrados++;
    }
  }

  // Códigos del arsenal de ESTE pitcher que, cruzando contra ESTE lineup
  // real, no encuentran ningún bateador con ese código y pa>=5. Esto es
  // lectura pura, con los mismos criterios que ya usa
  // calcularFactorArsenalLineup() (pa>=5), no un criterio nuevo.
  let codigosSinCruce = [];
  if (tieneArsenal && lineupRival && lineupRival.length && typeof BATTERS_VSPITCH_2026 !== "undefined") {
    arsenalData.arsenal.forEach(function (pitch) {
      let encontrado = false;
      for (let i = 0; i < lineupRival.length; i++) {
        const bd = BATTERS_VSPITCH_2026[lineupRival[i].player_id];
        if (bd && bd.vs && bd.vs[pitch.pt] && bd.vs[pitch.pt].pa >= 5) { encontrado = true; break; }
      }
      if (!encontrado) codigosSinCruce.push(pitch.pt + "(" + pitch.usage + "%)");
    });
  }

  log(
    "  DIAGNOSTICO ARSENAL [" + etiqueta + "] pitcherId=" + pitcherId +
    " | pitcher_sin_arsenal=" + (!tieneArsenal) +
    " | bateadores_encontrados=" + bateadoresEncontrados + "/" + totalLineup +
    " | codigos_arsenal_sin_cruce=" + (codigosSinCruce.length ? codigosSinCruce.join(", ") : "ninguno")
  );
}

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
    var homeTeamId = (g.teams && g.teams.home && g.teams.home.team) ? g.teams.home.team.id : null;
    var awayTeamId = (g.teams && g.teams.away && g.teams.away.team) ? g.teams.away.team.id : null;
    var pitcherHomeId = (g.teams && g.teams.home && g.teams.home.probablePitcher) ? g.teams.home.probablePitcher.id : null;
    var pitcherAwayId = (g.teams && g.teams.away && g.teams.away.probablePitcher) ? g.teams.away.probablePitcher.id : null;

    log("Procesando: "+away+" @ "+home);

    // --- clima de hoy ---
    var s = STADIUM_INDEX.get(stadiumNorm(venue));
    var today = { venue: venue, roof: s?s.roof:null, tempF: null, humedad: null, vientoMph: null, direccionViento: null };
    if (s) {
      try {
        var w = await climaFetchWeather(s, hoy, hoy);
        var hit = w.get(climaKeyTZ(g.gameDate, s.timezone));
        if (hit) {
          today.tempF = (typeof hit.temperature_f === "number") ? hit.temperature_f : null;
          today.humedad = (typeof hit.humidity_pct === "number") ? hit.humidity_pct : null;
          today.vientoMph = (typeof hit.windspeed_mph === "number") ? hit.windspeed_mph : null;
          today.direccionViento = (typeof hit.wind_dir === "number") ? hit.wind_dir : null;
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

    var perfilPitcherHoy = (typeof armarPerfilPitcher === "function") ? armarPerfilPitcher(pitcherHomeId) : null;
    var perfilPitcherAwayHoy = (typeof armarPerfilPitcher === "function") ? armarPerfilPitcher(pitcherAwayId) : null;
    var perfilPitcherHist = (typeof armarPerfilPitcher === "function" && hist) ? armarPerfilPitcher(hist.home_pitcher_id) : null;

    log("DIAGNOSTICO F5 pitcher ["+home+"]: pitcherHomeId="+pitcherHomeId+
      " | hist.game_id="+(hist?hist.game_id:"sin_hist")+
      " | hist.home_pitcher_id="+(hist?hist.home_pitcher_id:"sin_hist")+
      " | perfilHoy="+JSON.stringify(perfilPitcherHoy)+
      " | perfilHist="+JSON.stringify(perfilPitcherHist));

    var proyeccionTemprana = (typeof proyectarF5DesdePitcher === "function")
      ? proyectarF5DesdePitcher(perfilPitcherHoy, perfilPitcherAwayHoy)
      : { pieza: "F5_PROYECCION_TEMPRANA", estado: "SIN_DATOS", detalle: "Función de proyección no cargada." };

    var datosHistorico = hist ? {
      venue: hist.venue, roof: hist.roof||null, tempF: hist.temperature_f,
      vientoMph: (typeof hist.windspeed_mph==="number")?hist.windspeed_mph:null,
      direccionViento: hist.wind_dir||null, perfilPitcher: perfilPitcherHist
    } : { venue: null, roof: null, tempF: null, vientoMph: null, direccionViento: null, perfilPitcher: null };

    var datosHoy = {
      juego: away+" @ "+home, venue: venue, roof: today.roof,
      tempF: today.tempF, vientoMph: today.vientoMph, direccionViento: today.direccionViento,
      perfilPitcher: perfilPitcherHoy
    };

    var coincidencia = f5Coincidencia(datosHoy, datosHistorico);

    // --- lineup rival de hoy (con fallback real al último CONFIRMADO del
    // equipo si el de hoy todavía no sale oficial; ver jalar-lineup.js) ---
    var lineupData = null;
    try { lineupData = await jalarLineup(g.gamePk, awayTeamId, homeTeamId); } catch(e) { log("AVISO lineup: "+(e&&e.message?e.message:e)); }

    // --- cruce arsenal vs lineup rival (Carreraje) ---
    // CORREGIDO: cruce por equipo (home/away), ya no por venue.
    var lineaF5Juego = lineasF5 ? lineasF5BuscarEquipos(home, away) : null;
    var lineaCarreraje = (lineaF5Juego && lineaF5Juego.runlineF5) ? lineaF5Juego.runlineF5.point : 0.5;

    var carrerajeHome = { pieza:"F5_CARRERAJE", estado:"SIN_DATOS", detalle:"Sin pitcher o lineup rival." };
    var carrerajeAway = { pieza:"F5_CARRERAJE", estado:"SIN_DATOS", detalle:"Sin pitcher o lineup rival." };

    // --- DIAGNOSTICO TEMPORAL (solo lectura, ver prólogo) ---
    log("DIAGNOSTICO F5 [" + away + " @ " + home + "]:");
    diagnosticoArsenalLineup(pitcherHomeId, lineupData ? lineupData.lineup_away : null, "carrerajeHome: pitcher HOME vs lineup AWAY", log);
    diagnosticoArsenalLineup(pitcherAwayId, lineupData ? lineupData.lineup_home : null, "carrerajeAway: pitcher AWAY vs lineup HOME", log);
    // --- FIN DIAGNOSTICO TEMPORAL ---

    // lineup_disponible_away/home = hay 9 titulares reales (de hoy o del
    // ULTIMO_CONFIRMADO real), sin importar la fuente. Antes se miraba solo
    // ".length", que quedaba vacío si jalarLineup() no recibía los teamId
    // (por eso nunca activaba el fallback real y quedaba SIN_DATOS).
    if (pitcherHomeId && lineupData && lineupData.lineup_disponible_away) {
      var cruceHome = calcularFactorArsenalLineup(pitcherHomeId, lineupData.lineup_away);
      log("  DIAGNOSTICO CRUCE [carrerajeHome] bateadores_usados=" + cruceHome.bateadores_usados + "/" + cruceHome.bateadores_total + " | nota=" + cruceHome.nota);
      var cruceArsenalHome = cruceHome.confirmado
        ? { estado:"OK", woba_esperado: cruceHome.woba_esperado }
        : { estado: cruceHome.bateadores_usados>0 ? "PENDIENTE" : "NO_CONFIRMADO", woba_esperado: cruceHome.woba_esperado };
      // --- DIAGNOSTICO TEMPORAL: entrada/salida real de f5Carreraje() ---
      log("  DIAGNOSTICO F5CARRERAJE [carrerajeHome] cruce.confirmado=" + cruceHome.confirmado + " | cruce.woba_esperado=" + cruceHome.woba_esperado);
      log("  DIAGNOSTICO F5CARRERAJE [carrerajeHome] ENVIADO=" + JSON.stringify(cruceArsenalHome) + " | lineaCarreraje=" + lineaCarreraje);
      carrerajeHome = f5Carreraje(cruceArsenalHome, lineaCarreraje);
      log("  DIAGNOSTICO F5CARRERAJE [carrerajeHome] DEVUELTO=" + JSON.stringify(carrerajeHome));
      // --- FIN DIAGNOSTICO TEMPORAL ---
    }
    if (pitcherAwayId && lineupData && lineupData.lineup_disponible_home) {
      var cruceAway = calcularFactorArsenalLineup(pitcherAwayId, lineupData.lineup_home);
      log("  DIAGNOSTICO CRUCE [carrerajeAway] bateadores_usados=" + cruceAway.bateadores_usados + "/" + cruceAway.bateadores_total + " | nota=" + cruceAway.nota);
      var cruceArsenalAway = cruceAway.confirmado
        ? { estado:"OK", woba_esperado: cruceAway.woba_esperado }
        : { estado: cruceAway.bateadores_usados>0 ? "PENDIENTE" : "NO_CONFIRMADO", woba_esperado: cruceAway.woba_esperado };
      // --- DIAGNOSTICO TEMPORAL: entrada/salida real de f5Carreraje() ---
      log("  DIAGNOSTICO F5CARRERAJE [carrerajeAway] cruce.confirmado=" + cruceAway.confirmado + " | cruce.woba_esperado=" + cruceAway.woba_esperado);
      log("  DIAGNOSTICO F5CARRERAJE [carrerajeAway] ENVIADO=" + JSON.stringify(cruceArsenalAway) + " | lineaCarreraje=" + lineaCarreraje);
      carrerajeAway = f5Carreraje(cruceArsenalAway, lineaCarreraje);
      log("  DIAGNOSTICO F5CARRERAJE [carrerajeAway] DEVUELTO=" + JSON.stringify(carrerajeAway));
      // --- FIN DIAGNOSTICO TEMPORAL ---
    }

    var moneyline = f5MoneyLine(carrerajeHome, carrerajeAway);

    resultados.push({
      juego: away+" @ "+home,
      venue: venue,
      gamePk: g.gamePk,
      pitcherHomeId: pitcherHomeId, pitcherAwayId: pitcherAwayId,
      coincidencia: coincidencia,
      carrerajeHome: carrerajeHome,
      carrerajeAway: carrerajeAway,
      moneyline: moneyline,
      lineaMercadoF5: lineaF5Juego,
      proyeccionTemprana: proyeccionTemprana,
      tempF: today.tempF,
      humedad: today.humedad,
      vientoMph: today.vientoMph,
      direccionViento: today.direccionViento,
      roof: today.roof
    });
  }

  log("LISTO. "+resultados.length+" juego(s) procesado(s).");
  return resultados;
}
