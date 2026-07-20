function _f5MlLeerCache(llave) {
  /*
    Primero busca el histórico cargado como variable global por su archivo JS.
    Ejemplos:
      window.F5_HISTORICO_CARRERAJE_2026
      window.F5_HISTORICO_LINEUP_2026
  */
  try {
    if (
      typeof globalThis !== "undefined" &&
      Array.isArray(globalThis[llave])
    ) {
      return globalThis[llave];
    }
  } catch (eGlobal) {}

  /*
    Respaldo: permite leerlo desde localStorage si alguna herramienta
    histórica lo guardó allí.
  */
  try {
    var raw = localStorage.getItem(llave);

    if (!raw) return [];

    var dato = JSON.parse(raw);

    if (Array.isArray(dato)) {
      return dato;
    }

    /*
      Compatibilidad por si la caché viene envuelta:
        { juegos: [...] }
        { registros: [...] }
        { data: [...] }
    */
    if (dato && Array.isArray(dato.juegos)) {
      return dato.juegos;
    }

    if (dato && Array.isArray(dato.registros)) {
      return dato.registros;
    }

    if (dato && Array.isArray(dato.data)) {
      return dato.data;
    }

    return [];
  } catch (e) {
    return [];
  }
}
