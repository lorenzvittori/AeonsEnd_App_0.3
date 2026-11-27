// ui/finestre/biblioteca-carte.ts: le carte della Biblioteca come elementi. La miniatura (un pulsante), il pannello sotto
// (il box su una riga e le meccaniche come tag colorati da ui/colori-meccaniche.ts) e il messaggio di stato.
// Supporto di biblioteca.ts (stesso livello 4): non importa il file principale. Stile: biblioteca.css.
// Livello 4 (finestre). Dipende da: ui/dom.ts, tipi/dati.ts, regole/biblioteca.ts, ui/colori-meccaniche.ts.
// Usato da: ui/finestre/biblioteca.ts.

import { el } from '../dom.ts';
import type { CartaSupply } from '../../tipi/dati.ts';
import { etichettaBox, meccanicheCarta } from '../../regole/biblioteca.ts';
import { coloreMeccanica } from '../colori-meccaniche.ts';
import { bottoneStella } from './biblioteca-stella.ts';

export function messaggio(testo: string): HTMLElement {
  return el('p', 'biblioteca-message', testo);
}

// Chi apre lo zoom di una carta: la carta, la sua chiave di preferita e il pulsante che riceve il fuoco alla chiusura
export type ApriZoom = (carta: CartaSupply, chiave: string, origine: HTMLElement) => void;

// Un pulsante di carta: solo l'immagine (miniatura), niente nome né badge. La stella sta accanto, non dentro
function bottoneCarta(carta: CartaSupply, chiave: string, apriZoom: ApriZoom): HTMLButtonElement {
  const bottone = el('button', 'biblioteca-card');
  bottone.type = 'button';
  bottone.setAttribute('aria-label', carta.name);
  const img = el('img');
  img.src = carta.thumb;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 264;
  img.height = 369;
  bottone.append(img);
  bottone.addEventListener('click', () => apriZoom(carta, chiave, bottone));
  return bottone;
}

// Il box del pannello sta su una riga: la dimensione parte da 11 px e scende (mezzo px alla volta, fino a 7 px) finché
// il testo ci sta nella larghezza del pannello. Si ricalcola quando il pannello cambia dimensione (ResizeObserver)
const DIMENSIONE_BOX = 11;
const DIMENSIONE_BOX_MINIMA = 7;
function adattaRiga(riga: HTMLElement): void {
  riga.style.fontSize = `${DIMENSIONE_BOX}px`;
  let misura = DIMENSIONE_BOX;
  while (riga.scrollWidth > riga.clientWidth && misura > DIMENSIONE_BOX_MINIMA) {
    misura -= 0.5;
    riga.style.fontSize = `${misura}px`;
  }
}

let osservatoreBox: ResizeObserver | null = null;
function osservaRiga(riga: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') { adattaRiga(riga); return; }
  if (!osservatoreBox) osservatoreBox = new ResizeObserver(voci => { for (const v of voci) adattaRiga(v.target as HTMLElement); });
  osservatoreBox.observe(riga);
}

// Le righe dei box di un disegno precedente non servono più: si smette di osservarle
export function disconnettiEtichette(): void {
  osservatoreBox?.disconnect();
}

// Subito dopo l'inserimento nel contenitore: la dimensione dei box si misura ora (ResizeObserver per i cambi successivi)
export function adattaEtichetteIn(contenitore: HTMLElement): void {
  contenitore.querySelectorAll<HTMLElement>('.biblioteca-info-box').forEach(adattaRiga);
}

// Il pannello sotto la carta: il box ("x", o "x - y" con la mini espansione y) e le meccaniche come tag, ciascuna nel suo
// colore. Null se non c'è nulla da mostrare
function pannelloCarta(carta: CartaSupply): HTMLElement | null {
  const box = etichettaBox(carta);
  const tag = meccanicheCarta(carta);
  if (box === '' && tag.length === 0) return null;
  const pannello = el('div', 'biblioteca-info');
  if (box !== '') {
    const riga = el('p', 'biblioteca-info-box', box);
    pannello.append(riga);
    osservaRiga(riga);
  }
  if (tag.length > 0) {
    const elenco = el('div', 'biblioteca-tags');
    for (const nome of tag) {
      const etichetta = el('span', 'biblioteca-tag', nome);
      const colore = coloreMeccanica(nome);
      if (colore !== null) etichetta.style.setProperty('--tag', colore);
      elenco.append(etichetta);
    }
    pannello.append(elenco);
  }
  return pannello;
}

// Una voce del carosello o della griglia: la carta (con la stella sopra l'angolo) e, sotto, il suo pannello (stessa
// larghezza, scorrono insieme). `chiave` è la chiave della carta tra le preferite (chiaveCarta)
export function voceCarta(carta: CartaSupply, chiave: string, apriZoom: ApriZoom): HTMLElement {
  const voce = el('div', 'biblioteca-item');
  const miniatura = el('div', 'biblioteca-card-wrap');
  miniatura.append(bottoneCarta(carta, chiave, apriZoom), bottoneStella(chiave, false));
  voce.append(miniatura);
  const info = pannelloCarta(carta);
  if (info) voce.append(info);
  return voce;
}
