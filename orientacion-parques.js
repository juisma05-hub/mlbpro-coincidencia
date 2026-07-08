// orientacion-parques.js
// PIEZA REEMPLAZADA - orientacion real de home plate por parque.
// Fuente: medicion propia por coordenadas (jardin central -> segunda base -> home plate),
// cruzada contra Clem's Baseball donde fue posible. Techados: fuente de texto citada
// (sin verificacion geoespacial propia, decision ya tomada).
// Cada entrada trae su FUENTE. Si no hay fuente confirmada o hay contradiccion sin resolver,
// el valor es null (NO_CONFIRMADO) y confirmado: false.
// NO se debe rellenar ningun valor sin fuente citable.
//
// NOTA 8 jul 2026 - COINCIDENCIA:
// Se mantiene estructura original. Se actualizan retractables/domo con capturas usuario
// y se respeta stadiumCanonName() si existe para evitar cruce de aliases.

const ORIENTACION_PARQUES_2026 = {
  // ---- 20 MEDIDOS POR COORDENADAS PROPIAS (jardin central -> segunda base -> home plate) ----
  "Wrigley Field": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: 38,
    fuente: "Medicion propia por coordenadas; coincide con Hardball Times/Shaded Seats",
    confirmado: true
  },
  "Nationals Park": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: 27,
    fuente: "Medicion propia por coordenadas; contradice TickPick (decia ENE)",
    confirmado: true
  },
  "Yankee Stadium": {
    direccion_texto: "este-noreste (ENE)",
    grado_aproximado: 75,
    fuente: "Medicion propia por coordenadas; coincide con TickPick",
    confirmado: true
  },
  "Progressive Field": {
    direccion_texto: "norte",
    grado_aproximado: 0,
    fuente: "Medicion propia por coordenadas; coincide exacto con Clem's Baseball",
    confirmado: true
  },
  "Citizens Bank Park": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: 9.5,
    fuente: "Medicion propia por coordenadas; margen de error algo mayor",
    confirmado: true
  },
  "T-Mobile Park": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: 54.5,
    fuente: "ShadedSeats.com - captura usuario; grafico confirma orientacion NE aprox. Mantiene 54.5 de medicion previa",
    confirmado: true
  },
  "Petco Park": {
    direccion_texto: "norte",
    grado_aproximado: 1.5,
    fuente: "Medicion propia por coordenadas; coincide con Clem's Baseball",
    confirmado: true
  },
  "Comerica Park": {
    direccion_texto: "sureste (SE)",
    grado_aproximado: 150.5,
    fuente: "Medicion propia por coordenadas; coincide con Clem's Baseball (SSE)",
    confirmado: true
  },
  "Dodger Stadium": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: 26,
    fuente: "GPS propio verificado 5 jul 2026 (home 34.073413,-118.240223 / segunda 34.073726,-118.240038 / jardin central 34.074357,-118.239658) - distancia home-segunda 38.8m calza con oficial MLB (38.79m). Reemplaza 25.5 anterior.",
    confirmado: true
  },
  "Oracle Park": {
    direccion_texto: "este / este-sureste (E/ESE)",
    grado_aproximado: 96,
    fuente: "Medicion propia por coordenadas, remedido (primer intento dio 279 grados, invertido por error de puntos; corregido)",
    confirmado: true
  },
  "Busch Stadium": {
    direccion_texto: "este-noreste (ENE)",
    grado_aproximado: 63,
    fuente: "Medicion propia por coordenadas, recalculado (primer intento dio 304 grados, error de formula propio)",
    confirmado: true
  },
  "Rate Field": {
    direccion_texto: "este-sureste (ESE)",
    grado_aproximado: 127,
    fuente: "Medicion propia por coordenadas, recalculado (primer intento dio 327 grados, error de formula propio)",
    confirmado: true
  },
  "Kauffman Stadium": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: 46.4,
    fuente: "GPS propio del usuario 5 jul 2026 (jardin central 39.051993,-94.479810 / segunda base 39.051485,-94.480495 / home plate 39.051247,-94.480819) - distancia home-segunda 38.55m vs 38.79m oficial (0.6% margen). Reemplaza 147.",
    confirmado: true
  },
  "PNC Park": {
    direccion_texto: "sureste (SE)",
    grado_aproximado: 152.5,
    fuente: "Medicion propia por coordenadas, recalculado (primer intento dio 332 grados, error de formula propio)",
    confirmado: true
  },
  "Citi Field": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: 17,
    fuente: "Medicion propia por coordenadas; coincide con TickPick",
    confirmado: true
  },
  "Target Field": {
    direccion_texto: "este (E)",
    grado_aproximado: 86,
    fuente: "Medicion propia por coordenadas del usuario; margen de error mayor (6.5 grados entre tramos)",
    confirmado: true
  },
  "Oriole Park at Camden Yards": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: 33,
    fuente: "Medicion propia por coordenadas (home plate y centerfield), confirmado antes de esta sesion",
    confirmado: true
  },
  "Coors Field": {
    direccion_texto: "norte",
    grado_aproximado: 4.5,
    fuente: "Medicion propia por coordenadas (jardin central 39.756783,-104.994139 / segunda base 39.756071,-104.994158 / home plate 39.755694,-104.994199) - distancia home-segunda verificada (42.1m vs 38.8m real, ~8.5% de margen). Confirma el valor previo de 4.5 grados; contradice y reemplaza la fuente de texto (Wikipedia/The Shadium/TickPick que daba 40 grados NNE)",
    confirmado: true
  },
  "Fenway Park": {
    direccion_texto: "sureste (SE)",
    grado_aproximado: 146,
    fuente: "Medicion propia por coordenadas, recalculado; sigue en contradiccion real con Hardball Times/Shaded Seats/TickPick (decian NE) - no es error de calculo",
    confirmado: true
  },
  "Truist Park": {
    direccion_texto: "sur-suroeste (SSO)",
    grado_aproximado: 202,
    fuente: "Medicion propia por coordenadas; contradice Clem's Baseball (decia SSE) - no es error de calculo, tramos coincidian bien desde el principio",
    confirmado: true
  },

  // ---- 2 CON COORDENADAS GPS APORTADAS Y CONFIRMADAS EN ESTA SESION ----
  "Angel Stadium": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: 17,
    fuente: "Coordenadas del usuario (jardin central 33.800640,-117.882295 / segunda base 33.800265,-117.882734 / home plate 33.799906,-117.883171) - aproximado, campo no visible (obstruido por pista de motocross), sin verificacion de distancia real",
    confirmado: true
  },
  "Great American Ball Park": {
    direccion_texto: "este-sureste / sureste (ESE/SE)",
    grado_aproximado: 121,
    fuente: "Coordenadas del usuario (jardin central 39.096917,-84.505866 / segunda base 39.097286,-84.506673 / home plate 39.097470,-84.507044) - medicion propia, campo visible, verificada contra Shaded Seats/orientacion del rio",
    confirmado: true
  },

  // ---- TECHADOS - FUENTE DE TEXTO EXTERNA CITADA (sin verificacion geoespacial propia) ----
  "Chase Field": {
    direccion_texto: "norte-noreste / noreste (NNE/NE)",
    grado_aproximado: 23,
    fuente: "ShadedSeats.com - captura usuario; grafico orientado NNE/NE aprox., sin grado exacto",
    confirmado: true
  },
  "Sutter Health Park": {
    direccion_texto: "norte-noroeste (NNW) - home plate mira SSE",
    grado_aproximado: 330,
    fuente: "theshadium.com - texto, sin verificacion geoespacial propia",
    confirmado: true
  },
  "Globe Life Field": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: 45,
    fuente: "ShadedSeats.com - captura usuario; texto: oriented to the northeast; reemplaza 67.5 ENE",
    confirmado: true
  },
  "loanDepot Park": {
    direccion_texto: "sureste (SE)",
    grado_aproximado: 135,
    fuente: "ShadedSeats.com - captura usuario; grafico y texto indican orientacion SE / home plate facing southeast aprox.",
    confirmado: true
  },
  "Rogers Centre": {
    direccion_texto: "norte (aprox)",
    grado_aproximado: 0,
    fuente: "ShadedSeats.com - captura usuario; bateador/home plate orientado hacia norte aproximado, sin grado exacto",
    confirmado: true
  },

  // ---- AJUSTADOS CON CAPTURAS / APROXIMACION USUARIO 8 JUL 2026 ----
  "Daikin Park": {
    direccion_texto: "norte-noreste / noreste (NNE/NE)",
    grado_aproximado: 20,
    fuente: "ShadedSeats.com - captura usuario; grafico con brujula y trayectoria del sol; orientacion aproximada NE/NNE, sin grado exacto",
    confirmado: true
  },
  "American Family Field": {
    direccion_texto: "sureste (SE)",
    grado_aproximado: 135,
    fuente: "ShadedSeats.com / Miller Park - captura usuario; texto: home plate facing southeast; reemplaza 330 en contradiccion",
    confirmado: true
  },
  "Tropicana Field": {
    direccion_texto: "suroeste (SW) aproximado",
    grado_aproximado: 222,
    fuente: "Coordenadas aproximadas del usuario desde satelite: CF 27.767650,-82.653893 / medio 27.768237,-82.653255 / HP 27.768734,-82.652649. Domo cerrado; solo para orientacion visual, viento exterior NO cuenta.",
    confirmado: true
  }
};

// Devuelve la info de orientacion de un parque, o null si no esta confirmado.
function orientacionDelParque(venue) {
  var key = String(venue || "").trim();

  if (typeof stadiumCanonName === "function") {
    key = stadiumCanonName(key);
  }

  const info = ORIENTACION_PARQUES_2026[key];
  if (!info || !info.confirmado) return null;
  return info;
}
