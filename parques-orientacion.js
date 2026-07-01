// parques-orientacion.js
// Orientación de cada parque MLB: grados desde Home Plate hacia Center Field (HP→CF)
// La brújula muestra hacia dónde apunta CF desde HP.
// Para rotar el parque SVG: rotate(hpACF) — directo, SIN restar 180.
// Fuente: andrewclem.com/Baseball/Stadium_statistics.html + verificación cruzada
// con Baseball Almanac, TickPick, Shaded Seats y otras fuentes de orientación.
// NOTA: "Orientation" = dirección HP→CF en grados desde Norte, sentido horario.
// NOTA 2: verificación en curso, parque por parque, confirmada por el usuario
// contra Baseball Almanac (diagramas) + fuentes de texto cruzadas.

const PARQUES_ORIENTACION = {
  // ── AL ESTE ──
  // CORREGIDO: era 157 (SSE), verificado incorrecto contra 3 fuentes (TickPick,
  // Orioles Tickets/Shaded Seats, regla general Clem's Baseball: ningun parque
  // MLB cae entre 150-315 grados). Camden Yards esta confirmado NE. Valor
  // aproximado (no hay grado exacto al decimal en fuente publica accesible).
  "Oriole Park at Camden Yards":      { hpACF: 55,  nota: "HP hacia NE (aprox, corregido — antes 157 SSE era incorrecto)" },
  // CORREGIDO: era 90 (E), verificado contra shadedseats.com (texto: "oriented
  // to the northeast") + fuente citando 4 sitios incl. Reddit r/baseball: 45°.
  "Fenway Park":                       { hpACF: 45,  nota: "HP hacia NE — corregido (antes 90 E era incorrecto, 45 confirmado por 4 fuentes)" },
  // CORREGIDO: era 65, verificado contra fuente citando 4 sitios incl. Reddit
  // r/baseball: 75°. Coincide con shadedseats.com ("facing east") y grafica
  // Craig Robinson (~80-85, mismo cuadrante ENE/E).
  "Yankee Stadium":                    { hpACF: 75,  nota: "HP hacia E — corregido (antes 65, ahora 75 confirmado por 4 fuentes)" },
  "Citi Field":                        { hpACF: 45,  nota: "HP hacia NE" },
  // CORREGIDO: era 65 (ENE), verificado incorrecto contra shadedseats.com
  // (texto explicito: "Rogers Centre is one of the few major league parks
  // where the batter faces north when hitting").
  "Rogers Centre":                     { hpACF: 0,   nota: "HP hacia N — corregido (antes 65 ENE era incorrecto, shadedseats.com confirma bateador mira al norte) (techo retractil)" },

  // ── AL CENTRAL ──
  "Guaranteed Rate Field":             { hpACF: 135, nota: "HP hacia SE — confirmado con 3 fuentes (120-135 SE)" },
  "Rate Field":                        { hpACF: 135, nota: "HP hacia SE — confirmado (mismo parque, nombre nuevo)" },
  "Progressive Field":                 { hpACF: 65,  nota: "HP hacia ENE" },
  "Comerica Park":                     { hpACF: 145, nota: "HP hacia SE" },
  "Target Field":                      { hpACF: 60,  nota: "HP hacia ENE — confirmado, fuentes dicen 'Este', cercano" },
  "Kauffman Stadium":                  { hpACF: 15,  nota: "HP hacia NNE" },

  // ── AL OESTE ──
  "Minute Maid Park":                  { hpACF: 35,  nota: "HP hacia NNE (roof)" },
  "Daikin Park":                       { hpACF: 35,  nota: "HP hacia NNE (roof, mismo parque nombre nuevo)" },
  "Globe Life Field":                  { hpACF: 35,  nota: "HP hacia NNE (roof)" },
  "Angel Stadium":                     { hpACF: 65,  nota: "HP hacia ENE" },
  "T-Mobile Park":                     { hpACF: 15,  nota: "HP hacia NNE" },
  "Sutter Health Park":                { hpACF: 25,  nota: "HP hacia NNE (Oakland Athletics)" },

  // ── NL ESTE ──
  "Citizens Bank Park":                { hpACF: 55,  nota: "HP hacia ENE" },
  "Nationals Park":                    { hpACF: 85,  nota: "HP hacia E" },
  "Truist Park":                       { hpACF: 30,  nota: "HP hacia NNE" },
  "Hard Rock Stadium":                 { hpACF: 60,  nota: "HP hacia ENE (loanDepot)" },
  "loanDepot park":                    { hpACF: 60,  nota: "HP hacia ENE (roof)" },

  // ── NL CENTRAL ──
  // CORREGIDO: era 95 (E), verificado incorrecto contra 2 fuentes independientes
  // (TripAdvisor reviews + Shaded Seats: "Wrigley Field is oriented to the
  // northeast" / "stadium faces North East"). Confirmado visualmente por el
  // usuario contra Baseball Almanac: home plate en O, jardin abre hacia NE.
  "Wrigley Field":                     { hpACF: 45,  nota: "HP hacia NE (corregido — antes 95 E era incorrecto, 2 fuentes confirman NE)" },
  "American Family Field":             { hpACF: 60,  nota: "HP hacia ENE (roof)" },
  "PNC Park":                          { hpACF: 95,  nota: "HP hacia E" },
  "Busch Stadium":                     { hpACF: 60,  nota: "HP hacia ENE" },
  "Great American Ball Park":          { hpACF: 75,  nota: "HP hacia ENE" },

  // ── NL OESTE ──
  "Dodger Stadium":                    { hpACF: 65,  nota: "HP hacia ENE" },
  "Oracle Park":                       { hpACF: 95,  nota: "HP hacia E" },
  "Petco Park":                        { hpACF: 30,  nota: "HP hacia NNE" },
  "Chase Field":                       { hpACF: 30,  nota: "HP hacia NNE (roof)" },
  "Coors Field":                       { hpACF: 40,  nota: "HP hacia NE" },

  // ── Tropicana (domo fijo) ──
  // SIN CAMBIO: domo fijo cerrado, no hay fuente confiable con grado especifico
  // (el sol/viento exterior no aplica adentro del domo).
  "Tropicana Field":                   { hpACF: 60,  nota: "Domo fijo — brisa exterior no aplica — NO_CONFIRMADO grado especifico" },
};

// Helper: dado el nombre del parque, devuelve el ángulo HP→CF
// Si no existe en el mapa, devuelve 45° (NE, orientación más común MLB)
function getOrientacionParque(venue) {
  if (!venue) return 45;
  // buscar coincidencia parcial
  for (var key in PARQUES_ORIENTACION) {
    if (venue.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(venue.toLowerCase())) {
      return PARQUES_ORIENTACION[key].hpACF;
    }
  }
  return 45; // default NE
}
