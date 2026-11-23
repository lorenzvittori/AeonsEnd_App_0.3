// script.js: SOLO per il passaggio dal sito senza build (fino alla v268) al sito costruito con Vite.
// GitHub Pages tiene index.html in cache circa 10 minuti: un index.html vecchio legge version.json (non c'è più: carica
// senza ?v=N), chiede i CSS vecchi (non ci sono più: il caricatore va avanti lo stesso) e poi questo file. Qui si
// ricarica la pagina una volta: il browser ricontrolla index.html e prende quello nuovo, che carica i file di Vite.
// Il segno in sessionStorage evita di ricaricare all'infinito se per qualche minuto arriva ancora quello vecchio.
(function () {
  var KEY = 'ae-ricarica-vite';
  var last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch (e) { /* senza sessionStorage si ricarica comunque */ }
  if (Date.now() - last < 60000) return;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { /* niente */ }
  location.reload();
})();
