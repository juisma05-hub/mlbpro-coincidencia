// f5-roof.js — MLBPro F5 · Coincidencia de Factores
// F2 — Tipo de estadio / Roof
// Compara el tipo de techo del parque de hoy contra el del juego histórico.
// Tipos esperados: "open", "dome", "retractable" (o "fixed_dome" si así lo tienes en tu tabla).
// No inventa datos. Si falta el roof en cualquiera de los dos lados, SIN_DATOS.

function f2Roof(roofHoy, roofHistorico) {
  if (!roofHoy || !roofHistorico) {
    return {
      factor: "F2",
      estado: "SIN_DATOS",
      detalle: "Falta el dato de roof/tipo de estadio en el juego de hoy o en el histórico."
    };
  }

  const normalizar = (r) => String(r).trim().toLowerCase();

  const coincide = normalizar(roofHoy) === normalizar(roofHistorico);

  return {
    factor: "F2",
    estado: coincide ? "CONFIRMADO" : "NO_APLICA",
    roofHoy: roofHoy,
    roofHistorico: roofHistorico,
    detalle: coincide
      ? "Mismo tipo de estadio/roof en ambos juegos."
      : "Tipo de estadio/roof distinto, no se compara este juego histórico para F2."
  };
}

module.exports = { f2Roof };
