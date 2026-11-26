# tools/screenshot/

Gli screenshot dell'app in tutte le fasi, per ridisegnare l'interfaccia in Figma e Google Stitch. L'app non cambia: è uno strumento per chi sviluppa.

`npm run screenshot [-- --scala 1] [-- --lingua en] [-- --solo nome,nome] [-- --tutte] [-- --senza-build]`

- Ogni immagine è **720×1440 pixel** (telefono 360×720 con `deviceScaleFactor` 2, schermo a tocco): in Figma è un frame 360×720. `--scala 1` dà 360×720 pixel
  (`--scala 3` 1080×2160).
- `--lingua en`: la versione inglese (predefinita: italiano). L'italiano esce in `screenshot/360x720/`, l'inglese in `screenshot/360x720-en/`.
- `--solo a,b`: solo le foto il cui nome contiene `a` o `b` (le altre restano com'erano nella cartella; la numerazione è sempre quella dell'elenco completo).
- `--tutte`: fotografa anche ogni voce del giro di `dati/schermate.mjs` che non ha `foto` (nomi `giro-...`, in fondo): per cercare uno stato nuovo.
- `--senza-build`: riusa la build già fatta in `.confronto/attuale/dist` (utile se non hai toccato l'app).
- Un giro completo dura circa 3 minuti (dentro ci sono la build e i 38 stati).

## Cosa esce
`screenshot/360x720/NN-nome.png` (numeri e nomi parlanti: `01-menu-iniziale.png`, `02-menu-iniziale-riprendi-partita.png`, ...) e `indice.html` nella stessa
cartella: tutte le immagini in griglia con il nome sotto, da aprire nel browser. La cartella `screenshot/` è in `.gitignore`: le immagini non vanno su GitHub.
A ogni giro completo la cartella si svuota prima (con `--solo` no).

## Come funziona
Riusa lo strumento di confronto ([../confronto/README.md](../confronto/README.md)) senza copiarlo: `costruzione.mjs` (la build), `server.mjs`, `browser.mjs`
(Chromium senza finestra, caso e orologio fissi, il linguaggio dei passi) e soprattutto `dati/schermate.mjs`. Lì ogni voce di `GIRO` dice come si arriva a uno stato
(`passi`); `FOTO_IN_PIU` ha gli stati che servono solo agli screenshot (ognuno parte dal proprio scenario) e `ORDINE_FOTO` l'ordine dei file. Le voci con il campo `foto`
si fotografano, nell'ordine di `ORDINE_FOTO`, dopo aver percorso il giro (ogni voce parte da dove è arrivata la precedente).

Per ogni foto: il tempo finto va avanti, le immagini delle carte si caricano, le animazioni e le transizioni vanno alla fine (uno scorrimento non resta a metà), poi si fotografa.
Unica eccezione la scritta Tier (`istante: 'banner'`), che dura meno di 2 secondi e finisce trasparente: si ferma a metà della sua animazione (`__c.fermaBanner`).
Nelle foto della partita il pulsante **Regolazioni** e la scritta **TEST · ...** sono nascosti (`visibility: hidden`, lo spazio resta); nelle voci con `test: true` (l'elenco della
Modalità test e il pannello Regolazioni) restano visibili. Il dorso, lo sfondo e le opzioni sono quelli predefiniti in tutte le foto; la nemesi è quella dello scenario o della voce
(Maggoth quasi ovunque, Carapace Queen e Arachnos dove lo scenario la fissa).

## Controlli (a ogni foto; se uno fallisce l'esito è 1 e la foto è segnata in rosso nell'indice)
- **Lo stato è quello giusto** (`atteso` della voce): testi del dizionario dell'app (`T.chiave`, nella lingua in uso, senza badare a maiuscole), il testo del pulsante principale
  (`['pulsante', chiave]`), selettori che devono esserci o non esserci, valori (`['testo', selettore, valore]`). Una voce con `foto` senza `atteso` non passa.
- **Niente caricamenti a metà**: nessuna immagine in arrivo, rotta, né "Caricamento carta…" / "Immagine non disponibile".
- **L'immagine non è vuota né nera**: misure giuste, almeno 40 colori diversi, luminosità media sopra 6.
- Nessun errore dell'app in console (le richieste fuori dal server locale sono bloccate come nelle altre prove: si elencano, non sono errori).

## Aggiungere uno stato
Una voce in `tools/confronto/dati/schermate.mjs`: in `GIRO` (nel punto del giro da cui si raggiunge: entra anche nel confronto delle build e nella prova lingua) o in `FOTO_IN_PIU`
(solo screenshot; comincia dal proprio scenario, e se apre un pannello che resta aperto lo chiude la voce dopo con `RIMETTI`). Con `foto: 'nome'` e `atteso: [...]`, e il nome in
`ORDINE_FOTO` (se manca va in fondo). Per cercare i passi: `npm run screenshot -- --tutte --scala 1 --senza-build`. I passi `['subito', codice, ms]` (poco tempo, niente animazioni
portate alla fine) e `['salvataggio', file]` (un file di `tools/confronto/salvataggi/` diventa la partita salvata) sono in `browser.mjs`.

## File
- `screenshot.mjs`: il comando. `controlli.mjs`: i controlli sopra. `indice.mjs`: scrive `indice.html`.
- Non fa parte dell'app e non entra nella build. Playwright è una dipendenza di sviluppo.
