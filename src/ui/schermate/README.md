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
  6 `interattivi` (`#interattivi`, spazio riservato sotto le carte grandi, alto `--interattivi-altezza`, sempre vuoto e invisibile; i comandi della carta stanno
  dentro ogni carta grande del turno giocatori, `.queue-slot > .queue-controls`, e si vedono solo per quella al centro), 7 `principale` (`#dock`, `#pulsante-principale`).
- Disposizione: `partita.css` (`grid-template-areas`, una riga per zona; le zone 2-6 stanno in `.ae-main`). Misure: `partita-misure.css`
  (nome parlante e commento; i due turni hanno le stesse misure, una variabile sola; **ogni variabile è una misura vera**: l'altezza di una cosa o lo
  spazio tra due cose, con il disegno della zona in cima; la prova `misure` di `tools/confronto` lo controlla); il codice le legge con `misura()`.
  Zona 5 dal basso: carta, `--carte-grandi-riga-stato-distanza`, riga vita/token; l'avanzo si divide con i pesi `--carte-grandi-avanzo-sopra` / `-sotto`.
- `data-turno` = `giocatori` | `nemesi` | `pesca` | `crea-mazzo`, deciso da `variantePartita` (`ui/partita-variante.ts`):
  testo e azione (`data-azione`) del pulsante (`pesca-carta-turno`, `fine-turno`, `salva-modifiche`, `risolvi`, `pesca`, `torna`,
  `cursore`), contenuto della zona 5 (`coda`, `carosello`, `carta-coperta`), sfondo (nemesi e Pesca mostrano il lato destro).
- **Crea mazzo** è un momento della stessa schermata (sfondo nero `is-deck-dark` fino al banner "Partita iniziata"): i 9 mazzi (Tier 1-3
  × Base / Potenziate / Specifiche, queste a ventaglio e ingrandibili); tocco sul nome della nemesi = finestra con nome e giocatori
  (il mazzo si rifà). Il cursore (`buildDeckSlider`) pulsa finché non si tocca; `setDeckProgress` muove le carte seguendo il dito (prima il
  Tier 3); lasciando prima di `DECK_SLIDE_DONE` tutto torna indietro; da tastiera si completa subito. Poi banner e sfondo del turno.
- **Turno giocatori:** fascia piccola con tutte le carte in gioco, carte grandi in orizzontale (tocco al centro = scheda, di lato = porta
  al centro); i comandi sotto la carta al centro li mostra `markQueueRail` (classe `is-centred`; durante uno scorrimento avviato dall'app l'evidenziazione resta sulla
  carta scelta, col dito segue lo scorrimento). *Fine turno* (`endPlayerTurn`) chiude il turno (il turno dopo è in attesa), lo sfondo va al
  centro (`data-fondo="centro"`) e si apre la finestra "Pesca nuovo turno" (`componenti/pesca-turno.ts`), dove si pesca il turno dopo
  (`pescaCartaTurno`): se esce la nemesi, scossa e vibrazione e lo sfondo a destra, alla chiusura della finestra. Dopo "Crea mazzo" l'app
  attende "Pesca carta turno" (apre la stessa finestra). A fine giro il mazzo dei turni si mischia subito (animazione `playTurnShuffle`).
- **Turno nemesi:** carosello (`#focus`, scroll-snap nativo; `renderFocus` lo ricostruisce solo se cambia `focusStateSignature`,
  `scrollFocusTo`); carte risolte dalla più vecchia. Pulsante: potere "Vai avanti" / "Effetto risolto e scarta" all'ultimo token (un token si
  spegne da solo, `.is-auto-token`: pulsa e diventa grigio su una copia sopra la pagina, `componenti/token-volo.ts`), minion e attacco "Effetto risolto". **Passo Pesca**: dorso
  grande (la carta più grande che ci sta: `--carta-pescata-spazio-sopra`, `--carta-pescata-margine-lati`), pulsante dorato; **dal passo Pesca alla carta pescata messa in
  gioco le carte piccole non si toccano** (`viewCard`, classe `is-bloccata`); la carta nuova ha il
  bagliore dorato (un attacco lampeggia di rosso e va negli scarti con "Effetto risolto · Fine turno", le altre "Metti in gioco · Fine turno
  nemesi"). Alla prima carta di Tier 2 e 3 il banner (un tocco lo finisce subito). Il mazzo non si rimescola. Dal turno nemesi
  `passaAlTurnoGiocatori`. Dopo ogni azione che può chiudere il turno nemesi (pulsante principale, minion a 0 dalla scheda) lo schermo fa lo
  stesso passaggio: `mostraDopoAzione` (`turno-nemesi.ts`), chiesta dalla scheda con l'aggancio `dopoAzioneNemesi`; l'azione dello stato
  (`afterNemesisTurn`) chiude il turno e a fine passaggio si apre la finestra "Pesca nuovo turno".
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
  carte, scarti (`inPileZone`, fascia `inCardBand`); riga a tutta larghezza con `spaceItems` (primo oggetto sul bordo sinistro, ultimo su quello destro; `CARD_GAP_K`, `TURN_SPREAD`).
- Facce: `turnCardFace` usa `Assets/ui/turn-cards/<carta>.webp` (dorso `back.webp`); sulle carte 1/2, 3/4 e Wild con il giocatore deciso c'è il suo
  token (`Assets/ui/turn-tokens/pN.webp`). Le carte hanno contorno chiaro e ombra; un posto vuoto (scarti o mazzo) è un riquadro tratteggiato con ∅.
- Una carta degli scarti rimessa nel mazzo lascia il turno giocato nella barra (anche il turno in corso continua); una carta del mazzo negli
  scarti (solo in fondo) non è un turno. La carta trascinata resta dritta, con bordo dorato; sopra il posto di partenza resta un segnaposto.
- Dal Menu della copia (`apriMenuLaterale(shut)`) le voci che portano altrove chiudono prima la schermata. Prove: `tests/mazzo-turni-riga.test.ts`.
