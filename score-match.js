// score-match.js
//
// RUTA: Fórmula de coincidencia climática (Pieza de score). Se ubica entre
//   estadios.js (para el interruptor de domo fijo y resolución de mismo
//   parque) y calcular-coincidencia.js (que la invoca por cada registro
//   histórico candidato).
//
// RECIBE DE: estadios.js (stadiumGet, STADIUM_INDEX, stadiumNorm,
//   stadiumCanonName) para resolver roof y confirmar mismo parque; recibe
//   como parámetros los objetos "today" y "h" con los campos climáticos ya
//   adaptados (temperature_f, windspeed_mph, humidity_pct,
//   precipitation_mm, wind_dir, venueName).
//
// ENTREGA A: calcular-coincidencia.js (scoreMatch()), y transitivamente
//   Coincidencia, index.html, Over/Under.
//
// NO TOCA: clima-cache.js, jalar-clima.js, K6, F5, Moneyline. No hace
//   fetch, no escribe caché ni Data Madre.
//
// REGLA MADRE: La fórmula mantiene los pesos RELATIVOS originales de la
//   Caja de Pandora (30 temperatura / 25 viento / 20 humedad / 10
//   precipitación / 10 dirección de viento), pero el score final se
//   NORMALIZA sobre la suma de los pesos aplicables a ese cálculo en
//   concreto, para que el máximo posible siga siendo 100 sin importar
//   cuántos factores apliquen. Temperatura, humedad y precipitación son
//   SIEMPRE requeridas. Viento (velocidad) es requerido solo si el parque
//   NO es domo fijo — en domo fijo no se exige viento ni dirección, y
//   ambos quedan fuera tanto del numerador como del denominador (no se
//   penaliza el domo fijo por no tener viento exterior). La dirección del
//   viento es siempre opcional/bono: solo suma si ambos registros son del
//   mismo parque canónico y ambas direcciones son números finitos, y se
//   normaliza a rango 0–359 antes de calcular la diferencia (720 y 0 son
//   el mismo grado real, diferencia 0°).
//
//   Si "today" o "h" no son objetos, o falta cualquier dato REQUERIDO
//   (según la regla anterior), la función devuelve null — NUNCA 0 y NUNCA
//   lanza una excepción. null significa SCORE_SIN_DATOS: "no se pudo
//   comparar", no "coincidencia mínima". Es responsabilidad de
//   calcular-coincidencia.js tratar null igual que cualquier score no
//   finito (ya lo hace: no entra al ranking, y si todos los registros
//   devuelven null, el estado final es SCORE_SIN_DATOS).
//
//   La validación de campos requeridos usa exclusivamente
//   `typeof valor === "number" && Number.isFinite(valor)` — nunca
//   `Number(valor)`, porque Number("") y Number(null) dan 0 y un dato
//   vacío/nulo se colaría como si fuera un dato real de 0. La misma
//   validación estricta aplica también al bono de dirección de viento
//   (wind_dir), que además normaliza a rango 0–359 antes de comparar.
//
// DEPENDENCIAS OBLIGATORIAS: stadiumGet() y stadiumCanonName() son
//   verdaderamente opcionales/tolerantes — si no existen, la función usa
//   un fallback (STADIUM_INDEX directo, o nombres sin canonizar) y sigue
//   calculando con normalidad. stadiumNorm() NO es opcional en ese mismo
//   sentido: si hace falta resolver o comparar un parque (porque hay
//   venueName presente) y stadiumNorm() no existe como función, la
//   función NO lanza excepción — devuelve null (SCORE_SIN_DATOS) de
//   inmediato, en vez de continuar con un cálculo que no puede confirmar
//   parque ni domo fijo de forma segura. Si no hay venueName en juego,
//   stadiumNorm() nunca se invoca y esto no aplica.
//
// SALIDA: un número entre 0 y 100 (Math.round, ya normalizado sobre los
//   pesos aplicables), o null si "today"/"h" no son objetos válidos, si
//   falta algún dato climático requerido, o si hace falta stadiumNorm()
//   para resolver/comparar parque y no está disponible (SCORE_SIN_DATOS
//   en los tres casos).
//
// SI ESTE ARCHIVO FALLA: calcular-coincidencia.js no puede calcular ningún
//   score real (todos los registros quedarían con score inválido, ya
//   cubierto por su try/catch y su filtro de score numérico finito, y
//   termina en su estado SCORE_SIN_DATOS), y Coincidencia/index.html/
//   Over-Under se quedan sin pick climático para el juego de hoy.
//
// HISTORIAL: fórmula base con pesos 30/25/20/10/10 (Caja de Pandora);
//   interruptor de domo fijo (Pieza 1); validación de campos numéricos con
//   salida 0 cuando faltaba un dato (5 jul, versión previa); falta de dato
//   requerido devuelve null en vez de 0, domo fijo ya no exige viento ni
//   dirección, score normalizado sobre pesos aplicables (11 jul, primera
//   pasada); validación de requeridos con typeof+Number.isFinite en vez de
//   Number(valor), wind_dir normalizado a 0–359 antes de diferencia,
//   validación de "today"/"h" como objetos al inicio (11 jul, segunda
//   pasada); el bono de dirección de viento usa la misma validación
//   estricta que los requeridos (11 jul, auditoría final); CORREGIDO 11
//   jul 2026 (consistencia de dependencias): el prólogo decía que
//   stadiumNorm() era una dependencia tolerada, pero el código la invocaba
//   sin guardia y podía lanzar excepción si estadios.js no estaba
//   cargado. Ahora ambos puntos donde se llama stadiumNorm() (resolución
//   de domo vía STADIUM_INDEX, y comparación de mismo parque para el bono
//   de dirección) verifican typeof stadiumNorm === "function" primero; si
//   falta, la función devuelve null (SCORE_SIN_DATOS) sin lanzar
//   excepción. stadiumGet() y stadiumCanonName() siguen exactamente igual
//   que antes.

