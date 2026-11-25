# 11 · Glossario

**Cosa trovi qui.** Una tabella che mette in fila, per ogni parola del gioco, come si chiama nell'app (in italiano e in inglese), come si
chiama nel codice e dove si trova. Serve a tradurre tra quello che si dice al tavolo e quello che si legge nel codice.

## Come leggere la tabella

- **Parola del gioco**: come la dice chi gioca.
- **Nell'app (IT / EN)**: la scritta che compare sullo schermo nelle due lingue (se non c'è una scritta dedicata, il trattino).
- **Nome nel codice**: il nome di un campo, una funzione o un valore. I nomi del codice sono in **italiano e inglese mescolati**: le parti
  più vecchie sono in inglese (`queue`, `resolving`, `turnOrder`), le più nuove in italiano (`partita`, `richiediRidisegno`).
- **Dove sta**: il file principale, scritto come nei README (`stato/partita.ts` vuol dire `src/stato/partita.ts`).

## Il gioco: carte, mazzi, turni

| Parola del gioco | Nell'app (IT / EN) | Nome nel codice | Dove sta |
|---|---|---|---|
| coda (le carte nemesi in gioco) | Coda in gioco / Cards in play | `queue` (campo della partita); un elemento è una `VoceInGioco` | `tipi/partita.ts`, `stato/partita.ts` |
| mazzo nemesi | Mazzo nemesi / Nemesis deck | `deck` (si pesca dalla fine) | `stato/partita.ts`, `regole/mazzo-nemesi.ts` (`buildDeck()`) |
| scarti nemesi | Scarti · n / Discards · n | `discard` | `stato/partita.ts`, `ui/componenti/scarti.ts` |
| turno dei giocatori | Turno dei giocatori / Players' turn | `resolving` falso; momento `giocatori`; `data-turno="giocatori"`; schermata `turno-giocatori` | `ui/partita-variante.ts`, `ui/schermate/turno-giocatori.ts` |
| turno nemesi | Nemesi / Nemesis | `resolving` vero; momento `nemesi`; `nemesisTurn()`; schermata `turno-nemesi` | `regole/turno-nemesi.ts`, `ui/schermate/turno-nemesi.ts` |
| risolvere una carta | Effetto risolto, Vai avanti / Effect resolved | `resolveCurrent()`, `risolviCarta()`; azione `risolvi` | `regole/turno-nemesi.ts`, `stato/partita.ts` |
| carta da risolvere | Risolvi / Resolve | la carta in posizione `currentIndex` della coda | `regole/turno-nemesi.ts` |
| carta mostrata (anteprima) | Torna alla carta da risolvere / Back to the card to resolve | `ui.viewedUid`; azione `torna`; `inAnteprima()` | `ui/pagina.ts`, `ui/partita-variante.ts` |
| pesca (passo del turno nemesi) | Pesca / Draw | `isDrawStep()`, `DRAW_UID` (-1); momento `pesca`; `pescaCarta()` | `regole/turno-nemesi.ts`, `stato/partita.ts` |
| carta appena pescata | Nuova / New | `isNew`, `newIndex`, `ui.lastDrawnUid` | `tipi/partita.ts` |
| mettere in gioco | Metti in gioco · Fine turno nemesi / ... | effetto `play` di `resolveCurrent()` | `regole/turno-nemesi.ts` |
| potere | - | carta con `type` `Power`; token in `tokens` | `tipi/dati.ts` |
| token del potere | token / tokens | `tokens`, `powerTokens` (nella carta) | `tipi/partita.ts` |
| scartare un potere pagando | Rimuovi · costo pagato / Remove · cost paid | `paid`, bozza `{ paid: true }`; costo in Æ: `removalCost`, `aetherCost()` | `ui/schermate/turno-giocatori.ts`, `regole/turno-nemesi.ts` |
| minion | - | carta con `type` `Minion`; vita in `hp` | `tipi/dati.ts` |
| vita di un minion | HP | `hp`, `turnHp` (a inizio turno), `hpMax` | `tipi/partita.ts` |
| vita "?" (minion a vita variabile) | ? / Imposta la vita / Set life | `hpVariable`, `hpSet`, `hpUnset()`, `isVariableMinion()` | `regole/turno-nemesi.ts` |
| attacco | - | carta con `type` `Attack`; negli scarti appena risolto | `tipi/dati.ts` |
| Tier | Tier 1, 2, 3 | `tier` (nella carta), `maxTierDrawn`; banner `ui.tierBanner` | `tipi/dati.ts`, `ui/componenti/banner.ts` |
| carte Base / Potenziate / Specifiche | Base, Potenziate, Specifiche / Basic, Upgraded, Specific | `category`: `Basic`, `Upgraded`, `Specific` | `tipi/dati.ts` |
| vita di Gravehold | Gravehold | `graveLife` (parte da `GRAVEHOLD_LIFE` = 30) | `regole/vite.ts` |
| vita della nemesi | Nemesi / Nemesis | `nemesisLife` (da `life` in `nemesis.json`) | `regole/vite.ts` |
| Vittoria / Sconfitta | Vittoria, Sconfitta / Victory, Defeat | `isVictory()`, `lifeOutcome()`, `showVictory()`, `showDefeat()` | `regole/turno-nemesi.ts`, `ui/finestre/statistiche.ts` |

