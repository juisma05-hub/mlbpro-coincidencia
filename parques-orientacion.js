// parques-orientacion.js
// Orientación de los 30 parques MLB — grado hpACF (Home Plate → Centerfield,
// azimut real 0-360, 0=Norte, sentido horario).
// Generado: 2 julio 2026. Fuentes por parque en el campo "fuente".
// confianza: "exacta" = grado satelital/oficial puntual | "direccion" = punto
// medio de una dirección cardinal confirmada por texto, sin grado fino |
// "estimado" = triangulación por consenso de varias fuentes (sin medición directa)
//
// roof: "abierto" | "retractil" | "domo_fijo"  — SOLO REFERENCIAL AQUI.
// La exclusión real del cálculo de viento para domos cerrados se hace en
// casar-series.html usando el campo g.roof de cada juego en el cache
// (clima-cache.js / la API), NO este archivo. Este archivo da la orientación
// física del parque nada más, para todos los 30, domo o no.
//
// NO TOCAR ESTRUCTURA sin avisar a Perez — mlb-routes.js, clima-cache.js,
// estadios.js dependen de PARQUES_ORIENTACION y getOrientacionParque().

var PARQUES_ORIENTACION = {

  // ── CIELO ABIERTO — grado exacto (satelital u oficial puntual) ──
  "Oriole Park at Camden Yards": { hpACF: 33, roof: "abierto", confianza: "exacta", fuente: "cálculo propio 2 coordenadas (verificado)" },
  "Coors Field":                 { hpACF: 40, roof: "abierto", confianza: "exacta", fuente: "The Shadium + TickPick + Shadedseats" },
  "Kauffman Stadium":            { hpACF: 58, roof: "abierto", confianza: "exacta", fuente: "The Shadium + Shadedseats + RateYourSeats" },
  "Angel Stadium":                { hpACF: 65, roof: "abierto", confianza: "exacta", fuente: "The Shadium" },
  "PNC Park":                     { hpACF: 25, roof: "abierto", confianza: "exacta", fuente: "The Shadium" },
  "Nationals Park":               { hpACF: 87, roof: "abierto", confianza: "exacta", fuente: "The Shadium" },
  "Dodger Stadium":               { hpACF: 25, roof: "abierto", confianza: "exacta", fuente: "The Shadium" },
  "Truist Park":                  { hpACF: 45, roof: "abierto", confianza: "exacta", fuente: "The Shadium (grado exacto)" },
  "Oracle Park":                  { hpACF: 87, roof: "abierto", confianza: "exacta", fuente: "The Shadium ('faces 87 degrees') + Shadedseats ('faces due east') + TickPick ('roughly ENE')" },

  // ── CIELO ABIERTO — dirección confirmada (punto medio del rango, sin grado fino) ──
  "Target Field":          { hpACF: 90,  roof: "abierto", confianza: "direccion", fuente: "Shadedseats + wherestheshade + AmateurPlanner (~90° E)" },
  "Busch Stadium":         { hpACF: 80,  roof: "abierto", confianza: "direccion", fuente: "The Shadium + Shadedseats + Wikipedia (~80° ENE)" },
  "Great American Ball Park": { hpACF: 112, roof: "abierto", confianza: "direccion", fuente: "The Shadium + wherestheshade (~112° ESE)" },
  "Yankee Stadium":        { hpACF: 90,  roof: "abierto", confianza: "direccion", fuente: "TickPick + Shadedseats (E)" },
  "Progressive Field":     { hpACF: 135, roof: "abierto", confianza: "direccion", fuente: "TickPick (SE)" },
  "Citi Field":            { hpACF: 67.5, roof: "abierto", confianza: "direccion", fuente: "TickPick (ENE)" },
  "Citizens Bank Park":    { hpACF: 45,  roof: "abierto", confianza: "direccion", fuente: "TickPick (NE)" },
  "Petco Park":            { hpACF: 45,  roof: "abierto", confianza: "direccion", fuente: "TickPick (NE)" },
  "Wrigley Field":         { hpACF: 30,  roof: "abierto", confianza: "direccion", fuente: "The Shadium (30°, NNE/E)" },
  "Fenway Park":           { hpACF: 45,  roof: "abierto", confianza: "direccion", fuente: "TickPick + Shadedseats + Hardball Times (NE)" },
  "Comerica Park":         { hpACF: 180, roof: "abierto", confianza: "direccion", fuente: "Wikipedia + TickPick (SUR, el más al sur de MLB)" },
  "Rate Field":            { hpACF: 135, roof: "abierto", confianza: "direccion", fuente: "Shadedseats ('oriented to the southeast') + True Blue LA (diseño histórico a propósito hacia el SE para evitar viento SO de cola)" },

  // ── DOMO / RETRÁCTIL — orientación referencial, EXCLUIDA del cálculo de
  // viento en tiempo real vía g.roof en el cache, no aquí ──
  "Rogers Centre":        { hpACF: 15,  roof: "retractil", confianza: "exacta",    fuente: "The Shadium + TickPick + Shadedseats" },
  "T-Mobile Park":        { hpACF: 318, roof: "retractil", confianza: "exacta",    fuente: "The Shadium" },
  "Chase Field":          { hpACF: 23,  roof: "retractil", confianza: "exacta",    fuente: "The Shadium + Shadedseats" },
  "Globe Life Field":     { hpACF: 58,  roof: "retractil", confianza: "direccion", fuente: "MLB.com oficial + Wikipedia + Shadedseats + Ballpark Digest (ENE ~50-67°)" },
  "Daikin Park":          { hpACF: 20,  roof: "retractil", confianza: "exacta",    fuente: "The Shadium + HoustonTicketBrokers" },
  "American Family Field": { hpACF: 330, roof: "retractil", confianza: "estimado", fuente: "Clem's (portón home al NW) + The Shadium; TickPick discrepó NE" },
  "loanDepot park":       { hpACF: 128, roof: "retractil", confianza: "direccion", fuente: "wherestheshade + lista previa" },
  "Tropicana Field":      { hpACF: 359, roof: "domo_fijo", confianza: "estimado",  fuente: "sin fuente independiente; domo fijo, se excluye del cálculo igual" },

  // ── EL ÚLTIMO EN CERRAR — sin medición satelital de 2 puntos ──
  "Sutter Health Park": {
    hpACF: 56, roof: "abierto", confianza: "estimado",
    fuente: "Triangulado: MLB.com oficial ('east-northeast'=67.5°) + Shadedseats ('northeast'=45°) " +
            "+ deducción física (Tower Bridge y salida del sol tras jardín derecho) " +
            "+ patrón de viento Ballpark Pal cruzado con Delta Breeze regional (SO→NE). " +
            "Punto medio 45–67.5° = 56°, ±11° (dentro de margen de error 10-15°). " +
            "Rechazado: The Shadium (330° NNO) — outlier, mismo patrón de error que tuvo en Comerica."
  }
};

