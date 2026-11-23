// ui/compatibilita.js: Compatibilità con i browser vecchi (replaceChildren). Provvisorio: in testa a tutto.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
  // Browser vecchi (Safari prima di iOS 14, Chrome prima della 86) non hanno replaceChildren: lo si aggiunge
  if (!Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function (...nodes) {
      while (this.firstChild) this.removeChild(this.firstChild);
      this.append(...nodes);
    };
  }

  // --- 1. Testi, elementi, costanti e stato ---------------------------------------------------------------------------
}