## Il mazzo dei turni

| Parola del gioco | Nell'app (IT / EN) | Nome nel codice | Dove sta |
|---|---|---|---|
| mazzo dei turni | Mazzo dei turni / Turn order deck | `turnOrder` (tipo `MazzoTurni`); schermata `mazzo-turni` | `tipi/partita.ts`, `ui/schermate/mazzo-turni.ts` |
| carte nel mazzo dei turni | Mazzo turno / Turn deck | `turnOrder.left` (`left[0]` = cima) | `regole/mazzo-turni.ts` |
| scarti dei turni | Scarti / Discards | `turnOrder.drawn` | `regole/mazzo-turni.ts` |
| giro (del mazzo dei turni) | Turno N / Turn N (nella testata) | `turnOrder.round`; fine giro: `turnRoundOver()` | `regole/mazzo-turni.ts` |
| rimescolare a fine giro | Fine turno · Mischia mazzo / End turn · Shuffle deck | `shuffleTurnOrder()`, `nextTurnCard()` | `regole/mazzo-turni.ts`, `stato/partita.ts` |
| pescare la carta turno | Pesca carta turno / Draw turn card | `drawTurnCard()`, `pescaCartaTurno()`; azione `pesca-carta-turno`; `awaitingTurnCard()` | `regole/mazzo-turni.ts`, `stato/partita.ts` |
| fine turno di un giocatore | Fine turno · Pesca ordine turno / End turn · Draw turn card | `endPlayerTurn()`, `fineTurnoGiocatore()`; azione `fine-turno` | `stato/partita.ts` |
| storia del giro | (la barra dei turni) | `turnOrder.history`, tipo `TurnoStoria` | `tipi/partita.ts` |
| carta rivelata / nota | occhio, Rivela tutto / Copri tutto | `turnOrder.known` | `regole/mazzo-turni.ts` |
| Wild | Wild | carta `wild`; `turnOrder.wild` (giocatore 1-3) | `regole/mazzo-turni.ts` |
| carte 1/2 e 3/4 | Carte turno 1/2 e 3/4 / ... | carte `p12`, `p34`; memoria `pairNext`; `picks`; `isPairCard()` | `regole/mazzo-turni.ts` |
| scelta del giocatore di una carta 1/2 o 3/4 | Chi gioca questo turno? | `choosePairPlayer()`, `scegliGiocatoreCoppia()`, `needsPairChoice()` | `regole/mazzo-turni.ts`, `ui/componenti/barra-turni.ts` |
| barra dei turni | (zona 2) | `#fascia-turno`, `renderTurnTrack()` | `ui/componenti/barra-turni.ts` |

## Le modifiche, l'Undo, il salvataggio

| Parola del gioco | Nell'app (IT / EN) | Nome nel codice | Dove sta |
|---|---|---|---|
| modifiche non ancora salvate | Salva modifiche, Annulla modifiche / Save changes, Cancel changes | bozze: `ui.drafts` (una `BozzaCarta` per carta); azione `salva-modifiche`; `saveAllDrafts()` | `ui/pagina.ts`, `ui/schermate/turno-giocatori.ts` |
| annullare l'ultima azione | Azione annullata | Undo: `undo()`, `undoStack`, `pushUndo()`; `UNDO_LIMIT` = 300 | `ui/componenti/ripristino.ts`, `stato/partita.ts` |
| fare un'azione (con Undo e salvataggio) | - | `act()` | `stato/partita.ts` |
| partita salvata | Riprendi partita / Resume game | `save()`, `readSave()`, chiave `aeonsend-app-0.2-save` | `stato/salvataggio.ts` |
| fotografia della partita | - | `snapshot()`, tipo `Fotografia` | `regole/salvataggio.ts`, `tipi/salvataggio.ts` |
| rimettere una partita come era | - | `restore()`, `restoreGame()`, `applicaRipristino()` | `ui/componenti/ripristino.ts`, `regole/salvataggio.ts` |

## Schermate e interfaccia

