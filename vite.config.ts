// Configurazione di Vite (npm run dev / build / preview) e di Vitest (npm test).
import { defineConfig } from 'vite';

export default defineConfig({
  // Il sito è pubblicato su GitHub Pages in https://lorenzvittori.github.io/AeonsEnd_App_0.2/: Vite aggiunge questo
  // percorso agli indirizzi che iniziano con / (file di public/ in index.html e nel CSS) e ai file costruiti.
  // In locale l'app è quindi in http://localhost:5173/AeonsEnd_App_0.2/ (dev) e :4173 (preview).
  base: '/AeonsEnd_App_0.2/',
  build: {
    outDir: 'dist',
    // Codice e CSS in dist/app/ con un hash nel nome; le immagini e i dati di public/ si copiano così come sono.
    // Non "assets": su Windows (nomi senza maiuscole/minuscole) sarebbe la stessa cartella di public/Assets/
    assetsDir: 'app',
    // Niente file piccoli dentro il codice: le immagini restano file normali (cache del service worker)
    assetsInlineLimit: 0,
    // CSS non minificato: il minificatore riscrive regole e valori (prefissi, colori, variabili aggiunte) e il CSS deve
    // restare quello di prima (fase A: aspetto identico)
    cssMinify: false
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}']
  }
});
