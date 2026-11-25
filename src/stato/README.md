# src/stato/

Lo stato dell'app, diviso in tre pezzi con un solo compito ciascuno (lo stato dell'interfaccia sta in `ui/`).
Livello 1: importa da `tipi/` e `regole/`, mai da `ui/`.

## File
- `catalogo.ts`: `catalogo` (sola lettura): `allCards`, `cardsById`, `deckSetup`, `nemeses`, `products`, `nemesisArt`,
  `startOptions`. Lo riempie `caricaCatalogo` all'avvio; la pagina Nuova partita cambia le sue scelte con `impostaSceltePagina`.
- `preferenze.ts`: `preferenze`: `collection` (codici prodotto), `settings` (`players`, `nemesis`, `battleMode`,
  `mergeCollection`), opzioni del mazzo, carte 1/2 e 3/4 (`aeonsend-app-0.2-turn-pairs`) e lingua (`lingua()`, `setLingua()`,
  `linguaDelBrowser`). Salvate nel browser; `settings` anche nel salvataggio.
- `partita.ts`: `partita` (sola lettura): `queue`, `deck`, `discard`, `turn`, `resolving`, `currentIndex`, `newIndex`,
  `maxTierDrawn`, `graveLife`, `nemesisLife`, `stats`, `turnOrder`, `nextUid`, `undoStack`, `testRun`. **Solo le sue funzioni
  la cambiano.** Contiene le azioni, l'undo e il collegamento con le regole.
- `salvataggio.ts`: la partita nel browser (`scriviPartita`, lettura); `statoSalvataggio.gameSaved` dice se è già scritta.

## Il giro di un'azione
`act`: fotografia per l'undo → modifica (le regole) → salvataggio → ridisegno (lo fa la schermata che ha chiamato l'azione,
subito dopo, perché prima prepara le animazioni). **Un'azione = un passo di undo** (al massimo `UNDO_LIMIT` = 300). Azioni:
`pescaCartaTurno`, `fineTurnoGiocatore`, `scegliGiocatoreCoppia`, `pescaCarta`, `risolviCarta`, `cambiaVita`,
`cambiaVitaMinion`, `salvaModifiche`, `scartaCimaDelMazzo`. Eccezioni dichiarate: la schermata del mazzo dei turni
(`applicaBozzaTurni` senza undo a ogni modifica, `aggiungiPassoUndo` un passo alla chiusura) e la fine della partita
(`segnaFinePartita`: ora di fine, senza undo).
`pescaCarta`, `risolviCarta` e `cambiaVitaMinion` (minion a 0 nel turno nemesi) chiudono il turno nemesi quando era l'ultima carta e,
nello stesso passo di undo, chiamano `afterNemesisTurn` (la carta turno dopo). Il passo Pesca si riprende con Undo e ripresa
(`restoreGame`).

## Partita da zero e ripristino
- `campiDaZero()` è l'unico punto che costruisce una partita vuota. `nuovaPartita()` (Nuova partita, Ricomincia, cambio dei
  giocatori in "Crea mazzo", avvio) = da zero + vite + mazzo nuovo. `applicaRipristino()` (ripresa, undo, scenari) = da zero +
  fotografia (prima `preparaRipristino()` legge le carte senza cambiare niente). `esciDalTest()` = scelte di prima + da zero.
- `nextUid` non riparte mai: le carte della partita di prima ancora nella pagina non si confondono con le nuove.

## Salvataggio e browser
- Chiavi `localStorage` (diverse da quelle della v1, il dominio github.io è condiviso): `aeonsend-app-0.2-save`, `-collection`,
  `-background`, `-card-back`, `-deck-options`, `-gravehold-bg` (`city` | `tower`), `-turn-pairs`, `-language`, `-regolazioni`.
- La partita si salva da sola, con la cronologia dell'undo, **solo dal primo turno nemesi** (`save()` non scrive con `turn < 1`,
  salvo che sia già stata salvata); in "Crea mazzo" non si salva niente. Il formato ha `version` (`SAVE_VERSION`): un salvataggio
  di un'altra versione si cancella senza errori. Con un test in corso (`testRun`) `save()` non scrive niente.
- Un campo nuovo della partita: va in snapshot, ripristino, salvataggio e undo (vedi `tipi/salvataggio.ts`).

## Da sapere prima di modificare
- `npm run check` controlla che fuori da `stato/partita.ts` nessuno assegni un campo della partita (anche annidato), cambi
  un suo elenco o la passi a una regola che la modifica; TypeScript lo impedisce già per i campi diretti (`Readonly`).
  L'unica eccezione sono i setter di `window.app`.
- Prova: `tests/partita.test.ts` (stesso caso = stesso stato, un'azione = un passo di undo, salvataggio → ripresa = stesso stato).
