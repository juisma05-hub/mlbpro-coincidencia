// jalar-pitch-hand.js
// PIEZA - trae la mano de lanzar de un pitcher (R/L/S) usando su player_id.
// Fuente: MLB Stats API /people/{id} -> pitchHand.code
// NO inventa: si el campo no viene, devuelve "NO_CONFIRMADO".

async function jalarPitchHand(playerId) {
  const salida = {
    player_id: playerId,
    mano: "NO_CONFIRMADO",
    error: null
  };

  if (!playerId) { salida.error = "ERR:SIN_PLAYER_ID"; return salida; }

  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1/people/" + playerId;
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) { salida.error = "ERR:PEOPLE_HTTP_" + res.status; return salida; }
    const data = await res.json();

    const persona = data && data.people && data.people[0] ? data.people[0] : null;
    if (!persona) { salida.error = "ERR:SIN_PERSONA"; return salida; }

    const code = persona.pitchHand && persona.pitchHand.code ? persona.pitchHand.code : null;
    if (code === "L" || code === "R" || code === "S") {
      salida.mano = code;
    }

    return salida;
  } catch (err) {
    salida.error = "ERR:" + err.message;
    return salida;
  }
}
