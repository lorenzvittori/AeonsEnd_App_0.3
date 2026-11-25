# src/ui/schermate/

Le schermate dell'app, ognuna con il suo `disegna...()`. Livello 5: importa da livelli 0-4; nessun import tra schermate (se serve, un
aggancio di `ui/ridisegno.ts`) salvo i file di supporto della stessa schermata (`<nome>-*.ts`). Il CSS sta accanto al `.ts`.

## File
- `menu.ts` + `.css`: menu iniziale (Riprendi partita, Nuova partita, Opzioni, Test). `nuova-partita.ts` + `nuova-partita-anteprima.ts`:
  Nuova partita e la carta della nemesi scelta (`buildNemesisFlip`, zoom a due dita, `resetNemesisZoom`).
- `partita.css`: la mappa delle 7 zone. `partita-misure.css`: tutte le misure delle zone come variabili. `turno-giocatori.ts` + `.css`,
  `turno-nemesi.ts` + `turno-nemesi-carosello.ts` + `.css`: i due turni. `crea-mazzo.ts` + `crea-mazzo-cursore.ts` + `.css`: "Crea mazzo".
- `mazzo-turni.ts` + `.css` (apertura, foglio, chiusura, Esc), `mazzo-turni-bozza.ts` (bozza e stato `Finestra`), `mazzo-turni-disegno.ts`
  (disegno della riga: `draw`, `layoutFan`, `layoutHeads`), `mazzo-turni-trascina.ts` (tocchi, trascinamento, `runShuffle`),
  `mazzo-turni-riga.ts` (conti puri della riga, provati in `tests/mazzo-turni-riga.test.ts`).

## La schermata "partita" (turni, Pesca e "Crea mazzo": un solo `#app`, `data-schermata="partita"`)
- 7 zone dall'alto, ognuna un blocco di `index.html` con `data-zona`: 1 `testata` (`#topbar`), 2 `turno` (`#fascia-turno`, barra dei
  turni), 3 `carte-piccole` (`#rail`, una sola fascia), 4 `vite` (`#vite`), 5 `carte-grandi` (`#queue` o `#focus`, uno alla volta),
  6 `interattivi` (`#interattivi`, comandi della carta al centro, nel turno giocatori e in "Crea mazzo": `variantePartita()` dà `interattivi: true`), 7 `principale` (`#dock`, `#pulsante-principale`).
- Disposizione: `partita.css` (`grid-template-areas`, una riga per zona; le zone 2-6 stanno in `.ae-main`). Misure: `partita-misure.css`
  (nome parlante e commento; `-giocatori` / `-nemesi` dove i turni differiscono); il codice le legge con `misura()`.
- `data-turno` = `giocatori` | `nemesi` | `pesca` | `crea-mazzo`, deciso da `variantePartita` (`ui/partita-variante.ts`): presenza della zona 6,
  testo e azione (`data-azione`) del pulsante (`pesca-carta-turno`, `fine-turno`, `salva-modifiche`, `risolvi`, `pesca`, `torna`,
  `cursore`), contenuto della zona 5 (`coda`, `carosello`, `carta-coperta`), sfondo (nemesi e Pesca mostrano il lato destro).
- **Crea mazzo** è un momento della stessa schermata (sfondo nero `is-deck-dark` fino al banner "Partita iniziata"): i 9 mazzi (Tier 1-3
  × Base / Potenziate / Specifiche, queste a ventaglio e ingrandibili); tocco sul nome della nemesi = finestra con nome e giocatori
  (il mazzo si rifà). Il cursore (`buildDeckSlider`) pulsa finché non si tocca; `setDeckProgress` muove le carte seguendo il dito (prima il
  Tier 3); lasciando prima di `DECK_SLIDE_DONE` tutto torna indietro; da tastiera si completa subito. Poi banner e sfondo del turno.
