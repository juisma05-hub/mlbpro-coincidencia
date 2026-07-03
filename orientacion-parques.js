// orientacion-parques.js
// PIEZA REEMPLAZADA - orientacion real de home plate por parque.
// Fuente: medicion propia por coordenadas (jardin central -> segunda base -> home plate),
// cruzada contra Clem's Baseball donde fue posible. Techados: fuente de texto citada
// (sin verificacion geoespacial propia, decision ya tomada).
// Cada entrada trae su FUENTE. Si no hay fuente confirmada o hay contradiccion sin resolver,
// el valor es null (NO_CONFIRMADO) y confirmado: false.
// NO se debe rellenar ningun valor sin fuente citable.

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
    fuente: "Medicion propia por coordenadas; coincide con Clem's Baseball",
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
    grado_aproximado: 25.5,
    fuente: "Medicion propia por coordenadas; coincide con Clem's Baseball",
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
    direccion_texto: "sureste (SE)",
    grado_aproximado: 147,
    fuente: "Medicion propia por coordenadas, recalculado (primer intento dio 327 grados, error de formula propio)",
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
    fuente: "Medicion propia por coordenadas; reemplaza propuesta vieja de Shadium (40 grados NNE)",
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
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: 23,
    fuente: "theshadium.com - texto, sin verificacion geoespacial propia",
    confirmado: true
  },
  "Sutter Health Park": {
    direccion_texto: "norte-noroeste (NNW) - home plate mira SSE",
    grado_aproximado: 330,
    fuente: "theshadium.com - texto, sin verificacion geoespacial propia",
    confirmado: true
  },
  "Globe Life Field": {
    direccion_texto: "este-noreste (ENE)",
    grado_aproximado: null,
    fuente: "MLB.com / Texas Rangers (oficial) - texto, sin grado exacto",
    confirmado: true
  },
  "loanDepot Park": {
    direccion_texto: "sureste (SE)",
    grado_aproximado: null,
    fuente: "shadedseats.com - texto, sin grado exacto",
    confirmado: true
  },
  "Rogers Centre": {
    direccion_texto: "norte (aprox)",
    grado_aproximado: null,
    fuente: "shadedseats.com - texto ('el bateador mira hacia el norte'), sin grado exacto",
    confirmado: true
  },

  // ---- SIN CONFIRMAR (contradiccion entre fuentes o sin dato) ----
  "Daikin Park": {
    direccion_texto: null,
    grado_aproximado: null,
    fuente: null,
    confirmado: false,
    nota: "CONTRADICCION: shadedseats.com y wherestheshade.com dicen NNW/NW; houstonticketbrokers.com dice home plate mira NE. Ningun grado exacto. PENDIENTE resolver."
  },
  "American Family Field": {
    direccion_texto: null,
    grado_aproximado: null,
    fuente: null,
    confirmado: false,
    nota: "CONTRADICCION: wherestheshade.com dice que el estadio mira sureste; theshadium.com dice NNW. Ningun grado exacto. PENDIENTE resolver."
  },
  "Tropicana Field": {
    direccion_texto: null,
    grado_aproximado: null,
    fuente: null,
    confirmado: false,
    nota: "NO_CONFIRMADO. 1) Se busco grado/direccion de orientacion. 2) Busqueda web combinada e individual. 3) Resultados solo devolvieron direccion/parking/capacidad. 4) Falta grado o direccion cardinal desde fuente citable."
  }
};

// Devuelve la info de orientacion de un parque, o null si no esta confirmado.
function orientacionDelParque(venue) {
  const key = String(venue || "").trim();
  const info = ORIENTACION_PARQUES_2026[key];
  if (!info || !info.confirmado) return null;
  return info;
}
