// f5-viento.js — MLBPro F5 · Coincidencia de Factores
// F4 — Viento
// Compara la velocidad del viento de hoy contra la histórica.
// Umbral: ±3 mph (confirmado como válido por el usuario).
// La dirección del viento se reporta aparte, no se mezcla con la velocidad.
// No inventa datos. Si falta el viento en cualquiera de los dos lados, SIN_DATOS.

function f4Viento(vientoHoyMph, vientoHistoricoMph, direccionHoy, direccionHistorico) {
  const UMBRAL_MPH = 3;

  if (vientoHoyMph === null || vientoHoyMph === undefined ||
      vientoHistoricoMph === null || vientoHistoricoMph === undefined ||
      isNaN(vientoHoyMph) || isNaN(vientoHistoricoMph)) {
    return {
      factor: "F4",
      estado: "SIN_DATOS",
      detalle: "Falta la velocidad de viento real de hoy o del histórico."
    };
  }

  const diferencia = Math.abs(vientoHoyMph - vientoHistoricoMph);
  const coincide = diferencia <= UMBRAL_MPH;

  return {
    factor: "F4",
    estado: coincide ? "CONFIRMADO" : "NO_COINCIDE",
    vientoHoyMph: vientoHoyMph,
    vientoHistoricoMph: vientoHistoricoMph,
    diferenciaMph: diferencia,
    umbralMph: UMBRAL_MPH,
    direccionHoy: direccionHoy || "SIN_DATOS",
    direccionHistorico: direccionHistorico || "SIN_DATOS",
    detalle: coincide
      ? "Diferencia de " + diferencia + " mph, dentro del umbral de ±" + UMBRAL_MPH + " mph."
      : "Diferencia de " + diferencia + " mph, fuera del umbral de ±" + UMBRAL_MPH + " mph."
  };
}

module.exports = { f4Viento };
