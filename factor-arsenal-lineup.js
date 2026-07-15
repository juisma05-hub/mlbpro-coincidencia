// factor-arsenal-lineup.js
// PIEZA - cruza el ARSENAL real de un pitcher (ARSENAL_MASTER_2026) contra el
// LINEUP confirmado de bateadores rivales (BATTERS_VSPITCH_2026).
// Mide: qué tan vulnerable o resistente es ese lineup a ESE arsenal específico.
// Métrica usada: wOBA (predice producción/carreras), NO whiff/K.
// NO inventa números. Si falta arsenal, lineup, referencia de liga o datos del
// bateador contra un pitch específico, ese dato se excluye.
// Si no hay lineup confirmado o no existe muestra suficiente, devuelve factor
// NO_CONFIRMADO (null) con confirmado:false y una nota explicativa.
//
// CORRECCIÓN (esta auditoría): factor ya NO devuelve 1.0 como valor neutro
// cuando falta cualquier dato — devuelve null. Antes, un consumidor que
// olvidara chequear "confirmado" podía leer 1.0 como si fuera un factor
// real. El cambio se aplicó en el único punto donde se declara el valor
// inicial de "factor" dentro del objeto salida, por lo que cubre las 6
// salidas tempranas (SIN_LINEUP_CONFIRMADO, SIN_ARSENAL_CONFIRMADO,
// SIN_REFERENCIA_WOBA_LIGA, SIN_DATOS_SUFICIENTES_EN_LINEUP,
// WOBA_ESPERADO_INVALIDO, FACTOR_INVALIDO) sin tocar cada una por separado.

function calcularFactorArsenalLineup(pitcherId, lineupRival) {
  const lineupValido = Array.isArray(lineupRival);

  const salida = {
    pitcher_id: pitcherId,
    factor: null,
    woba_esperado: null,
    woba_liga_ref: null,
    bateadores_usados: 0,
    bateadores_total: lineupValido ? lineupRival.length : 0,
    confirmado: false,
    nota: ""
  };

  if (!lineupValido || lineupRival.length === 0) {
    salida.nota = "SIN_LINEUP_CONFIRMADO";
    return salida;
  }

  const arsenalData =
    typeof ARSENAL_MASTER_2026 !== "undefined"
      ? ARSENAL_MASTER_2026[pitcherId]
      : null;

  if (
    !arsenalData ||
    !Array.isArray(arsenalData.arsenal) ||
    arsenalData.arsenal.length === 0
  ) {
    salida.nota = "SIN_ARSENAL_CONFIRMADO";
    return salida;
  }

  const ligaRef = calcularWobaLigaPromedio();

  if (!Number.isFinite(ligaRef) || ligaRef <= 0) {
    salida.nota = "SIN_REFERENCIA_WOBA_LIGA";
    return salida;
  }

  salida.woba_liga_ref = Math.round(ligaRef * 1000) / 1000;

  let sumaWobaEsperadoBateadores = 0;
  let nBateadoresValidos = 0;

  for (let i = 0; i < lineupRival.length; i++) {
    const jugador = lineupRival[i];
    const bateadorId =
      jugador && typeof jugador === "object"
        ? jugador.player_id
        : null;

    if (bateadorId === undefined || bateadorId === null) continue;

    const bateadorData =
      typeof BATTERS_VSPITCH_2026 !== "undefined"
        ? BATTERS_VSPITCH_2026[bateadorId]
        : null;

    if (!bateadorData || !bateadorData.vs) continue;

    let sumaUsoConDato = 0;
    let sumaWobaPonderado = 0;

    for (let j = 0; j < arsenalData.arsenal.length; j++) {
      const pitch = arsenalData.arsenal[j];

      if (!pitch || !pitch.pt) continue;

      const usage = Number(pitch.usage);

      if (!Number.isFinite(usage) || usage <= 0) continue;

      const statBateador = bateadorData.vs[pitch.pt];

      if (!statBateador) continue;

      const woba = Number(statBateador.woba);
      const pa = Number(statBateador.pa);

      if (!Number.isFinite(woba)) continue;
      if (!Number.isFinite(pa) || pa < 5) continue;

      sumaWobaPonderado += woba * usage;
      sumaUsoConDato += usage;
    }

    if (!Number.isFinite(sumaUsoConDato) || sumaUsoConDato <= 0) continue;

    const wobaEsperadoBateador =
      sumaWobaPonderado / sumaUsoConDato;

    if (!Number.isFinite(wobaEsperadoBateador)) continue;

    sumaWobaEsperadoBateadores += wobaEsperadoBateador;
    nBateadoresValidos++;
  }

  if (nBateadoresValidos === 0) {
    salida.nota = "SIN_DATOS_SUFICIENTES_EN_LINEUP";
    return salida;
  }

  const wobaEsperadoEquipo =
    sumaWobaEsperadoBateadores / nBateadoresValidos;

  if (!Number.isFinite(wobaEsperadoEquipo)) {
    salida.nota = "WOBA_ESPERADO_INVALIDO";
    return salida;
  }

  const factor = wobaEsperadoEquipo / ligaRef;

  if (!Number.isFinite(factor) || factor <= 0) {
    salida.nota = "FACTOR_INVALIDO";
    return salida;
  }

  salida.woba_esperado =
    Math.round(wobaEsperadoEquipo * 1000) / 1000;

  salida.bateadores_usados = nBateadoresValidos;
  salida.factor = Math.round(factor * 1000) / 1000;
  salida.confirmado = nBateadoresValidos >= 5;

  salida.nota = salida.confirmado
    ? "OK"
    : "MUESTRA_PARCIAL_" +
      nBateadoresValidos +
      "_DE_" +
      lineupRival.length;

  return salida;
}

var _wobaLigaCache = undefined;

function calcularWobaLigaPromedio() {
  if (_wobaLigaCache !== undefined) {
    return _wobaLigaCache;
  }

  if (typeof BATTERS_VSPITCH_2026 === "undefined") {
    _wobaLigaCache = null;
    return null;
  }

  let sumaWoba = 0;
  let nMuestras = 0;

  const ids = Object.keys(BATTERS_VSPITCH_2026);

  for (let i = 0; i < ids.length; i++) {
    const registro = BATTERS_VSPITCH_2026[ids[i]];
    const vs = registro && registro.vs;

    if (!vs) continue;

    const pitches = Object.keys(vs);

    for (let j = 0; j < pitches.length; j++) {
      const stat = vs[pitches[j]];

      if (!stat) continue;

      const woba = Number(stat.woba);
      const pa = Number(stat.pa);

      if (!Number.isFinite(woba)) continue;
      if (!Number.isFinite(pa) || pa < 5) continue;

      sumaWoba += woba;
      nMuestras++;
    }
  }

  _wobaLigaCache =
    nMuestras > 0
      ? sumaWoba / nMuestras
      : null;

  return _wobaLigaCache;
}
