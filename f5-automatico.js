/*
  MLBPro · f5-automatico.js

  FUNCIÓN:
  Pieza automática de F5 (primeras 5 entradas). Junta, para cada juego real
  de HOY: schedule + clima de hoy + histórico del mismo parque + línea F5 de
  mercado + lineup rival + cruce arsenal-vs-lineup + Carreraje + MoneyLine
  propio de F5.

  CORRECCIÓN 20 JUL 2026:
  f5MoneyLine() recibe lineaF5Juego como tercer parámetro para calcular los
  porcentajes propios y compararlos contra la Moneyline F5 real de mercado.
*/

function diagnosticoArsenalLineup(pitcherId, lineupRival, etiqueta, logFn) {
  function log(t) {
    if (typeof logFn === "function") logFn(t);
  }

  if (!pitcherId) {
    log(
      "  DIAGNOSTICO ARSENAL [" +
        etiqueta +
        "]: sin pitcherId (probable pitcher no confirmado)."
    );
    return;
  }

  const arsenalData =
    typeof ARSENAL_MASTER_2026 !== "undefined"
      ? ARSENAL_MASTER_2026[pitcherId]
      : null;

  const tieneArsenal = !!(
    arsenalData &&
    arsenalData.arsenal &&
    arsenalData.arsenal.length
  );

  const totalLineup = lineupRival ? lineupRival.length : 0;
  let bateadoresEncontrados = 0;

  if (
    lineupRival &&
    typeof BATTERS_VSPITCH_2026 !== "undefined"
  ) {
    for (let i = 0; i < lineupRival.length; i++) {
      if (
        BATTERS_VSPITCH_2026[
          lineupRival[i].player_id
        ]
      ) {
        bateadoresEncontrados++;
      }
    }
  }

  let codigosSinCruce = [];

  if (
    tieneArsenal &&
    lineupRival &&
    lineupRival.length &&
    typeof BATTERS_VSPITCH_2026 !== "undefined"
  ) {
    arsenalData.arsenal.forEach(function (pitch) {
      let encontrado = false;

      for (let i = 0; i < lineupRival.length; i++) {
        const bd =
          BATTERS_VSPITCH_2026[
            lineupRival[i].player_id
          ];

        if (
          bd &&
          bd.vs &&
          bd.vs[pitch.pt] &&
          bd.vs[pitch.pt].pa >= 5
        ) {
          encontrado = true;
          break;
        }
      }

      if (!encontrado) {
        codigosSinCruce.push(
          pitch.pt +
            "(" +
            pitch.usage +
            "%)"
        );
      }
    });
  }

  log(
    "  DIAGNOSTICO ARSENAL [" +
      etiqueta +
      "] pitcherId=" +
      pitcherId +
      " | pitcher_sin_arsenal=" +
      !tieneArsenal +
      " | bateadores_encontrados=" +
      bateadoresEncontrados +
      "/" +
      totalLineup +
      " | codigos_arsenal_sin_cruce=" +
      (codigosSinCruce.length
        ? codigosSinCruce.join(", ")
        : "ninguno")
  );
}

