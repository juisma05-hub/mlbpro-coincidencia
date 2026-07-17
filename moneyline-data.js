// moneyline-data.js
//
// FUNCIÓN:
// Integrador PREGAME de Moneyline MLBPro. Reúne en un solo objeto los
// bloques reales ya calculados para un juego: schedule, roster, lineup,
// pitcheo completo, arsenal vs lineup, clima, Coincidencia y línea de
// mercado.
//
// NO HACE:
// - No calcula ganador.
// - No calcula probabilidad.
// - No aplica pesos.
// - No inventa factores.
// - No convierte ausencia de datos en 0 ni en 1.
// - No escribe histórico.
// - No escribe Data Madre.
// - No usa resultados del juego de hoy.
//
// ENTRADA PRINCIPAL:
//   moneylineData(juego, bloques)
//
// "juego" debe contener, como mínimo:
// {
//   game_id o gamePk,
//   away / away_name / away_team,
//   home / home_name / home_team,
//   venue / venueName,
//   game_date / fecha / commence_time,
//   status / estado
// }
//
// "bloques" recibe los resultados reales ya producidos por las piezas
// cerradas, o funciones async para resolverlos:
//
// {
//   roster,
//   lineup,
//   pitcheo,
//   arsenal,
//   fuerza_equipo,
//   clima,
//
//   resolverRoster,
//   resolverLineup,
//   resolverPitcheo,
//   resolverArsenal,
//   resolverFuerzaEquipo,
//   resolverClima
// }
//
// Las funciones resolver reciben:
//   (juegoNormalizado, bloques)
//
// DEPENDENCIAS GLOBALES CONFIRMADAS:
// - climaHoyLeer(gameId)
// - calcularCoincidencia(today)
// - lineasBuscarJuego(away, home, venue)
//
// SALIDA:
// {
//   juego,
//   roster,
//   lineup,
//   pitcheo,
//   arsenal_vs_lineup,
//   fuerza_equipo,
//   clima,
//   coincidencia,
//   linea_pregame,
//   cobertura,
//   confirmado,
//   estado,
//   notas
// }
//
// REGLA:
// Cada bloque faltante queda en null con estado NO_CONFIRMADO.
// El objeto general puede devolverse aunque falten piezas, para que la
// interfaz muestre cobertura real sin fabricar una predicción.