- **Turno giocatori:** fascia piccola con tutte le carte in gioco, carte grandi in orizzontale (tocco al centro = scheda, di lato = porta
  al centro); zona 6 aggiornata da `markQueueRail` (`disegnaInterattivi`). *Fine turno · Pesca ordine turno* (`endPlayerTurn`) estrae il turno dopo: se
  esce la nemesi, scossa e vibrazione e lo sfondo scorre a destra. Dopo "Crea mazzo" l'app attende "Pesca carta turno" (`drawFirstTurn`).
  A fine giro: "Fine turno · Mischia mazzo", animazione `playTurnShuffle`, poi "Pesca la prima carta turno".
- **Turno nemesi:** carosello (`#focus`, scroll-snap nativo; `renderFocus` lo ricostruisce solo se cambia `focusStateSignature`,
  `scrollFocusTo`); carte risolte dalla più vecchia. Pulsante: potere "Vai avanti" / "Effetto risolto e scarta" all'ultimo token (un token si
  spegne da solo, `.is-auto-token`), minion e attacco "Effetto risolto". **Passo Pesca**: dorso grande, pulsante dorato; la carta nuova ha il
  bagliore dorato (un attacco lampeggia di rosso e va negli scarti, le altre "Metti in gioco · Fine turno nemesi"). Alla prima carta di Tier
  2 e 3 il banner. Il mazzo non si rimescola. Dal turno nemesi `passaAlTurnoGiocatori`. Dopo ogni azione che può chiudere il turno nemesi (pulsante
  principale, minion a 0 dalla scheda) lo schermo fa lo stesso passaggio: `mostraDopoAzione` (`turno-nemesi.ts`), chiesta dalla scheda
  con l'aggancio `dopoAzioneNemesi`; la carta turno la estrae sempre l'azione dello stato (`afterNemesisTurn`).
- **Menu e Nuova partita:** menu con partita in corso (Riprendi), collezione vuota = "Inserisci collezione" e Nuova partita oscurata. Nuova
  partita: giocatori 2-4; opzioni del mazzo (*Modalità battaglia*, *Unisci le carte della collezione*, preferenze del browser
  `aeonsend-app-0.2-deck-options`, copiate in `settings`); wave multiple a cifre romane; nemesi con dado, freccia che apre la carta (il retro
  solo con lo swipe); non giocabili in box piccoli ("Non in collezione" o "!"); "Inizia partita" sempre visibile.

## Il mazzo dei turni (si apre toccando la barra dei turni; `turnDeckBlocked()` lo impedisce in certi momenti)
- Strumento libero, nessun vincolo per carta. Copia solo da guardare di testata e barra (`viewOnlyCopy`), un **foglio** che scende da sotto
  la barra (320ms) con una riga: scarti | segmento | mazzo (cima a sinistra), titoli su una linea, Mescola (`runShuffle`), Rivela/Copri tutto.
- Si lavora su una **bozza** (`turnDraftFrom`, `turnDraftKey`): ogni modifica si scrive subito nella partita; **un solo passo di undo per
  visita** (`before = snapshot()` all'apertura, `commitUndo` alla chiusura). Carte note all'apertura scurite e ferme salvo in cima (`d.old`).
- Spostamenti: la carta segue il dito dopo `TURN_DRAG_PX` (6px) o col tocco (selezione + destinazione); destinazioni Cima, Fondo, tra due
  carte, scarti (`inPileZone`, fascia `inCardBand`); riga compatta con `spaceItems` (`TURN_GAP_MAX` 12px, `CARD_GAP_K`, `TURN_SPREAD`).
- Facce: `turnCardFace` usa `Assets/ui/turn-cards/<carta>.webp` (dorso `back.webp`); sulle carte 1/2, 3/4 e Wild con il giocatore deciso c'è il suo
  token (`Assets/ui/turn-tokens/pN.webp`). Le carte hanno contorno chiaro e ombra; un posto vuoto (scarti o mazzo) è un riquadro tratteggiato con ∅.
- Una carta degli scarti rimessa nel mazzo lascia il turno giocato nella barra (anche il turno in corso continua); una carta del mazzo negli
  scarti (solo in fondo) non è un turno. La carta trascinata resta dritta, con bordo dorato; sopra il posto di partenza resta un segnaposto.
- Dal Menu della copia (`apriMenuLaterale(shut)`) le voci che portano altrove chiudono prima la schermata. Prove: `tests/mazzo-turni-riga.test.ts`.
