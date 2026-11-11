# Aeon's End – Nemesis Companion: contesto per lo sviluppo

Unico documento di riferimento del progetto: cosa fa l'app, come si usa, come è fatta e come ci si lavora. Va dato
come contesto a una nuova sessione di sviluppo. (Fino alla v147 c'era anche `CONTESTO_APP.md`, ora unito qui.)

## 1. Cos'è

Web app personale, pensata prima di tutto per il telefono, che gestisce il **mazzo della nemesi** nel gioco da tavolo
cooperativo **Aeon's End** (soprattutto *The New Age*):
- prepara il mazzo secondo la regola "Nemesis Deck Setup";
- pesca le carte;
- tiene in ordine le carte in gioco (poteri, minion, attacchi);
- tiene il conto di token potere e vita dei minion;
- guida la risoluzione del turno nemesi.

Il resto del gioco (maghi, vita di Gravehold e della nemesi) resta sul tavolo.

## 2. Repository, cartelle, sito

| Cosa | Dove |
|---|---|
| Repo attivo (si lavora qui) | `C:\Users\lvitt\OneDrive\Documenti\GiuHub Local Repository\AeonsEnd_App_0.2` – GitHub `lorenzvittori/AeonsEnd_App_0.2` |
| Sito | <https://lorenzvittori.github.io/AeonsEnd_App_0.2/> |
| Versione vecchia (v1, non toccare se non richiesto) | `...\GiuHub Local Repository\AeonsEnd_APP` – GitHub `lorenzvittori/AeonsEnd_APP` – il sito vecchio ha anche il prototipo in `new_design_0.2/` |

Il proprietario scrive in **italiano**: si risponde in italiano.

## 3. Regole di lavoro (concordate con l'utente)

- **Accesso ai file:** solo dentro le cartelle dei due repository e nei file che l'utente allega. Non si legge né si
  scrive altrove sul PC; se serve, prima si chiede.
- **Commit e push:** dopo ogni richiesta si fa commit e push su `main`.
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

## 4. Come si usa

**Menu iniziale ("Aeon's End – Nemesis Companion")**
- Se c'è una partita salvata, la finestra **Partita in corso** (nemesi, giocatori, illustrazione) con solo *Riprendi
  partita*. Sotto, sempre: **Nuova partita** (secondario se c'è una partita in corso) e **Opzioni**.
- **Opzioni:** per ora una voce, *La mia collezione* (con il riepilogo wave · prodotti).

**Pagina Nuova partita** (`startMode = 'setup'`)
- In alto a destra il **Menu** (tre linee): *La mia collezione* ed *Esci* (torna al menu iniziale). Anche il tasto
  Indietro torna al menu iniziale.
- **La mia collezione:** schermata con un interruttore per ogni wave (la sua scatola base) e, sotto, le sue mini
  espansioni. Nemesi e carte Basic / Upgraded Basic escono solo dai prodotti spuntati. Vale solo con "Salva collezione".
- **Giocatori:** 2, 3 o 4 (dalle colonne di `deck-setup.json`).
- **Wave:** gruppo a sé, con pillole tonde (solo le wave della collezione); il vecchio `#wave-select` resta nascosto e
  tiene il valore.
- **Nemesi:** separata dalla wave da una linea; si sceglie la nemesi della wave.
  - Ogni pulsante mostra parte dell'illustrazione, la battaglia e, se c'è, la mini espansione.
  - Sulla nemesi scelta c'è una freccia (o un secondo tocco) che apre la sua carta intera; un tocco o uno slide la gira
    e mostra il retro con il setup.
  - Le nemesi non giocabili sono in piccoli box non cliccabili: quelle che l'app ha (battaglia e carte) ma fuori dalla
    collezione hanno a destra la scritta "Non in collezione"; le altre (senza battaglia o senza carte) un "!" rosso.
- L'interruttore **Includi carte base potenziate** è stato tolto in v156 (per ora non serve): le Upgraded Basic sono
  sempre incluse (`settings.includeUpgraded` resta `true`; la logica in `buildDeck` c'è ancora).

**Inizio partita**
- "Inizia partita": la pagina iniziale esce a sinistra e la partita entra da destra.
- Schermata **Crea mazzo**: i 9 mazzi da cui nasce il mazzo nemesi (righe Tier 1-3, colonne Base / Potenziate /
  Specifiche). Base e Potenziate sono dorsi con il numero di carte (al 60% dell'altezza della carta); le Specifiche
  sono a ventaglio, a faccia in su, e toccandole si vedono grandi (**Carte Nemesi Specifiche**: sopra
  "Tier 1 | Tier 2 | Tier 3" con un pallino per carta, acceso sulla carta mostrata; toccando un Tier si va alla sua prima
  carta).
- Sfondo **nero** (come il menu iniziale, `.ae-shell.is-deck-dark`); mazzo e scarti in alto non si toccano.
- Tocco sul **nome della nemesi** in alto (solo qui): finestra con nome, battaglia, illustrazione e **giocatori**, che si
  possono cambiare (il mazzo si rifà subito).
- Nel Menu c'è anche **Ricomincia la partita** (mazzo nuovo, stessa nemesi e giocatori).
- Al posto del pulsante principale c'è lo **slider** "Scorri per creare il mazzo" (`buildDeckSlider`), che pulsa finché
  non si tocca: il quadratino dorato si trascina a destra e le carte volano nel mazzo in alto **seguendo il dito**
  (`setDeckProgress`: a metà strada è nel mazzo metà delle carte; prima il Tier 3, poi il 2, poi l'1; le Specifiche si
  girano appena lo slider si muove). Lasciando prima della fine (`DECK_SLIDE_DONE`) il quadratino e le carte tornano
  indietro; arrivando in fondo il mazzo si completa. Da tastiera (Invio / freccia destra) si completa subito.
- Poi compare il banner **Partita iniziata**, con la stessa animazione del banner Tier; finito il banner lo sfondo passa
  dal nero a quello del turno giocatori e si è nel turno giocatori.

**Testata (uguale nei due turni, Proposta A «Pollice» da v159)**
- A sinistra il nome della nemesi e sotto: fiamma con il numero della battaglia | icona dei giocatori | Turno N.
- A destra una sola **pillola mazzo/scarti** (alta 44px): metà sinistra il **mazzo** (dorso piccolo + numero), metà
  destra gli **scarti** (ultima carta + numero). Nel Passo Pesca il bordo è dorato.
  - Tocco sugli scarti: si apre la pila degli scarti, dalla più recente, e ogni carta si ingrandisce.
  - Tocco sul mazzo: compare "Pesca carta", che mostra la carta in cima con *Rimetti nel mazzo* (nessun cambiamento) o
    *Scarta* (va negli scarti, un passo di undo). Serve per gli effetti che fanno pescare o guardare la carta in cima.
- Il **Menu** non è più in testata: è in basso, a sinistra del pulsante principale (60×60), nei due turni.
- **Traccia del turno** (da v158), sotto la testata: una tacca doppia "Giocatori", una tacca per ogni carta da
  risolvere, una tacca "Pesca". Fatte grigie, attuale avorio (turno giocatori) / rossa (turno nemesi) / dorata (Pesca).
  Sotto: "Turno giocatori · Turno nemesi N →", "Turno nemesi N · Carta i di n · Pesca", "Turno nemesi N · Pesca".
  È ricavata dallo stato (`renderTurnTrack`; il numero di carte di inizio turno viene dall'ultimo passo di undo del
  turno giocatori, `turnStartCount`).

**Turno dei giocatori** (Proposta A, da v160)
- In alto una fila di **miniature** 28×39 (tutta la coda, `.ae-mini-rail`); quella al centro è piena con il contorno
  avorio. Tocco = le carte grandi scorrono lì.
- Sotto le carte grandi (circa 230px su 375), una al centro e un pezzo delle vicine (velate). Niente riga vita/token
  sopra e niente comandi sotto; sulla carta resta "HP: −n" (danno o cura del turno, rispetto a `turnHp`).
- **Pannello di comando** in basso (`.ae-deck-card` nel dock), per la carta al centro (`centredQueueUid`), sopra il
  pulsante principale: riga con nome · tipo (e token del potere) e posizione "2 / 5", poi:
  - **minion:** "−" e "+" tondi da 72px ai lati della vita (goccia, vita, /massimo); "+" solo fino alla vita di inizio
    turno. Sotto le pillole **−2 −3 −5** e **Uccidi** (vita a 0);
  - **potere con "TO DISCARD":** "Paga il costo (Spend 7 Æ)" (testo da `toDiscard`), poi "Costo pagato · Annulla";
  - **altri poteri:** la nota "! Non rimovibile"; **attacco:** solo la riga del nome.
  La parte dei comandi è sempre alta come quella del minion, così scorrendo le carte non cambiano misura.
- **Niente bozze** (tolti "Salva modifiche" / "Annulla modifiche"): ogni tocco va subito nella partita ed è un passo di
  undo; tocchi veloci sullo stesso minion (entro 1,5 s, `actMerged`) sono un passo solo. I minion a 0 e i poteri pagati
  restano grigi fino a **Turno Nemesi**, che li fa volare negli scarti. Dopo un Annulla resta al centro la stessa carta.
- Toccando una carta grande si apre la sua finestra (vita del minion, token del potere, rimozione del potere): anche
  qui la conferma va subito nella partita.
- Il pulsante **Turno Nemesi**, con l'illustrazione della nemesi, avvia il turno della nemesi: breve scossa dello
  schermo e vibrazione (urgenza, `shakeApp`). Lo sfondo (maga a sinistra, nemesi a destra) scorre verso il lato della
  nemesi.

**Turno nemesi** (Proposta A, da v161)
- Le carte in gioco si risolvono dalla più vecchia, **una alla volta, senza carosello**: al centro c'è solo la carta da
  risolvere, con sopra la riga vita/token. Non si può guardare un'altra carta al suo posto (tolti l'anteprima e
  "Torna alla carta da risolvere").
- In alto la stessa **fila di miniature** del turno giocatori: contorno rosso sulla carta da risolvere; toccandone una
  si apre la carta in grande, in sola lettura.
- La carta da risolvere lampeggia di rosso, come l'attacco appena pescato; non lampeggiano i poteri con più di un token.
- **Pannello** in basso, sopra il pulsante principale: "Minion · 2 di 4" (tipo e posizione, come nella traccia) e cosa
  fare, in parole: "<Nome>: applica l'effetto. Resta in gioco." / "1 token tolto, ne restano N." / "ultimo token.
  Applica l'effetto, poi la carta va negli scarti." / attacco "applica l'effetto, poi va negli scarti."
- Riga in basso: Menu, **«‹»** (torna alla carta prima con l'undo; attivo solo se l'ultimo passo è di questo turno
  nemesi, `canStepBack`) e il pulsante principale (alto 64px):
  - **potere:** un token lampeggia e diventa grigio da solo; il pulsante dice "Avanti" (token −1) o "Risolto, scarta"
    (ultimo token: negli scarti);
  - **minion:** "Fatto, avanti", resta in gioco. Toccando il minion si apre la finestra con −1 / +1 alla vita;
  - **attacco:** "Risolto, scarta", va negli scarti.
- **Passo Pesca:** dopo l'ultima carta un dorso vola dal mazzo al centro, con il pulsante dorato **Pesca** (o tocco sul
  dorso). La carta si gira e mostra NUOVA e un bagliore dorato; un attacco lampeggia di rosso. Dorso e carta pescata
  sono più grandi delle altre carte: il 90% (`BIG_CARD_SCALE`) della misura massima calcolata da `sizeFocus`.
  - Attacco pescato: "Risolto, scarta", vola negli scarti. Altre carte: "Metti in gioco" (pannello: "Minion · nuova",
    "<Nome>: entra in gioco."). Poi si torna al turno
    giocatori: la carta messa in gioco si rimpicciolisce al suo posto e le altre carte della coda entrano da sinistra.
- Alla prima carta di Tier 2 e di Tier 3 compare la scritta "Tier N".
- **Il mazzo non si rimescola:** se è vuoto la nemesi non pesca.
- **Vittoria:** mazzo vuoto e nessun potere né minion in gioco (dopo il primo turno nemesi), oppure "Nemesi uccisa" nel
  Menu → schermata Vittoria: la scritta "Vittoria" entra come il banner dei Tier e resta ferma; sotto *Statistiche* e
  *Menu iniziale*. Un tocco in una parte vuota dello schermo torna alla partita, che non cambia.
- **Statistiche:** turni nemesi, carte giocate del mazzo nemesi (mazzo iniziale − carte rimaste, quindi anche quelle
  scartate con "Pesca carta"), carte rimanenti, minion uccisi, poteri scartati pagando il costo, poteri risolti, Æ spesi
  per i poteri (solo i costi "Spend N Æ"; gli altri costi valgono 0), attacchi risolti e, per ogni minion, i turni nemesi
  passati da quando è stato pescato (uccisi e ancora in gioco). Sotto carte giocate, carte rimanenti (per Tier e nome),
  minion uccisi (con la vita della carta), poteri scartati, poteri risolti e attacchi risolti c'è un box con le carte in
  fila; toccandone una la si vede grande. Gli elenchi sono in `stats.cards` (id); i salvataggi più vecchi non li hanno.

**Menu (pannello laterale al 70%)**
- Turno nemesi N e carte nel mazzo.
- **Annulla ultima azione:** chiude il menu e lascia un pulsante sospeso che si può toccare più volte; si torna indietro
  fino all'inizio della partita.
- Scarti.
- **Nemesi uccisa:** per quando la nemesi muore al tavolo; apre la schermata Vittoria.
- **Sfondo:** menu a tendina con tre sfondi (Nemesi mascherata, Demone cornuto, Bocca con tentacoli). Cambia subito e
  resta salvato nel browser; non entra nella partita né nell'undo.
- **Esci dalla partita:** rosso, va **tenuto premuto** (`holdToConfirm`, 0,9 s); un tocco breve avvisa "Tieni premuto
  per uscire". Porta al menu iniziale.
- Aprendo il Menu le tre linee del pulsante diventano una **X** (animazione, `menuCloseToggle`); toccando la X il menu si
  chiude. Vale anche per il Menu della pagina Nuova partita.

**Salvataggio:** la partita si salva da sola nel browser, insieme alla cronologia dell'undo, **solo dal primo turno
nemesi** (`save()` non scrive con `turn < 1`, a meno che la partita sia già stata salvata: `ui.gameSaved`). Durante
"Crea mazzo" non si salva niente e resta l'eventuale partita salvata prima.

**Telefono**
- **Schermo sempre acceso** finché l'app è aperta e visibile (Screen Wake Lock, `keepScreenOn` in `script.js`): si
  richiede all'avvio, al ritorno in primo piano e al primo tocco. Dove il browser non lo permette, non succede niente.
- **Tasto / gesto Indietro** (Android, swipe di iOS): chiude il livello in primo piano (finestre, Menu, Vittoria,
  "Annulla ultima azione" sospeso, "Pesca carta", La mia collezione, scarti) invece di uscire. Se non c'è niente da
  chiudere compare "Premi di nuovo Indietro per uscire" e un secondo Indietro (entro 2,5 s) esce. Funziona con una voce
  in più nella cronologia (`armBackGuard`, `closeTopForBack`), stesso indirizzo.
- **Solo verticale:** con il telefono in orizzontale (altezza ≤ 500px e schermo touch) l'app è coperta da "Gira il
  telefono in verticale" (`.ae-rotate`). Tablet e desktop non cambiano.
- **Aree di tocco:** la pillola mazzo/scarti è alta 44px e tutta toccabile; la freccia della carta nemesi su 44 di
  altezza; "−" e "+" della vita 72px, pillole −2/−3/−5/Uccidi 40px (44 con l'area invisibile); pulsante principale e
  Menu 60px.
- **"Inizia partita"** resta sempre visibile in fondo alla pagina iniziale.
- **Menu:** si chiude anche trascinandolo verso destra (`swipeToClose`).
- **Vibrazione** (solo Android): carta pescata (doppia per un attacco) e scritte Tier / Partita iniziata (`buzz`).
- **App installabile:** `manifest.webmanifest` (a tutto schermo, verticale) e icone in `Assets/ui/app-icons/`
  (rifatte da `tools/build-app-icons.py` a partire dal dorso).
- **Senza rete:** `sw.js` (service worker). Codice e dati: prima la rete, senza rete l'ultima copia salvata (una per
  file, senza `?v=N`). Immagini e font: prima la copia salvata. All'inizio o alla ripresa della partita si scaricano le
  immagini di tutte le carte in gioco nel mazzo (`prefetchDeckImages`), non con "Risparmio dati". Se un'immagine già
  pubblicata viene **sostituita** con lo stesso nome, i telefoni tengono la vecchia: in quel caso si cambia
  `MEDIA_CACHE` in `sw.js` (per esempio `ae-media-v2`). Il workflow di Pages copia anche `sw.js` e
  `manifest.webmanifest`.

**Tablet e desktop (da 768px di larghezza)**
- La partita è la stessa del telefono (testata, fascia piccola, carte grandi, pulsante), in una **colonna al centro**
  larga quanto la carta grande più un pezzo delle vicine (`--ae-col`, calcolata da `sizeColumn` in `script.js`: carta
  misurata dall'altezza + 2 × 54px, mai meno di 440px). Lo sfondo riempie tutto lo schermo. La pagina iniziale e la
  collezione hanno la loro colonna da 560px.
- Il tablet in verticale ha carte grandi (circa 460px a 768×1024); il desktop e il tablet in orizzontale sono limitati
  dall'altezza (carte da 270–300px).
- La rotella del mouse scorre le carte grandi e le fasce piccole (orizzontali).
- "Crea mazzo" ha mazzi più grandi (fino a 150px).
- La vecchia vista a due colonne (coda a sinistra, carta a destra, da 900px) è stata tolta in v153.

## 5. Terminologia (usata con l'utente)

| Termine | Significato |
|---|---|
| **Turno giocatori** (nel codice *VistaCoda*, `#queue-view`) | Vista delle carte in gioco tra un turno nemesi e l'altro. |
| **Turno nemesi** (nel codice *VistaRisoluzione*, `#resolve-view`) | Risoluzione delle carte in gioco, poi pesca della nuova carta. |
| **Coda** (`queue`) | Le carte nemesi in gioco, in ordine di arrivo. |
| **Vista piccola / fascia** (`.ae-compact-rail`) | Striscia in alto con tutte le carte in piccolo: `#rail` (dentro `.ae-rail-row`) nel turno nemesi. Nel turno giocatori è la fila di **miniature** `#queue-rail.ae-mini-rail`. |
| **Vista grande** | Le carte grandi: lista scorrevole nel turno giocatori, carosello nel turno nemesi. |
| **Carosello** (`#focus`, `.ae-focus-track`, `.ae-focus-slide`) | Turno nemesi: dalla v161 contiene una sola carta (quella da risolvere, o il dorso / la carta pescata). Il codice dello scorrimento c'è ancora ma non serve più. |
| **Carta da risolvere** | La carta indicata da `currentIndex`. |
| **Carta mostrata** (`ui.viewedUid`) | Dalla v161 è sempre la carta da risolvere (niente anteprima). |
| **Pannello del turno nemesi** (`.ae-resolve-panel`, `renderResolvePanel`) | Tipo · posizione e cosa fare con la carta; con «‹» (`stepBackBtn`, `canStepBack`). |
| **Passo Pesca** (`isDrawStep()`, `DRAW_UID = -1`) | Dopo l'ultima carta risolta: dorso al centro e pulsante dorato "Pesca". |
| **Carta nuova** | Carta appena pescata: etichetta NUOVA e bagliore dorato; un attacco lampeggia di rosso. |
| **Banner Tier** (`showBanner`) | Scritta "Tier 2" / "Tier 3" alla prima carta di quel Tier pescata; la stessa animazione serve per "Partita iniziata". Il carattere Cinzel si carica all'avvio (`preloadBannerFont`); la scritta entra ferma (`is-preparing`) e parte quando il carattere è pronto (max 300 ms) e dopo due fotogrammi. L'animazione muove solo trasformazione e opacità. |
| **Lampeggio rosso** (`.is-to-resolve`, `.is-attack-drawn`) | Turno nemesi: carta da risolvere (non i poteri con più di un token) e attacco appena pescato. |
| **Pillola mazzo/scarti** (`.ae-pile-pill`, `.ae-pile`, `.ae-pile-face`) | In testata, a destra, in entrambi i turni. Le animazioni (volo negli scarti, Crea mazzo, carta da pescare) vanno sul riquadro dell'immagine (`pileFace`). |
| **Traccia del turno** (`.ae-turn-track`, `renderTurnTrack`) | Barra a tacche sotto la testata: Giocatori → carte da risolvere → Pesca. |
| **Pannello di comando** (`.ae-deck-card`, `renderControlDeck`) | Turno giocatori: comandi della carta al centro, nel dock sopra il pulsante principale. |
| **Bozza** (`ui.drafts`) | Tolta in v160 (Proposta A): ogni modifica va subito nella partita. Recuperabile dal tag `v157-prima-proposta-a`. |
| **Token automatico** (`.is-auto-token`) | Turno nemesi: sul potere da risolvere un token lampeggia e diventa grigio da solo. |
| **Crea mazzo** (`#deck-build`, `ui.deckBuilding`) | Schermata dei 9 mazzi dopo "Inizia partita", con lo slider (`deckSlider`). |
| **Menu iniziale** (`startMode = 'home'`) | Partita in corso (Riprendi), Nuova partita, Opzioni. |
| **Collezione** | Prodotti posseduti (wave e mini espansioni), scelti in "La mia collezione". |
| **Sfondo unico** (`--ae-battle-bg`, `BACKGROUNDS`) | Un'immagine sola su tutta l'app: maga a sinistra (turno giocatori), nemesi a destra (turno nemesi). Si sceglie nel Menu tra `battle-bg.webp`, `battle-bg-2.webp`, `battle-bg-3.webp` (1672 x 941). |
| **BannerInfoNemesi** | Tolto in v105, recuperabile dal tag `v104-banner-info-nemesi`. |

## 6. Architettura

### File

- `index.html`: il loader legge `version.json` (no-store) e carica `css/design-tokens.css`, `css/components.css`,
  `style.css` e `script.js` con `?v=N`.
  - GitHub Pages tiene in cache `index.html` per circa 10 minuti. Per questo molti elementi (pulsante Menu, box mazzo e
    scarti, "Annulla modifiche", finestra "Partita in corso", pulsante Collezione, fascia del turno giocatori) sono
    creati o spostati da `script.js` all'avvio: il DOM reale è diverso da quello scritto in `index.html`
    (per esempio `#info-row` viene tolto e `#undo-btn` resta nascosto).
- `script.js`: **un solo file**, voluto così per la cache-busting, diviso in 9 sezioni numerate (indice in cima):
  1. testi (`I18N_IT`), elementi, costanti e stato;
  2. dati e mazzo (collezione compresa);
  3. componenti;
  4. VistaCoda;
  5. scarti;
  6. pagina iniziale;
  7. salvataggio e undo;
  8. VistaRisoluzione;
  9. eventi, testata, animazioni di volo, passaggio tra i turni, vittoria, Crea mazzo, undo sospeso, "Pesca carta",
     menu e avvio.
- `css/design-tokens.css`: palette e font (Cinzel per i titoli, Inter per l'interfaccia, da Google Fonts). Colori:
  - `--ae-bg #101116`, `--ae-surface`, `--ae-surface-raised`, `--ae-border`;
  - `--ae-text` avorio, `--ae-text-muted`;
  - `--ae-gold #DFAE59`, `--ae-danger #D95E5C`, `--ae-heal`, `--ae-focus`.
- `css/components.css`: componenti (pulsanti, badge, carta, finestre, scarti, toast, interruttore).
- `style.css`: layout e quasi tutte le aggiunte recenti, in fondo al file, spesso come ridefinizioni di regole
  precedenti: in caso di dubbio vale l'ultima.

### Stato

- Partita (entra nel salvataggio e nell'undo): `queue` (voci `{ uid, data, tokens, hp, turnHp, isNew, paid, bornTurn }`,
  dove `data` è la carta di `cards.json` e `bornTurn` il turno in cui è stata pescata), `deck` e `discard` (array di
  `data`; si pesca dalla fine di `deck`), `currentIndex`, `newIndex` (≥0 quando c'è una carta appena pescata),
  `resolving`, `turn`, `maxTierDrawn`, `stats` (statistiche: `deckSize`, contatori e `minions`; si aggiornano in
  `discardGone`, `removeWhileResolving` e `resolveCurrent`). I salvataggi senza `stats` ripartono da zero.
- Impostazioni: `settings = { players, nemesis, includeUpgraded }`; collezione in `collection` (Set di id prodotto
  `"<wave>|base"` o `"<wave>|<mini espansione>"`).
- `ui`: stato solo visivo, dichiarato tutto nell'oggetto `ui` in cima (viewedUid, holdUid, isTransitioning con
  `lockFor(ms)`, reveal, queueAnchor, drafts, flyingDiscards, tierBanner, deckBuilding, …).
- **Undo e salvataggio:** `act(fn)` fa `snapshot()` per l'undo, esegue l'azione e salva.
  - L'undo arriva fino a `UNDO_LIMIT = 300` passi; `restore()` ripristina.
  - Chiavi di `localStorage`: `aeonsend-app-0.2-save` (partita), `aeonsend-app-0.2-collection` (collezione) e
    `aeonsend-app-0.2-background` (sfondo), diverse da quelle della v1 perché il dominio github.io è condiviso. Il formato del salvataggio è quello della v48.
- **Rendering:** `render()` disegna tutto.
  - Turno nemesi: `renderResolve()`, con la fascia e `renderFocus` (carosello). Il carosello si ricostruisce solo quando
    cambia la "firma" (`focusStateSignature`); altrimenti scorre e basta.
  - `scrollFocusTo(uid, smooth, jump)`: mentre è in corso uno scorrimento animato avviato dallo script, le chiamate
    senza `smooth` (ridisegni, `sizeFocus`) aggiornano solo la meta invece di saltare; `jump` forza il salto.
  - Un `render()` ricostruisce le carte del turno giocatori e interrompe le loro animazioni: per questo `lockFor`, che
    ridisegna alla fine, deve durare almeno quanto le animazioni avviate (vedi `toPlayersTurn`, `ENTER_MS`).
  - Turno giocatori: `renderQueue()`, con la fascia, `.queue-slot` (carta + comandi) e `sizeQueue()`.
  - La misura delle carte grandi è una sola regola per i due turni (`sharedCardWidth`); `STATUS_H` deve restare uguale
    all'altezza della riga vita/token in `style.css`.

### Regole di gioco nel codice

- **Mazzo** (`buildDeck`): per ogni Tier si prendono a caso carte Basic e Upgraded Basic dei prodotti della collezione,
  nel numero indicato da `deck-setup.json[battaglia][giocatori]`, più le carte Specific della nemesi. Ogni Tier è
  mescolato a parte, con il Tier 1 in cima. Le carte senza Tier e le maledizioni (`Curse`) non entrano nel mazzo.
- **Risoluzione** (`resolveCurrent`): potere con più di 1 token: −1 token e avanti; minion: resta e avanti; attacco o
  potere all'ultimo token: negli scarti.
- **Pesca** (`drawNewCard`): solo con "Pesca". Il mazzo **non** si rimescola: vuoto = niente pesca.
- **Carta pescata:** un attacco va negli scarti; le altre carte "Metti in gioco". Poi si torna al turno giocatori.
- **Inizio turno nemesi** (`nemesisTurn`): `turnHp` diventa la vita attuale, le bozze si perdono, le carte grigie
  (`isGone`) vanno negli scarti.
- **Vittoria** (`isVictory`): `turn > 0`, mazzo vuoto e nessun potere né minion in coda.

## 7. Dati

- `cards.json` (stile PowerShell: 4 spazi e due spazi dopo i due punti). Campi di ogni carta:
  - `id`, `name`, `category` (`Basic Nemesis` / `Upgraded Basic Nemesis` / `Specific`), `nemesis`, `tier` (null = fuori
    dal mazzo), `subgroup`;
  - `type` (`Attack` / `Power` / `Minion`; altri tipi solo per le carte fuori dal mazzo), `hp`, `hpVariable`,
    `tokens`, `qty` (>1 solo per carte senza Tier, quindi non conta per il mazzo);
  - `effect`, `toDiscard`, `immediately`, `persistent`, `powerEffect` (testi, **non usati dall'app**);
  - `removable` (solo i poteri: true se l'effetto contiene "TO DISCARD");
  - `image` (`Data/<Nemesi>/Tier_N/<Nome>.webp`).
  - Il prodotto delle carte Basic / Upgraded Basic si ricava dal prefisso dell'id (`CARD_PRODUCT_PREFIX` in `script.js`:
    `NA-`, `TA-`, `SD-`, `ITW-`).
- `nemesis.json`: `name`, `wave`, `waveOrder`, `miniExpansion`, `battle`, `flagBattle5`, `owned` (`owned` serve solo
  come collezione iniziale).
  - Una nemesi è giocabile se ha la battaglia, il suo prodotto è nella collezione e ha carte Specific.
- `deck-setup.json`: la tabella del Nemesis Deck Setup.
- **Immagini:**
  - `Data/...`: scansioni in WebP qualità 90. Gli originali JPG/PNG sono sul PC ma esclusi da git.
  - `thumbs/<id>.webp`: miniature (264 x 369).
  - `Assets/nemesis/`: per ogni nemesi `<slug>.webp` (carta), `<slug>-back.webp` (retro con setup e storia),
    `<slug>-portrait.webp` (ritaglio) e `nemesis-art.json` (elenco).
  - `Assets/ui/decor/`: `card-back-logo.webp` (dorso), `battle-bg.webp`, `battle-bg-2.webp`, `battle-bg-3.webp`
    (sfondi scelti nel Menu).
  - `Assets/power-token-2.webp` (token), `Assets/ui/icons/`: `life-drop.webp` (goccia della vita), `alert.webp` ("!"),
    `flame.png` (battaglia), `players-1..4.png`, icone SVG usate come maschera (undo, eye, close, discard, empty-deck).
  - Immagini non più usate tolte in v148 (vecchi sfondi dei due turni, vecchi dorsi, gocce di vita, logo, icone del
    kit): recuperabili dal tag `v147-prima-della-pulizia`.
- **Nemesi complete:** le 7 di The New Age: Maggoth, Arachnos, Ageless Walker e Fenrix (scatola base); The Wailing,
  The Wanderer e Necroswarm (mini espansioni).

### Script in `tools/` (Python + Pillow, da lanciare dalla cartella del repo)

- `convert-webp.py`: converte JPG/PNG di `Data/` in WebP 90 e aggiorna `cards.json`.
- `build-thumbs.py`: rifà tutte le miniature. Attenzione: rigenerandole dai WebP cambiano anche quelle esistenti, quindi
  si fa commit solo delle nuove.
- `build-nemesis-art.py`: legge `Assets/nemesis/src/<Nome>.jpg` e `<Nome> - back.jpg` (esclusi da git) e crea carta,
  retro, ritaglio e manifest.

## 8. Pubblicazione

- `.github/workflows/pages.yml` (Pages → Source = "GitHub Actions").
  - Pubblica solo i file del sito: niente `tools/`, `README`, `.md`.
  - Ogni tentativo di deploy ha 3 minuti e ce ne sono fino a 3.
  - Motivo: GitHub ogni tanto si blocca fino al limite di 10 minuti e manda una mail di errore.

## 9. Test in locale

- **Server:** `python -m http.server 8124 --bind 127.0.0.1`, lanciato in background dalla cartella del repo. Poi si apre
  `http://127.0.0.1:8124/` nel browser interno.
- **Misura del telefono:** `resize_window` preset `mobile` (375×812); alla fine si torna a `desktop`.
- **Limiti del browser di prova:**
  - non esegue animazioni né transizioni (restano al tempo 0);
  - **requestAnimationFrame non scatta**;
  - gli eventi `scroll` nativi non arrivano;
  - script JS lunghi (molte attese in fila) possono far chiudere la scheda: meglio più script brevi.

  Si verifica quindi con lo stato e le misure, lanciando gli eventi a mano (`dispatchEvent(new Event('scroll'))`) e
  chiamando `clearTransition()` dopo le azioni animate. Per questo il carosello usa `setTimeout` invece di rAF.
- **Funzioni utili da console:** sono globali, per esempio `queue`, `allCards`, `makeEntry`, `act()`, `render()`,
  `undo()`, `startGame()`, `onNemesisClick()`, `onResolveClick()`, `viewCard()`, `isDrawStep()`, `centredFocusUid()`.
- Dopo le prove si toglie la partita di test: `localStorage.removeItem('aeonsend-app-0.2-save')`.

## 10. Punti di ripristino (tag git)

| Tag | Stato |
|---|---|
| `v86-prima-dei-comandi-sotto-le-carte` | Prima dei comandi sotto le carte nel turno giocatori. |
| `v98-prima-del-carosello` | Turno nemesi con una carta sola e slide a mano, prima del carosello nativo. |
| `v104-banner-info-nemesi` | Con il BannerInfoNemesi in basso, prima dei box mazzo e scarti. |
| `v113-prima-test-banner` | Testata con Undo e Menu e BannerInfoNemesi in alto, prima della prova che li ha tolti. |
| `v123-prima-sfondo-unico` | Due sfondi separati per i due turni, prima dello sfondo unico. |
| `v147-prima-della-pulizia` | Prima della pulizia del codice morto e dell'unione dei documenti (v148). |
| `v152-prima-layout-tablet-desktop` | Con la vecchia vista a due colonne da 900px, prima della colonna centrale per tablet e desktop (v153). |
| `v154-prima-mobile` | Prima delle modifiche per il telefono della v155 (orizzontale, aree di tocco, app installabile, service worker). |
| `v156-prima-menu-e-slider` | Prima della v157 (menu iniziale con Opzioni, slider di Crea mazzo, salvataggio dal primo turno nemesi). |
| `v157-prima-proposta-a` | Prima della Proposta A «Pollice» (traccia del turno, pillola mazzo/scarti, pannello di comando, niente bozze). |

Per tornare a un tag si ripubblica quello stato con un nuovo commit, senza riscrivere la storia.

## 11. Idee e cose aperte

- Semplificazione del codice, proposta dopo l'analisi del repo (la pulizia del codice morto è fatta in v148):
  1. stato della partita in un solo oggetto `game` (lo snapshot diventa una copia);
  2. `script.js` diviso in 5–6 file caricati dal loader con `?v=N`, con le regole di gioco separate dall'interfaccia;
  3. un solo modo di creare il DOM (tutto in `index.html` o tutto da JS), senza le difese per l'`index.html` vecchio;
  4. CSS riorganizzato per componente, unendo i selettori ridefiniti più volte in `style.css`;
  5. qualche test sulle regole (mazzo, risoluzione, vittoria).
- Doppioni da unire: i due editor della vita del minion (comandi sotto la carta e finestra), le tre animazioni di volo
  (`flyToDiscard`, `launchDeckCard`, `animateDrawIn`).
- Le immagini delle altre nemesi (wave diverse da The New Age) mancano: l'utente le fornisce come scansioni della carta
  nemesi, fronte e retro.
- Il repo originale `AeonsEnd_APP` ha lo stesso problema di pubblicazione bloccata; lì non c'è ancora il workflow con i
  tentativi.