(function (global) {
  "use strict";

  function numeroFinito(valor) {
    return typeof valor === "number" && Number.isFinite(valor);
  }

  function textoValido(valor) {
    return typeof valor === "string" && valor.trim() !== "";
  }

  function primerValor() {
    for (var i = 0; i < arguments.length; i++) {
      var valor = arguments[i];

      if (valor !== null && valor !== undefined && valor !== "") {
        return valor;
      }
    }

    return null;
  }

  function normalizarEquipo(valor) {
    if (textoValido(valor)) {
      return {
        id: null,
        name: valor.trim()
      };
    }

    if (!valor || typeof valor !== "object") {
      return {
        id: null,
        name: null
      };
    }

    return {
      id: primerValor(
        valor.id,
        valor.team_id,
        valor.teamId
      ),
      name: primerValor(
        valor.name,
        valor.team_name,
        valor.teamName,
        valor.nombre
      )
    };
  }

  function normalizarJuego(juego) {
    if (!juego || typeof juego !== "object") {
      return null;
    }

    var awayRaw = primerValor(
      juego.away,
      juego.away_team,
      juego.awayTeam,
      juego.visitante
    );

    var homeRaw = primerValor(
      juego.home,
      juego.home_team,
      juego.homeTeam,
      juego.local
    );

    var away = normalizarEquipo(awayRaw);
    var home = normalizarEquipo(homeRaw);

    if (!away.name) {
      away.name = primerValor(
        juego.away_name,
        juego.away_team_name,
        juego.visitante_nombre
      );
    }

    if (!home.name) {
      home.name = primerValor(
        juego.home_name,
        juego.home_team_name,
        juego.local_nombre
      );
    }

    if (away.id === null) {
      away.id = primerValor(
        juego.away_id,
        juego.away_team_id
      );
    }

    if (home.id === null) {
      home.id = primerValor(
        juego.home_id,
        juego.home_team_id
      );
    }

    return {
      game_id: primerValor(
        juego.game_id,
        juego.gamePk,
        juego.gamepk,
        juego.id
      ),

      fecha: primerValor(
        juego.game_date,
        juego.fecha,
        juego.date,
        juego.commence_time
      ),

      estado_juego: primerValor(
        juego.status,
        juego.estado,
        juego.game_status
      ),

      venue: primerValor(
        juego.venue,
        juego.venueName,
        juego.venue_name,
        juego.parque
      ),

      away: away,
      home: home,

      raw: juego
    };
  }

  function bloqueEstado(valor) {
    if (valor === null || valor === undefined) {
      return {
        disponible: false,
        confirmado: false,
        estado: "NO_CONFIRMADO"
      };
    }

    if (typeof valor !== "object") {
      return {
        disponible: true,
        confirmado: true,
        estado: "OK"
      };
    }

    if (valor.estado !== undefined && valor.estado !== null) {
      return {
        disponible: true,
        confirmado: false,
        estado: String(valor.estado)
      };
    }

    if (valor.confirmado === false) {
      return {
        disponible: true,
        confirmado: false,
        estado: valor.nota || "NO_CONFIRMADO"
      };
    }

    return {
      disponible: true,
      confirmado: true,
      estado: "OK"
    };
  }

  async function resolverBloque(nombre, juego, bloques) {
    var valorDirecto = bloques[nombre];

    if (valorDirecto !== undefined) {
      return valorDirecto;
    }

    var nombreResolver =
      "resolver" +
      nombre.charAt(0).toUpperCase() +
      nombre.slice(1);

    var resolver = bloques[nombreResolver];

    if (typeof resolver !== "function") {
      return null;
    }

    try {
      return await resolver(juego, bloques);
    } catch (error) {
      return {
        confirmado: false,
        estado: "ERROR_" + nombre.toUpperCase(),
        nota: error && error.message
          ? error.message
          : String(error)
      };
    }
  }

  function obtenerClimaHoy(juego, climaBloque) {
    if (climaBloque !== null && climaBloque !== undefined) {
      return climaBloque;
    }

    if (
      juego.game_id !== null &&
      typeof global.climaHoyLeer === "function"
    ) {
      try {
        return global.climaHoyLeer(juego.game_id);
      } catch (error) {
        return {
          confirmado: false,
          estado: "ERROR_CLIMA_HOY",
          nota: error && error.message
            ? error.message
            : String(error)
        };
      }
    }

    return null;
  }

  function obtenerCoincidencia(clima) {
    if (!clima || typeof clima !== "object") {
      return null;
    }

    if (typeof global.calcularCoincidencia !== "function") {
      return {
        top: null,
        ranked: [],
        estado: "DEPENDENCIA_FALTANTE",
        nota: "calcularCoincidencia no disponible"
      };
    }

    try {
      return global.calcularCoincidencia({
        venueName: primerValor(
          clima.venueName,
          clima.venue
        ),
        temperature_f: clima.temperature_f,
        windspeed_mph: clima.windspeed_mph,
        humidity_pct: clima.humidity_pct,
        precipitation_mm: clima.precipitation_mm,
        wind_dir: clima.wind_dir
      });
    } catch (error) {
      return {
        top: null,
        ranked: [],
        estado: "ERROR_COINCIDENCIA",
        nota: error && error.message
          ? error.message
          : String(error)
      };
    }
  }

  function obtenerLinea(juego) {
    if (typeof global.lineasBuscarJuego !== "function") {
      return null;
    }

    if (!juego.away.name || !juego.home.name) {
      return null;
    }

    try {
      return global.lineasBuscarJuego(
        juego.away.name,
        juego.home.name,
        juego.venue
      );
    } catch (error) {
      return {
        confirmado: false,
        estado: "ERROR_LINEA_PREGAME",
        nota: error && error.message
          ? error.message
          : String(error)
      };
    }
  }

  function validarLineaPregame(linea) {
    if (!linea || typeof linea !== "object") {
      return null;
    }

    var mlHomeValida = numeroFinito(linea.moneyline_home);
    var mlAwayValida = numeroFinito(linea.moneyline_away);
    var moneylineCompleta = mlHomeValida && mlAwayValida;

    return {
      event_id: primerValor(linea.event_id, null),
      commence_time: primerValor(linea.commence_time, null),

      home: primerValor(linea.home, null),
      away: primerValor(linea.away, null),
      venue: primerValor(linea.venue, null),

      total: numeroFinito(linea.total)
        ? linea.total
        : null,

      total_bookie: primerValor(
        linea.bookie,
        null
      ),

      moneyline_home: moneylineCompleta
        ? linea.moneyline_home
        : null,

      moneyline_away: moneylineCompleta
        ? linea.moneyline_away
        : null,

      moneyline_bookie: moneylineCompleta
        ? primerValor(linea.moneyline_bookie, null)
        : null,

      tipo_linea:
        linea.tipo_linea === "PREGAME"
          ? "PREGAME"
          : null,

      confirmado:
        linea.tipo_linea === "PREGAME" &&
        moneylineCompleta,

      estado:
        linea.tipo_linea !== "PREGAME"
          ? "NO_PREGAME"
          : moneylineCompleta
            ? "OK"
            : "MONEYLINE_NO_CONFIRMADA"
    };
  }

  function construirCobertura(bloquesSalida) {
    var nombres = Object.keys(bloquesSalida);
    var detalle = {};
    var confirmados = 0;

    for (var i = 0; i < nombres.length; i++) {
      var nombre = nombres[i];
      var estado = bloqueEstado(bloquesSalida[nombre]);

      detalle[nombre] = estado;

      if (estado.confirmado) {
        confirmados++;
      }
    }

    var total = nombres.length;

    return {
      confirmados: confirmados,
      total: total,
      porcentaje: total > 0
        ? Math.round((confirmados / total) * 100)
        : 0,
      detalle: detalle
    };
  }

  async function moneylineData(juegoEntrada, bloquesEntrada) {
    var bloques = bloquesEntrada &&
      typeof bloquesEntrada === "object"
      ? bloquesEntrada
      : {};

    var juego = normalizarJuego(juegoEntrada);

    if (!juego) {
      return {
        juego: null,
        roster: null,
        lineup: null,
        pitcheo: null,
        arsenal_vs_lineup: null,
        fuerza_equipo: null,
        clima: null,
        coincidencia: null,
        linea_pregame: null,
        cobertura: {
          confirmados: 0,
          total: 8,
          porcentaje: 0,
          detalle: {}
        },
        confirmado: false,
        estado: "ENTRADA_INVALIDA",
        notas: ["Falta el objeto del juego"]
      };
    }

    var resultados = await Promise.all([
      resolverBloque("roster", juego, bloques),
      resolverBloque("lineup", juego, bloques),
      resolverBloque("pitcheo", juego, bloques),
      resolverBloque("arsenal", juego, bloques),
      resolverBloque("fuerza_equipo", juego, bloques),
      resolverBloque("clima", juego, bloques)
    ]);

    var roster = resultados[0];
    var lineup = resultados[1];
    var pitcheo = resultados[2];
    var arsenal = resultados[3];
    var fuerzaEquipo = resultados[4];
    var clima = obtenerClimaHoy(juego, resultados[5]);

    var coincidencia = obtenerCoincidencia(clima);
    var lineaPregame = validarLineaPregame(
      obtenerLinea(juego)
    );

    var bloquesSalida = {
      roster: roster,
      lineup: lineup,
      pitcheo: pitcheo,
      arsenal_vs_lineup: arsenal,
      fuerza_equipo: fuerzaEquipo,
      clima: clima,
      coincidencia: coincidencia,
      linea_pregame: lineaPregame
    };

    var cobertura = construirCobertura(bloquesSalida);
    var notas = [];

    if (!juego.game_id) {
      notas.push("GAME_ID_NO_CONFIRMADO");
    }

    if (!juego.away.name || !juego.home.name) {
      notas.push("EQUIPOS_NO_CONFIRMADOS");
    }

    if (!juego.venue) {
      notas.push("VENUE_NO_CONFIRMADO");
    }

    if (!lineaPregame || lineaPregame.confirmado !== true) {
      notas.push("MONEYLINE_NO_CONFIRMADA");
    }

    if (
      !coincidencia ||
      coincidencia.estado !== null
    ) {
      notas.push("COINCIDENCIA_NO_CONFIRMADA");
    }

    var confirmado =
      cobertura.confirmados === cobertura.total &&
      notas.length === 0;

    return {
      juego: juego,

      roster: roster,
      lineup: lineup,
      pitcheo: pitcheo,
      arsenal_vs_lineup: arsenal,
      fuerza_equipo: fuerzaEquipo,

      clima: clima,
      coincidencia: coincidencia,
      linea_pregame: lineaPregame,

      cobertura: cobertura,

      confirmado: confirmado,
      estado: confirmado
        ? "OK"
        : "COBERTURA_PARCIAL",

      notas: notas
    };
  }

  global.moneylineData = moneylineData;
  global.MONEYLINE_DATA = {
    moneylineData: moneylineData,
    normalizarJuego: normalizarJuego,
    validarLineaPregame: validarLineaPregame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      moneylineData: moneylineData,
      normalizarJuego: normalizarJuego,
      validarLineaPregame: validarLineaPregame
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
