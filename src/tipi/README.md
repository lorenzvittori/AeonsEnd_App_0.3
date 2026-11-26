# src/tipi/

Il contratto comune dei dati: tipi di `cards_nemesis.json` e degli altri JSON, della partita in corso e del salvataggio.
Livello 0: non importa da niente (solo altri file di `tipi/`). Lo usano `regole/`, `stato/`, `dati/` e `ui/` (con `import type`).

## File
- `dati.ts`: i JSON di `public/`: `Carta` (cards_nemesis.json; `Categoria` = Basic | Upgraded | Specific, `TipoCarta`,
  `Tier` = numero | '9+' | null, `thumb` aggiunta al caricamento), `Nemesi`, `Prodotti` (`CodiceProdotto`), `DeckSetup`,
  `ArteNemesi` (`Assets/nemesis/nemesis-art.json`), `DatiRegole` (carte, nemesi e Deck Setup passati alle regole).
- `partita.ts`: lo stato di gioco: `VoceInGioco` (carta in coda: uid, tokens, hp, turnHp, paid, isNew, bornTurn, hpSet,
  hpMax...), `MazzoTurni` (left, drawn, round, wild, picks, pairNext, history, known, waiting) e la sua bozza `BozzaTurni`,
  `Statistiche`, `Impostazioni`, `Partita` (i campi di gioco), `StatoPartita` (più `nextUid`, `undoStack`, `testRun`),
  `ProvaInCorso` (Modalità test).
- `salvataggio.ts`: il formato scritto oggi (`Fotografia`, `Salvataggio`) e quelli letti, anche vecchi, con i campi che
  possono mancare (`FotografiaLetta`, `SalvataggioLetto`, `SalvataggioValido`).

## Da sapere prima di modificare
- Quando un dato cambia si cambia **prima il tipo** e si segue il compilatore (`tsc`). Ogni campo ha un commento di una
  riga; i valori ammessi sono unioni di stringhe.
- Un campo nuovo di un salvataggio è **facoltativo** in `FotografiaLetta` (i salvataggi di prima non lo hanno): chi legge
  (`regole/salvataggio.ts`) mette un valore di partenza. Si cambia `SAVE_VERSION` solo se i vecchi non si possono più leggere.
- Altri tipi stanno vicino a chi li usa: `Catalogo` (`stato/catalogo.ts`), `Preferenze` (`stato/preferenze.ts`), gli elementi
  della pagina e lo stato dell'interfaccia (`ui/pagina.ts`), le opzioni delle funzioni delle regole.
- Elementi del DOM: `byId(id, HTMLButtonElement)` (`ui/pagina.ts`) e `query()` / `queryAll()` (`ui/dom.ts`) controllano il tipo
  con `instanceof`; `need(valore, cosa)` per un elemento che c'è sempre (errore chiaro se manca).
- Il controllo dei JSON all'avvio (`dati/controllo.ts`) deve restare d'accordo con `dati.ts`; `tests/dati-json.test.ts` lo prova
  sui veri `public/*.json`.