// Alias para nombres alternos del mismo parque (renombres de patrocinio,
// nombres usados en otros archivos del proyecto como park-factors.js).
// Todos apuntan al mismo objeto de orientación.
var PARQUES_ALIAS = {
  "Guaranteed Rate Field": "Rate Field",
  "US Cellular Field": "Rate Field",
  "Comiskey Park": "Rate Field",
  "UNIQLO Field at Dodger Stadium": "Dodger Stadium",
  "Camden Yards": "Oriole Park at Camden Yards",
  "AT&T Park": "Oracle Park",
  "loanDepot Park": "loanDepot park",
  "Raley Field": "Sutter Health Park"
};

// Busca la orientación (hpACF) de un parque por nombre de venue, con
// coincidencia difusa (substring en cualquier dirección) porque el nombre
// que llega del cache/API puede no ser idéntico letra por letra.
// CORRECCION: antes devolvia 45 (valor inventado) en silencio cuando no
// encontraba el parque. Ahora devuelve null explicito. El codigo que llama
// a esta funcion debe verificar null y tratarlo como NO_CONFIRMADO, no
// asumir un grado.
function getOrientacionParque(venue) {
  if (!venue) return null;
  var v = venue.toLowerCase();

  // 1. match directo
  if (PARQUES_ORIENTACION[venue]) return PARQUES_ORIENTACION[venue].hpACF;

  // 2. match por alias
  for (var alias in PARQUES_ALIAS) {
    if (alias.toLowerCase() === v) {
      var real = PARQUES_ALIAS[alias];
      if (PARQUES_ORIENTACION[real]) return PARQUES_ORIENTACION[real].hpACF;
    }
  }

  // 3. match difuso por substring contra claves y alias
  for (var key in PARQUES_ORIENTACION) {
    if (v.indexOf(key.toLowerCase()) >= 0 || key.toLowerCase().indexOf(v) >= 0) {
      return PARQUES_ORIENTACION[key].hpACF;
    }
  }
  for (var a in PARQUES_ALIAS) {
    if (v.indexOf(a.toLowerCase()) >= 0 || a.toLowerCase().indexOf(v) >= 0) {
      var real2 = PARQUES_ALIAS[a];
      if (PARQUES_ORIENTACION[real2]) return PARQUES_ORIENTACION[real2].hpACF;
    }
  }

  // NO_CONFIRMADO: parque no encontrado. Antes esto devolvia 45 en
  // silencio (valor inventado disfrazado de dato real). Se corrige aqui.
  console.warn("getOrientacionParque: NO_CONFIRMADO, parque no encontrado -> " + venue);
  return null;
}

// Devuelve el objeto completo de orientación (con roof, confianza, fuente),
// o null si no se encuentra. Útil si en algún momento se quiere mostrar la
// fuente/confianza en la UI en vez de solo el número.
function getInfoParque(venue) {
  if (!venue) return null;
  var v = venue.toLowerCase();
  if (PARQUES_ORIENTACION[venue]) return PARQUES_ORIENTACION[venue];
  for (var alias in PARQUES_ALIAS) {
    if (alias.toLowerCase() === v) return PARQUES_ORIENTACION[PARQUES_ALIAS[alias]] || null;
  }
  for (var key in PARQUES_ORIENTACION) {
    if (v.indexOf(key.toLowerCase()) >= 0 || key.toLowerCase().indexOf(v) >= 0) {
      return PARQUES_ORIENTACION[key];
    }
  }
  return null;
}