async function f5AutomaticoHoy(logFn) {
  function log(t) {
    if (typeof logFn === "function") logFn(t);
  }

  var hoy = climaHoyISO();

  log("Trayendo clima + juegos...");
  await jalarClima(log);

  log("Trayendo líneas F5 de mercado...");

  var lineasF5 = null;

  try {
    lineasF5 = await jalarLineasF5(log);
  } catch (e) {
    log(
      "AVISO líneas F5: " +
        (e && e.message ? e.message : e)
    );
  }

  log(
    "DIAGNOSTICO lineasF5: " +
      JSON.stringify(lineasF5)
  );

  log("Trayendo schedule de hoy...");

  var mlbUrl =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" +
    hoy +
    "&hydrate=probablePitcher";

  var resp = await fetch(
    MLB_ROUTES.WORKER_BASE +
      encodeURIComponent(mlbUrl)
  );

  if (!resp.ok) {
    throw new Error(
      "Schedule HTTP " + resp.status
    );
  }

  var data = await resp.json();

  var games =
    data.dates && data.dates[0]
      ? data.dates[0].games
      : [];

  log("Juegos hoy: " + games.length);

  var cache = climaLeerCache();
  var resultados = [];

  for (var i = 0; i < games.length; i++) {
    var g = games[i];

    var venue =
      g.venue
        ? g.venue.name
        : "";

    var home =
      g.teams &&
      g.teams.home &&
      g.teams.home.team
        ? g.teams.home.team.name
        : "?";

    var away =
      g.teams &&
      g.teams.away &&
      g.teams.away.team
        ? g.teams.away.team.name
        : "?";

    var homeTeamId =
      g.teams &&
      g.teams.home &&
      g.teams.home.team
        ? g.teams.home.team.id
        : null;

    var awayTeamId =
      g.teams &&
      g.teams.away &&
      g.teams.away.team
        ? g.teams.away.team.id
        : null;

    var pitcherHomeId =
      g.teams &&
      g.teams.home &&
      g.teams.home.probablePitcher
        ? g.teams.home.probablePitcher.id
        : null;

    var pitcherAwayId =
      g.teams &&
      g.teams.away &&
      g.teams.away.probablePitcher
        ? g.teams.away.probablePitcher.id
        : null;

    log(
      "Procesando: " +
        away +
        " @ " +
        home
    );

    var s = stadiumGet(venue);

    var today = {
      venue: venue,
      roof: s ? s.roof : null,
      tempF: null,
      humedad: null,
      vientoMph: null,
      direccionViento: null
    };

    if (s) {
      try {
        var w = await climaFetchWeather(
          s,
          hoy,
          hoy
        );

        var clave = climaKeyTZ(
          g.gameDate,
          s.timezone
        );

        var hit =
          w.get(clave) ||
          climaBuscarHoraCercana(
            w,
            clave
          );

        if (hit) {
          today.tempF =
            typeof hit.temperature_f ===
            "number"
              ? hit.temperature_f
              : null;

          today.humedad =
            typeof hit.humidity_pct ===
            "number"
              ? hit.humidity_pct
              : null;

          today.vientoMph =
            typeof hit.windspeed_mph ===
            "number"
              ? hit.windspeed_mph
              : null;

          today.direccionViento =
            typeof hit.wind_dir ===
            "number"
              ? hit.wind_dir
              : null;
        }
      } catch (e) {
        log(
          "AVISO clima hoy: " +
            (e && e.message
              ? e.message
              : e)
        );
      }
    }

    var histCandidatos =
      cache.filter(function (x) {
        return (
          x &&
          x.venue &&
          stadiumNorm(
            stadiumCanonName(x.venue)
          ) ===
            stadiumNorm(
              stadiumCanonName(venue)
            ) &&
          x.status === "Final" &&
          typeof x.temperature_f ===
            "number"
        );
      });

    histCandidatos.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });

    var hist =
      histCandidatos[0] || null;

    var perfilPitcherHoy =
      typeof armarPerfilPitcher ===
      "function"
        ? armarPerfilPitcher(
            pitcherHomeId
          )
        : null;

    var perfilPitcherAwayHoy =
      typeof armarPerfilPitcher ===
      "function"
        ? armarPerfilPitcher(
            pitcherAwayId
          )
        : null;

    var perfilPitcherHist =
      typeof armarPerfilPitcher ===
        "function" && hist
        ? armarPerfilPitcher(
            hist.home_pitcher_id
          )
        : null;

    log(
      "DIAGNOSTICO F5 pitcher [" +
        home +
        "]: pitcherHomeId=" +
        pitcherHomeId +
        " | hist.game_id=" +
        (hist
          ? hist.game_id
          : "sin_hist") +
        " | hist.home_pitcher_id=" +
        (hist
          ? hist.home_pitcher_id
          : "sin_hist") +
        " | perfilHoy=" +
        JSON.stringify(
          perfilPitcherHoy
        ) +
        " | perfilHist=" +
        JSON.stringify(
          perfilPitcherHist
        )
    );

    var proyeccionTemprana =
      typeof proyectarF5DesdePitcher ===
      "function"
        ? proyectarF5DesdePitcher(
            perfilPitcherHoy,
            perfilPitcherAwayHoy
          )
        : {
            pieza:
              "F5_PROYECCION_TEMPRANA",
            estado: "SIN_DATOS",
            detalle:
              "Función de proyección no cargada."
          };

    var datosHistorico = hist
      ? {
          venue: hist.venue,
          roof: hist.roof || null,
          tempF:
            hist.temperature_f,

          vientoMph:
            typeof hist.windspeed_mph ===
            "number"
              ? hist.windspeed_mph
              : null,

          direccionViento:
            typeof hist.wind_dir ===
            "number"
              ? hist.wind_dir
              : null,

          perfilPitcher:
            perfilPitcherHist
        }
      : {
          venue: null,
          roof: null,
          tempF: null,
          vientoMph: null,
          direccionViento: null,
          perfilPitcher: null
        };

    var datosHoy = {
      juego:
        away + " @ " + home,

      venue: venue,
      roof: today.roof,
      tempF: today.tempF,
      vientoMph:
        today.vientoMph,
      direccionViento:
        today.direccionViento,
      perfilPitcher:
        perfilPitcherHoy
    };

    var coincidencia =
      f5Coincidencia(
        datosHoy,
        datosHistorico
      );

    var lineupData = null;

    try {
      lineupData =
        await jalarLineup(
          g.gamePk,
          awayTeamId,
          homeTeamId
        );
    } catch (e) {
      log(
        "AVISO lineup: " +
          (e && e.message
            ? e.message
            : e)
      );
    }

    var lineaF5Juego =
      lineasF5
        ? lineasF5BuscarEquipos(
            home,
            away
          )
        : null;

    var lineaCarreraje =
      lineaF5Juego &&
      lineaF5Juego.runlineF5 &&
      typeof lineaF5Juego
        .runlineF5.point === "number"
        ? lineaF5Juego
            .runlineF5.point
        : null;

    var carrerajeHome = {
      pieza: "F5_CARRERAJE",
      estado: "SIN_DATOS",
      detalle:
        "Sin pitcher o lineup rival."
    };

    var carrerajeAway = {
      pieza: "F5_CARRERAJE",
      estado: "SIN_DATOS",
      detalle:
        "Sin pitcher o lineup rival."
    };

    log(
      "DIAGNOSTICO F5 [" +
        away +
        " @ " +
        home +
        "]:"
    );

    diagnosticoArsenalLineup(
      pitcherHomeId,
      lineupData
        ? lineupData.lineup_away
        : null,
      "carrerajeHome: pitcher HOME vs lineup AWAY",
      log
    );

    diagnosticoArsenalLineup(
      pitcherAwayId,
      lineupData
        ? lineupData.lineup_home
        : null,
      "carrerajeAway: pitcher AWAY vs lineup HOME",
      log
    );

    if (
      pitcherHomeId &&
      lineupData &&
      lineupData.lineup_disponible_away
    ) {
      var cruceHome =
        calcularFactorArsenalLineup(
          pitcherHomeId,
          lineupData.lineup_away
        );

      log(
        "  DIAGNOSTICO CRUCE [carrerajeHome] bateadores_usados=" +
          cruceHome.bateadores_usados +
          "/" +
          cruceHome.bateadores_total +
          " | nota=" +
          cruceHome.nota
      );

      var cruceArsenalHome =
        cruceHome.confirmado
          ? {
              estado: "OK",
              woba_esperado:
                cruceHome.woba_esperado
            }
          : {
              estado:
                cruceHome
                  .bateadores_usados >
                0
                  ? "PENDIENTE"
                  : "NO_CONFIRMADO",

              woba_esperado:
                cruceHome.woba_esperado
            };

      log(
        "  DIAGNOSTICO F5CARRERAJE [carrerajeHome] cruce.confirmado=" +
          cruceHome.confirmado +
          " | cruce.woba_esperado=" +
          cruceHome.woba_esperado
      );

      log(
        "  DIAGNOSTICO F5CARRERAJE [carrerajeHome] ENVIADO=" +
          JSON.stringify(
            cruceArsenalHome
          ) +
          " | lineaCarreraje=" +
          lineaCarreraje
      );

      carrerajeHome =
        f5Carreraje(
          cruceArsenalHome,
          lineaCarreraje
        );

      log(
        "  DIAGNOSTICO F5CARRERAJE [carrerajeHome] DEVUELTO=" +
          JSON.stringify(
            carrerajeHome
          )
      );
    }

    if (
      pitcherAwayId &&
      lineupData &&
      lineupData.lineup_disponible_home
    ) {
      var cruceAway =
        calcularFactorArsenalLineup(
          pitcherAwayId,
          lineupData.lineup_home
        );

      log(
        "  DIAGNOSTICO CRUCE [carrerajeAway] bateadores_usados=" +
          cruceAway.bateadores_usados +
          "/" +
          cruceAway.bateadores_total +
          " | nota=" +
          cruceAway.nota
      );

      var cruceArsenalAway =
        cruceAway.confirmado
          ? {
              estado: "OK",
              woba_esperado:
                cruceAway.woba_esperado
            }
          : {
              estado:
                cruceAway
                  .bateadores_usados >
                0
                  ? "PENDIENTE"
                  : "NO_CONFIRMADO",

              woba_esperado:
                cruceAway.woba_esperado
            };

      log(
        "  DIAGNOSTICO F5CARRERAJE [carrerajeAway] cruce.confirmado=" +
          cruceAway.confirmado +
          " | cruce.woba_esperado=" +
          cruceAway.woba_esperado
      );

      log(
        "  DIAGNOSTICO F5CARRERAJE [carrerajeAway] ENVIADO=" +
          JSON.stringify(
            cruceArsenalAway
          ) +
          " | lineaCarreraje=" +
          lineaCarreraje
      );

      carrerajeAway =
        f5Carreraje(
          cruceArsenalAway,
          lineaCarreraje
        );

      log(
        "  DIAGNOSTICO F5CARRERAJE [carrerajeAway] DEVUELTO=" +
          JSON.stringify(
            carrerajeAway
          )
      );
    }

    var moneyline =
      f5MoneyLine(
        carrerajeHome,
        carrerajeAway,
        lineaF5Juego
      );

    resultados.push({
      juego:
        away + " @ " + home,

      venue: venue,
      gamePk: g.gamePk,

      pitcherHomeId:
        pitcherHomeId,

      pitcherAwayId:
        pitcherAwayId,

      coincidencia:
        coincidencia,

      carrerajeHome:
        carrerajeHome,

      carrerajeAway:
        carrerajeAway,

      moneyline:
        moneyline,

      lineaMercadoF5:
        lineaF5Juego,

      proyeccionTemprana:
        proyeccionTemprana,

      tempF:
        today.tempF,

      humedad:
        today.humedad,

      vientoMph:
        today.vientoMph,

      direccionViento:
        today.direccionViento,

      roof:
        today.roof
    });
  }

  log(
    "LISTO. " +
      resultados.length +
      " juego(s) procesado(s)."
  );

  return resultados;
}
