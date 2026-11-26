// Configurazione di Vite (npm run dev / build / preview) e di Vitest (npm test).
import { readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Gli sfondi dell'app: ogni public/Assets/ui/decor/battle-bg*.webp (src/ui/componenti/sfondi.ts); un file nuovo si vede riavviando `npm run dev`
const sfondi = readdirSync('public/Assets/ui/decor').filter(f => /^battle-bg.*\.webp$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

export default defineConfig({
  define: { __SFONDI__: JSON.stringify(sfondi) },
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
