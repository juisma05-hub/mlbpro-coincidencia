/*
  MLBPro · factor-pitcheo-completo.js

  FUNCIÓN:
  Combina abridor confirmado + bullpen disponible de un equipo en un factor
  de carreraje único para Moneyline (carreras de TODO el juego, no solo lo
  que tire el abridor).

  ENTRADAS:
  teamId, pitcherAbridorId, lineupRival, fechaHoyISO.

  SALIDAS / MODIFICACIONES:
  Objeto:
    { team_id, abridor_id, factor_abridor, factor_bullpen, factor_final,
      bullpen_disponible[], bullpen_no_disponible_hoy[],
      cobertura,            // "COMPLETO" (reservado, no alcanzable hoy) |
                             // "ABRIDOR_Y_BULLPEN_PARCIAL" |
                             // "PARCIAL_ABRIDOR" | "PARCIAL_BULLPEN" |
                             // "SIN_DATOS"
      cobertura_bullpen,     // "PARCIAL_SOLO_ULTIMO_JUEGO" | "SIN_DATOS"
      exclusion_metodo,      // documenta que la exclusión de relevistas es
                             // una deducción no validada por backtest
      confirmado, nota }
  No escribe cache ni localStorage.

  DEPENDENCIAS:
  calcularFactorArsenalLineup() (factor-arsenal-lineup.js — no auditado en
  esta cadena todavía, se asume ya validado por trabajo previo).
  jalarBullpenAyer(), pitchersNoDisponiblesHoy() (jalar-bullpen.js).

  NO TOCA:
  jalar-bullpen.js, jalar-roster.js, jalar-lineup.js, clima, coincidencia,
  K6, históricos. No modifica ninguna tabla madre.

  UTC / HORA LOCAL:
  No maneja fechas/horas directamente; delega fechaHoyISO al llamador.

  QUÉ HACE:
  - Calcula factor_abridor vía calcularFactorArsenalLineup(abridor, lineupRival).
  - Calcula factor_bullpen como promedio de los relevistas disponibles
    encontrados en el ÚLTIMO juego Final del equipo, excluyendo a quienes
    lanzaron 3+ outs ayer (deducción, no confirmación de MLB).
  - Combina abridor (60%) + bullpen (40%) solo cuando ambos existen.
  - Si falta una pieza, usa solo la disponible y lo marca como parcial.
  - Si no hay ninguna pieza, devuelve null/NO_CONFIRMADO — nunca un valor
    neutro disfrazado de resultado real.

  QUÉ NO HACE:
  - NO representa el bullpen completo del equipo (todos los relevistas
    activos). Solo ve a quienes aparecieron en el ÚLTIMO juego Final,
    porque jalar-bullpen.js no trae más que eso. Esta es una limitación de
    la fuente, no de este archivo, y queda marcada en cobertura_bullpen.
  - NO trata "3+ outs ayer = no disponible" como verdad confirmada por MLB:
    es una deducción sin validar por backtest, y queda marcada en
    exclusion_metodo.
  - NO inventa factor_bullpen cuando no hay relevistas válidos: queda null.
  - NO devuelve 1.0 como valor por defecto cuando faltan datos: queda null
    y confirmado=false.
  - NO llama a calcularFactorArsenalLineup con el abridor incluido en el
    grupo de bullpen (excluido explícitamente por id).

  QUÉ AFECTA:
  El factor de pitcheo consumido por moneyline-data.js.

  QUÉ NO AFECTA:
  F5, K6, Over/Under, otros motores.

  CORRECCIÓN ACTUAL (esta auditoría):
  1. factor_final ya NO devuelve 1.0 cuando no hay datos — devuelve null.
  2. Se agrega el campo cobertura (COMPLETO/PARCIAL_ABRIDOR/PARCIAL_BULLPEN/
     SIN_DATOS) separado de confirmado, para no mezclar "pitcheo completo"
     con un resultado parcial bajo la misma bandera.
  3. Se agrega cobertura_bullpen para documentar que el bullpen mostrado es
     solo el derivado del último juego Final, NO el bullpen completo real.
  4. Se agrega exclusion_metodo para documentar que la regla de 3+ outs es
     una deducción no validada, no un hecho confirmado por MLB.
  5. factor_bullpen sigue siendo un promedio simple de los relevistas
     válidos encontrados — no se reemplaza por una métrica de fuerza real
     ponderada porque esa métrica no existe todavía en ningún archivo
     auditado. Se deja documentado como limitación, no resuelto en silencio.
  6. Se agrega module.exports condicional al entorno.
  7. Prólogo reescrito al formato estándar completo.

  CORRECCIÓN ADICIONAL (segunda vuelta):
  8. confirmado ahora es true ÚNICAMENTE cuando cobertura === "COMPLETO".
     Antes quedaba true también en PARCIAL_ABRIDOR/PARCIAL_BULLPEN, lo cual
     para Moneyline mezclaba "pitcheo completo real" con un resultado
     parcial bajo la misma bandera de confirmación.
  9. Blindaje: calcularFactorArsenalLineup() puede no existir en el entorno
     (typeof !== "function"), o devolver null/undefined en vez de un
     objeto — ambos casos ahora se tratan como NO_CONFIRMADO para ese
     componente, en vez de lanzar una excepción no controlada.
  10. Blindaje: bullpenAyer.pitchers_usados_ayer puede no ser un arreglo
      (dato faltante o malformado) — se valida con Array.isArray() antes de
      iterar; si no es arreglo, el bullpen completo de esa llamada queda
      SIN_DATOS en vez de romper la ejecución.

  CORRECCIÓN ADICIONAL (tercera vuelta):
  11. Normalización de IDs: player_id (numérico en los datos reales de MLB
      StatsApi) y pitcherAbridorId (puede llegar como texto) ahora se
      comparan siempre como String(...). Antes, una comparación estricta
      entre tipos distintos podía fallar en detectar que el abridor estaba
      dentro de la lista de relevistas del bullpen, y contarlo dos veces.
  12. Blindaje de pitchersNoDisponiblesHoy(): si la función no existe en el
      entorno, o lanza una excepción, o no devuelve un arreglo, se trata
      como "sin exclusiones detectadas" (arreglo vacío) en vez de romper
      la ejecución completa de calcularFactorPitcheoCompleto().
  13. Cada factor (del abridor y de cada relevista) se valida con
      Number.isFinite() antes de sumarse. Un factor no numérico o NaN ya
      no contamina factor_bullpen ni factor_final; ese componente
      individual se descarta como NO_CONFIRMADO.
  14. El HTML de prueba ahora carga en el modo real, en orden: mlb-routes.js
      -> jalar-bullpen.js -> factor-arsenal-lineup.js ->
      factor-pitcheo-completo.js, para que el modo real deje de depender
      únicamente de los mocks.

  CORRECCIÓN ADICIONAL (cuarta vuelta):
  15. Se renombra la cobertura que antes decía "COMPLETO" cuando había
      abridor + bullpen a "ABRIDOR_Y_BULLPEN_PARCIAL". El bullpen mostrado
      SIEMPRE es parcial (solo el último juego Final, ver punto 3), así
      que llamarlo "COMPLETO" era engañoso incluso cuando ambas piezas
      existían. "COMPLETO" queda RESERVADO para cuando exista una fuente
      real de bullpen completo (no implementada todavía) — hoy nunca se
      alcanza ese estado.
  16. Como consecuencia directa del punto 15: confirmado=true SOLO ocurre
      si cobertura==="COMPLETO", y como ese estado no es alcanzable hoy,
      confirmado será SIEMPRE false con las fuentes actuales. Esto es
      intencional, no un bug: refleja que Moneyline no debe tratar ningún
      resultado de este módulo como "pitcheo completo confirmado" mientras
      no exista una fuente real de bullpen completo.
  17. Blindaje adicional: calcularFactorArsenalLineup() ahora se llama
      dentro de try/catch tanto para el abridor como para cada relevista.
      Antes, si esa función lanzaba una excepción (no solo si estaba
      ausente o devolvía null), la excepción se propagaba sin control y
      rompía calcularFactorPitcheoCompleto() por completo.

  PENDIENTE, NO RESUELTO EN ESTA CORRECCIÓN:
  - No existe todavía una fuente de "bullpen completo real" (roster de
    relevistas activos con su fuerza real, más allá de quién lanzó en el
    último juego). Resolver esto requiere auditar o construir un archivo
    nuevo — no se inventa aquí.
  - factor-arsenal-lineup.js (calcularFactorArsenalLineup) no ha sido
    auditado en esta cadena; este archivo asume que ya es válido.

  FECHA:
  15 jul 2026.

  ESTADO:
  Corregido según los puntos de rechazo. confirmado será siempre false con
  las fuentes de bullpen actuales (ver punto 16) — esto es intencional.
  Pendiente de prueba real y aprobación final — no autoaprobado.
*/

