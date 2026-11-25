# tools/confronto/

Lo strumento di confronto: `npm run confronta -- <tag o commit> [--solo partite,scenari,salvataggi,schermate,indietro,scheletri,lingua,misure]`.
Confronta la versione attuale (anche non committata) con un tag o un commit e stampa solo l'esito. Un giro completo dura circa 3 minuti.
Playwright è una dipendenza di sviluppo (non entra nella build).

## Cosa fa
Costruisce `<ref>` in una worktree temporanea `.confronto/<ref>/` (con `node_modules` collegato; la build si riusa se il commit non cambia) e la versione
attuale in `.confronto/attuale/`; le serve su due porte (localStorage separati) e le apre in Chromium senza finestra. Caso (`Math.random` con
semente, rifissata a ogni passo) e orologio (`Date.now`, timer, `requestAnimationFrame` finti di Playwright, che avanzano solo di quanto si dice) sono
uguali per le due build; le animazioni vanno alla fine.

## File
- `confronta.mjs`: il comando (elenco delle prove, esito, uscita 0 se identico, 1 se ci sono differenze, 2 se lo strumento non riesce a lavorare).
- `costruzione.mjs`: costruisce le due versioni. `server.mjs`: serve `dist` sotto `/AeonsEnd_App_0.2/` (la base di Vite).
- `browser.mjs`: il browser senza finestra, con caso e orologio fissi, niente service worker né rete fuori dal server locale, errori dell'app
  raccolti, e il piccolo linguaggio dei passi dei file di dati (`['scenario', id]`, `['clic', selettore]`, `['js', codice]`, `['aspetta', ms]`...).
- `differenze.mjs`: confronto di due risultati (`normalizza` fa contare uguali `rgba(223, 174, 89, 0.6)` e `color-mix(...)` se i numeri finali a 8 bit
  sono uguali, e un colore del tutto trasparente conta sempre "trasparente").
- `pagina-lib.js`: codice iniettato in ogni pagina prima dell'app (usa `window.app`; se un nome cambia si aggiorna qui, in un posto solo).
- `prove/`: una prova per file (`{ nome, esegui(ctx) }`), i casi nei file omonimi di `dati/`. `salvataggi/`: i `.json` della prova `salvataggi`.

## Le prove
- `partite`: 9 partite (una con i minion portati a 0 dalla scheda, `uccidi`; una con la ripresa al passo Pesca, `ripresaAlPesca`) come sequenze di azioni, con Undo e ripresa a metà (la pagina si ricarica e si riprende dal salvataggio, a collezione completa), stato e vista a ogni passo. `scenari`: tutti quelli della Modalità test.
  Le azioni di gioco (risolvi, pesca, fine turno, pesca carta turno) sono il tocco sul pulsante principale vero (`clicca` in `pagina-lib.js`), non le funzioni dello stato: così passano da dove passa l'app (`showActive` aggiorna la carta mostrata). La vista registra anche `carta` = carta mostrata/carta da risolvere (uid): se differiscono dopo un'azione compare `Torna alla carta da risolvere` senza che nessuno l'abbia chiesto.
- `salvataggi`: i file di `salvataggi/` (main v228 dei test e uno scritto dal sito pubblicato v273), ripresi e giocati.
- `schermate`: il giro delle schermate a 375×812 e 1280×800 (più 812×375 e riduzione del movimento per le voci con `anche`): `getComputedStyle` di
  tutti gli elementi visibili con `::before`/`::after`, posizione, testo e attributi, e i pulsanti principali con `:hover`/`:active`/`:focus-visible` forzati.
- `indietro`: il giro fino al tasto Indietro. `scheletri`: la pagina `public/scheletri/` nei 4 formati.
- `lingua`: non confronta due build: apre la versione attuale in italiano e in inglese (375×812 e 1280×800), percorre il giro di `dati/schermate.mjs`
  più le finestre di `dati/lingua.mjs` e riapre i salvataggi; segnala in inglese un testo che esce dal suo box (`scrollWidth > clientWidth`) o dallo
  schermo, un pulsante su più righe dove in italiano ha meno righe, un testo o `aria-label` vuoto, "undefined"/"NaN"/"[object"/"null" visibili e testo
  italiano rimasto (`ITALIANO`; per una terza lingua si aggiunge un secondo confronto con l'italiano).
- `misure`: come `lingua`, non confronta due build: apre la versione attuale a 375×812, 390×844 e 1280×800, nel turno giocatori e nel turno nemesi, e per ogni
  variabile di `partita-misure.css` (casi in `dati/misure.mjs`: le due cose che separa, selettore e bordo) la aumenta di 10px e controlla con
  `getBoundingClientRect` che lo spazio tra le due cose cresca di 10px. Controlli fissi: fondo della carta grande → zona 6 uguale a `--interattivi-distanza` (e, nel turno giocatori, → comandi della carta al centro: caso `--interattivi-distanza`);
  carta grande, zona 5 e zona 6 uguali (misura e posizione) nei due turni; i pesi dell'avanzo (`--carte-grandi-avanzo-sopra` / `-sotto`) dividono lo spazio
  come dicono (non su desktop: la colonna si adatta alla carta). Le variabili che non si provano così (proporzioni, pesi, minimi, valori che dipendono
  dal testo) stanno in `NON_PROVABILI` con il motivo, e nell'elenco dell'esito. Una variabile nuova in `partita-misure.css` = un caso in `dati/misure.mjs`
  (o una riga in `NON_PROVABILI`).
- `console`: errori dell'app solo nella versione attuale (`vibrate` non conta).

## Come si legge
Una riga per prova: `✓ identico` oppure `✗ N differenze` con le prime 10 (`[schermata] elemento · proprietà: prima → dopo`). Tutte le differenze sono in
`.confronto/esito.json`. Nelle partite le differenze di *vista* (momento, testo del pulsante, fase) non fermano il confronto dello stato; quelle dello
*stato* sì, al primo passo che differisce. Una differenza voluta (un testo, un valore cambiato) si dichiara nel report; le altre sono errori.

## Aggiungere una prova
Una partita = una riga in `dati/partite.mjs`; una schermata = una voce in `dati/schermate.mjs` (passi `['js', …]`, `['clic', …]`, `['scenario', id]`…, nel punto
del giro da cui si raggiunge; `forza` per i pulsanti); un passo di Indietro = una riga in `dati/indietro.mjs`; un salvataggio = un `.json` in `salvataggi/`
(il testo di `localStorage['aeonsend-app-0.2-save']`); una prova nuova = un file in `prove/` e la riga in `confronta.mjs`.

## Cosa non prova
Animazioni vere (si guarda il punto d'arrivo), gesti con più dita, scorrimento inerziale, il telefono vero (Android/iOS), le immagini come pixel (solo le
proprietà CSS), la rete lenta o assente, il service worker (spento). Il browser interno di Claude non esegue animazioni né transizioni, `requestAnimationFrame`
non scatta e gli eventi `scroll` nativi non arrivano: lì si verifica con stato e misure (telefono: `resize_window` preset `mobile` 375×812, poi di nuovo `desktop`). `:hover`/`:active`/`:focus-visible` sono forzati solo sui pulsanti
elencati in `dati/schermate.mjs`. Una nemesi scelta da console: la pagina Nuova partita mostra solo le nemesi delle wave spuntate (`selectedWaves`):
per giocare la nemesi voluta si spunta prima la sua wave, come farebbe un utente.
