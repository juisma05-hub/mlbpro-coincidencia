/*
  MLBPro · perfil-pitcher-builder.js

  FUNCIÓN:
  Construye el perfil genérico de un pitcher para uso compartido entre los
  bloques F5 y Moneyline, utilizando exclusivamente las tablas madre ya
  existentes PITCHERS_MASTER_2026 y ARSENAL_MASTER_2026.

  ENTRADAS:
  - pitcherId: identificador oficial del pitcher en MLB.
  - PITCHERS_MASTER_2026[pitcherId].
  - ARSENAL_MASTER_2026[pitcherId].

  SALIDAS / MODIFICACIONES:
  - Expone armarPerfilPitcher(pitcherId).
  - Devuelve un objeto con:
    mano, kPct, bbPct, whiffPct, xera, xwoba, arsenal,
    ipRecientes y nombre.
  - No modifica las tablas madre.
  - No escribe caché ni localStorage.

  DEPENDENCIAS:
  - pitchers-master.js
  - arsenal-master.js

  NO TOCA:
  - Schedule.
  - Lineups.
  - Bullpen.
  - Líneas de mercado.
  - Clima.
  - Coincidencia.
  - K6.
  - Históricos.

  UTC / HORA LOCAL:
  No maneja fechas, horas ni zonas horarias.

  QUÉ HACE:
  - Busca xERA y nombre en PITCHERS_MASTER_2026.
  - Busca arsenal y nombre en ARSENAL_MASTER_2026.
  - Calcula whiffPct mediante promedio ponderado por el uso real de cada
    pitcheo que tenga whiff válido.
  - Devuelve null cuando no existe ningún dato real de xERA ni arsenal.

  QUÉ NO HACE:
  - No inventa datos faltantes.
  - No sustituye valores faltantes por cero ni por promedios genéricos.
  - No calcula mano, K%, BB%, xwOBA ni innings recientes.
  - No calcula directamente una predicción de F5 ni de Moneyline.

  QUÉ AFECTA:
  - El perfil de pitcheo consumido por los módulos F5 y Moneyline.

  QUÉ NO AFECTA:
  - Otros motores o bloques independientes del proyecto.

  CORRECCIÓN ACTUAL:
  - Se declara formalmente como utilidad compartida F5/Moneyline.
  - Se mantiene intacta la lógica previamente auditada.

  FECHA:
  2026-07-15

  ESTADO:
  Pendiente de prueba y aprobación final.
*/

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
