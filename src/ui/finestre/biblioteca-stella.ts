// ui/finestre/biblioteca-stella.ts: la stella dei preferiti, sopra l'angolo in alto a sinistra di una carta (miniatura o
// zoom). Vuota e bianca se la carta non è preferita, piena e dorata se lo è. Il tocco cambia la preferita senza aprire
// la carta e senza conferme. Tutte le stelle sulla pagina si aggiornano insieme (aggiornaStelle).
// Livello 4 (finestre). Dipende da: ui/testi.ts, ui/dom.ts, ui/finestre/biblioteca-icone.ts,
// ui/finestre/biblioteca-preferiti.ts. Usato da: ui/finestre/biblioteca-carte.ts, ui/finestre/biblioteca-zoom.ts,
// ui/finestre/biblioteca.ts. Stile: biblioteca.css.

import { T } from '../testi.ts';
import { el } from '../dom.ts';
import { iconaStella } from './biblioteca-icone.ts';
import { alternaPreferita, preferita } from './biblioteca-preferiti.ts';

function allineaStella(stella: HTMLElement): void {
  const on = preferita(stella.dataset.chiave ?? '');
  stella.classList.toggle('is-on', on);
  stella.setAttribute('aria-pressed', String(on));
  stella.setAttribute('aria-label', on ? T.libraryUnfavorite : T.libraryFavorite);
}

// `chiave` identifica la carta (chiaveCarta); `grande` è la stella dello zoom (area di tocco più ampia)
export function bottoneStella(chiave: string, grande: boolean): HTMLButtonElement {
  const stella = el('button', grande ? 'biblioteca-star is-large' : 'biblioteca-star');
  stella.type = 'button';
  stella.dataset.chiave = chiave;
  stella.appendChild(iconaStella());
  stella.addEventListener('click', e => {
    // Il tocco sulla stella non deve arrivare al contenitore (la carta, o lo zoom che si chiuderebbe)
    e.stopPropagation();
    alternaPreferita(chiave);
  });
  allineaStella(stella);
  return stella;
}

// Riallinea tutte le stelle presenti (griglia, carosello, zoom)
export function aggiornaStelle(): void {
  document.querySelectorAll<HTMLElement>('[data-chiave]').forEach(allineaStella);
}
