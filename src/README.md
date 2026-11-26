# src/

Il codice dell'app: Vite + TypeScript `strict`, moduli ES, nessun framework. Ogni sottocartella ha il suo README.

## Livelli (un file importa solo da livelli più bassi: `npm run check`)
0 `tipi/`, `regole/`, `stili/` · 1 `stato/`, `dati/` · 2 `ui/` (base) · 3 `ui/componenti/` · 4 `ui/finestre/` ·
5 `ui/schermate/` · 6 `ui/navigazione.ts` · 7 `avvio.ts` · 8 `main.ts`. Dettagli e eccezioni: [ui/README.md](ui/README.md).

## File di questa cartella
- `main.ts` (livello 8): punto d'ingresso di Vite, caricato da `index.html`. Importa i CSS (`stili/indice.ts`, per primo),
  poi chiama l'`avvio()` di ogni modulo nell'ordine dell'elenco `MODULI` (i moduli senza `avvio()` stanno in `SENZA_AVVIO`)
  e crea `window.app`. L'ordine conta: `ui/pagina.ts` prima di tutto, `avvio.ts` per ultimo.
- `avvio.ts` (livello 7): `init()` legge e controlla i JSON (con `dati/controllo.ts`), riempie il catalogo, prepara la
  prima partita da zero, fa il primo disegno e mostra il menu iniziale; avviso "Gira il telefono in verticale"
  (`.ae-rotate`: altezza ≤ 500px e schermo touch); pulsante Riprova se i dati non si caricano.

## Da sapere prima di modificare
- **Niente variabili globali** tranne `window.app` (per la console, `scheletri/` e le prove di `tools/confronto/`):
  le funzioni esportate dai moduli (`app.render()`, `app.act()`, `app.nuovaPartita()`, `app.startScenario(app.SCENARI[0])`),
  i campi dello stato per nome (`app.queue`, `app.turn`...; assegnabili solo per il debug), gli oggetti `app.catalogo`,
  `app.preferenze`, `app.partita`, l'elemento `app.app`, `app.noSave = true` (spegne il salvataggio), `app.regole` (regole pure).
  Se un nome cambia si aggiornano `main.ts`, `tools/confronto/pagina-lib.js` e `scheletri/`.
- Al caricamento i moduli non eseguono niente (solo funzioni e costanti): il codice di avvio sta in `avvio()`.
- Intestazione di ogni file: prima riga `// <percorso>: cosa contiene`, poi `Dipende da:` e `Usato da:`; nei commenti niente
  storia delle versioni, solo il perché, al presente. Un file `.ts` nuovo va citato nel README della sua cartella
  (lo controlla `npm run check`).
- Niente `any` (si usa `unknown` con un controllo), `@ts-ignore` vietato, `@ts-expect-error` con il motivo sulla stessa riga;
  nessun ciclo di import; nessun file sopra 500 righe (si divide in file di supporto `<nome>-*.ts`).
- I file serviti così come sono stanno in `public/`: `Data/`, `thumbs/`, `Assets/`, i JSON (`cards_nemesis.json`, `nemesis.json`,
  `products.json`, `deck-setup.json`), `manifest.webmanifest`, `sw.js`. Vedi [dati/README.md](dati/README.md).
