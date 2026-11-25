# Aeon's End – Nemesis Companion: contesto per lo sviluppo

Documento di partenza per una nuova sessione di sviluppo: cos'è l'app, come ci si lavora, dove sta ogni cosa. I dettagli tecnici
di ogni cartella sono nel suo `README.md` (mappa nella sezione 6). La storia delle fasi (A-H, porting, inglese) è nei commit e nei
tag; la versione lunga di questo file, con la descrizione dettagliata di ogni schermata, è nel tag `ts-prima-fase-F`.

## 1. Cos'è

Web app personale, pensata prima di tutto per il telefono, che gestisce il **mazzo della nemesi** nel gioco da tavolo
cooperativo **Aeon's End** (soprattutto *The New Age*):
- prepara il mazzo secondo la regola "Nemesis Deck Setup";
- pesca le carte;
- tiene in ordine le carte in gioco (poteri, minion, attacchi);
- tiene il conto di token potere e vita dei minion e delle vite di Gravehold e della nemesi;
- guida la risoluzione del turno nemesi e il mazzo dei turni.

Il resto del gioco (maghi, carte dei giocatori) resta sul tavolo. L'interfaccia è in italiano e in inglese. Vite + TypeScript, nessun
framework, nessun dato personale: tutto resta nel browser (`localStorage`).

## 2. Repository, cartelle, sito

| Cosa | Dove |
|---|---|
| Repo attivo (si lavora qui) | `C:\Users\lvitt\OneDrive\Documenti\GiuHub Local Repository\AeonsEnd\AeonsEnd_App_0.2` – GitHub `lorenzvittori/AeonsEnd_App_0.2` (non lavorare in `AeonsEnd_App_0.2.5`) |
| DataBase (fonte di cards.json e delle immagini, solo lettura) | `...\GiuHub Local Repository\AeonsEnd\DataBase` (predefinito di `tools/import-db.py`) |
| Sito | <https://lorenzvittori.github.io/AeonsEnd_App_0.2/> |
| Versione vecchia (v1, non toccare se non richiesto) | `...\GiuHub Local Repository\AeonsEnd_APP` – GitHub `lorenzvittori/AeonsEnd_APP` – il sito vecchio ha anche il prototipo in `new_design_0.2/` |

Il proprietario scrive in **italiano**: si risponde in italiano. Il branch di lavoro è `ts`; `main` è il sito pubblicato (senza build)
finché `ts` non viene unito.

## 3. Regole di lavoro (concordate con l'utente)

- **Accesso ai file:** solo dentro le cartelle dei due repository e nei file che l'utente allega. Non si legge né si
  scrive altrove sul PC; se serve, prima si chiede.
