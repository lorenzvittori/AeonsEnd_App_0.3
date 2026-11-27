# src/ui/finestre/

Ciò che si apre sopra una schermata (con `openModal` della pila di `componenti/dialoghi.ts`: Esc, Indietro e l'inerte valgono da soli).
Livello 4: importa da livelli 0-3; niente import tra finestre (se serve, un aggancio di `ui/ridisegno.ts`); la apre chi la usa.
Ogni finestra con stile ha il suo `.css` accanto.

## File
- `menu-laterale.ts` + `.css`: il menu della partita (pannello al 70%, entra da destra, esce in `SIDE_MENU_OUT_MS` 0,22s, si chiude
  anche trascinandolo a destra: `swipeToClose`; il pulsante Menu diventa X: `menuCloseToggle`).
- `opzioni.ts` + `.css`: Opzioni del menu iniziale, La mia collezione, finestra "nemesi non più in collezione" (`openMissingNemesis`).
- `biblioteca.ts` + `.css` + `biblioteca-icone.ts`: la Biblioteca a tutto schermo (`openLibrary`, dal menu iniziale): schede Nemesi,
  Mercato (filtri: ricerca, set e meccaniche in due pannelli (le meccaniche sono quelle della categoria scelta), costo; caroselli per costo o griglia (sotto ogni carta: il box, "x" o "x - y" con la mini espansione, su una riga: la dimensione scende da 11 px fino a 7 px, poi i puntini, e le meccaniche come tag colorati da `ui/colori-meccaniche.ts`; intestazione del costo con il simbolo Aether da `Assets/ui/icons/aether.svg`), zoom della carta, barra inferiore con le
  icone SVG della specifica), Tesori (in arrivo). Legge `cards_supply.json` e `mechanics.json` alla prima apertura (se `mechanics.json`
  manca o è rotto, il filtro meccaniche non si mostra); l'ordine è fisso. Preferenza (categoria) in `localStorage`.
- `scheda-carta.ts`: la scheda della carta in gioco toccata. `vita.ts`: la finestra della vita di Gravehold o della nemesi.
- `statistiche.ts` + `.css`: Vittoria, Sconfitta (`showEndScreen`, `showDefeat`) e Statistiche. `test.ts` + `.css`: Modalità test e scenari.
- `test-regolazioni.ts` + `.css`: pannello "Regolazioni" della Modalità test; `test-regolazioni-lettura.ts`: la sua parte pura (la legge anche la pagina `scheletri/`: `MISURE` e i disegni delle zone, `DISEGNI`).

## Cosa fanno
- **Menu:** turno nemesi e carte nel mazzo; *Annulla ultima azione* (chiude il menu e lascia un pulsante sospeso, ripetibile: il
  primo toglie le modifiche non salvate); Scarti; *Statistiche in corso* (apre le Statistiche, aggancio `apriStatistiche`); *Nemesi uccisa* (apre la Vittoria); Sfondo, Dorso, Sfondo Gravehold (pulsanti con
  anteprima); *Ricomincia la partita*; *Esci dalla partita* (rosso, conferma "Uscire dalla partita?" con `openExitConfirm`; i pulsanti
  da tenere premuto usano `holdToConfirm`, `HOLD_EXIT_MS`). Nella Modalità test: "Ricomincia lo scenario", "Esci dal test".
- **Opzioni:** La mia collezione (riepilogo wave · prodotti; un interruttore per wave con le sue mini espansioni, Seleziona/Deseleziona
  tutto, vale solo con "Salva collezione"; per ora wave 1 e 4), Dorso, Sfondo, *Carte turno 1/2 e 3/4* (interruttore, attivo, vale dal
  prossimo giro), *Lingua / Language* (sceglierne un'altra salva e ricarica l'app). Il menu iniziale mostra "Modalità test" in fondo.
- **Scheda carta:** minion = vita in bozza (−5 −1 +1, senza tetti: oltre la vita massima il numero diventa dorato e compare un avviso, `hpOverMax`; il
  minimo è 0; i comandi sotto la carta grande restano con il +1 solo fino alla vita di inizio turno), potere = token e rimozione pagando il
  costo. Minion a vita variabile ("?"): "Imposta la vita" con −5 −1 +1 +5 da 0; `unsetHpClick` apre la scheda dal box "?".
  Il pulsante principale diventa *Salva modifiche* (un solo passo di undo; minion a 0 e poteri pagati vanno negli scarti) con *Annulla modifiche*.
- **Vita** (`openLifeDialog`): pillola al centro con numero grande, −5 −1 · +1 +5, cambio "+x"/"−y"; esce dal box e si ingrandisce
  (`LIFE_ZOOM_MS` 280ms); si chiude toccando fuori, con Esc o Indietro e la vita si applica una volta sola (un passo di undo, senza cambi nessuno).
  Gravehold non ha minimo (`lifeFloor`): può andare nei negativi; la Sconfitta scatta quando arriva a 0 o meno da sopra.
- **Statistiche** (`openStats`, anche da *Statistiche in corso* del menu): in cima i tempi e la tabella dei maghi, poi le righe con le carte, in fondo i
  turni in gioco dei minion (una fila di miniature con la clessidra e i turni, come le altre carte). Turni nemesi, carte giocate (mazzo iniziale − rimaste), rimanenti (per Tier), minion uccisi (con la vita della carta,
  "*" se variabile), poteri scartati pagando e risolti, Æ spesi (solo costi "Spend N Æ"), attacchi risolti, turni in gioco di ogni minion;
  elenchi in `stats.cards` / `stats.minions` (id; i salvataggi vecchi non li hanno). **Maghi**: `stats.mages` (`p1`…`p4`, `wild`),
  contati in `saveAllDrafts` per il giocatore del turno: danni ai minion (le cure nello stesso salvataggio li riducono), minion
  uccisi, poteri scartati e **costo pagato** (Æ = `removalCost` della carta); in `cambiaVita` i punti tolti alla nemesi (**Danni nemesi**) e
  dati a Gravehold (**Vita a Gravehold**) nel turno di un giocatore; non contano le vite del turno nemesi. La tabella ha il token del
  giocatore e "P1"…"P4". **Tempi** (`statsTimes`): `startedAt`, `tierAt` (prima carta di ogni Tier), `endedAt`;
  è l'orologio, pause comprese; partite iniziate prima mostrano "—". Vittoria = mazzo vuoto e niente potere o minion in gioco,
  o *Nemesi uccisa*; vita a 0: nemesi → Vittoria, Gravehold (0 o meno) → Sconfitta, con "Continua" che torna alla partita; chiusa la
  schermata, Undo rimette la vita. Un tocco durante l'animazione di entrata di Vittoria e Sconfitta (e dei banner Tier e "Partita iniziata")
  la finisce subito.
- **Modalità test:** dal menu iniziale, elenco degli **scenari** (`SCENARI`, `startScenario`); uno scenario non parte se una carta non è
  in `cards_nemesis.json` (o il nome è di più carte senza `boxCode`) e dice il motivo. Nella testata "TEST · <scenario>". **Isolamento:** con un test in
  corso (`testRun`) niente si salva e la collezione non conta; lo scenario sostituisce solo, finché dura, le carte 1/2 e 3/4 e il
  mazzo dei turni dei giri nuovi. Scenari: turni, minion a vita variabile, cambio Tier, coda piena, Vittoria, carte 1/2 e 3/4, memoria
  1/2, Wild e fine giro, statistiche piene, mazzo nemesi vuoto, vite quasi a zero. **Aggiungere uno scenario:** un oggetto in più in
  `SCENARI` (campi nel commento sopra: `id`, `name`, `desc`, `players`, `nemesis`, `phase`, `deck`, `queue`, `discard`, `turnOrder`,
  facoltativi `turnCards`, `pairs`, `turn`, `maxTier`, `stats`, `graveLife`, `nemesisLife`); carte per nome, `{ name, boxCode }` se
  il nome è di più carte; `buildScenarioState` lo trasforma in fotografia. Poi la prova `scenari` di `tools/confronto` lo apre da sola.
- **Regolazioni** (solo in uno scenario; salvate a parte in `aeonsend-app-0.2-regolazioni`, mai nel salvataggio): pannello a metà
  schermo con **Colori** (colori base di `palette.css`) e **Misure** (variabili di `partita-misure.css`, non quelle con `calc()`);
  **Ripristina tutto**, **Copia** (le sole variabili cambiate, con il file in cui vanno). Per renderle definitive: Copia, si cambiano i
  valori nel file indicato, Ripristina tutto, poi `npm run check`, `npm test`, `npm run confronta -- <tag>`. Etichette e gruppi si
  leggono dai commenti dei CSS (`--nome: valore; /* etichetta */`, `/* --- titolo --- */`); `test-regolazioni-lettura.ts` è il solo
  modulo che può importare CSS come testo (`?raw`).

## Da sapere prima di modificare
- Una finestra nuova: un file qui con la funzione che la apre; niente import da altre finestre.
- Prove: `tests/regolazioni.test.ts` (lettura pura, ogni ruolo punta a un colore base), `tests/navigazione.test.ts` (Indietro).
