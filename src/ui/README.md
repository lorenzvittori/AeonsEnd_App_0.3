# src/ui/

L'interfaccia. I file qui sono il livello 2 (base) e il coordinatore (livello 6); le sottocartelle sono i livelli 3-5.

| Livello | Cartella | Cosa c'è |
|---|---|---|
| 2 | `ui/` (file qui sotto) | elementi di index.html e stato `ui`, testi, `el`/`query`/`need`, agganci |
| 3 | `componenti/` | pezzi riusabili o sempre presenti nella partita (testata, barra dei turni, vite, scarti, dialoghi...) |
| 4 | `finestre/` | ciò che si apre sopra una schermata (Opzioni, statistiche, Modalità test, menu laterale, scheda carta, vita) |
| 5 | `schermate/` | menu iniziale, Nuova partita, Crea mazzo, turno giocatori, turno nemesi, mazzo dei turni |
| 6 | `navigazione.ts` | il coordinatore; 7 `avvio.ts`, 8 `main.ts` (in `src/`) |

## File di questa cartella
- `pagina.ts`: elementi di index.html (con il tipo, `byId`), costanti, oggetto `ui` (stato solo visivo: carta mostrata, `lockFor`,
  bozze, `deckBuilding`...). `dom.ts`: `el`, `icon`, `need`, `query`, `queryAll`. `compatibilita.ts`: browser vecchi (primo modulo).
- `ridisegno.ts`: gli agganci verso l'alto. `navigazione.ts`: il coordinatore. `navigazione-stato.ts`: dove si è (senza DOM, provato).
- `partita-variante.ts`: `variantePartita(p, u, t = T)` (pura, riceve i testi): momento della schermata "partita".
- `testi.ts` (unico accesso: `T`, `DIZIONARI`, `LINGUA`, tipo `Testi`), `testi-it.ts` (`I18N_IT`, il modello), `testi-en.ts` (`I18N_EN`).

## Regole dei livelli (`tools/check-moduli.mjs`)
- Un file importa solo da livelli più bassi. Nei livelli 0-3 anche dallo stesso livello (senza cicli); nei livelli 4-5 no, salvo i file di
  supporto della stessa cartella (`<nome>.ts` con i suoi `<nome>-*.ts`). Il supporto non importa il file principale.
- **Componente o finestra:** componente se serve a più schermate o finestre o c'è sempre nella partita; finestra se si apre al volo
  su una sola parte (o dal coordinatore). Niente import tra finestre: se serve, un aggancio.
- **Il coordinatore** è l'unico che mostra e nasconde i blocchi fissi (`#start`, `#queue`, `#focus`, `data-turno`).
  `schermataAttuale()` dice dove si è ('menu', 'nuova-partita', 'crea-mazzo', 'turno-giocatori', 'turno-nemesi', 'mazzo-turni';
  il mazzo dei turni lo segna la schermata con `impostaMazzoTurniAperto`). `render()` disegna testata, blocchi, comandi, pezzi
  comuni, poi `disegnaTurnoNemesi()` o `disegnaTurnoGiocatori()`; l'ordine conta (il nome della nemesi si misura dopo le classi).
- **Agganci** (`ridisegno.ts`, chiamate dirette, registrate da `navigazione.avvio()`): `richiediRidisegno`, `vaiAlMenuIniziale`,
  `mostraFinePartita(esito)`, `chiudiCreaMazzo`, `apriMenuLaterale(leave)`, `ricominciaMazzo`, `ricominciaScenario`,
  `vaiAllaPartitaDaScenario`, `passaAlTurnoGiocatori(uid, nodo)`, `passaAlTurnoNemesi`, `dopoAzioneNemesi(a)` (la scheda della carta chiede allo schermo il passaggio di fine turno nemesi), `vaiA('menu' | 'nuova-partita')`,
  `riprendiPartita`, `aggiornaInizio`, `apriFinestraVita(kind)`. Si usa invece una **funzione passata come argomento** quando chi
  crea il pezzo sa già cosa deve succedere (`creaBarraTurni(apri)`, `disegnaTestata(onNameClick)`, `enterNemesisTurnView`).
- **Tasto/gesto Indietro** (`closeTopForBack` con `cosaChiudeIndietro`, voce in più nella cronologia `armBackGuard`): chiude il livello
  in primo piano (finestre, Annulla sospeso, "Pesca carta", collezione/Opzioni/Test, scarti); dalla Nuova partita torna al menu;
  senza niente da chiudere avvisa e un secondo Indietro entro 2,5 s esce.

## Come si aggiunge
- **Una schermata:** file in `schermate/` con il suo `disegna...()` (e `avvio()` se serve); un nome in `Schermata` e
  `schermataAttuale()` con un test in `tests/navigazione.test.ts`; il coordinatore la mostra; CSS accanto, importato da `stili/indice.ts`;
  il modulo va in `main.ts` (`MODULI` o `SENZA_AVVIO`).
- **Una finestra:** file in `finestre/` con la funzione che la apre tramite `openModal` (Esc, Indietro e l'inerte valgono da soli).
- **Un testo:** la chiave in `I18N_IT` (stringa, o funzione per conti e plurali), la stessa in `I18N_EN` (breve come l'italiano: i
  pulsanti stanno su una riga), poi `T.chiave`. Mai testo scritto a mano nei `.ts` (lo controlla `check-moduli`; eccezioni in
  `FILE_CON_TESTI`). Testi fissi di `index.html`: `data-testo`, `data-testo-aria`, `data-testo-title` con la chiave, scritti da `testi.avvio()`.
- **Una lingua** (es. francese): codice in `Lingua`/`LINGUE` (`stato/preferenze.ts`), `testi-fr.ts` con `I18N_FR: Testi`, voce in
  `DIZIONARI` e in `check-moduli.mjs`, poi la prova `lingua` di `tools/confronto`. La lingua è una preferenza (`aeonsend-app-0.2-language`);
  si sceglie in Opzioni, che ricarica l'app. Restano fissi: nome del gioco, manifest, `public/scheletri/`, etichette del pannello Regolazioni.
