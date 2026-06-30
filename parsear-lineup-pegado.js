// parsear-lineup-pegado.js
// PIEZA - convierte el TEXTO PEGADO MANUALMENTE (copiado de RotoWire u otra fuente
// con "Expected Lineup") en lineups estructurados por equipo abreviado.
// El usuario pega el bloque completo de varios juegos; esta funcion separa cada
// juego y cada "Expected Lineup" de 9 bateadores.
// Se guarda en localStorage marcado como PROYECTADO_MANUAL (no es dato API real,
// es texto que el usuario confirma haber copiado de una fuente externa).
// Cuando el lineup real de MLB se confirme (jalar-lineup.js trae 9), ese reemplaza
// a este automaticamente porque jalar-lineup.js siempre tiene prioridad en el codigo
// que lo consume.

var LINEUP_PEGADO_CACHE_KEY = "lineup_pegado_manual_v1";

function lineupPegadoLeerCache() {
  try {
    var raw = localStorage.getItem(LINEUP_PEGADO_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function lineupPegadoGuardarCache(obj) {
  try {
    localStorage.setItem(LINEUP_PEGADO_CACHE_KEY, JSON.stringify(obj));
  } catch(e) {}
}

// Busca el lineup proyectado pegado de un equipo, por nombre de equipo completo
// (ej. "Chicago White Sox") o por abreviado (ej. "CWS"). Devuelve array de {nombre}
// o null si no hay nada pegado para ese equipo hoy.
function lineupPegadoBuscarEquipo(nombreOAbrev) {
  var cache = lineupPegadoLeerCache();
  if (!cache || !cache.equipos || !nombreOAbrev) return null;
  var v = nombreOAbrev.trim().toLowerCase();
  var keys = Object.keys(cache.equipos);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === v) return cache.equipos[keys[i]];
  }
  return null;
}

// Parsea el texto pegado completo. Formato esperado (tal cual copia/pega de RotoWire):
//   CWS
//   CWS
//   BAL
//   BAL
//   White Sox (44-39)
//   Orioles (39-47)
//   Erick Fedde R
//   2-6 4.34 ERA
//   Expected Lineup
//   LF S. Antonacci L
//   3B M. Vargas R
//   ... (9 lineas de bateador)
//   Expected Lineup
//   SS G. Henderson L
//   ... (9 lineas del otro equipo)
// Se identifica el bloque "Expected Lineup" y se toman las siguientes 9 lineas como
// bateadores de ESE equipo, en orden. El nombre de equipo se asocia al ultimo nombre
// completo visto antes de cada "Expected Lineup" (away primero, home despues).
function parsearLineupPegado(textoCompleto) {
  var resultado = { equipos: {}, juegos_detectados: 0, errores: [] };
  if (!textoCompleto || typeof textoCompleto !== "string") {
    resultado.errores.push("TEXTO_VACIO");
    return resultado;
  }

  var lineas = textoCompleto.split("\n").map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });

  // nombres de equipo completos conocidos, para detectar la linea "White Sox (44-39)"
  var NOMBRES_EQUIPO = [
    "White Sox","Orioles","Rangers","Guardians","Pirates","Phillies","Tigers","Yankees",
    "Mets","Blue Jays","Nationals","Red Sox","Cardinals","Braves","Rays","Royals",
    "Reds","Brewers","Padres","Cubs","Twins","Astros","Marlins","Rockies","Dodgers",
    "Athletics","Angels","Mariners","Giants","Diamondbacks"
  ];

  var equipoActual = null;
  var dentroDeLineup = false;
  var contadorBateadores = 0;
  var lineupTemp = [];

  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];

    // detectar nombre de equipo con record, ej "White Sox (44-39)"
    var matchEquipo = null;
    for (var ne = 0; ne < NOMBRES_EQUIPO.length; ne++) {
      if (linea.indexOf(NOMBRES_EQUIPO[ne]) === 0) { matchEquipo = NOMBRES_EQUIPO[ne]; break; }
    }
    if (matchEquipo) {
      equipoActual = matchEquipo;
      continue;
    }

    if (linea === "Expected Lineup") {
      dentroDeLineup = true;
      contadorBateadores = 0;
      lineupTemp = [];
      continue;
    }

    if (dentroDeLineup && contadorBateadores < 9) {
      // formato de linea de bateador: "LF S. Antonacci L" -> posicion, nombre, mano
      var partes = linea.split(" ");
      if (partes.length >= 2) {
        var posicion = partes[0];
        var manoUltima = partes[partes.length - 1];
        var nombreBateador = partes.slice(1, partes.length - 1).join(" ");
        // si la ultima palabra no es mano (L/R/S), el nombre incluye todo menos la posicion
        if (manoUltima !== "L" && manoUltima !== "R" && manoUltima !== "S") {
          nombreBateador = partes.slice(1).join(" ");
        }
        lineupTemp.push({ nombre: nombreBateador, posicion: posicion });
        contadorBateadores++;
      }

      if (contadorBateadores === 9) {
        if (equipoActual) {
          resultado.equipos[equipoActual] = lineupTemp.slice();
          resultado.juegos_detectados++;
        } else {
          resultado.errores.push("LINEUP_SIN_EQUIPO_ASOCIADO_EN_LINEA_" + i);
        }
        dentroDeLineup = false;
      }
    }
  }

  return resultado;
}

// Guarda el resultado parseado en cache, marcado con la fecha de hoy.
function guardarLineupPegado(textoCompleto) {
  var parseado = parsearLineupPegado(textoCompleto);
  var hoy = (function(){
    var d = new Date(Date.now() - 6*60*60*1000);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  })();
  var nuevo = { fecha: hoy, equipos: parseado.equipos, tipo: "PROYECTADO_MANUAL" };
  lineupPegadoGuardarCache(nuevo);
  return parseado;
}
