# src/regole/

Le regole del gioco come funzioni pure. Livello 0: importano solo da `regole/` e, come `import type`, da `tipi/`.
Non toccano DOM, `localStorage`, stato, `Math.random` né l'orologio: ricevono tutto come argomenti (il caso come `random`,
l'ora come `now()`, gli uid come `newUid()`) e restituiscono il risultato, oppure modificano solo l'oggetto che ricevono
(lo dice l'intestazione della funzione). `npm run check` lo controlla. Le chiama `stato/partita.ts`, che passa la partita,
`Math.random` e `Date.now`; l'interfaccia le chiama solo per leggere (`isDrawStep`, `canDraw`...).

## File
- `caso.ts`: mescolare e scegliere a caso (tipo `Caso` = la funzione del caso).
- `json.ts`: copie JSON tipizzate (`jsonCopy`), `parseJson` (restituisce `unknown`), `isRecord`.
- `mazzo-nemesi.ts`: Nemesis Deck Setup (`buildDeck`), collezione, Modalità battaglia, Unisci e il suo blocco, mazzo corto,
  nemesi giocabili.
- `mazzo-turni.ts`: mazzo dei turni: carte per numero di giocatori, giri, pesca, wild, coppie 1/2 e 3/4, scarti dei turni,
  storia del giro, bozza della schermata, lettura dei salvataggi vecchi.
- `turno-nemesi.ts`: carte in gioco, risoluzione, pesca, vittoria a mazzo vuoto, statistiche, fine del turno dei giocatori.
- `vite.ts`: vite di Gravehold (`GRAVEHOLD_LIFE` = 30) e della nemesi (`nemesisStartLife`, campo `life` di nemesis.json),
  tetto, Vittoria e Sconfitta a 0.
- `salvataggio.ts`: fotografia (salvataggio e undo), ripristino anche dai formati vecchi, controllo di `SAVE_VERSION`.

## Regole di gioco
- **Mazzo** (`buildDeck`): per ogni Tier 1-3 carte con `inNemesisDeck` e quel `tier`, scelte a caso tra Basic e Upgraded
  dei prodotti della collezione (con "Unisci" spento solo della wave della nemesi: `deckPool`), nel numero della riga di
  `deck-setup.json` (`deckSetupRow`: battaglia della nemesi, o battaglia 1 con "Modalità battaglia" spenta; se le carte
  non bastano il Tier esce più corto, `deckShortfall`), più le Specific della nemesi. Ogni Tier è mescolato a parte, il Tier 1
  in cima. `mergeLockedWave`: con Modalità battaglia attiva, se la battaglia chiede Upgraded e la wave non ne ha, "Unisci" resta
  acceso e bloccato. Una nemesi è giocabile (`isPlayable`) con `boxCode`, battaglia, prodotto in collezione e carte Specific.
- **Risoluzione** (`resolveCurrent`): potere con più di 1 token: −1 token e avanti; minion: resta e avanti; attacco o
  potere all'ultimo token: negli scarti. **Pesca** (`drawNewCard`): solo con "Pesca"; il mazzo non si rimescola (vuoto = niente
  pesca); un attacco pescato va negli scarti, le altre carte si mettono in gioco. **Inizio turno nemesi** (`nemesisTurn`):
  `turn` sale di uno e parte la risoluzione (`startResolution`). **Fine del turno di un giocatore** (`endPlayerTurnCards`):
  `turnHp` = vita attuale e le carte grigie (`isGone`) vanno negli scarti; le bozze non salvate non arrivano qui (con bozze il
  pulsante è "Salva modifiche"; `ui.drafts` è dell'interfaccia). **Fine del turno nemesi**: da `resolveCurrent`, `drawNewCard` e
  `removeWhileResolving` (`endResolution`); poi `stato/partita.ts` estrae la carta turno dopo (`afterNemesisTurn`). **Vittoria** (`isVictory`):
  `turn > 0`, mazzo vuoto, nessun potere né minion in coda.
- **Minion a vita variabile** (`hpVariable`): entra senza vita (`hp` 0, `hpSet` false), mostra "?" finché i giocatori non la
  impostano; quella vita diventa `hpMax` (tetto del +1, con la vita di inizio turno nel turno giocatori); la prima impostazione
  non conta come danno nelle statistiche dei maghi.
- **Mazzo dei turni** (`MazzoTurni`): 2 giocatori G1 G1 G2 G2; 3: G1 G2 G3 e Wild; 4: G1-G4; sempre 2 carte nemesi. `left[0]` è
  la cima; mescolato a ogni giro (`shuffleTurnOrder`, `round` sale, `known` si azzera), si pesca dalla cima (`drawTurnCard`).
  `history` = un turno per carta pescata nel giro (l'ultimo è il turno in corso; `pos` = posto negli scarti, null se la carta è
  tornata nel mazzo); `known` è parallelo a `left`. **Wild** (3 giocatori): `wild` 1-3 passa al giocatore dopo a ogni giro; i suoi
  turni valgono per quel giocatore (`turnCardPlayer`). **Carte 1/2 e 3/4** (4 giocatori, preferenza): `pairNext` dice a chi tocca
  la prossima della coppia (null = si sceglie, poi la memoria diventa l'altro; giocatore = carta obbligata); non si azzera
  a fine giro né mescolando; `picks[pos] = { player, forced }`; `predictedPairPlayers` deduce i giocatori delle carte note.
  Rimettere nel mazzo una carta già giocata non cambia la memoria (`takeFromTurnPile`). `waiting` serve solo a leggere salvataggi vecchi.

## Da sapere prima di modificare
- Una regola nuova prende tutto come argomento; se serve il caso o l'ora, si aggiunge un parametro e lo passa `stato/partita.ts`.
- Le regole che modificano la partita ricevuta sono elencate in `MUTATING_RULES` (`tools/check-moduli.mjs`): se ne aggiungi una, aggiungila lì.
- Prova con i dati veri: `tests/mazzo-nemesi.test.ts`, `mazzo-turni.test.ts`, `turno-nemesi.test.ts`, `vite.test.ts`, `salvataggio.test.ts`.
- `restoreGame` (`salvataggio.ts`) riporta al passo Pesca una fotografia con `currentIndex` = lunghezza della coda e mazzo non vuoto; a mazzo vuoto (salvataggi vecchi) `currentIndex` torna sull'ultima carta. Provato da `tests/salvataggio.test.ts` e `tests/partita.test.ts` (Undo e ripresa).
