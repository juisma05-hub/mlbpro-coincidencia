// perfil-pitcher-builder.js
// Arma el objeto "perfil pitcher" que necesita f5-pitcher.js (f5PerfilPitcher)
// a partir de las tablas madre YA existentes: PITCHERS_MASTER_2026 (xera) y
// ARSENAL_MASTER_2026 (arsenal + whiff% por pitcheo).
// No inventa nada: mano, kPct, bbPct, xwoba, ipRecientes se dejan en null
// porque hoy no hay fuente real para ellos. whiffPct SÍ se calcula (no se
// inventa): es el promedio de whiff% de cada pitcheo del arsenal, ponderado
// por su % de uso real.

function armarPerfilPitcher(pitcherId) {
  if (!pitcherId) return null;

  var xeraData = (typeof PITCHERS_MASTER_2026 !== "undefined") ? PITCHERS_MASTER_2026[pitcherId] : null;
  var arsenalData = (typeof ARSENAL_MASTER_2026 !== "undefined") ? ARSENAL_MASTER_2026[pitcherId] : null;

  var xera = (xeraData && typeof xeraData.xera === "number") ? xeraData.xera : null;
  var arsenal = (arsenalData && Array.isArray(arsenalData.arsenal)) ? arsenalData.arsenal : null;

  var whiffPct = null;
  if (arsenal && arsenal.length > 0) {
    var usoTotal = 0, sumaPonderada = 0, huboWhiffValido = false;
    for (var i = 0; i < arsenal.length; i++) {
      var p = arsenal[i];
      var usage = (typeof p.usage === "number") ? p.usage : 0;
      var whiff = (typeof p.whiff === "number") ? p.whiff : null;
      if (whiff !== null) {
        sumaPonderada += usage * whiff;
        usoTotal += usage;
        huboWhiffValido = true;
      }
    }
    if (huboWhiffValido && usoTotal > 0) {
      whiffPct = Math.round((sumaPonderada / usoTotal) * 100) / 100;
    }
  }

  // Si no hay NINGÚN dato real (ni xera, ni arsenal), no hay perfil -> null,
  // para que f5-pitcher.js lo trate como "falta el perfil completo".
  if (xera === null && arsenal === null) return null;

  return {
    mano: null,
    kPct: null,
    bbPct: null,
    whiffPct: whiffPct,
    xera: xera,
    xwoba: null,
    arsenal: arsenal,
    ipRecientes: null,
    nombre: (xeraData && xeraData.name) || (arsenalData && arsenalData.name) || null
  };
}

if (typeof module !== "undefined") { module.exports = { armarPerfilPitcher: armarPerfilPitcher }; }
