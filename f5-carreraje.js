/*
  MLBPro · f5-carreraje.js

  FUNCIÓN:
  Traduce el dominio del pitcher (cruce arsenal-vs-lineup, woba_esperado)
  a un estado de Carreraje F5 (línea 0.5). F5 = solo pitcher, el bullpen
  NO entra aquí (Regla Madre). NO proyecta un número de carreras: solo
  clasifica el dominio del pitcher (DOMINA / PAREJO / LE_PEGAN) y deja
  explícito que traducir eso a una proyección numérica real contra la
  línea requiere backtest — que ya se corrió tres veces (ver CIERRE DE
  RAMA abajo) y en las tres veces no alcanzó.

  ENTRADAS:
  cruceArsenal (objeto de calcularFactorArsenalLineup(): {estado, woba_esperado, ...})
  lineaCarreraje (number, opcional, default 0.5)

  SALIDAS / MODIFICACIONES:
  Devuelve { pieza, estado, linea, dominioPitcher?, wobaEsperado?, proyeccionNumerica?, detalle }.
  estado puede ser: "SIN_DATOS" (falta cruce o woba_esperado real),
  "PENDIENTE" (lineup rival no confirmado), o "DOMINIO_CALCULADO"
  (dominio real calculado; incluye proyeccionNumerica: "NO_VALIDADA"
  porque no hay fórmula numérica calibrada todavía).
  No escribe ninguna caché ni localStorage.

  DEPENDENCIAS:
  Ninguna función externa. Recibe cruceArsenal ya calculado por quien lo
  llama (f5-automatico.js, vía calcularFactorArsenalLineup()).

  NO TOCA:
  factor-arsenal-lineup.js, f5-automatico.js, f5-moneyline.js, clima,
  K6, brújula, jalar-lineup.js, mercado. No lee ni escribe ninguna caché.

  UTC / HORA LOCAL DEL ESTADIO:
  No aplica — no usa horarios ni timezone.

  CIERRE DE RAMA F5 — EVIDENCIA REAL DE BACKTEST (12 jul 2026):
  Antes de escribir cualquier fórmula aquí, se corrieron tres backtests
  reales sobre 1,427 juegos históricos confirmados (carreras reales de F5
  + lineup real + pitchers reales, capturados por f5-historico-carreraje.js
  y f5-historico-lineup.js):
    1) woba_esperado solo   → R² = 0.0026 (sobre 2,834 muestras)
    2) xERA solo            → R² = 0.0310 (sobre 2,683 muestras)
    3) woba_esperado + xERA combinados → R² = 0.0338 (sobre 2,668
       muestras — recalculado wOBA-solo=0.0020 y xERA-solo=0.0317 sobre
       ESTE MISMO conjunto, comparación limpia, no contra corridas con
       otro tamaño de muestra)
  Ninguna de las tres alcanza un R² que justifique publicar una fórmula
  de proyección numérica (RMSE ~2.3 carreras de error típico, sobre un
  rango de 0 a 16 carreras reales — demasiado grande para confiar). Por
  eso este archivo SIGUE devolviendo "DOMINIO_CALCULADO" con el dominio
  cualitativo (DOMINA/PAREJO/LE_PEGAN) y proyeccionNumerica: "NO_VALIDADA",
  tal como ya hacía bajo el nombre anterior. No se escribió ningún
  coeficiente ni proyección numérica — la evidencia real dice que no
  corresponde todavía. Los archivos de las tres pruebas
  (f5-calibracion-carreraje.js, f5-calibracion-xera.js,
  f5-calibracion-combinado.js) quedan como constancia de esa evidencia.

  ESTADO:
  CONFIRMADO — la lógica no cambió (cero modificaciones de cálculo, cero
  cambios de umbral). Corrección aplicada: el estado que antes se llamaba
  "PENDIENTE POR ACCESO" se renombró a "DOMINIO_CALCULADO" porque el
  acceso y el cálculo ya habían ocurrido — el nombre anterior contradecía
  la propia evidencia del archivo. Se agregó el campo explícito
  proyeccionNumerica: "NO_VALIDADA" para separar "ya sé el dominio" de
  "no tengo número validado contra la línea".

  FECHA:
  20 jul 2026 (corrección de nombre de estado; cálculo sin cambios desde
  12 jul 2026).
*/

// f5-carreraje.js — MLBPro F5 · Carreraje (línea 0.5)
// Conecta el dominio del pitcher (perfil + cruce vs lineup) con el Carreraje F5.
// F5 = solo pitcher, bullpen NO entra aquí (regla madre).
// La línea de Carreraje en F5 es 0.5 (media carrera), no 1.5.
//
// Esta pieza NO inventa un número de carreras proyectadas todavía.
// Reporta el estado de dominio del pitcher (mismo criterio que ya existe
// en cruce-arsenal.js / viento-pitcher-test.html: woba_esperado del cruce).
// Ya se ejecutaron tres backtests reales (woba solo, xERA solo, combinado)
// y ninguno alcanzó calidad suficiente (ver CIERRE DE RAMA F5 arriba) —
// por eso el dominio calculado va marcado con proyeccionNumerica: "NO_VALIDADA",
// con evidencia real, no por falta de haber probado.
function f5Carreraje(cruceArsenal, lineaCarreraje) {
  const LINEA_DEFECTO = 0.5;
  const linea = (lineaCarreraje !== undefined && lineaCarreraje !== null) ? lineaCarreraje : LINEA_DEFECTO;

  if (!cruceArsenal || cruceArsenal.estado === "NO_CONFIRMADO") {
    return {
      pieza: "F5_CARRERAJE",
      estado: "SIN_DATOS",
      linea: linea,
      detalle: "Falta el cruce arsenal vs lineup (dato del pitcher rival)."
    };
  }

  if (cruceArsenal.estado === "PENDIENTE") {
    return {
      pieza: "F5_CARRERAJE",
      estado: "PENDIENTE",
      linea: linea,
      detalle: "Lineup rival todavía no confirmado (pendiente por acceso)."
    };
  }

  const woba = cruceArsenal.woba_esperado;
  if (woba === undefined || woba === null || isNaN(woba)) {
    return {
      pieza: "F5_CARRERAJE",
      estado: "SIN_DATOS",
      linea: linea,
      detalle: "El cruce no trae woba_esperado real."
    };
  }

  let dominio;
  if (woba >= 0.340) dominio = "LE_PEGAN";
  else if (woba <= 0.300) dominio = "DOMINA";
  else dominio = "PAREJO";

  return {
    pieza: "F5_CARRERAJE",
    estado: "DOMINIO_CALCULADO",
    linea: linea,
    dominioPitcher: dominio,
    wobaEsperado: woba,
    proyeccionNumerica: "NO_VALIDADA",
    detalle: "Dominio del pitcher: " + dominio + " (woba esperado " + woba.toFixed(3) + "). " +
      "Ya se ejecutaron tres backtests reales (woba solo, xERA solo, woba+xERA combinado) " +
      "sobre 1,427 juegos historicos, y ninguno alcanzo calidad suficiente para traducir esto " +
      "a una proyeccion numerica de carreras contra la linea de " + linea + ". No se inventa el numero."
  };
}

if (typeof module !== "undefined") { module.exports = { f5Carreraje }; }
