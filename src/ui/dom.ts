// ui/dom.ts: creazione e ricerca degli elementi della pagina: el (elemento con classe e testo), icon, need (valore che
// c'è sempre, errore chiaro se manca), query / queryAll (con il controllo del tipo), pageEl (elemento della pagina
// iniziale che c'è sempre).
// Livello 2 (ui/ base). Non dipende da niente. Usato da: quasi tutti i moduli di ui/, avvio.ts.
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Valore che c'è sempre (un elemento della pagina creato dall'app, uno stato già pronto): se manca è un errore del
// programma, con un messaggio chiaro (invece dell'errore di accesso a null che darebbe JavaScript)
export function need<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new TypeError(what + ' mancante');
  return value;
}

// Primo elemento dentro root che corrisponde al selettore ed è del tipo indicato; null altrimenti (il tipo si controlla
// davvero, non si suppone)
export function query<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T | null {
  const node = root.querySelector(selector);
  return node instanceof type ? node : null;
}

// Tutti gli elementi dentro root che corrispondono al selettore e sono del tipo indicato
export function queryAll<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T[] {
  return Array.from(root.querySelectorAll(selector)).filter((n): n is T => n instanceof type);
}

export function icon(name: string): HTMLSpanElement {
  const span = el('span', 'ae-icon ae-icon--' + name);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

// Elemento della pagina iniziale che c'è sempre (creato da index.html o dall'app)
export function pageEl<T extends HTMLElement>(root: ParentNode, selector: string, type: abstract new () => T): T {
  return need(query(root, selector, type), selector);
}
