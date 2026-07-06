// f5-temperatura.js — MLBPro F5 · Coincidencia de Factores
// F3 — Temperatura
// Compara la temperatura de hoy contra la temperatura histórica.
// Umbral: ±5°F (confirmado como válido por el usuario).
// No inventa datos. Si falta la temperatura en cualquiera de los dos lados, SIN_DATOS.

function f3Temperatura(tempHoyF, tempHistoricoF) {
  const UMBRAL_F = 5;

  if (tempHoyF === null || tempHoyF === undefined ||
      tempHistoricoF === null || tempHistoricoF === undefined ||
      isNaN(tempHoyF) || isNaN(tempHistoricoF)) {
    return {
      factor: "F3",
      estado: "SIN_DATOS",
      detalle: "Falta la temperatura real de hoy o del histórico."
    };
  }

  const diferencia = Math.abs(tempHoyF - tempHistoricoF);
  const coincide = diferencia <= UMBRAL_F;

  return {
    factor: "F3",
    estado: coincide ? "CONFIRMADO" : "NO_COINCIDE",
    tempHoyF: tempHoyF,
    tempHistoricoF: tempHistoricoF,
    diferenciaF: diferencia,
    umbralF: UMBRAL_F,
    detalle: coincide
      ? "Diferencia de " + diferencia + "°F, dentro del umbral de ±" + UMBRAL_F + "°F."
      : "Diferencia de " + diferencia + "°F, fuera del umbral de ±" + UMBRAL_F + "°F."
  };
}

module.exports = { f3Temperatura };
