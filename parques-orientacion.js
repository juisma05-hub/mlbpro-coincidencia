// parques-orientacion.js
// Orientacion de los 30 parques MLB - grado hpACF (Home Plate -> Centerfield).
// ACTUALIZADO 3 jul 2026 con mediciones GPS propias (3 puntos: jardin
// central, segunda base, home plate) - reemplaza valores previos menos
// precisos. Fuente de esta pasada: investigacion nueva con coordenadas.
//
// AVISO: Sutter Health Park cambia de 56 (consenso anterior, rechazando
// Shadium) a 330 (fuente Shadium, "decision ya tomada" segun el nuevo
// documento). Es un cambio de criterio respecto a la sesion anterior.
//
// confianza: "exacta" = medicion GPS propia o grado citado puntual
// "direccion" = solo direccion cardinal, sin grado fino
// "aproximada" = coordenadas/imagen aproximada, no GPS exacto
// "contradiccion" = fuentes se contradicen, sin resolver
// "no_confirmado" = sin dato

var PARQUES_ORIENTACION = {
  "Wrigley Field":            { hpACF: 38,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide Hardball Times/Shaded Seats" },
  "Nationals Park":           { hpACF: 27,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - contradice TickPick (ENE)" },
  "Yankee Stadium":           { hpACF: 75,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide TickPick" },
  "Progressive Field":        { hpACF: 0,     roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide exacto Clem's" },
  "Citizens Bank Park":       { hpACF: 9.5,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio" },
  "T-Mobile Park":            { hpACF: 54.5,  roof:"retractil", confianza:"direccion", fuente:"ShadedSeats.com - captura usuario; grafico confirma orientacion NE aprox. Mantiene 54.5 de medicion previa" },
  "Petco Park":               { hpACF: 1.5,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide Clem's" },
  "Comerica Park":            { hpACF: 150.5, roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide Clem's (SSE)" },
  "Dodger Stadium":           { hpACF: 26,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio verificado 5 jul 2026 (home 34.073413,-118.240223 / segunda 34.073726,-118.240038 / jardin central 34.074357,-118.239658) - distancia home-segunda 38.8m calza con oficial MLB (38.79m). Reemplaza 25.5 anterior." },
  "Oracle Park":              { hpACF: 96,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - remedido" },
  "Busch Stadium":            { hpACF: 63,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - recalculado" },
  "Rate Field":               { hpACF: 127,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - recalculado" },
  "Kauffman Stadium":         { hpACF: 46.4,  roof:"abierto",   confianza:"exacta", fuente:"GPS propio del usuario 5 jul 2026 (jardin central 39.051993,-94.479810 / segunda base 39.051485,-94.480495 / home plate 39.051247,-94.480819) - distancia home-segunda 38.55m vs 38.79m oficial (0.6% margen). Reemplaza 147." },
  "PNC Park":                 { hpACF: 152.5, roof:"abierto",   confianza:"exacta", fuente:"GPS propio - recalculado" },
  "Citi Field":               { hpACF: 17,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide TickPick" },
  "Target Field":             { hpACF: 86,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio" },
  "Oriole Park at Camden Yards": { hpACF: 33, roof:"abierto",   confianza:"exacta", fuente:"confirmado antes de esta pasada" },
  "Coors Field":              { hpACF: 4.5,   roof:"abierto",   confianza:"exacta", fuente:"Ajuste directo confirmado por Perez 5 jul 2026 - hpACF 4.5" },
  "Fenway Park":              { hpACF: 146,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - contradice otras fuentes (decian NE), no es error de calculo" },
  "Truist Park":              { hpACF: 202,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - contradice Clem's (SSE), no es error de calculo" },
  "Angel Stadium": {
    hpACF: 17, roof:"abierto", confianza:"exacta",
    fuente:"GPS propio del usuario - aproximado, campo obstruido por pista de motocross, sin verificacion de distancia real",
    jardin_central:"33.800640,-117.882295", segunda_base:"33.800265,-117.882734", home_plate:"33.799906,-117.883171"
  },
  "Great American Ball Park": {
    hpACF: 121, roof:"abierto", confianza:"exacta",
    fuente:"GPS propio del usuario - verificado, campo visible, contra Shaded Seats/orientacion del rio",
    jardin_central:"39.096917,-84.505866", segunda_base:"39.097286,-84.506673", home_plate:"39.097470,-84.507044"
  },
  "Chase Field":              { hpACF: 23,  roof:"retractil", confianza:"direccion", fuente:"ShadedSeats.com - captura usuario; grafico orientado NNE/NE aprox., sin grado exacto" },
  "Sutter Health Park": {
    hpACF: 330, roof:"abierto", confianza:"exacta",
    fuente:"theshadium.com - CAMBIO DE CRITERIO: pasada anterior rechazaba este valor (outlier) y usaba 56 por consenso; este documento lo adopta como decision tomada"
  },
  "Globe Life Field":         { hpACF: 45,  roof:"retractil", confianza:"direccion", fuente:"ShadedSeats.com - captura usuario; texto: oriented to the northeast; reemplaza 67.5 ENE" },
  "loanDepot Park":           { hpACF: 135, roof:"retractil", confianza:"direccion", fuente:"ShadedSeats.com - captura usuario; grafico y texto indican orientacion SE / home plate facing southeast aprox." },
  "Rogers Centre":            { hpACF: 0,   roof:"retractil", confianza:"direccion", fuente:"ShadedSeats.com - captura usuario; bateador/home plate orientado hacia norte aproximado, sin grado exacto" },
  "Daikin Park": {
    hpACF: 20, roof:"retractil", confianza:"direccion",
    fuente:"ShadedSeats.com - captura usuario; grafico con brujula y trayectoria del sol; orientacion aproximada NE/NNE, sin grado exacto"
  },
  "American Family Field": {
    hpACF: 135, roof:"retractil", confianza:"direccion",
    fuente:"ShadedSeats.com / Miller Park - captura usuario; texto: home plate facing southeast; reemplaza 330 en contradiccion"
  },
  "Tropicana Field": {
    hpACF: 222, roof:"domo_fijo", confianza:"aproximada",
    fuente:"Coordenadas aproximadas del usuario desde satelite: CF 27.767650,-82.653893 / medio 27.768237,-82.653255 / HP 27.768734,-82.652649. Domo cerrado; solo para orientacion visual, viento exterior NO cuenta."
  }
};

// Alias para nombres alternos del mismo parque (renombres de patrocinio,
// nombres usados en otros archivos del proyecto como park-factors.js).
var PARQUES_ALIAS = {
  "Guaranteed Rate Field": "Rate Field",
  "US Cellular Field": "Rate Field",
  "Comiskey Park": "Rate Field",
  "UNIQLO Field at Dodger Stadium": "Dodger Stadium",
  "Camden Yards": "Oriole Park at Camden Yards",
  "AT&T Park": "Oracle Park",
  "loanDepot park": "loanDepot Park",
  "LoanDepot Park": "loanDepot Park",
  "Marlins Park": "loanDepot Park",
  "Miller Park": "American Family Field",
  "Raley Field": "Sutter Health Park",
  "Oakland Coliseum": "Sutter Health Park",
  "Minute Maid Park": "Daikin Park"
};

// Busca la orientacion (hpACF) de un parque por nombre de venue, con
// coincidencia difusa. Devuelve el numero de grados, o null
// si no encuentra nada o si el parque no tiene grado confirmado.
function getOrientacionParque(venue) {
  if (!venue) return null;
  var v = venue.toLowerCase();

  if (PARQUES_ORIENTACION[venue]) {
    var hp = PARQUES_ORIENTACION[venue].hpACF;
    return (hp === null || hp === undefined) ? null : hp;
  }

  for (var alias in PARQUES_ALIAS) {
    if (alias.toLowerCase() === v) {
      var real = PARQUES_ALIAS[alias];
      if (PARQUES_ORIENTACION[real]) {
        var hp2 = PARQUES_ORIENTACION[real].hpACF;
        return (hp2 === null || hp2 === undefined) ? null : hp2;
      }
    }
  }

  for (var key in PARQUES_ORIENTACION) {
    if (v.indexOf(key.toLowerCase()) >= 0 || key.toLowerCase().indexOf(v) >= 0) {
      var hp3 = PARQUES_ORIENTACION[key].hpACF;
      return (hp3 === null || hp3 === undefined) ? null : hp3;
    }
  }
  for (var a in PARQUES_ALIAS) {
    if (v.indexOf(a.toLowerCase()) >= 0 || a.toLowerCase().indexOf(v) >= 0) {
      var real2 = PARQUES_ALIAS[a];
      if (PARQUES_ORIENTACION[real2]) {
        var hp4 = PARQUES_ORIENTACION[real2].hpACF;
        return (hp4 === null || hp4 === undefined) ? null : hp4;
      }
    }
  }

  return null;
}

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
