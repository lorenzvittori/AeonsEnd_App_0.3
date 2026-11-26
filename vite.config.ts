// Configurazione di Vite (npm run dev / build / preview) e di Vitest (npm test).
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { componiVersione } from './src/regole/versione.ts';

// Gli sfondi dell'app: ogni public/Assets/ui/decor/battle-bg*.webp (src/ui/componenti/sfondi.ts); un file nuovo si vede riavviando `npm run dev`
const sfondi = readdirSync('public/Assets/ui/decor').filter(f => /^battle-bg.*\.webp$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

// Versione dell'app (v0.3.x): x è il numero di commit dall'ultimo tag vN.N (la 0.3 è il tag v0.3). Si calcola ad ogni avvio di
// `npm run dev` e di `npm run build`; niente da aggiornare a mano. Senza git o senza tag, la versione è v0.3.? (src/regole/versione.ts).
function git(...argomenti: string[]): string | null {
  try {
    const out = execFileSync('git', argomenti, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out === '' ? null : out;
  } catch {
    return null;
  }
}
const tag = git('describe', '--tags', '--match', 'v[0-9]*.[0-9]*', '--abbrev=0');
const conteggio = tag === null ? null : git('rev-list', '--count', `${tag}..HEAD`);
const versione = componiVersione(tag, conteggio === null ? null : Number(conteggio));
const commit = git('rev-parse', '--short', 'HEAD') ?? '?';

export default defineConfig({
  define: {
    __SFONDI__: JSON.stringify(sfondi),
    __VERSIONE__: JSON.stringify(versione),
    __COMMIT__: JSON.stringify(commit)
  },
  // Il sito è pubblicato su GitHub Pages in https://lorenzvittori.github.io/AeonsEnd_App_0.3/: Vite aggiunge questo
  // percorso agli indirizzi che iniziano con / (file di public/ in index.html e nel CSS) e ai file costruiti.
  // In locale l'app è quindi in http://localhost:5173/AeonsEnd_App_0.3/ (dev) e :4173 (preview).
  // È l'UNICO posto dove scrivere il nome del repository: tools/confronto/server.mjs legge questa riga.
  base: '/AeonsEnd_App_0.3/',
  build: {
    outDir: 'dist',
    // Codice e CSS in dist/app/ con un hash nel nome; le immagini e i dati di public/ si copiano così come sono.
    // Non "assets": su Windows (nomi senza maiuscole/minuscole) sarebbe la stessa cartella di public/Assets/
    assetsDir: 'app',
    // Niente file piccoli dentro il codice: le immagini restano file normali (cache del service worker)
    assetsInlineLimit: 0,
    // CSS non minificato: il minificatore riscrive regole e valori (prefissi, colori, variabili aggiunte) e il CSS deve
    // restare quello scritto nei file .css
    cssMinify: false,
    // Due pagine: l'app (index.html) e la pagina di sviluppo scheletri/ (le misure di partita-misure.css accanto a quelle
    // vere dell'app). Non è una schermata dell'app: nessun link, niente nel service worker.
    rollupOptions: {
      input: { main: 'index.html', scheletri: 'scheletri/index.html' }
    }
  },
  test: {
    environment: 'node',
    // Di norma Vitest svuota i file CSS importati; quelli letti come testo ('...css?raw', pannello Regolazioni della
    // Modalità test) servono interi
    css: { include: [/\.css\?raw$/] },
    include: ['tests/**/*.test.ts']
  }
});