function scoreMatch(today, h) {
  // Validación de entrada: si falta cualquiera de los dos objetos, no hay
  // nada que comparar. Nunca se lanza excepción por esto.
  if (!today || typeof today !== "object" || !h || typeof h !== "object") {
    return null;
  }

  // Interruptor de domo fijo (lee roof de estadios.js, ya cargado antes).
  // Se calcula ANTES de validar campos requeridos, porque determina si el
  // viento es o no un dato requerido.
  let vientoCuenta = true;
  if (today.venueName) {
    let s = null;
    if (typeof stadiumGet === "function") {
      s = stadiumGet(today.venueName);
    } else if (typeof STADIUM_INDEX !== "undefined") {
      if (typeof stadiumNorm !== "function") {
        return null; // SCORE_SIN_DATOS: sin stadiumNorm no se puede resolver el parque de forma segura.
      }
      s = STADIUM_INDEX.get(stadiumNorm(today.venueName));
    }
    if (s && s.roof === "fixed_dome") {
      vientoCuenta = false;
    }
  }

  // Campos SIEMPRE requeridos: temperatura, humedad, precipitación.
  // Viento (velocidad) requerido solo si el parque NO es domo fijo.
  // Validación estricta: typeof + Number.isFinite, NUNCA Number(valor)
  // (Number("") === 0 y Number(null) === 0 colarian datos vacios como
  // si fueran un 0 real).
  const requeridosOk =
    typeof today.temperature_f === "number" && Number.isFinite(today.temperature_f) &&
    typeof h.temperature_f === "number" && Number.isFinite(h.temperature_f) &&
    typeof today.humidity_pct === "number" && Number.isFinite(today.humidity_pct) &&
    typeof h.humidity_pct === "number" && Number.isFinite(h.humidity_pct) &&
    typeof today.precipitation_mm === "number" && Number.isFinite(today.precipitation_mm) &&
    typeof h.precipitation_mm === "number" && Number.isFinite(h.precipitation_mm) &&
    (
      !vientoCuenta ||
      (
        typeof today.windspeed_mph === "number" && Number.isFinite(today.windspeed_mph) &&
        typeof h.windspeed_mph === "number" && Number.isFinite(h.windspeed_mph)
      )
    );

  if (!requeridosOk) {
    return null; // SCORE_SIN_DATOS: no se pudo comparar, no es 0.
  }

  const W_TEMP = 30;
  const W_WIND = 25;
  const W_HUM = 20;
  const W_PRECIP = 10;
  const W_DIR = 10;

  let earned = 0;
  let applicableMax = 0;

  const tempDiff = Math.abs(today.temperature_f - h.temperature_f);
  earned += Math.max(0, W_TEMP - tempDiff);
  applicableMax += W_TEMP;

  const humDiff = Math.abs(today.humidity_pct - h.humidity_pct);
  earned += Math.max(0, W_HUM - (humDiff / 3));
  applicableMax += W_HUM;

  const precipDiff = Math.abs(today.precipitation_mm - h.precipitation_mm);
  earned += Math.max(0, W_PRECIP - (precipDiff * 10));
  applicableMax += W_PRECIP;

  // Viento: no aplica en domo fijo (ni suma a earned ni a applicableMax).
  if (vientoCuenta) {
    const windDiff = Math.abs(today.windspeed_mph - h.windspeed_mph);
    earned += Math.max(0, W_WIND - (windDiff * 2));
    applicableMax += W_WIND;

    // direccion del viento: solo bono si es el MISMO parque y ambas
    // direcciones son numericas finitas. Nunca requerido.
    if (today.venueName && h.venueName) {
      let todayVenue = today.venueName;
      let histVenue = h.venueName;

      if (typeof stadiumCanonName === "function") {
        todayVenue = stadiumCanonName(todayVenue);
        histVenue = stadiumCanonName(histVenue);
      }

      if (typeof stadiumNorm !== "function") {
        return null; // SCORE_SIN_DATOS: sin stadiumNorm no se puede confirmar mismo parque de forma segura.
      }

      if (stadiumNorm(todayVenue) === stadiumNorm(histVenue)) {
        const tdOk = typeof today.wind_dir === "number" && Number.isFinite(today.wind_dir);
        const hdOk = typeof h.wind_dir === "number" && Number.isFinite(h.wind_dir);
        if (tdOk && hdOk) {
          // Normalizar a rango 0-359 ANTES de calcular diferencia.
          // Sin esto, valores fuera de 0-359 (ej. 720) podian producir
          // diferencias negativas o infladas y sumar de mas.
          const td = ((today.wind_dir % 360) + 360) % 360;
          const hd = ((h.wind_dir % 360) + 360) % 360;
          let dd = Math.abs(td - hd);
          if (dd > 180) dd = 360 - dd;
          earned += Math.max(0, W_DIR - (dd / 18));
          applicableMax += W_DIR;
        }
      }
    }
  }

  // Salvaguarda: si por alguna razon no quedo ningun peso aplicable
  // (no deberia pasar, ya que temp/hum/precip siempre suman), no dividir
  // entre 0 y devolver SCORE_SIN_DATOS en vez de NaN.
  if (applicableMax <= 0) {
    return null;
  }

  const normalizado = (earned / applicableMax) * 100;

  return Math.max(0, Math.min(100, Math.round(normalizado)));
}
