// jalar-condition.js
// PIEZA 2A - trae el campo REAL gameData.weather.condition de UN juego.
// ENDPOINT REAL: /api/v1.1/game/{gamePk}/feed/live
// (el endpoint /feed/game NO EXISTE en la API de MLB — daba HTTP 404 en todos los parques).
// El congelado de valores NO se resuelve aquí: se resuelve con snapshot antes del primer pitcheo.

async function jalarCondition(gamePk) {
  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1.1/game/" + gamePk + "/feed/live";
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) return "ERR:FEEDLIVE_HTTP_" + res.status;
    const data = await res.json();
    const cond = data?.gameData?.weather?.condition;
    if (typeof cond !== "string" || cond === "") return "ERR:NO_CONDITION";
    return cond;
  } catch (err) {
    return "ERR:" + err.message;
  }
}
