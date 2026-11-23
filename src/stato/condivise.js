// stato/condivise.js: variabili condivise tra moduli (fase A, PROVVISORIO).
// Un modulo ES non può riassegnare un nome importato: le variabili che nello script unico erano assegnate da parti
// diverse del codice sono campi di G (G.queue, G.settings, ...). Si inizializzano nelle avvio() dei moduli dove erano
// dichiarate, nello stesso ordine di prima. La fase D (stato unico) le sostituisce con lo stato vero della partita.
// Campi: allCards, cancelDraftsBtn, cardsById, collection, currentIndex, deck, deckSetup, deckSlider, discard, focusSignature, graveLife, maxTierDrawn, nemeses, nemesisArt, nemesisLife, newIndex, nextUid, products, queue, resolving, settings, startOptions, stats, testRun, turn, turnOrder, undoStack, victoryKey
export const G = {};
