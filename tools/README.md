# tools/

Strumenti per chi sviluppa: non fanno parte dell'app costruita. Si lanciano dalla cartella del repo.

## File
- `check-moduli.mjs`: controllo dei moduli di `src/` (`npm run check`, dopo `tsc`; esce con 1 se trova problemi). Legge i `.ts` con il
  parser di rolldown e controlla: ogni nome importato esiste tra gli export; nessuna variabile globale tranne `window.app`; `src/regole/`
  pura (import solo da `regole/` o tipi da `tipi/`, niente nomi del browser, `Date`, `Math.random`); i CSS si importano solo da
  `stili/indice.ts` (e `...css?raw` solo in `ui/finestre/test-regolazioni-lettura.ts`); niente `any`, `@ts-ignore` vietato, `@ts-expect-error`
  con il motivo; la partita si cambia solo in `stato/partita.ts`; nessun testo italiano nei `.ts` fuori dai dizionari (`FILE_CON_TESTI`
  elenca le eccezioni con il motivo; `I18N_IT`/`I18N_EN` solo in `ui/testi.ts`); nessun ciclo di import; i livelli ([ui/README](../src/ui/README.md));
  nessun file sopra 500 righe (salvo un commento in testa "Oltre 500 righe: <motivo>"); blocchi fissi mostrati e nascosti solo da
  `ui/navigazione.ts`; **ogni file `.ts` di una cartella di `src/` citato nel `README.md` di quella cartella**. Stampa file, file più grande
  e import tra moduli di `ui/`; `--conta` stampa `any`, eccezioni ai tipi, file `.js`, usi di `G` (attesi 0). Un file nuovo di `src/` va
  messo in `levelOf` (livello) e nel README della sua cartella.
- `check-docs.mjs`: controllo di `docs/` (`npm run docs`, lanciato anche da `npm run check`, esce con 1 se trova problemi): ogni percorso di file
  citato tra backtick è **salvato nel repository** (`git ls-files`, non basta che sia sul disco: si cerca dalla radice, poi in `src/` e `public/`; le cartelle generate o
  in `.gitignore`, come dist/ e screenshot/, si scrivono senza backtick), ogni link tra
  file funziona, ogni blocco `mermaid` si disegna (Playwright senza finestra e `mermaid` come dipendenza di sviluppo). Non sa se un diagramma dice il
  vero: lo verifica chi scrive. Un file `.md` passato come argomento controlla solo quello.
- `import-db.py`: il ponte DataBase → app (Python con openpyxl e Pillow). Genera `cards_nemesis.json`, `cards_supply.json`,
  `cards_treasure.json`, `mechanics.json` (meccaniche delle supply, con il nome del DataBase e quante carte le hanno), `products.json`, `Data/Nemesis/`, `Data/Supply/`, `Data/Treasure/` con le miniature in `thumbs/` e le immagini
  delle nemesi (`Assets/nemesis/`: carta, retro, ritaglio, `nemesis-art.json`): **questi file non si modificano a mano**. Fonti in sola
  lettura: `Data/NEMESIS_CARDS.xlsx`, `Data/SUPPLY_CARDS.xlsx`, `Data/TREASURE_CARDS.xlsx`, `Data/DataBase_*.xlsx` (foglio MAIN, immagini
  per UID), `BOXES_NAMES` di `pipeline.py`.
  `python tools/import-db.py` (DataBase predefinito `..\DataBase`) o `python tools/import-db.py "C:\percorso\DataBase"`; `--no-images` rifà solo i
  JSON delle nemesi; `--solo-supply` rifà solo le supply e `--solo-tesori` solo i tesori; `--force` rifà anche immagini e miniature già presenti
  (senza, un file esistente non si sovrascrive). Due lanci di fila danno lo stesso risultato. I rinomini delle meccaniche (nome nel
  DataBase → nome nell'app) stanno nella tabella `RINOMINI_MECCANICHE` in cima allo script: come si aggiunge una voce è spiegato in
  [src/dati/README.md](../src/dati/README.md).
- `build-app-icons.py`: le icone dell'app installabile (`public/Assets/ui/app-icons/`) da `public/Assets/ui/decor/app-icon.png` (400×400); l'icona
  maskable ha l'immagine nel 72% centrale con il bordo sfumato. Le usa `public/manifest.webmanifest` (a tutto schermo, verticale).
- `pubblicazione-precedente.mjs`: nel workflow di pubblicazione, dopo `npm run build`: scarica i file di `app/` dell'`index.html` del sito
  pubblicato e li mette in `dist/app/` accanto ai nuovi (si tengono le ultime 3 pubblicazioni, elenco in `app/precedenti.json`).
- `confronto/`: lo strumento di confronto, vedi [confronto/README.md](confronto/README.md).
- `screenshot/`: gli screenshot dell'app a 360×720 (`npm run screenshot`, opzioni `--scala 1`, `--lingua en`) per Figma e Stitch; riusa lo strumento di confronto
  e le situazioni di `confronto/dati/schermate.mjs`; esce in `screenshot/360x720/` (non va su GitHub) con un `indice.html`. Vedi [screenshot/README.md](screenshot/README.md).

## Pubblicazione
- `.github/workflows/pages.yml` parte solo con push su `main` (anche lanciato a mano pubblica solo `main`; Pages → Source = "GitHub Actions"). Passi:
  `npm ci`, `npm run check`, `npm test`, `npm run build`, `pubblicazione-precedente.mjs`, poi pubblica `dist/`. Ogni tentativo di deploy ha 3 minuti
  e ce ne sono fino a 3 (GitHub ogni tanto si blocca fino al limite di 10 minuti). Parte solo da `main`; si lavora su `sviluppo` (e `ts`, `main-v273` restano per riferimento): non pubblicano.
- **Cache di `index.html`:** GitHub Pages lo tiene circa 10 minuti, e i file costruiti (`dist/app/index-<hash>.js` e `.css`) cambiano nome a ogni
  pubblicazione: per questo `pubblicazione-precedente.mjs` conserva i file delle pubblicazioni di prima. Un `index.html` del sito senza build
  (fino alla v268) carica `public/script.js`, che ricarica la pagina una volta. La cartella del codice costruito si chiama `app/` e non `assets/`:
  su Windows sarebbe la stessa di `public/Assets/`.
- `public/sw.js` (service worker) e `manifest.webmanifest` si copiano così come sono. `scheletri/` (fuori da `public/`) è una seconda pagina di Vite, di
  sviluppo: le misure di `partita-misure.css` zona per zona accanto a quelle vere dell'app (`scheletri/README.md`); non è l'app.

## Da sapere prima di modificare
- Aggiungere un controllo a `check-moduli.mjs`: una riga nell'elenco in testa, il controllo, e un messaggio che dica file e riga.
- Nuovi file Python/script: si lanciano dalla cartella del repo e scrivono in `public/`.
- Dopo aver toccato `check-moduli.mjs` si lancia `npm run check` e si prova a rompere apposta la regola (per esempio togliere un nome dal README).
