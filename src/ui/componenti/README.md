# src/ui/componenti/

Pezzi riusabili dell'interfaccia, o sempre presenti nella partita. Livello 3: importa da livelli 0-2 e, senza cicli, da altri
componenti. Ogni pezzo con stile ha il suo `.css` accanto (importato da `stili/indice.ts`).

## File
- `animazioni.ts`: `lockFor(ms)` (blocca i tocchi e ridisegna alla fine), `fastScrollTo` (scorrimenti animati del 50% più veloci,
  260ms, interrompibili), gesti (`trackDrag`), `buzz` (vibrazione Android), `shakeApp`, durate (`MORPH_MS`, `ENTER_MS`, `BG_SLIDE_MS`).
- `banner.ts`: la scritta al centro ("Tier 2", "Tier 3", "Partita iniziata"; `showBanner`); il carattere Cinzel si carica
  all'avvio (`preloadBannerFont`) e l'animazione muove solo trasformazione e opacità.
- `barra-turni.ts` + `.css`: la barra dei turni sotto la testata (zona 2). `componenti.ts` + `.css`: le carte disegnate.
- `dialoghi.ts` + `.css`: la pila delle finestre (`openModal`, Esc, Tab, resto inerte), pulsanti, toast, annunci, immagini.
- `misure.ts`: `misura()` legge le variabili di `schermate/partita-misure.css` (proporzioni della carta, riga vita/token, comandi,
  spazi, colonna del desktop `sizeColumn`, `sharedCardWidth` unica per i due turni (senza riserve: la zona 6 c'è sempre), `altezzaArea` (altezza
  dell'area delle carte senza lo spazio dell'alone), `spazioVicine()`).
- `pesca-undo.ts` + `.css`: "Pesca carta" dal mazzo in alto (Rimetti nel mazzo / Scarta), Annulla sospeso, conferma di uscita.
- `pulsante-principale.ts`: zona 7, l'unico pulsante e "Annulla modifiche"; disegnato dal coordinatore e dal carosello.
- `ripristino.ts`: `restore`/`undo` lato interfaccia (animazioni ferme, finestre chiuse, carta da mostrare, `chiudiCreaMazzo`).
- `scarti.ts` + `.css`: la pila degli scarti `#discard` (dalla più recente, tocco = carta grande in sola lettura).
- `sfondi.ts`: sfondo dell'app (3: `BACKGROUNDS`), sfondo del box di Gravehold (`GRAVEHOLD_BGS`: Città o Torre) e dorso delle carte
  (29, `CARD_BACKS` in `ui/pagina.ts`, `setCardBack`): pulsanti con anteprima usati dal menu laterale e dalle Opzioni. Scelte nel browser, mai nell'undo.
- `testata.ts` + `.css`: la testata (zona 1). `vite-scrub.ts`: conti puri dello scrubbing. `vite.ts` + `.css`: la riga delle vite (zona 4).

## Da sapere prima di modificare
- **Testata:** a sinistra nome della nemesi, fiamma con la battaglia, giocatori, "Turno N"; a destra mazzo, scarti, Menu. **Turno N**
  conta i giri del mazzo dei turni (`turnOrder.round`), non i turni nemesi (`turn`, per le statistiche). `fitPhaseName` riduce il
  carattere del nome (da 18px, senza minimo) finché sta nella colonna: si ricalcola a ogni `render`, al `resize` e dopo
  `document.fonts.ready`; è la stessa funzione per il nome di "Crea mazzo" e per la copia della testata nel mazzo dei turni.
  Mazzo e scarti si toccano su 44×44. Il volo delle carte verso gli scarti è `flyToDiscard`.
- **Barra dei turni:** `renderTurnTrack` disegna la **storia del giro** (`turnOrder.history`: turni giocati, turno in corso, carte
  del mazzo): anche più di 6 caselle (`--ae-seg-n`). Casella accesa 122px (pulsa una volta quando cambia giocatore); sotto, "Giocatore N",
  "Wild · N" o "Nemesi · Risolvi/Pesca"; nei turni passati la sigla (N, 1-4, W, 1/2). Le carte note hanno il colore tenue
  (`.is-known`). Colori dei giocatori: `--ae-turn-p1…p4` in `barra-turni.css`. Nascosta in "Crea mazzo". Contiene la scelta
  "Chi gioca questo turno?" (`renderPairChoice`: sfumatura dei due colori, tutto oscurato tranne la barra, `animatePairToDock` la
  riduce in due pulsanti in basso; il giocatore scelto si annulla con l'undo).
- **Carte** (`componenti.ts`): poteri con 4-5 token rimpiccioliti (`zoom` 3/n), con più di 5 un token e il numero (`.is-count`); poteri non
  rimovibili: simbolo di divieto (`.ae-ban-badge`). Minion con danno in corso: "x/X" con X = vita prima del danno.
- **Vite** (`vite.ts`): `renderLives` riscrive il numero solo se cambia (`data-shown`); `lifeScrub`: trascinando in verticale la
  vita cambia di 1 ogni 30px (`LIFE_SCRUB_PX`, parte dopo 6px, `touch-action: none`), al rilascio una sola `cambiaVita`
  (un passo di undo); a 0 Vittoria o Sconfitta (`mostraFinePartita`); cifre che scorrono con `renderLifeDigits`. Non c'è in "Crea mazzo".
- **Misure:** per cambiare una misura si edita `partita-misure.css`; due variabili (`-giocatori` / `-nemesi`) dove i turni differiscono.
- Un `render()` ricostruisce le carte del turno giocatori e interrompe le loro animazioni: `lockFor` deve durare almeno quanto
  le animazioni avviate. La colonna desktop (`sizeColumn`) è una sola per i due turni.
