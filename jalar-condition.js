/*
  MLBPro · jalar-condition.js

  FUNCIÓN:
  Trae el campo real gameData.weather.condition de un juego puntual, para
  mostrarlo junto al clima de hoy. Solo lee y devuelve; no calcula nada.

  ENTRADAS:
  gamePk (Number/String) — id del juego MLB (StatsAPI gamePk).

  SALIDAS / MODIFICACIONES:
  Devuelve un string:
    - el valor real de gameData.weather.condition si existe,
    - "NO_CONFIRMADO" si MLB no lo ha publicado (ausencia real de dato,
      no un error),
    - "ERR:FEEDLIVE_HTTP_<code>" si la llamada HTTP falla,
    - "ERR:<mensaje>" si hay una excepción de red/parseo.
  No escribe cache ni localStorage. No modifica nada fuera de su propio
  valor de retorno.

  DEPENDENCIAS:
  MLB_ROUTES.WORKER_BASE (mlb-routes.js).
  Endpoint real: https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live

  NO TOCA:
  clima-cache.js, jalar-clima.js, score-match.js, calcular-coincidencia.js,
  jalar-linea.js (mercado), jalar-lineup.js, K6, F5. No escribe cache.

  UTC / HORA LOCAL DEL ESTADIO:
  No aplica. Este archivo no usa horarios ni timezone en ningún cálculo
  — solo lee un campo de texto (gameData.weather.condition) del feed en
  vivo de MLB, sin fecha ni hora involucrada en la lógica.

  QUÉ HACE: lee y devuelve la condición climática real reportada por MLB
  para un juego puntual, o NO_CONFIRMADO/ERR según corresponda.

  QUÉ NO HACE: no calcula nada, no combina con otros datos de clima, no
  decide qué mostrar — solo entrega el valor crudo o su ausencia.

  QUÉ AFECTA: el texto de "condición" que se muestra junto al clima de
  hoy en index.html (chip informativo).

  QUÉ NO AFECTA: la Data Madre, el histórico, Coincidencia, F5, K6,
  MoneyLine, lineups, mercado.

  CORRECCIÓN ACTUAL:
  El endpoint ya era el correcto (sin cambios). Se corrigió únicamente la
  etiqueta de ausencia de dato: antes devolvía "ERR:NO_CONDITION" (sonaba a
  error de código) para algo que en realidad es MLB sin publicar el dato
  todavía. Ahora devuelve "NO_CONFIRMADO", consistente con el resto del
  proyecto. Los errores reales (HTTP, red) siguen como "ERR:...".

  FECHA:
  12 jul 2026.

  ESTADO:
  CONFIRMADO.
*/

// jalar-condition.js
// PIEZA 2A - trae el campo REAL gameData.weather.condition de UN juego.
// ENDPOINT REAL: /api/v1.1/game/{gamePk}/feed/live
// (el endpoint /feed/game NO EXISTE en la API de MLB — daba HTTP 404 en todos los parques).
// El congelado de valores NO se resuelve aquí: se resuelve con snapshot antes del primer pitcheo.
//
// CORREGIDO: el endpoint ya era el correcto (confirmado, sin cambios). Lo que
// generaba "ERR:NO_CONDITION" en casi todos los juegos no era un bug de esta
// pieza: MLB simplemente no publica gameData.weather.condition para muchos
// juegos (sobre todo antes de que arranquen). Eso es una AUSENCIA REAL de
// dato, no un error de la llamada — antes se etiquetaba como si lo fuera.
// Ahora se devuelve "NO_CONFIRMADO", igual que el resto del proyecto marca
// un dato que no existe todavía. Nunca se inventa una condición. Los errores
// reales (HTTP fallido, excepción de red/parseo) siguen devolviendo "ERR:...".
async function jalarCondition(gamePk) {
  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1.1/game/" + gamePk + "/feed/live";
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) return "ERR:FEEDLIVE_HTTP_" + res.status;
    const data = await res.json();
    const cond = data?.gameData?.weather?.condition;
    if (typeof cond !== "string" || cond === "") return "NO_CONFIRMADO";
    return cond;
  } catch (err) {
    return "ERR:" + err.message;
  }
}