async function calcularFactorPitcheoCompleto(teamId, pitcherAbridorId, lineupRival, fechaHoyISO) {
  const salida = {
    team_id: teamId,
    abridor_id: pitcherAbridorId,
    factor_abridor: null,
    factor_bullpen: null,
    factor_final: null,
    bullpen_disponible: [],
    bullpen_no_disponible_hoy: [],
    cobertura: "SIN_DATOS",
    cobertura_bullpen: "SIN_DATOS",
    exclusion_metodo: "DEDUCCION_3_OUTS_NO_VALIDADO_POR_BACKTEST",
    confirmado: false,
    nota: ""
  };

  // 1. ABRIDOR
  // Blindaje: calcularFactorArsenalLineup puede no existir en el entorno,
  // devolver null/undefined, o LANZAR UNA EXCEPCION. Los tres casos se
  // tratan igual: ese componente queda NO_CONFIRMADO, sin romper la
  // ejecucion de calcularFactorPitcheoCompleto().
  let resAbridor = null;
  if (typeof calcularFactorArsenalLineup === "function") {
    try {
      resAbridor = calcularFactorArsenalLineup(pitcherAbridorId, lineupRival);
    } catch (errAbridor) {
      resAbridor = null;
    }
  }
  salida.factor_abridor =
    (resAbridor && resAbridor.confirmado && Number.isFinite(resAbridor.factor))
      ? resAbridor.factor
      : null;

  // 2. BULLPEN: traer el ultimo juego de este equipo para tener el roster de pitchers usados.
  // LIMITACIÓN CONOCIDA: esto NO es el bullpen completo del equipo, es solo
  // quienes aparecieron en el ÚLTIMO juego Final. Ver cobertura_bullpen.
  let bullpenAyer;
  try {
    bullpenAyer = await jalarBullpenAyer(teamId, fechaHoyISO);
  } catch (err) {
    salida.nota = "ERR_BULLPEN:" + (err && err.message ? err.message : err);
    bullpenAyer = null;
  }

  const bullpenListaValida =
    !!bullpenAyer &&
    !bullpenAyer.error &&
    Array.isArray(bullpenAyer.pitchers_usados_ayer);

  if (!bullpenListaValida) {
    if (bullpenAyer && !bullpenAyer.error) {
      salida.nota += " SIN_BULLPEN_CONFIRMADO (pitchers_usados_ayer no es un arreglo valido)";
    } else {
      salida.nota += " SIN_BULLPEN_CONFIRMADO";
    }
    salida.cobertura_bullpen = "SIN_DATOS";
  } else {
    salida.cobertura_bullpen = "PARCIAL_SOLO_ULTIMO_JUEGO";

    // Blindaje: pitchersNoDisponiblesHoy puede no existir, lanzar excepcion,
    // o no devolver un arreglo. En cualquiera de esos casos se trata como
    // "sin exclusiones detectadas" (arreglo vacio), nunca rompe la funcion.
    let noDisponibles = [];
    if (typeof pitchersNoDisponiblesHoy === "function") {
      try {
        const resExclusion = pitchersNoDisponiblesHoy(bullpenAyer);
        if (Array.isArray(resExclusion)) noDisponibles = resExclusion;
      } catch (errExclusion) {
        noDisponibles = [];
      }
    }

    // Normalizacion: player_id llega numerico desde MLB StatsApi;
    // pitcherAbridorId puede llegar como texto. Se comparan siempre como
    // String(...) para no dejar colar al abridor dentro del bullpen ni
    // fallar en detectar una exclusion por diferencia de tipo.
    const idsNoDisponibles = noDisponibles.map(function(p) { return String(p.player_id); });
    salida.bullpen_no_disponible_hoy = noDisponibles;

    const abridorIdStr = String(pitcherAbridorId);

    // candidatos disponibles: los que aparecieron en el roster reciente y NO
    // estan en la lista de quemados (deducción, no confirmación — ver
    // exclusion_metodo) y no son el abridor de hoy.
    const candidatosDisponibles = bullpenAyer.pitchers_usados_ayer.filter(function(p) {
      return idsNoDisponibles.indexOf(String(p.player_id)) === -1 && String(p.player_id) !== abridorIdStr;
    });

    let sumaFactorBullpen = 0;
    let nRelevistasValidos = 0;

    for (let i = 0; i < candidatosDisponibles.length; i++) {
      const relevista = candidatosDisponibles[i];
      let resRelevista = null;
      if (typeof calcularFactorArsenalLineup === "function") {
        try {
          resRelevista = calcularFactorArsenalLineup(relevista.player_id, lineupRival);
        } catch (errRelevista) {
          resRelevista = null;
        }
      }
      if (!resRelevista || !resRelevista.confirmado || !Number.isFinite(resRelevista.factor)) continue;
      sumaFactorBullpen += resRelevista.factor;
      nRelevistasValidos++;
      salida.bullpen_disponible.push({
        player_id: relevista.player_id,
        nombre: relevista.nombre,
        factor: resRelevista.factor
      });
    }

    // NOTA DE LIMITACIÓN: este promedio simple NO es una métrica de fuerza
    // real de bullpen (no pondera por rol, apariciones recientes, ni
    // calidad histórica del relevista). Es el promedio de arsenal-vs-lineup
    // de los relevistas detectados en el último juego. Ver prólogo, punto 5.
    if (nRelevistasValidos > 0) {
      salida.factor_bullpen = Math.round((sumaFactorBullpen / nRelevistasValidos) * 1000) / 1000;
    }
  }

  // 3. COMBINAR abridor + bullpen.
  // SUPUESTO documentado (no es dato real, es ventana fija): abridor pesa 60%, bullpen 40%.
  if (salida.factor_abridor !== null && salida.factor_bullpen !== null) {
    salida.factor_final = Math.round((salida.factor_abridor * 0.6 + salida.factor_bullpen * 0.4) * 1000) / 1000;
    // NO se llama "COMPLETO": el bullpen usado es siempre parcial (solo el
    // ultimo juego Final, ver cobertura_bullpen). "COMPLETO" queda
    // reservado para cuando exista una fuente real de bullpen completo.
    salida.cobertura = "ABRIDOR_Y_BULLPEN_PARCIAL";
    salida.nota = "OK_ABRIDOR_Y_BULLPEN_PARCIAL";
  } else if (salida.factor_abridor !== null) {
    salida.factor_final = salida.factor_abridor;
    salida.cobertura = "PARCIAL_ABRIDOR";
    salida.nota = "SOLO_ABRIDOR_CONFIRMADO";
  } else if (salida.factor_bullpen !== null) {
    salida.factor_final = salida.factor_bullpen;
    salida.cobertura = "PARCIAL_BULLPEN";
    salida.nota = "SOLO_BULLPEN_CONFIRMADO";
  } else {
    salida.factor_final = null;
    salida.cobertura = "SIN_DATOS";
    salida.nota = "SIN_DATOS_NO_CONFIRMADO";
  }

  // confirmado=true UNICAMENTE si cobertura==="COMPLETO". Ese estado no es
  // alcanzable hoy (no existe fuente de bullpen completo real), asi que
  // confirmado sera SIEMPRE false con las fuentes actuales. Intencional:
  // ver punto 16 del prologo.
  salida.confirmado = (salida.cobertura === "COMPLETO");

  return salida;
}

if (typeof module !== "undefined") {
  module.exports = { calcularFactorPitcheoCompleto: calcularFactorPitcheoCompleto };
}
