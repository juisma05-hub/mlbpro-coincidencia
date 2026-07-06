// f5-pitcher.js — MLBPro F5 · Coincidencia de Factores
// F5 — Perfil Pitcher
// Compara el perfil del pitcher de hoy contra el del juego histórico.
// Variables: mano, K%, BB%, whiff%, xERA, xwOBA, arsenal, IP recientes.
// No inventa datos. Si falta una variable, se marca PARCIAL y se dice cuál falta.
// Si no hay ninguna variable real, SIN_DATOS.

function f5PerfilPitcher(perfilHoy, perfilHistorico) {
  if (!perfilHoy || !perfilHistorico) {
    return {
      factor: "F5",
      estado: "SIN_DATOS",
      detalle: "Falta el perfil completo del pitcher de hoy o del histórico."
    };
  }

  const variables = ["mano", "kPct", "bbPct", "whiffPct", "xera", "xwoba", "arsenal", "ipRecientes"];

  const faltantes = [];
  variables.forEach(function (v) {
    const valHoy = perfilHoy[v];
    const valHist = perfilHistorico[v];
    if (valHoy === null || valHoy === undefined || valHist === null || valHist === undefined) {
      faltantes.push(v);
    }
  });

  if (faltantes.length === variables.length) {
    return {
      factor: "F5",
      estado: "SIN_DATOS",
      detalle: "Ninguna variable del perfil pitcher tiene dato real en ambos lados."
    };
  }

  if (faltantes.length > 0) {
    return {
      factor: "F5",
      estado: "PARCIAL",
      variablesFaltantes: faltantes,
      detalle: "Faltan estas variables para completar la comparación: " + faltantes.join(", ")
    };
  }

  return {
    factor: "F5",
    estado: "PENDIENTE POR ACCESO",
    detalle: "Todas las variables tienen dato real. Falta la validación manual de similitud (regla definida por el usuario, no automatizada todavía)."
  };
}

if (typeof module !== "undefined") { module.exports = { f5PerfilPitcher }; }
