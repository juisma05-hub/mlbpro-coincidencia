// Selecciona UNA sola casa por juego.
//
// Revisa DraftKings, FanDuel y BetMGM completas antes de decidir.
// Gana la casa que tenga más mercados F5 válidos:
//   Moneyline + Run Line + Total.
//
// Si dos casas tienen la misma cantidad de mercados válidos, se mantiene
// la prioridad:
//   DraftKings -> FanDuel -> BetMGM.
//
// Nunca mezcla mercados de casas distintas.
function parseMarketsF5(bookmakers, home, away) {
  var orden = [
    "draftkings",
    "fanduel",
    "betmgm"
  ];

  var lista = Array.isArray(bookmakers)
    ? bookmakers
    : [];

  var mejor = null;
  var mejorCantidad = 0;
  var mejorPrioridad = Infinity;

  for (var bo = 0; bo < orden.length; bo++) {
    var bookmakerEncontrado = null;

    for (var b = 0; b < lista.length; b++) {
      if (
        lista[b] &&
        lista[b].key === orden[bo]
      ) {
        bookmakerEncontrado = lista[b];
        break;
      }
    }

    if (!bookmakerEncontrado) {
      continue;
    }

    var extraido = _f5ExtraerDeUnBookmaker(
      bookmakerEncontrado,
      home,
      away
    );

    var cantidad =
      _f5ContarMercadosValidos(extraido);

    if (cantidad === 0) {
      continue;
    }

    /*
      Solo reemplaza la selección anterior cuando trae MÁS mercados.

      Si trae la misma cantidad, no reemplaza, porque la casa elegida antes
      tiene mayor prioridad según el orden:
      DraftKings -> FanDuel -> BetMGM.
    */
    if (
      mejor === null ||
      cantidad > mejorCantidad ||
      (
        cantidad === mejorCantidad &&
        bo < mejorPrioridad
      )
    ) {
      mejor = {
        moneylineF5:
          extraido.moneylineF5,

        runlineF5:
          extraido.runlineF5,

        totalF5:
          extraido.totalF5,

        bookmaker_key:
          bookmakerEncontrado.key,

        bookmaker_title:
          bookmakerEncontrado.title ||
          bookmakerEncontrado.key
      };

      mejorCantidad = cantidad;
      mejorPrioridad = bo;
    }
  }

  if (!mejor) {
    return {
      moneylineF5: null,
      runlineF5: null,
      totalF5: null,
      bookmaker_key: null,
      bookmaker_title: null
    };
  }

  if (mejor.moneylineF5) {
    mejor.moneylineF5.bookie =
      mejor.bookmaker_title;
  }

  if (mejor.runlineF5) {
    mejor.runlineF5.bookie =
      mejor.bookmaker_title;
  }

  if (mejor.totalF5) {
    mejor.totalF5.bookie =
      mejor.bookmaker_title;
  }

  return mejor;
}
