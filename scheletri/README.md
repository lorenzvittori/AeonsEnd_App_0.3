# scheletri/

La pagina dello scheletro: una **seconda pagina di Vite** (build a più pagine, `build.rollupOptions.input` in `vite.config.ts`), di sviluppo, **non una schermata
dell'app**: nessun link dall'app, niente nel service worker. Somiglia a `src/ui/schermate/partita-misure.css`: stesse zone, stesso ordine, stessi nomi e commenti,
e per ogni misura il valore del file accanto a quello misurato davvero nell'app.

## Come si apre
- `npm run dev`: <http://localhost:5173/AeonsEnd_App_0.3/scheletri/>
- `npm run preview` (dopo `npm run build`): <http://localhost:4173/AeonsEnd_App_0.3/scheletri/>
- sul sito pubblicato: <https://lorenzvittori.github.io/AeonsEnd_App_0.3/scheletri/>

## Come si legge
- Un blocco per zona (Carte, 1 testata ... 7 pulsante principale), con il disegno scritto nel commento del file. Per ogni variabile una riga: **nome**,
  **commento** del file (l'etichetta), **valore nel file**, **misurata** nell'app, **differenza**. Una riga con differenza diversa da 0 è in rosso; una differenza
  spiegata (`diffSpiegata`) o una misura che non può essere uguale al valore (`nonUguale`) è in grigio, con il motivo; una variabile che non si può misurare
  (pesi, proporzioni, minimi, valori che dipendono dal testo) ha il motivo, preso da `NON_PROVABILI` della prova "misure".
- A destra il disegno in scala dello schermo (360 px di larghezza; formati 18:9 = 360×720 predefinito, 19:9, 19.5:9, 20:9), con le 7 zone. Passando il mouse (o toccando)
  una riga, nel disegno si evidenzia la cosa o lo spazio che misura; passando sul disegno si accende la riga. Un tocco su una riga la tiene scelta.
- Comandi in alto: formato, **turno giocatori / turno nemesi** (nel turno nemesi la zona 6 è lo spazio vuoto), unità (px / mm) e scala del disegno. Si ricordano nel browser.

## Come misura
L'app vera sta in un iframe nascosto largo 360 px (`app.noSave = true`: la partita salvata non cambia). Per ogni formato e turno si porta nel momento della prova
"misure" (`MOMENTI` di `tools/confronto/dati/misure.mjs`: scenario `full-queue`, un minion al centro / turno nemesi con il carosello) e si misura ogni variabile con le
**stesse coppie "tra X e Y"** della prova (`CASI`, `LEGGI`, `IMPOSTA` di `tools/confronto/dati/misure.mjs`): pagina e prova non possono dire cose diverse. I valori
e i commenti vengono dal file CSS, letto dal lettore del pannello Regolazioni (`src/ui/finestre/test-regolazioni-lettura.ts`: `MISURE`, `DISEGNI`).
Cambiando una variabile in `partita-misure.css` e ricaricando, la pagina mostra il valore nuovo nel file e nella misura.

## File
- `index.html`: la pagina (la seconda entrata di Vite). `scheletri.ts`: tutto il codice. `scheletri.css`: l'aspetto.
- Provata da `npm run confronta -- <ref> --solo scheletri` (`tools/confronto/prove/scheletri.mjs`): ogni variabile ha la sua riga, ogni differenza è 0 o spiegata.
- Controllata da `tsc` (`tsconfig.json` include `scheletri/`; i tipi di `misure.mjs` sono in `tools/confronto/dati/misure.d.mts`).
