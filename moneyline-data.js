// moneyline-data.js
//
// FUNCIÓN:
// Integrador PREGAME de Moneyline MLBPro. Reúne en un solo objeto los
// bloques reales ya calculados para un juego: schedule, roster, lineup,
// pitcheo completo, arsenal vs lineup, fuerza del equipo, clima,
// Coincidencia y línea de mercado.
//
// ORDEN REAL DE RESOLUCIÓN:
//   1) roster
//   2) lineup
//   3) arsenal vs lineup
//   4) pitcheo completo
//   5) fuerza del equipo
//   6) clima
//
// El orden es obligatorio porque arsenal y pitcheo pueden depender de los
// IDs de abridores y de los lineups resueltos previamente.
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
// "bloques" puede recibir resultados ya calculados:
//
// {
//   roster,
//   lineup,
//   pitcheo,
//   arsenal,
//   fuerza_equipo,
//   clima
// }
//
// O funciones async:
//
// {
//   resolverRoster,
//   resolverLineup,
//   resolverArsenal,
//   resolverPitcheo,
//   resolverFuerzaEquipo,
//   resolverClima
// }
//
// Cada resolver recibe:
//   (juegoNormalizado, bloquesTrabajo)
//
// bloquesTrabajo incluye los bloques ya resueltos anteriormente. Por
// ejemplo, resolverArsenal y resolverPitcheo reciben:
//
// {
//   roster: resultadoRosterAdaptado,
//   lineup: resultadoLineupAdaptado,
//   arsenal: resultadoArsenal,
//   ...
// }
//
// RESOLUCIÓN AUTOMÁTICA:
// Si no se entrega roster ni resolverRoster, usa global.jalarRoster().
// Si no se entrega lineup ni resolverLineup, usa global.jalarLineup().
//
// Si no se entrega fuerza_equipo ni resolverFuerzaEquipo, usa
// global.calcularFuerzaEquipo(homeTeam, awayTeam, fechaCorteISO) — en ese
// orden exacto de prioridad:
//   1) bloques.fuerza_equipo (si llega, se usa tal cual)
//   2) bloques.resolverFuerzaEquipo(juego, bloquesTrabajo) (si es función)
//   3) global.calcularFuerzaEquipo(juego.home.name, juego.away.name,
//      global.MLBPRO_CORE.hoyISO())
//        — HOME primero, AWAY después, exactamente como exige el
//          contrato de fuerza-equipo.js.
//        — fechaCorteISO se obtiene SIEMPRE de global.MLBPRO_CORE.hoyISO(),
//          nunca se recalcula "hoy" en este archivo. Esto excluye el
//          juego de hoy y cualquier juego posterior, igual que exige
//          fuerza-equipo.js internamente.
// Si falta global.calcularFuerzaEquipo, global.MLBPRO_CORE, o
// MLBPRO_CORE.hoyISO, fuerza_equipo queda como bloque NO_CONFIRMADO
// (confirmado:false, estado:"DEPENDENCIA_FALTANTE") — nunca como 1.0 ni
// ningún valor neutral inventado.
//
// ADAPTADORES:
// jalar-roster.js y jalar-lineup.js mantienen intacto su contrato original.
// Este integrador agrega confirmado/estado únicamente al objeto integrado.
// fuerza_equipo NO se adapta ni se reescribe: el objeto que devuelve
// calcularFuerzaEquipo() (o el resolver externo) se conserva completo,
// incluidos los perfiles home y away y ventana_reciente: "ULTIMOS_10".
//
// ROSTER CONFIRMADO:
// Requiere ambos abridores reales:
//   pitcher_away_id y pitcher_home_id.
//
// LINEUP DISPONIBLE:
// Requiere 9 bateadores reales por lado:
//   lineup_disponible_away && lineup_disponible_home.
//
// Si ambos lineups son oficiales de hoy:
//   estado = LINEUPS_CONFIRMADOS_HOY.
//
// Si uno o ambos vienen del último juego Final:
//   estado = LINEUPS_REALES_FALLBACK.
//
// DEPENDENCIAS GLOBALES:
// - jalarRoster(gamePk)
// - jalarLineup(gamePk, awayTeamId, homeTeamId)
// - calcularFuerzaEquipo(homeTeam, awayTeam, fechaCorteISO)  [fuerza-equipo.js]
// - MLBPRO_CORE.hoyISO()                                    [mlbpro-core.js]
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
//   senal_unanimidad,
//   confirmado_unanimidad,
//   detalle_unanimidad,
//   clima,
//   coincidencia,
//   linea_pregame,
//   cobertura,
//   confirmado,
//   estado,
//   notas
// }
//
// senal_unanimidad, confirmado_unanimidad y detalle_unanimidad se toman
// DIRECTAMENTE de fuerzaEquipo.senal_unanimidad,
// fuerzaEquipo.confirmado_unanimidad y fuerzaEquipo.detalle_unanimidad —
// no se recalculan aquí. Si fuerza_equipo no está disponible o no trae
// esos campos, quedan en null / false / null respectivamente (nunca en
// un valor neutral inventado).
//
// REGLA:
// Cada bloque faltante queda en null o NO_CONFIRMADO. El objeto general se
// devuelve aunque falten piezas, para mostrar cobertura real sin fabricar
// una predicción.
//
// CORREGIDO 17 jul 2026:
// - resolverFuerzaEquipo usa PascalCase correcto.
// - bloqueEstado prioriza confirmado:true/false.
// - roster y lineup reciben adaptadores de confirmación.
// - roster, lineup, arsenal y pitcheo ya no se ejecutan simultáneamente.
// - los resolvers dependientes reciben los resultados anteriores.
//
// CORREGIDO 17 jul 2026 (auditoría de consistencia cobertura/notas):
// - arsenal, pitcheo y fuerza_equipo usaban DOS criterios distintos de
//   confirmación: cobertura/bloqueEstado() consideraba confirmado por
//   defecto cualquier objeto sin campo .confirmado ni .estado, mientras
//   que notas exigía explícitamente bloque.confirmado === true. Un
//   resolver externo que devolviera datos reales sin marcar .confirmado
//   a mano quedaba contado como confirmado en cobertura pero igual
//   generaba su nota de NO_CONFIRMADO, bloqueando permanentemente
//   confirmado:true en la salida general aunque cobertura mostrara
//   100%. Ahora notas usa el mismo bloqueEstado() que cobertura para
//   arsenal, pitcheo y fuerza_equipo: un único criterio de verdad, sin
//   exigir un campo .confirmado que este archivo nunca declaró como
//   obligatorio para esos tres bloques.
// - obtenerCoincidencia() exigía copia.estado === null Y copia.top no
//   nulo/undefined para marcar confirmado. El contrato cerrado de
//   calcularCoincidencia() dice únicamente "si estado === null, la
//   Coincidencia es válida" — sin exigir top. Se quita la condición
//   extra sobre top; confirmado depende solo de estado === null, tal
//   como el contrato original establece.
//
// CORREGIDO 19 jul 2026 (integración automática de Fuerza de Equipo):
// - fuerza_equipo ya NO depende únicamente de que bloques entregue
//   fuerza_equipo o resolverFuerzaEquipo a mano. Se agregó
//   resolverFuerzaEquipoAutomatico(), que respeta ese mismo orden y,
//   si ninguno de los dos llega, llama directamente a
//   global.calcularFuerzaEquipo(juego.home.name, juego.away.name,
//   global.MLBPRO_CORE.hoyISO()) — HOME primero, AWAY después.
// - Si global.calcularFuerzaEquipo, global.MLBPRO_CORE o
//   MLBPRO_CORE.hoyISO no existen, fuerza_equipo queda como bloque
//   NO_CONFIRMADO explícito (confirmado:false,
//   estado:"DEPENDENCIA_FALTANTE"), nunca como 1.0 ni ningún valor
//   neutral.
// - La salida principal ahora expone senal_unanimidad,
//   confirmado_unanimidad y detalle_unanimidad, tomados directamente
//   del bloque fuerza_equipo ya resuelto. fuerza_equipo se conserva
//   completo (perfiles home/away, ventana_reciente: "ULTIMOS_10",
//   etc.) sin adaptarlo ni recortarlo.
// - No se tocó roster, lineup, arsenal, pitcheo, clima, Coincidencia,
//   línea de mercado, ni el bug pendiente de empates (no corregido en
//   fuerza-equipo.js, y por lo tanto tampoco aquí).
//
// ESTADO:
// PENDIENTE DE PRUEBA DE INTEGRACIÓN.

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

  function copiarObjeto(valor) {
    if (!valor || typeof valor !== "object") {
      return valor;
    }

    var copia = {};
    var claves = Object.keys(valor);

    for (var i = 0; i < claves.length; i++) {
      copia[claves[i]] = valor[claves[i]];
    }

    return copia;
  }

  function aCamelCasePascal(nombre) {
    return String(nombre || "")
      .split("_")
      .filter(function (parte) {
        return parte.length > 0;
      })
      .map(function (parte) {
        return parte.charAt(0).toUpperCase() + parte.slice(1);
      })
      .join("");
  }

  function valorConfirmado(valor) {
    return (
      valor !== null &&
      valor !== undefined &&
      valor !== "" &&
      valor !== "NO_CONFIRMADO"
    );
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

    if (valor.confirmado === true) {
      return {
        disponible: true,
        confirmado: true,
        estado: valor.estado || "OK"
      };
    }

    if (valor.confirmado === false) {
      return {
        disponible: true,
        confirmado: false,
        estado:
          valor.estado ||
          valor.nota ||
          "NO_CONFIRMADO"
      };
    }

    if (valor.estado !== undefined && valor.estado !== null) {
      return {
        disponible: true,
        confirmado: valor.estado === "OK",
        estado: String(valor.estado)
      };
    }

    return {
      disponible: true,
      confirmado: true,
      estado: "OK"
    };
  }

  function crearErrorBloque(nombre, error) {
    return {
      confirmado: false,
      estado: "ERROR_" + String(nombre).toUpperCase(),
      nota:
        error && error.message
          ? error.message
          : String(error)
    };
  }

  function adaptarRoster(roster) {
    if (!roster || typeof roster !== "object") {
      return null;
    }

    var copia = copiarObjeto(roster);

    var pitcherAway = primerValor(
      copia.pitcher_away_id,
      copia.away_pitcher_id,
      copia.pitcherAwayId
    );

    var pitcherHome = primerValor(
      copia.pitcher_home_id,
      copia.home_pitcher_id,
      copia.pitcherHomeId
    );

    var confirmado =
      valorConfirmado(pitcherAway) &&
      valorConfirmado(pitcherHome);

    copia.confirmado = confirmado;
    copia.estado = confirmado
      ? "ABRIDORES_CONFIRMADOS"
      : "ABRIDORES_NO_CONFIRMADOS";

    return copia;
  }

  function contarLineup(valor) {
    if (!Array.isArray(valor)) {
      return 0;
    }

    var total = 0;

    for (var i = 0; i < valor.length; i++) {
      var bateador = valor[i];

      if (
        bateador !== null &&
        bateador !== undefined &&
        bateador !== "" &&
        bateador !== "NO_CONFIRMADO"
      ) {
        total++;
      }
    }

    return total;
  }

  function obtenerArrayLineup(lineup, lado) {
    var candidatos;

    if (lado === "away") {
      candidatos = [
        lineup.lineup_away,
        lineup.away_lineup,
        lineup.lineupAway,
        lineup.away
      ];
    } else {
      candidatos = [
        lineup.lineup_home,
        lineup.home_lineup,
        lineup.lineupHome,
        lineup.home
      ];
    }

    for (var i = 0; i < candidatos.length; i++) {
      if (Array.isArray(candidatos[i])) {
        return candidatos[i];
      }
    }

    return [];
  }

  function fuenteLineupHoy(lineup, lado) {
    var fuente;

    if (lado === "away") {
      fuente = primerValor(
        lineup.fuente_away,
        lineup.source_away,
        lineup.away_source,
        lineup.lineup_source_away
      );
    } else {
      fuente = primerValor(
        lineup.fuente_home,
        lineup.source_home,
        lineup.home_source,
        lineup.lineup_source_home
      );
    }

    if (!textoValido(fuente)) {
      return false;
    }

    var texto = fuente.toUpperCase();

    return (
      texto.indexOf("HOY") !== -1 ||
      texto.indexOf("TODAY") !== -1 ||
      texto.indexOf("OFICIAL") !== -1 ||
      texto.indexOf("CONFIRM") !== -1
    );
  }

  function adaptarLineup(lineup) {
    if (!lineup || typeof lineup !== "object") {
      return null;
    }

    var copia = copiarObjeto(lineup);

    var awayArray = obtenerArrayLineup(copia, "away");
    var homeArray = obtenerArrayLineup(copia, "home");

    var awayDisponible =
      copia.lineup_disponible_away === true ||
      contarLineup(awayArray) >= 9;

    var homeDisponible =
      copia.lineup_disponible_home === true ||
      contarLineup(homeArray) >= 9;

    var disponible =
      awayDisponible &&
      homeDisponible;

    var oficialAway =
      copia.lineup_confirmado_away === true ||
      copia.confirmado_away === true ||
      fuenteLineupHoy(copia, "away");

    var oficialHome =
      copia.lineup_confirmado_home === true ||
      copia.confirmado_home === true ||
      fuenteLineupHoy(copia, "home");

    copia.lineup_disponible_away = awayDisponible;
    copia.lineup_disponible_home = homeDisponible;
    copia.confirmado = disponible;

    if (!disponible) {
      copia.estado = "LINEUPS_NO_CONFIRMADOS";
    } else if (oficialAway && oficialHome) {
      copia.estado = "LINEUPS_CONFIRMADOS_HOY";
    } else {
      copia.estado = "LINEUPS_REALES_FALLBACK";
    }

    return copia;
  }

  async function resolverBloque(nombre, juego, bloquesTrabajo) {
    var valorDirecto = bloquesTrabajo[nombre];

    if (valorDirecto !== undefined) {
      return valorDirecto;
    }

    var nombreResolver =
      "resolver" +
      aCamelCasePascal(nombre);

    var resolver = bloquesTrabajo[nombreResolver];

    if (typeof resolver !== "function") {
      return null;
    }

    try {
      return await resolver(juego, bloquesTrabajo);
    } catch (error) {
      return crearErrorBloque(nombre, error);
    }
  }

  async function resolverRosterAutomatico(juego, bloquesTrabajo) {
    if (bloquesTrabajo.roster !== undefined) {
      return adaptarRoster(bloquesTrabajo.roster);
    }

    if (typeof bloquesTrabajo.resolverRoster === "function") {
      try {
        return adaptarRoster(
          await bloquesTrabajo.resolverRoster(
            juego,
            bloquesTrabajo
          )
        );
      } catch (error) {
        return crearErrorBloque("roster", error);
      }
    }

    if (
      juego.game_id !== null &&
      typeof global.jalarRoster === "function"
    ) {
      try {
        return adaptarRoster(
          await global.jalarRoster(juego.game_id)
        );
      } catch (error) {
        return crearErrorBloque("roster", error);
      }
    }

    return null;
  }

  async function resolverLineupAutomatico(juego, bloquesTrabajo) {
    if (bloquesTrabajo.lineup !== undefined) {
      return adaptarLineup(bloquesTrabajo.lineup);
    }

    if (typeof bloquesTrabajo.resolverLineup === "function") {
      try {
        return adaptarLineup(
          await bloquesTrabajo.resolverLineup(
            juego,
            bloquesTrabajo
          )
        );
      } catch (error) {
        return crearErrorBloque("lineup", error);
      }
    }

    if (
      juego.game_id !== null &&
      juego.away.id !== null &&
      juego.home.id !== null &&
      typeof global.jalarLineup === "function"
    ) {
      try {
        return adaptarLineup(
          await global.jalarLineup(
            juego.game_id,
            juego.away.id,
            juego.home.id
          )
        );
      } catch (error) {
        return crearErrorBloque("lineup", error);
      }
    }

    return null;
  }

  // Fuerza de Equipo: resolución automática con el mismo patrón de
  // prioridad que roster/lineup:
  //   1) bloques.fuerza_equipo (valor directo, se conserva completo)
  //   2) bloques.resolverFuerzaEquipo(juego, bloquesTrabajo)
  //   3) global.calcularFuerzaEquipo(juego.home.name, juego.away.name,
  //      global.MLBPRO_CORE.hoyISO())  — HOME primero, AWAY después.
  //
  // fuerza-equipo.js NO se modifica ni se toca aquí; este resolver solo
  // lo invoca con los argumentos correctos. Si faltan las dependencias
  // globales necesarias (calcularFuerzaEquipo, MLBPRO_CORE, hoyISO) o
  // los nombres de los equipos, se devuelve un bloque NO_CONFIRMADO
  // explícito — nunca 1.0 ni ningún valor neutral inventado.
  async function resolverFuerzaEquipoAutomatico(juego, bloquesTrabajo) {
    if (bloquesTrabajo.fuerza_equipo !== undefined) {
      return bloquesTrabajo.fuerza_equipo;
    }

    if (typeof bloquesTrabajo.resolverFuerzaEquipo === "function") {
      try {
        return await bloquesTrabajo.resolverFuerzaEquipo(
          juego,
          bloquesTrabajo
        );
      } catch (error) {
        return crearErrorBloque("fuerza_equipo", error);
      }
    }

    var dependenciasListas =
      typeof global.calcularFuerzaEquipo === "function" &&
      !!global.MLBPRO_CORE &&
      typeof global.MLBPRO_CORE.hoyISO === "function";

    if (!dependenciasListas) {
      return {
        confirmado: false,
        estado: "DEPENDENCIA_FALTANTE",
        nota:
          "global.calcularFuerzaEquipo, global.MLBPRO_CORE o " +
          "MLBPRO_CORE.hoyISO no están disponibles."
      };
    }

    if (!textoValido(juego.home.name) || !textoValido(juego.away.name)) {
      return {
        confirmado: false,
        estado: "EQUIPOS_NO_CONFIRMADOS",
        nota:
          "Falta el nombre de home o away para calcular Fuerza de Equipo."
      };
    }

    try {
      var fechaCorte = global.MLBPRO_CORE.hoyISO();

      return await global.calcularFuerzaEquipo(
        juego.home.name,
        juego.away.name,
        fechaCorte
      );
    } catch (error) {
      return crearErrorBloque("fuerza_equipo", error);
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
          nota:
            error && error.message
              ? error.message
              : String(error)
        };
      }
    }

    return null;
  }

  // CORREGIDO (fix bug #2): confirmado depende ÚNICAMENTE de
  // copia.estado === null, tal como establece el contrato cerrado de
  // calcularCoincidencia ("si estado === null, la Coincidencia es
  // válida"). Ya no se exige además que copia.top exista.
  function obtenerCoincidencia(clima) {
    if (!clima || typeof clima !== "object") {
      return null;
    }

    if (typeof global.calcularCoincidencia !== "function") {
      return {
        top: null,
        ranked: [],
        confirmado: false,
        estado: "DEPENDENCIA_FALTANTE",
        nota: "calcularCoincidencia no disponible"
      };
    }

    try {
      var resultado = global.calcularCoincidencia({
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

      if (!resultado || typeof resultado !== "object") {
        return null;
      }

      var copia = copiarObjeto(resultado);

      copia.confirmado = copia.estado === null;

      return copia;
    } catch (error) {
      return {
        top: null,
        ranked: [],
        confirmado: false,
        estado: "ERROR_COINCIDENCIA",
        nota:
          error && error.message
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
        nota:
          error && error.message
            ? error.message
            : String(error)
      };
    }
  }

  function validarLineaPregame(linea) {
    if (!linea || typeof linea !== "object") {
      return null;
    }

    if (linea.estado === "ERROR_LINEA_PREGAME") {
      return linea;
    }

    var mlHomeValida =
      numeroFinito(linea.moneyline_home);

    var mlAwayValida =
      numeroFinito(linea.moneyline_away);

    var moneylineCompleta =
      mlHomeValida &&
      mlAwayValida;

    var tipoPregame =
      linea.tipo_linea === "PREGAME";

    return {
      event_id: primerValor(
        linea.event_id,
        null
      ),

      commence_time: primerValor(
        linea.commence_time,
        null
      ),

      home: primerValor(
        linea.home,
        null
      ),

      away: primerValor(
        linea.away,
        null
      ),

      venue: primerValor(
        linea.venue,
        null
      ),

      total: numeroFinito(linea.total)
        ? linea.total
        : null,

      total_bookie: primerValor(
        linea.bookie,
        linea.total_bookie,
        null
      ),

      moneyline_home: moneylineCompleta
        ? linea.moneyline_home
        : null,

      moneyline_away: moneylineCompleta
        ? linea.moneyline_away
        : null,

      moneyline_bookie: moneylineCompleta
        ? primerValor(
            linea.moneyline_bookie,
            null
          )
        : null,

      tipo_linea: tipoPregame
        ? "PREGAME"
        : null,

      confirmado:
        tipoPregame &&
        moneylineCompleta,

      estado:
        !tipoPregame
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
      var estado = bloqueEstado(
        bloquesSalida[nombre]
      );

      detalle[nombre] = estado;

      if (estado.confirmado) {
        confirmados++;
      }
    }

    var total = nombres.length;

    return {
      confirmados: confirmados,
      total: total,

      porcentaje:
        total > 0
          ? Math.round(
              (confirmados / total) * 100
            )
          : 0,

      detalle: detalle
    };
  }

  // Extrae senal_unanimidad, confirmado_unanimidad y detalle_unanimidad
  // DIRECTAMENTE del bloque fuerza_equipo ya resuelto — no se recalculan
  // aquí. Si fuerza_equipo no es un objeto (null, NO_CONFIRMADO sin esos
  // campos, bloque de error) los tres quedan en null / false / null.
  function extraerUnanimidad(fuerzaEquipo) {
    if (!fuerzaEquipo || typeof fuerzaEquipo !== "object") {
      return {
        senal_unanimidad: null,
        confirmado_unanimidad: false,
        detalle_unanimidad: null
      };
    }

    return {
      senal_unanimidad:
        fuerzaEquipo.senal_unanimidad !== undefined
          ? fuerzaEquipo.senal_unanimidad
          : null,

      confirmado_unanimidad:
        fuerzaEquipo.confirmado_unanimidad === true,

      detalle_unanimidad:
        fuerzaEquipo.detalle_unanimidad !== undefined
          ? fuerzaEquipo.detalle_unanimidad
          : null
    };
  }

  async function moneylineData(
    juegoEntrada,
    bloquesEntrada
  ) {
    var bloques =
      bloquesEntrada &&
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
        senal_unanimidad: null,
        confirmado_unanimidad: false,
        detalle_unanimidad: null,
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
        notas: [
          "Falta el objeto del juego"
        ]
      };
    }

    var trabajo = {};

    var clavesEntrada = Object.keys(bloques);

    for (var i = 0; i < clavesEntrada.length; i++) {
      trabajo[clavesEntrada[i]] =
        bloques[clavesEntrada[i]];
    }

    var roster = await resolverRosterAutomatico(
      juego,
      trabajo
    );

    trabajo.roster = roster;

    var lineup = await resolverLineupAutomatico(
      juego,
      trabajo
    );

    trabajo.lineup = lineup;

    var arsenal = await resolverBloque(
      "arsenal",
      juego,
      trabajo
    );

    trabajo.arsenal = arsenal;
    trabajo.arsenal_vs_lineup = arsenal;

    var pitcheo = await resolverBloque(
      "pitcheo",
      juego,
      trabajo
    );

    trabajo.pitcheo = pitcheo;

    var fuerzaEquipo = await resolverFuerzaEquipoAutomatico(
      juego,
      trabajo
    );

    trabajo.fuerza_equipo = fuerzaEquipo;

    var unanimidad = extraerUnanimidad(fuerzaEquipo);

    var climaResuelto = await resolverBloque(
      "clima",
      juego,
      trabajo
    );

    var clima = obtenerClimaHoy(
      juego,
      climaResuelto
    );

    trabajo.clima = clima;

    var coincidencia =
      obtenerCoincidencia(clima);

    var lineaPregame =
      validarLineaPregame(
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

    var cobertura =
      construirCobertura(bloquesSalida);

    var notas = [];

    if (!juego.game_id) {
      notas.push(
        "GAME_ID_NO_CONFIRMADO"
      );
    }

    if (
      !juego.away.name ||
      !juego.home.name
    ) {
      notas.push(
        "EQUIPOS_NO_CONFIRMADOS"
      );
    }

    if (!juego.venue) {
      notas.push(
        "VENUE_NO_CONFIRMADO"
      );
    }

    if (
      !roster ||
      roster.confirmado !== true
    ) {
      notas.push(
        "ROSTER_NO_CONFIRMADO"
      );
    }

    if (
      !lineup ||
      lineup.confirmado !== true
    ) {
      notas.push(
        "LINEUP_NO_CONFIRMADO"
      );
    }

    // CORREGIDO (fix bug #1): arsenal, pitcheo y fuerza_equipo ahora usan
    // el mismo bloqueEstado() que ya se aplicó en cobertura, en vez de
    // exigir por separado bloque.confirmado === true. Antes, un resolver
    // externo que devolviera un objeto de datos válido sin campo
    // .confirmado explícito quedaba contado como confirmado en cobertura
    // pero igual generaba su nota de NO_CONFIRMADO — dos criterios de
    // verdad distintos para el mismo bloque. Ahora hay un único criterio.
    if (!bloqueEstado(arsenal).confirmado) {
      notas.push(
        "ARSENAL_NO_CONFIRMADO"
      );
    }

    if (!bloqueEstado(pitcheo).confirmado) {
      notas.push(
        "PITCHEO_NO_CONFIRMADO"
      );
    }

    if (!bloqueEstado(fuerzaEquipo).confirmado) {
      notas.push(
        "FUERZA_EQUIPO_NO_CONFIRMADA"
      );
    }

    if (!clima) {
      notas.push(
        "CLIMA_NO_CONFIRMADO"
      );
    }

    if (
      !lineaPregame ||
      lineaPregame.confirmado !== true
    ) {
      notas.push(
        "MONEYLINE_NO_CONFIRMADA"
      );
    }

    if (
      !coincidencia ||
      coincidencia.confirmado !== true
    ) {
      notas.push(
        "COINCIDENCIA_NO_CONFIRMADA"
      );
    }

    var confirmado =
      cobertura.confirmados ===
        cobertura.total &&
      notas.length === 0;

    return {
      juego: juego,

      roster: roster,
      lineup: lineup,
      pitcheo: pitcheo,
      arsenal_vs_lineup: arsenal,
      fuerza_equipo: fuerzaEquipo,

      senal_unanimidad: unanimidad.senal_unanimidad,
      confirmado_unanimidad: unanimidad.confirmado_unanimidad,
      detalle_unanimidad: unanimidad.detalle_unanimidad,

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

  global.moneylineData =
    moneylineData;

  global.MONEYLINE_DATA = {
    moneylineData: moneylineData,
    normalizarJuego: normalizarJuego,
    validarLineaPregame:
      validarLineaPregame,
    adaptarRoster: adaptarRoster,
    adaptarLineup: adaptarLineup,
    bloqueEstado: bloqueEstado
  };

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = {
      moneylineData: moneylineData,
      normalizarJuego: normalizarJuego,
      validarLineaPregame:
        validarLineaPregame,
      adaptarRoster: adaptarRoster,
      adaptarLineup: adaptarLineup,
      bloqueEstado: bloqueEstado
    };
  }
})(
  typeof window !== "undefined"
    ? window
    : globalThis
);
