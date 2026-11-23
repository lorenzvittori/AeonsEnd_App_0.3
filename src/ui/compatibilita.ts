// ui/compatibilita.ts: compatibilità con i browser vecchi (replaceChildren). Provvisorio: in testa a tutto.
// Non dipende da niente. Usato da: main.ts (primo modulo avviato).

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  // Browser vecchi (Safari prima di iOS 14, Chrome prima della 86) non hanno replaceChildren: lo si aggiunge. Per i
  // tipi del DOM il metodo c'è sempre: qui lo si guarda come facoltativo, perché nei browser vecchi manca davvero
  const proto: { replaceChildren?: (this: Element, ...nodes: (Node | string)[]) => void } = Element.prototype;
  if (!proto.replaceChildren) {
    proto.replaceChildren = function (this: Element, ...nodes: (Node | string)[]) {
      while (this.firstChild) this.removeChild(this.firstChild);
      this.append(...nodes);
    };
  }
}