| Parola del gioco | Nell'app (IT / EN) | Nome nel codice | Dove sta |
|---|---|---|---|
| nuova partita | Inizia partita / Start game | `startGame()`, `nuovaPartita()` | `ui/navigazione.ts`, `stato/partita.ts` |
| Crea mazzo | Mazzo nemesi / Nemesis deck (titolo della schermata) | `ui.deckBuilding`; momento `crea-mazzo`; `showDeckBuild()` | `ui/schermate/crea-mazzo.ts` |
| menu iniziale | Menu iniziale / Main menu | schermata `menu`; `openStart()`, `setStartMode('home')` | `ui/navigazione.ts`, `ui/schermate/menu.ts` |
| menu laterale | Menu | `openSideMenu()` | `ui/finestre/menu-laterale.ts` |
| collezione | La mia collezione / My collection | `preferenze.collection` (codici prodotto, per esempio `4.1`) | `dati/collezione.ts`, `stato/preferenze.ts` |
| Modalità battaglia | Modalità battaglia / Battle mode | `settings.battleMode` | `stato/preferenze.ts` |
| Unisci le carte della collezione | Unisci le carte della collezione / Merge collection cards | `settings.mergeCollection` | `stato/preferenze.ts` |
| Modalità test | Modalità test | `testRun`, `SCENARI`, `startScenario()` | `ui/finestre/test.ts` |
| Regolazioni | Regolazioni | il pannello Regolazioni, `REGOLAZIONI_KEY` | `ui/finestre/test-regolazioni.ts` |
| le sette zone della partita | - | `data-zona`: `testata`, `turno`, `carte-piccole`, `vite`, `carte-grandi`, `interattivi`, `principale` | `index.html`, `ui/schermate/partita.css` |
| momento della partita | - | `data-turno`: `giocatori`, `nemesi`, `pesca`, `crea-mazzo`; `variantePartita()` | `ui/partita-variante.ts` |
| il pulsante in basso | (il testo cambia) | `#pulsante-principale`, `data-azione` | `ui/componenti/pulsante-principale.ts` |
| fascia delle carte piccole | Coda in gioco / Cards in play | `#rail`, `.ae-compact-rail` | `ui/schermate/turno-giocatori.ts` |
| carosello (carte grandi del turno nemesi) | Coda della nemesi / Nemesis queue | `#focus`, `renderFocus()` | `ui/schermate/turno-nemesi-carosello.ts` |
| comandi sotto la carta al centro | −5, −1, +1 | zona 6, `#interattivi`, `cardControls()` | `ui/schermate/turno-giocatori.ts` |
| lingua | Lingua / Language | `lingua()`, `T`, chiave `aeonsend-app-0.2-language` | `stato/preferenze.ts`, `ui/testi.ts` |
| un testo dell'app | - | `T.chiave`, `data-testo` | `ui/testi-it.ts`, `ui/testi-en.ts` |
| ridisegnare | - | `render()`; aggancio `richiediRidisegno()` | `ui/navigazione.ts`, `ui/ridisegno.ts` |

## Parole del codice senza un corrispondente nel gioco

| Parola | Cosa vuol dire | Dove approfondire |
|---|---|---|
| modulo | un file `.ts` con funzioni e valori pronti da usare | [03](03-architettura.md) |
| livello | un numero da 0 a 8: chi sta più in alto può usare chi sta più in basso | [03](03-architettura.md) |
| aggancio | una funzione di `ui/ridisegno.ts` con cui un livello basso chiede qualcosa a un livello alto | [03](03-architettura.md) |
| stato | l'insieme dei dati che descrivono la partita adesso | [05](05-stato-e-salvataggio.md) |
| render | ridisegnare le zone dello schermo a partire dallo stato | [04](04-un-tocco.md) |
| funzione pura | una funzione che con gli stessi argomenti dà sempre lo stesso risultato e non tocca niente fuori da sé | [03](03-architettura.md) |
| build | la costruzione del sito finito in `dist/` | [01](01-il-progetto.md) |
| tag | un'etichetta fissa su un punto della storia del codice, per poterci tornare | [10](10-strumenti.md) |
| test | un controllo automatico di una parte della logica | [10](10-strumenti.md) |
| service worker | il programma del browser che permette all'app di funzionare senza rete | [01](01-il-progetto.md) |

## Per approfondire

- Prima: [10 · Gli strumenti](10-strumenti.md). Tutta la documentazione parte da [00 · Da dove partire](00-leggimi.md).
- La terminologia concordata con l'utente è anche in [CONTESTO_SVILUPPO.md](../CONTESTO_SVILUPPO.md) (sezione 5).
- I nomi dei campi con il loro significato: [05 · Stato e salvataggio](05-stato-e-salvataggio.md).
