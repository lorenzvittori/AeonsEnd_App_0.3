# tests/

I test con Vitest (`npm test`), scritti in TypeScript e controllati da `tsc` (`tests/tsconfig.json`, con i tipi di Node).
Importano direttamente i moduli di `src/` (al caricamento non toccano il DOM). Provano la logica; l'aspetto lo prova `tools/confronto/`.

## File
- `aiuto.ts`: aiuti comuni: i dati veri di `public/` già controllati e tipizzati, `seeded` (caso ripetibile), `must`.
- `mazzo-nemesi.test.ts`: ogni nemesi giocabile × 2/3/4 giocatori × Modalità battaglia × Unisci, su tre collezioni.
- `mazzo-turni.test.ts`: carte per 2/3/4 giocatori, wild, carte 1/2 e 3/4, memoria delle coppie, mescola, giro nuovo, salvataggi vecchi.
- `mazzo-turni-riga.test.ts`: la riga della schermata del mazzo dei turni (spazi, metà tra carte, centratura, `it.on`, zone di rilascio).
- `turno-nemesi.test.ts`: risoluzione, pesca, vittoria, fine del turno giocatori, statistiche, con le carte vere di `cards.json`.
- `vite.test.ts`: vite di Gravehold e della nemesi (valori iniziali, tetto, passi). `vite-scrub.test.ts`: scrubbing (partenza, passi da 30px, limiti).
- `salvataggio.test.ts`: fotografia e ripristino, formati vecchi (con un salvataggio vero di main v228 in `tests/dati/`), versione, scrittura.
- `partita.test.ts`: `nuovaPartita()` dà sempre lo stesso stato, un'azione = un passo di undo, salvataggio → ripresa = stesso stato,
  uscita dalla Modalità test (caso e orologio fissati, `localStorage` finto).
- `partita-variante.test.ts`: `variantePartita()` nei vari momenti, in italiano e inglese; la funzione non cambia niente.
- `navigazione.test.ts`: `schermataAttuale()` (compreso il mazzo dei turni) e cosa chiude Indietro con e senza finestre, senza la pagina.
- `regolazioni.test.ts`: lettura pura del pannello Regolazioni e coerenza di `palette.css` (ogni ruolo punta a un colore base).
- `testi.test.ts`: dizionari it/en con le stesse chiavi, nessun valore vuoto, funzioni per 0/1/2, testi di `index.html`.
- `lingua.test.ts`: preferenza della lingua (lingua del browser al primo avvio, scelta salvata).
- `dati-json.test.ts`: i veri `public/*.json` rispettano i tipi e `dati/controllo.ts` (se `import-db.py` produce dati sbagliati, lo dice).
- `moduli.test.ts`: i moduli si importano senza effetti, le regole sono pure, niente `.js` in `src/`, ogni file ha l'intestazione.
- `dati/`: file di prova (salvataggi veri). `tsconfig.json`: configurazione dei test.

## Da sapere prima di modificare
- Si aggiunge un test con un file nuovo o un blocco `it('cosa controlla', () => { ... })`. I test delle regole usano i JSON veri di
  `public/` e un caso ripetibile; con `Math.random` e `Date.now` finti (`vi.spyOn`) e `localStorage` finto quando serve.
- Un test che cambia testi italiani o inglesi deve restare d'accordo con `src/ui/testi-it.ts` e `testi-en.ts`.
- `vite.config.ts` dice a Vitest di non svuotare i `.css?raw` (servono a `regolazioni.test.ts`).
- Quello che richiede un browser (disegno, animazioni, gesti) non si prova qui: è `npm run confronta` ([tools/confronto/](../tools/confronto/README.md)).
