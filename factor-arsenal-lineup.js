// factor-arsenal-lineup.js
// PIEZA - cruza el ARSENAL real de un pitcher (ARSENAL_MASTER_2026) contra el
// LINEUP confirmado de bateadores rivales (BATTERS_VSPITCH_2026).
// Mide: que tan vulnerable o resistente es ese lineup a ESE arsenal especifico.
// Metrica usada: woba (predice produccion/carreras), NO whiff/K (eso es para ponches).
// NO inventa numeros. Si falta arsenal, lineup, o datos del bateador contra un pitch
// especifico -> ese pitch/bateador se excluye del promedio (no se rellena con nada).
// Si no hay lineup confirmado -> factor = 1.0 NEUTRO, confirmado:false.

function calcularFactorArsenalLineup(pitcherId, lineupRival) {
  const salida = {
    pitcher_id: pitcherId,
    factor: 1.0,
    woba_esperado: null,
    woba_liga_ref: null,
    bateadores_usados: 0,
    bateadores_total: lineupRival ? lineupRival.length : 0,
    confirmado: false,
    nota: ""
  };

  if (!lineupRival || lineupRival.length === 0) {
    salida.nota = "SIN_LINEUP_CONFIRMADO";
    return salida;
  }

  const arsenalData = (typeof ARSENAL_MASTER_2026 !== "undefined") ? ARSENAL_MASTER_2026[pitcherId] : null;
  if (!arsenalData || !arsenalData.arsenal || !arsenalData.arsenal.length) {
    salida.nota = "SIN_ARSENAL_CONFIRMADO";
    return salida;
  }

  const arsenal = arsenalData.arsenal;
  const ligaRef = calcularWobaLigaPromedio();
  salida.woba_liga_ref = ligaRef;

  let sumaWobaEsperadoBateadores = 0;
  let nBateadoresValidos = 0;

  for (let i = 0; i < lineupRival.length; i++) {
    const bateadorId = lineupRival[i].player_id;
    const bateadorData = (typeof BATTERS_VSPITCH_2026 !== "undefined") ? BATTERS_VSPITCH_2026[bateadorId] : null;
    if (!bateadorData || !bateadorData.vs) continue;

    let sumaUsoConDato = 0;
    let sumaWobaPonderado = 0;

    for (let j = 0; j < arsenal.length; j++) {
      const pitch = arsenal[j];
      const statBateador = bateadorData.vs[pitch.pt];
      if (!statBateador || statBateador.woba === undefined || statBateador.woba === null) continue;
      if (!statBateador.pa || statBateador.pa < 5) continue;

      sumaWobaPonderado += statBateador.woba * pitch.usage;
      sumaUsoConDato += pitch.usage;
    }

    if (sumaUsoConDato === 0) continue;

    const wobaEsperadoBateador = sumaWobaPonderado / sumaUsoConDato;
    sumaWobaEsperadoBateadores += wobaEsperadoBateador;
    nBateadoresValidos++;
  }

  if (nBateadoresValidos === 0) {
    salida.nota = "SIN_DATOS_SUFICIENTES_EN_LINEUP";
    return salida;
  }

  const wobaEsperadoEquipo = sumaWobaEsperadoBateadores / nBateadoresValidos;
  salida.woba_esperado = Math.round(wobaEsperadoEquipo * 1000) / 1000;
  salida.bateadores_usados = nBateadoresValidos;
  salida.factor = Math.round((wobaEsperadoEquipo / ligaRef) * 1000) / 1000;
  salida.confirmado = nBateadoresValidos >= 5;
  salida.nota = salida.confirmado ? "OK" : "MUESTRA_PARCIAL_" + nBateadoresValidos + "_DE_" + lineupRival.length;

  return salida;
}

var _wobaLigaCache = null;
function calcularWobaLigaPromedio() {
  if (_wobaLigaCache !== null) return _wobaLigaCache;
  if (typeof BATTERS_VSPITCH_2026 === "undefined") return 0.310;

  let sumaWoba = 0;
  let nMuestras = 0;
  const ids = Object.keys(BATTERS_VSPITCH_2026);
  for (let i = 0; i < ids.length; i++) {
    const vs = BATTERS_VSPITCH_2026[ids[i]].vs;
    if (!vs) continue;
    const pitches = Object.keys(vs);
    for (let j = 0; j < pitches.length; j++) {
      const stat = vs[pitches[j]];
      if (stat && stat.woba !== undefined && stat.woba !== null && stat.pa >= 5) {
        sumaWoba += stat.woba;
        nMuestras++;
      }
    }
  }
  _wobaLigaCache = nMuestras > 0 ? (sumaWoba / nMuestras) : 0.310;
  return _wobaLigaCache;
}
