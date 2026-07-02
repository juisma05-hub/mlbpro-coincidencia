// orientacion-parques.js
// PIEZA NUEVA - orientacion real de home plate por parque (direccion cardinal, NO grado exacto).
// Cada entrada trae su FUENTE. Si no hay fuente confirmada, el valor es null (NO_CONFIRMADO).
// NO se debe rellenar ningun valor sin fuente citable.
// Metodo: 1) descripcion de texto de fuente confiable (TickPick/Wikipedia/Hardball Times)
//         2) cuando hay 2 coordenadas reales (home plate + centerfield), calculo directo verificado.

const ORIENTACION_PARQUES_2026 = {
  "Comerica Park": {
    direccion_texto: "sur",
    grado_aproximado: null, // rango sur ~ 160-200, sin numero exacto confirmado
    fuente: "Wikipedia (Comerica Park) + TickPick seating guide",
    confirmado: true
  },
  "Oracle Park": {
    direccion_texto: "este-noreste (ENE)",
    grado_aproximado: null, // rango ENE = 45-67
    fuente: "TickPick seating guide (San Francisco Giants)",
    confirmado: true
  },
  "Yankee Stadium": {
    direccion_texto: "este",
    grado_aproximado: null, // rango este ~ 80-100
    fuente: "TickPick seating guide (New York Yankees) + Shaded Seats Yankee Stadium",
    confirmado: true
  },
  "PNC Park": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: null, // rango NNE = 22-45
    fuente: "TickPick seating guide (Pittsburgh Pirates)",
    confirmado: true
  },
  "Progressive Field": {
    direccion_texto: "sureste (SE)",
    grado_aproximado: null, // rango SE = 112-157
    fuente: "TickPick seating guide (Cleveland Guardians)",
    confirmado: true
  },
  "Citi Field": {
    direccion_texto: "este-noreste (ENE)",
    grado_aproximado: null,
    fuente: "TickPick seating guide (New York Mets)",
    confirmado: true
  },
  "Citizens Bank Park": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: null,
    fuente: "TickPick seating guide (Philadelphia Phillies)",
    confirmado: true
  },
  "Dodger Stadium": {
    direccion_texto: "norte",
    grado_aproximado: null,
    fuente: "TickPick seating guide (Los Angeles Dodgers)",
    confirmado: true
  },
  "Rate Field": {
    direccion_texto: "norte-noreste (NNE)",
    grado_aproximado: null,
    fuente: "TickPick seating guide (Chicago White Sox)",
    confirmado: true
  },
  "Nationals Park": {
    direccion_texto: "este-noreste (ENE)",
    grado_aproximado: null,
    fuente: "TickPick seating guide (Washington Nationals)",
    confirmado: true
  },
  "Petco Park": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: null,
    fuente: "TickPick seating guide (San Diego Padres)",
    confirmado: true
  },
  "Wrigley Field": {
    direccion_texto: "este (con nota: Hardball Times sugiere mas hacia el norte que ENE puro)",
    grado_aproximado: null,
    fuente: "TickPick seating guide (Chicago Cubs) — CONTRADICCION MENOR con Hardball Times, revisar",
    confirmado: true
  },
  "Fenway Park": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: null,
    fuente: "TickPick / Shaded Seats (Boston Red Sox) + Hardball Times (coincide)",
    confirmado: true
  },
  "Oriole Park at Camden Yards": {
    direccion_texto: "noreste (NE)",
    grado_aproximado: 33, // UNICO con grado exacto: calculado por mi con 2 coordenadas reales (home plate + centerfield)
    fuente: "Coordenadas de home plate (39.283733,-76.621774) y centerfield (39.284897,-76.620798), calculo propio verificado (~33°, coincide con fuente original de 31°)",
    confirmado: true
  },

  // ---- SIN CONFIRMAR TODAVIA (17 parques) ----
  "Rogers Centre": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Tropicana Field": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Kauffman Stadium": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Target Field": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Daikin Park": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Angel Stadium": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Sutter Health Park": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "T-Mobile Park": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Globe Life Field": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Truist Park": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "loanDepot Park": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Great American Ball Park": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "American Family Field": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Busch Stadium": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Chase Field": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false },
  "Coors Field": { direccion_texto: null, grado_aproximado: null, fuente: null, confirmado: false }
};

// Devuelve la info de orientacion de un parque, o null si no esta confirmado.
function orientacionDelParque(venue) {
  const key = String(venue || "").trim();
  const info = ORIENTACION_PARQUES_2026[key];
  if (!info || !info.confirmado) return null;
  return info;
}
