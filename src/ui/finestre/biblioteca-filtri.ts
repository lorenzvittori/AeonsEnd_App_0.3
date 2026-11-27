// ui/finestre/biblioteca-filtri.ts: i pezzi della barra dei filtri della Biblioteca. Il box di un filtro (icona e freccia,
// senza testo), il suo menu a selezione multipla (titolo, caselle, Azzera, Applica; il menu si sovrappone alle carte,
// non le sposta) e il chip di un filtro attivo, con la X per toglierlo. Le scelte nel menu sono una bozza: valgono solo
// con Applica; tocco fuori o Esc chiudono senza applicare.
// Livello 4 (finestre). Dipende da: ui/dom.ts, ui/testi.ts, ui/finestre/biblioteca-icone.ts. Usato da: ui/finestre/biblioteca.ts.
// Stile: biblioteca.css.

import { T } from '../testi.ts';
import { el, icon } from '../dom.ts';
import { iconaFreccia } from './biblioteca-icone.ts';

// Una voce del menu: il valore (la chiave della scelta), il testo, il numero di carte e il colore del tag (se è una meccanica)
export interface VoceFiltro {
  valore: string;
  testo: string;
  conteggio?: number;
  colore?: string | null;
}

export interface MenuFiltro {
  // Il contenitore del box e del menu (relativo, così il menu parte dal box)
  wrap: HTMLElement;
  box: HTMLButtonElement;
  pannello: HTMLElement;
  aperto(): boolean;
  // Apre il menu con le voci date e le scelte attuali (la bozza parte da queste)
  apri(voci: VoceFiltro[], scelti: ReadonlySet<string>): void;
  chiudi(): void;
  // Vero se il tocco o il fuoco è dentro il box o il menu (il tocco fuori chiude il menu)
  contiene(nodo: Node | null): boolean;
}

interface OpzioniMenu {
  titolo: string;
  icona: Element;
  // Dà le voci e le scelte quando il box viene toccato
  voci: () => VoceFiltro[];
  scelti: () => ReadonlySet<string>;
  // Riceve le scelte da Applica (il menu si chiude dopo)
  applica: (scelti: Set<string>) => void;
}

// Il box di un filtro: sfondo scuro, bordo sottile, angoli 8 px; in evidenza (oro) quando il filtro è attivo
export function creaMenuFiltro(opzioni: OpzioniMenu): MenuFiltro {
  const wrap = el('div', 'biblioteca-fmenu');
  const box = el('button', 'biblioteca-fbox');
  box.type = 'button';
  box.setAttribute('aria-label', opzioni.titolo);
  box.setAttribute('aria-haspopup', 'dialog');
  box.setAttribute('aria-expanded', 'false');
  const freccia = el('span', 'biblioteca-fbox-arrow');
  freccia.setAttribute('aria-hidden', 'true');
  freccia.appendChild(iconaFreccia());
  box.append(opzioni.icona, freccia);

  // Il pannello: titolo del filtro, le caselle, Azzera e Applica
  const pannello = el('div', 'biblioteca-fpanel');
  pannello.setAttribute('role', 'dialog');
  pannello.setAttribute('aria-label', opzioni.titolo);
  pannello.hidden = true;
  const titolo = el('div', 'biblioteca-fpanel-title', opzioni.titolo);
  const elenco = el('div', 'biblioteca-fpanel-list');
  elenco.setAttribute('role', 'group');
  elenco.setAttribute('aria-label', opzioni.titolo);
  const azioni = el('div', 'biblioteca-fpanel-actions');
  const azzera = el('button', 'biblioteca-fpanel-clear', T.libraryClear);
  azzera.type = 'button';
  const applicaBtn = el('button', 'biblioteca-fpanel-apply', T.libraryApply);
  applicaBtn.type = 'button';
  azioni.append(azzera, applicaBtn);
  pannello.append(titolo, elenco, azioni);
  wrap.append(box, pannello);

  let bozza = new Set<string>();
  let aperto = false;
  const caselle: HTMLInputElement[] = [];

  function chiudi(): void {
    aperto = false;
    pannello.hidden = true;
    box.setAttribute('aria-expanded', 'false');
  }

  function apri(voci: VoceFiltro[], scelti: ReadonlySet<string>): void {
    bozza = new Set(scelti);
    caselle.length = 0;
    elenco.replaceChildren(...voci.map(v => {
      const riga = el('label', 'biblioteca-fpanel-row');
      const casella = el('input');
      casella.type = 'checkbox';
      casella.value = v.valore;
      casella.checked = bozza.has(v.valore);
      casella.addEventListener('change', () => {
        if (casella.checked) bozza.add(v.valore);
        else bozza.delete(v.valore);
      });
      caselle.push(casella);
      // Una meccanica (colore dato, anche null) si mostra con il suo tag; gli altri filtri con il testo semplice
      const nome = v.colore === undefined
        ? el('span', 'biblioteca-fpanel-name', v.testo)
        : el('span', 'biblioteca-tag', v.testo);
      if (v.colore) nome.style.setProperty('--tag', v.colore);
      riga.append(casella, nome);
      if (v.conteggio !== undefined) riga.append(el('span', 'biblioteca-fpanel-count', String(v.conteggio)));
      return riga;
    }));
    // Il pannello si mette sotto il box, senza uscire dallo schermo (fisso nella finestra)
    aperto = true;
    pannello.hidden = false;
    box.setAttribute('aria-expanded', 'true');
    const r = box.getBoundingClientRect();
    const larghezza = Math.min(260, window.innerWidth - 16);
    pannello.style.width = `${larghezza}px`;
    pannello.style.top = `${Math.round(r.bottom + 4)}px`;
    pannello.style.left = `${Math.round(Math.max(8, Math.min(r.left, window.innerWidth - larghezza - 8)))}px`;
  }

  box.addEventListener('click', () => {
    if (aperto) chiudi();
    else apri(opzioni.voci(), opzioni.scelti());
  });
  azzera.addEventListener('click', () => {
    bozza.clear();
    caselle.forEach(c => { c.checked = false; });
  });
  applicaBtn.addEventListener('click', () => {
    opzioni.applica(new Set(bozza));
    chiudi();
  });

  return {
    wrap,
    box,
    pannello,
    aperto: () => aperto,
    apri,
    chiudi,
    contiene: (nodo: Node | null) => nodo !== null && wrap.contains(nodo),
  };
}

// Il chip di un filtro attivo: il testo e una X per toglierlo (la riga dei chip scorre in orizzontale)
export function creaChip(testo: string, rimuovi: string, alRimuovere: () => void, colore?: string | null): HTMLElement {
  const chip = el('span', 'biblioteca-achip');
  const nome = el('span', 'biblioteca-achip-text', testo);
  if (colore) nome.style.setProperty('--tag', colore);
  const x = el('button', 'biblioteca-achip-x');
  x.type = 'button';
  x.setAttribute('aria-label', rimuovi);
  x.appendChild(icon('close'));
  x.addEventListener('click', alRimuovere);
  chip.append(nome, x);
  return chip;
}
