// f5-estadio.js — MLBPro F5 · Coincidencia de Factores
// F1 — Estadio
// Compara el parque del juego de hoy contra el parque de un juego histórico.
// No inventa datos. Si falta el nombre de parque en cualquiera de los dos lados,
// devuelve SIN_DATOS en vez de asumir.

function f1Estadio(venueHoy, venueHistorico) {
  if (!venueHoy || !venueHistorico) {
    return {
      factor: "F1",
      estado: "SIN_DATOS",
      detalle: "Falta el nombre del parque en el juego de hoy o en el histórico."
    };
  }

  const normalizar = (nombre) => String(nombre).trim().toLowerCase();

  const coincide = normalizar(venueHoy) === normalizar(venueHistorico);

  return {
    factor: "F1",
    estado: coincide ? "CONFIRMADO" : "NO_APLICA",
    venueHoy: venueHoy,
    venueHistorico: venueHistorico,
    detalle: coincide
      ? "Mismo parque en ambos juegos."
      : "Parques distintos, no se compara este juego histórico para F1."
  };
}

if (typeof module !== "undefined") { module.exports = { f1Estadio }; }
