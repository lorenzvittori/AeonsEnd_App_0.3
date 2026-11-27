// ui/finestre/biblioteca-zoom.ts: lo zoom di una carta della Biblioteca, a tutto schermo, con le proporzioni originali
// (la scansione intera, senza ritagli) e la stella dei preferiti nell'angolo in alto a sinistra. Supporto di biblioteca.ts
// (stesso livello 4): non importa il file principale. Stile: biblioteca.css.
// Livello 4 (finestre). Dipende da: ui/testi.ts, ui/dom.ts, tipi/dati.ts, ui/finestre/biblioteca-stella.ts.
// Usato da: ui/finestre/biblioteca.ts.

import { T } from '../testi.ts';
import { el, icon } from '../dom.ts';
import type { CartaSupply } from '../../tipi/dati.ts';
import { bottoneStella } from './biblioteca-stella.ts';

// `layer` (la Biblioteca) resta inerte finché lo zoom è aperto; alla chiusura il fuoco torna alla carta (`origine`).
// Il tocco sulla stella cambia la preferita senza chiudere lo zoom (bottoneStella ferma la propagazione)
export function apriZoomCarta(carta: CartaSupply, chiave: string, origine: HTMLElement, layer: HTMLElement): void {
  const zoom = el('div', 'collection-screen biblioteca-zoom');
  zoom.setAttribute('role', 'dialog');
  zoom.setAttribute('aria-modal', 'true');
  zoom.setAttribute('aria-label', carta.name);
  const testata = el('div', 'collection-head biblioteca-zoom-head');
  const chiudiZoom = el('button', 'ae-icon-button');
  chiudiZoom.type = 'button';
  chiudiZoom.setAttribute('aria-label', T.close);
  chiudiZoom.appendChild(icon('close'));
  testata.append(chiudiZoom);
  const scena = el('div', 'biblioteca-zoom-stage');
  const cornice = el('div', 'biblioteca-zoom-frame');
  const img = el('img');
  img.src = carta.image;
  img.alt = carta.name;
  cornice.append(img, bottoneStella(chiave, true));
  scena.append(cornice);
  zoom.append(testata, scena);
  const chiudiIngrandimento = () => {
    zoom.remove();
    layer.inert = false;
    // La Biblioteca non si ridisegna: la posizione di scorrimento resta com'era
    if (origine.isConnected) origine.focus({ preventScroll: true });
  };
  chiudiZoom.addEventListener('click', chiudiIngrandimento);
  scena.addEventListener('click', chiudiIngrandimento);
  zoom.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); chiudiIngrandimento(); } });
  document.body.appendChild(zoom);
  layer.inert = true;
  chiudiZoom.focus();
}