- **Passaggio a Vite + TypeScript (branch `ts`, dalla fase A).** Sul branch `ts` l'app si costruisce con Vite: le regole
  qui sotto su `version.json` e sul caricatore valgono solo per `main` finché `ts` non viene fuso. Su `ts`:
  - **`npm run dev`** per provare (http://localhost:5173/AeonsEnd_App_0.2/, si aggiorna da solo a ogni modifica);
    `npm run build` + `npm run preview` per provare il sito costruito come sarà pubblicato (porta 4173);
  - **prima di ogni commit `npm run check` e `npm test`**, entrambi senza errori;
  - **niente `version.json`** e niente `?v=N`: Vite dà ai file costruiti un nome con l'hash (vedi sezione 8);
  - il codice è in `src/` (moduli ES: ogni file importa quello che usa, niente variabili globali tranne
    `window.app` per il debug), i file serviti così come sono in `public/` (sezione 9).
  - **TypeScript (dalla fase C):** tutto `src/` e `tests/` è `.ts`, `strict`. Niente `any` (né scritto né implicito);
    dove il tipo esatto costa troppo si usa `unknown` con un controllo. `// @ts-ignore` è vietato; un
    `// @ts-expect-error` deve avere il motivo sulla stessa riga (lo controlla `npm run check`). I tipi dei dati e dello
    stato sono in `src/tipi/` (sezione 6): quando un dato cambia si cambia prima il tipo e si segue il compilatore.
  - **Intestazione di ogni file di `src/`:** prima riga `// <percorso>: cosa contiene`, poi `Dipende da:` (o
    `Non dipende da niente`) e `Usato da:` (lo controlla un test). Nei commenti niente storia delle versioni: solo il
    perché, al presente.
- **Commit e push:** dopo ogni richiesta si fa commit e push su `main` (sul branch `ts`: su `ts`).
  - Gli autori dei commit sono `Claude` e `noreply@anthropic.com`, passati con i flag del singolo comando. Non vanno mai
    scritti nella config, e il nome dell'utente non va mai usato:
    ```
    git -c user.name=Claude -c user.email=noreply@anthropic.com commit -m "..."
    ```
  - Nei commit si aggiungono solo i file toccati, con percorsi espliciti: niente `git add -A` sui file dell'utente.
- **`version.json`:** va aumentato (`{ "v": N }`) a **ogni** modifica di CSS o JS. È la cache-busting di tutti i file.
- **Pubblicazione:**
  - non si fa push mentre una pubblicazione di Pages è ancora in corso;
  - dopo il push si fa **un solo** controllo ritardato (un'attesa in background di ~100 s, poi la lettura di
    `https://lorenzvittori.github.io/AeonsEnd_App_0.2/version.json`).
  - L'API `api.github.com` a volte non risponde: in quel caso basta il `version.json` del sito.
- **Verifiche:** **niente screenshot** per verificare (costano troppi token). Si verifica con JS e testo: misure con
  `getBoundingClientRect`, classi, stato.
- **Fare solo ciò che è chiesto.** Se una richiesta è ambigua si chiede: l'utente non ama le interpretazioni
  sbagliate. Se l'utente non risponde, si sceglie l'opzione più sensata e lo si dice.
  - Le correzioni brevi di una riga di solito si riferiscono all'ultima cosa toccata.
- **Pacchetti e librerie:** installabili se pesano meno di 1 GB.
- **Modifiche grandi:** prima di farle si crea un **tag git di ripristino**, così l'utente può tornare indietro.
- **Messaggi di chiusura:** in italiano, chiari. Si dice cosa non è stato verificato (per esempio l'aspetto visivo o il
  telefono vero).
- **Documentazione:** quando cambia un comportamento visibile, si aggiorna questo file (sezioni 4 e 5). La storia delle
  modifiche sta nel git log, non nei commenti del codice.

## 4. Comandi

Da lanciare dalla cartella del repo (PowerShell).

| Comando | Cosa fa |
|---|---|
| `npm install` (o `npm ci`) | la prima volta |
| `npm run dev` | prova l'app su <http://localhost:5173/AeonsEnd_App_0.2/>, si aggiorna a ogni modifica |
| `npm run build` | costruisce il sito in `dist/` (file con l'hash nel nome, codice in `dist/app/`) |
| `npm run preview` | serve il sito costruito, come sarà pubblicato: <http://localhost:4173/AeonsEnd_App_0.2/> |
| `npm run check` | `tsc` su `src/` e `tests/`, `tools/check-moduli.mjs` (livelli, cicli, `any`, testi, README...), Stylelint dei colori (`npm run colori`), `tools/check-docs.mjs` (percorsi, link e diagrammi di `docs/`, `npm run docs`) |
| `npm test` | i test con Vitest (`tests/`) |
| `npm run confronta -- <tag o commit> [--solo prova,...]` | confronta la versione attuale con un tag o un commit nel browser senza finestra |
| `node tools/check-moduli.mjs --conta` | quanti `any`, eccezioni ai tipi, file `.js`, usi di `G` (attesi 0) |
| `python tools/import-db.py` | rigenera `cards.json`, `products.json` e le immagini dal DataBase (serve openpyxl e Pillow) |

`check`, `test` e `build` devono essere verdi prima di ogni commit. Dettagli: [tools/README.md](tools/README.md),
[tools/confronto/README.md](tools/confronto/README.md), [tests/README.md](tests/README.md).

## 5. Terminologia (usata con l'utente)

| Termine | Significato |
|---|---|
| **Turno giocatori** (nel codice *VistaCoda*, `data-turno="giocatori"`, coda `#queue`) | Vista delle carte in gioco tra un turno nemesi e l'altro. |
| **Turno nemesi** (nel codice *VistaRisoluzione*, `data-turno="nemesi"` / `pesca`, carosello `#focus`) | Risoluzione delle carte in gioco, poi pesca della nuova carta. |
| **Coda** (`queue`) | Le carte nemesi in gioco, in ordine di arrivo. |
| **Vista piccola / fascia** (`.ae-compact-rail`) | Striscia in alto con tutte le carte in piccolo: `#queue-rail` nel turno giocatori, `#rail` (dentro `.ae-rail-row`) nel turno nemesi. |
| **Vista grande** | Le carte grandi: lista scorrevole nel turno giocatori, carosello nel turno nemesi. |
| **Carosello** (`#focus`, `.ae-focus-track`, `.ae-focus-slide`) | Turno nemesi: tutte le carte in fila, scroll-snap nativo, ai lati si vede un pezzo delle vicine. |
| **Carta da risolvere** | La carta indicata da `currentIndex`. |
| **Carta mostrata / in anteprima** | La carta al centro (`ui.viewedUid`). Se non è quella da risolvere compare "Torna alla carta da risolvere". |
| **Passo Pesca** (`isDrawStep()`, `DRAW_UID = -1`) | Dopo l'ultima carta risolta: dorso al centro e pulsante dorato "Pesca". |
| **Carta nuova** | Carta appena pescata: etichetta NUOVA e bagliore dorato; un attacco lampeggia di rosso. |
| **Banner Tier** (`showBanner`) | Scritta "Tier 2" / "Tier 3" alla prima carta di quel Tier pescata; la stessa animazione serve per "Partita iniziata". Il carattere Cinzel si carica all'avvio (`preloadBannerFont`); la scritta entra ferma (`is-preparing`) e parte quando il carattere è pronto (max 300 ms) e dopo due fotogrammi. L'animazione muove solo trasformazione e opacità. |
| **Lampeggio rosso** (`.is-to-resolve`, `.is-attack-drawn`) | Turno nemesi: carta da risolvere (non i poteri con più di un token) e attacco appena pescato. |
| **Box mazzo / box scarti** (`.ae-header-piles`, `.ae-pile`) | In testata, a sinistra, in entrambi i turni. |
| **Bozza** (`ui.drafts`) | Turno giocatori: vita e costi pagati non ancora salvati. "Salva modifiche" / "Annulla modifiche". |
| **Token automatico** (`.is-auto-token`) | Turno nemesi: sul potere da risolvere un token lampeggia e diventa grigio da solo (solo visivo: lo toglie il tocco sul pulsante). |
| **Crea mazzo** (`#deck-build`, `ui.deckBuilding`) | Schermata dei 9 mazzi dopo "Inizia partita", con lo slider (`deckSlider`). |
| **Menu iniziale** (`startMode = 'home'`) | Partita in corso (Riprendi), Nuova partita, Opzioni. |
| **Collezione** | Prodotti posseduti (wave e mini espansioni), scelti in "La mia collezione". |
| **Sfondo unico** (`--ae-battle-bg`, `BACKGROUNDS`) | Un'immagine sola su tutta l'app: maga a sinistra (turno giocatori), nemesi a destra (turno nemesi). Si sceglie nel Menu tra `battle-bg.webp`, `battle-bg-2.webp`, `battle-bg-3.webp` (1672 x 941). |
| **BannerInfoNemesi** | Tolto in v105, recuperabile dal tag `v104-banner-info-nemesi`. |

## 6. Mappa delle cartelle

Ogni cartella di codice ha un `README.md`: a cosa serve, il livello, cosa può importare, una riga per file, cosa sapere prima di modificarla.
`npm run check` controlla che ogni file `.ts` di `src/` sia citato nel README della sua cartella.

| Cartella | Cosa c'è |
|---|---|
| [`src/`](src/README.md) | `main.ts` (avvio, `window.app`) e `avvio.ts`; livelli e regole generali |
| [`src/tipi/`](src/tipi/README.md) | i tipi dei dati, della partita e del salvataggio (livello 0) |
| [`src/regole/`](src/regole/README.md) | le regole del gioco, funzioni pure (livello 0) |
| [`src/stato/`](src/stato/README.md) | catalogo, preferenze, partita con le azioni e l'undo, salvataggio (livello 1) |
| [`src/dati/`](src/dati/README.md) | caricamento e controllo dei JSON, collezione, rete; formato dei dati di `public/` (livello 1) |
| [`src/ui/`](src/ui/README.md) | base dell'interfaccia, coordinatore, agganci, testi e lingue; come si aggiunge una schermata, una finestra, un testo |
| [`src/ui/componenti/`](src/ui/componenti/README.md) | testata, barra dei turni, vite, carte, scarti, dialoghi, sfondi (livello 3) |
| [`src/ui/finestre/`](src/ui/finestre/README.md) | menu laterale, Opzioni, scheda carta, vita, statistiche, Modalità test e Regolazioni (livello 4) |
| [`src/ui/schermate/`](src/ui/schermate/README.md) | menu, Nuova partita, Crea mazzo, turni, mazzo dei turni; la schermata "partita" a 7 zone (livello 5) |
| [`src/stili/`](src/stili/README.md) | palette dei colori, token, ordine di tutti i CSS |
| [`tests/`](tests/README.md) | i test (Vitest) |
| [`tools/`](tools/README.md) | controllo dei moduli, ponte DataBase → app, icone, pubblicazione |
| [`tools/confronto/`](tools/confronto/README.md) | lo strumento di confronto tra due versioni |
| [`docs/`](docs/00-leggimi.md) | spiegazioni con diagrammi Mermaid, dal quadro generale al dettaglio (12 file, partenza `00-leggimi.md`) |
| `public/` | file serviti così come sono: `Data/`, `thumbs/`, `Assets/`, JSON, `manifest.webmanifest`, `sw.js`, `scheletri/` |

## 7. Livelli in breve

0 `tipi/`, `regole/`, `stili/` · 1 `stato/`, `dati/` · 2 `ui/` base · 3 `ui/componenti/` · 4 `ui/finestre/` · 5 `ui/schermate/` ·
6 `ui/navigazione.ts` · 7 `avvio.ts` · 8 `main.ts`. **Un file importa solo da livelli più bassi** (nei livelli 0-3 anche dallo stesso livello,
senza cicli; nei livelli 4-5 solo i file di supporto `<nome>-*.ts` della stessa schermata o finestra). Un livello basso che deve far
succedere qualcosa deciso più in alto chiama un **aggancio** (`ui/ridisegno.ts`) o riceve una funzione come argomento. Nessun ciclo di
import, nessun `any`, nessun file sopra 500 righe. Dettagli in [src/ui/README.md](src/ui/README.md).

## 8. Come si lavora

- **Prima di ogni fase o modifica grande:** `git status` pulito (a parte `ToDo.md`), tag `ts-prima-<fase>` e push del tag, così si può tornare indietro.
- **`ToDo.md` è dell'utente:** non si tocca e non entra nei commit. Nei commit solo i file toccati, con percorsi espliciti.
- **Per ogni passo:** `npm run check`, `npm test`, `npm run build` verdi; poi commit con gli autori della sezione 3, `git show --stat HEAD` per
  controllare che ci siano tutti i file (nuovi e spostati compresi), poi push su `ts`. `main` non si tocca.
- **A fine lavoro:** `npm run confronta -- <tag della fase>`: deve dare TUTTO IDENTICO, salvo le differenze volute (un testo, un valore), che
  si dichiarano. Il confronto non prova animazioni, gesti a più dita, telefono vero, rete (elenco in `tools/confronto/README.md`).
- **Documentazione:** cambia un comportamento visibile → si aggiorna il README della cartella; un file `.ts` nuovo va citato nel README
  della sua cartella (e messo in `levelOf` di `tools/check-moduli.mjs`). Nei commenti niente storia: solo il perché, al presente.
- **Documentazione per capire (`docs/`):** chi cambia la struttura (file, flussi, zone, campi dello stato) aggiorna anche `docs/` (partenza:
  [docs/00-leggimi.md](docs/00-leggimi.md)). `tools/check-docs.mjs`, lanciato da `npm run check`, controlla che i percorsi citati esistano, che
  i link funzionino e che ogni diagramma Mermaid si disegni; che dicano il vero lo verifica chi scrive.
- **Report finale** in italiano semplice e corto: cosa è cambiato, esito dei controlli e del confronto, cosa non è stato verificato.

## 9. Bug noti (annotati, non corretti)

- **Rotella sulla fascia piccola:** sul desktop la rotella del mouse scorre la fascia delle carte piccole solo nel turno nemesi, non nel
  turno giocatori (quando le fasce erano due, solo quella del turno nemesi aveva l'ascoltatore). Il limite è tenuto apposta
  (`navigazione.ts`, ascoltatore `wheel`).
- **Misure diverse tra i due turni:** risolto nella parte che contava. La zona 6 c'è sempre (vuota e invisibile nel turno nemesi), la misura della
  carta grande è una sola regola senza riserve e la carta ha la stessa misura e posizione nei due turni (lo prova `npm run confronta -- <ref> --solo
  misure`, a 375×812, 390×844 e 1280×800); ogni variabile di `partita-misure.css` è una misura vera. Restano due valori per turno
  (`-giocatori` / `-nemesi`), oggi **uguali** tra loro: spazio tra le carte grandi 18px/18px, altezza della fascia piccola 106px/106px, margine
  della fascia piccola 16px/16px. Unirle lo decide l'utente. La colonna su desktop (`sizeColumn`) usa lo spazio del carosello nemesi per tutti e due.
  La carta da pescare / pescata è il 90% (`--carta-pescata-scala`) della carta piena: oggi è quindi un po' più piccola della carta normale
  (prima era più grande, perché la normale lasciava libero lo spazio della zona 6); con scala 1 è uguale.

## 10. Idee e cose aperte

- **Unire `ts` a `main`:** la pubblicazione (`.github/workflows/pages.yml`) si attiva solo allora; l'`index.html` del sito senza build è coperto
  da `public/script.js`. Dopo l'unione i commenti del workflow che parlano del branch `ts` vanno aggiornati.
- Un solo modo di creare il DOM (tutto in `index.html` o tutto da JS), senza le difese per l'`index.html` vecchio ancora in cache.
- Doppioni da unire: i due editor della vita del minion (comandi sotto la carta e finestra), le animazioni di volo (`flyToDiscard`, `animateDrawIn`).
- Le immagini delle altre nemesi (wave diverse da The New Age e dalla 1) mancano: l'utente le fornisce come scansioni della carta nemesi, fronte e
  retro. Per ora solo le wave 1 e 4 si possono scegliere in collezione (`COLLECTION_WAVES`).
- Il Core Set non ha carte Upgraded: con la sola wave 1, dalla battaglia 2 il mazzo è più corto di `deck-setup.json` (domanda aperta).
- `public/manifest.webmanifest` è statico (la descrizione è in italiano): renderlo per lingua vorrebbe un manifest generato. Terza lingua:
  procedura in [src/ui/README.md](src/ui/README.md).
- Il repo originale `AeonsEnd_APP` ha lo stesso problema di pubblicazione bloccata; lì non c'è ancora il workflow con i tentativi.

## 11. Punti di ripristino (tag git)

Per tornare a un tag si ripubblica quello stato con un nuovo commit, senza riscrivere la storia. Elenco (`git tag -l`):
- Branch `ts`: `ts-prima-fase-B`, `ts-prima-fase-C`, `ts-prima-fase-D`, `ts-prima-porting-273`, `ts-prima-fase-E`, `ts-prima-fase-E2`,
  `ts-prima-fase-G`, `ts-prima-fase-H`, `ts-prima-confronto`, `ts-prima-inglese`, `ts-prima-fase-F`.
- Prima del passaggio a Vite: `v268-prima-ts`, `v268-prima-mazzo-turni-fix`, `v266-prima-riga-equispaziata`, `v253-prima-vite`,
  `v228-old-turn`, `v226-prima-refactoring-1`, `v221-prima-storia-turni`, `v219-prima-memoria-coppie`, `v214-prima-modalita-test`,
  `v212-prima-opzioni-mazzo`, `v211-prima-ritocchi-turni`, `v210-prima-finestra-turni`, `v209-prima-del-ponte-db`.
- Più vecchi: `v190-prima-annullo-spazi`, `v188-prima-spazi-uguali`, `v167-prima-mazzo-turni`, `v162-prima-voci-semplici`,
  `v157-prima-nuova-partita-e-dorsi`, `v156-prima-menu-e-slider`, `v154-prima-mobile`, `v152-prima-layout-tablet-desktop`,
  `v147-prima-della-pulizia`, `v123-prima-sfondo-unico`, `v113-prima-test-banner`, `v104-banner-info-nemesi`, `v98-prima-del-carosello`,
  `v86-prima-dei-comandi-sotto-le-carte`, `refactoring-prima-fase-2`, `refactoring-prima-fase-3`, `refactoring-prima-fase-4`.
