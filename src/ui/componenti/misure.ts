// ui/componenti/misure.ts: le misure delle zone lette da ui/schermate/partita-misure.css (misura, rapportoCarta), la
// misura delle carte grandi, una sola regola per turno giocatori e turno nemesi (sharedCardWidth), e la colonna
// centrale su tablet e desktop (sizeColumn). Nessun numero proprio: le misure stanno solo nel CSS.
// Livello 3 (ui/componenti/). Dipende da: ui/pagina.ts. Usato da: schermate turno giocatori e turno nemesi.
import { app } from '../pagina.ts';

// Una misura di partita-misure.css (variabile su :root), come numero (i px si tolgono). Si legge quando serve, dalla
// pagina: al caricamento del modulo il CSS non c'è ancora
export function misura(nome: string): number {
  const valore = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(nome));
  if (!isFinite(valore)) throw new Error(`Misura ${nome} mancante in ui/schermate/partita-misure.css`);
  return valore;
}

// Altezza / larghezza della carta (88 / 63)
export function rapportoCarta(): number {
  return misura('--carta-altezza') / misura('--carta-larghezza');
}

// I due turni hanno lo spazio tra le carte grandi proprio (--carte-grandi-spazio-giocatori / -nemesi, partita-misure.css)
export type TurnoCarte = 'giocatori' | 'nemesi';

// Quanto si vede delle carte vicine ai lati e lo spazio tra le carte (quello del turno), nel calcolo della misura
export function spazioVicine(turno: TurnoCarte): number {
  return 2 * (misura('--carte-grandi-vicine-visibili') + misura(`--carte-grandi-spazio-${turno}`));
}

// Altezza dell'area delle carte (coda o carosello) senza il padding in basso (nel carosello è lo spazio per l'alone)
export function altezzaArea(box: HTMLElement): number {
  return box.clientHeight - parseFloat(getComputedStyle(box).paddingBottom);
}

// Larghezza della carta grande: UNA sola regola per turno giocatori e turno nemesi (la zona 6 c'è sempre, quindi la zona 5
// è alta uguale nei due turni). boxH è l'altezza dell'area delle carte, già senza lo spazio sopra della zona
// (--carte-grandi-spazio-sopra, che è il padding della zona 5): la carta riempie quello che resta dopo la riga vita/token
// e il suo spazio. Se è la larghezza a limitare, l'altezza che avanza si divide con i due pesi --carte-grandi-avanzo-...
export function sharedCardWidth(boxW: number, boxH: number, peekRoom: number): number {
  const ratio = rapportoCarta();
  const statusH = misura('--carte-grandi-riga-stato-altezza');
  const statusGap = misura('--carte-grandi-riga-stato-distanza');
  const byWidth = boxW - 2 * misura('--carte-grandi-margine-lato') - peekRoom;
  const byHeight = (boxH - statusH - statusGap) / ratio;
  return Math.floor(Math.min(byWidth, byHeight));
}

// Tablet e desktop (da 768px): la partita sta in una colonna al centro (--ae-col su .ae-shell, base.css). La colonna
// è larga quanto la carta grande (misurata solo dall'altezza: in larghezza c'è spazio) più un pezzo delle vicine
// (--colonna-vicine-visibili per lato), mai meno di --colonna-larghezza-minima né più dello schermo. Sotto i 768px la
// colonna è lo schermo intero.
export function sizeColumn(box: HTMLElement): void {
  if (window.innerWidth < 768) { app.style.removeProperty('--ae-col'); return; }
  const card = sharedCardWidth(Infinity, altezzaArea(box), 0);
  if (!isFinite(card) || card <= 0) return;
  // La colonna è una sola per i due turni: sempre con lo spazio del carosello nemesi (così non cambia da un turno all'altro)
  const peek = misura('--colonna-vicine-visibili') + misura('--carte-grandi-spazio-nemesi');
  const col = Math.min(window.innerWidth, Math.max(misura('--colonna-larghezza-minima'),
    card + 2 * peek + 2 * misura('--carte-grandi-margine-lato')));
  const current = parseFloat(app.style.getPropertyValue('--ae-col')) || 0;
  if (Math.abs(current - col) >= 1) app.style.setProperty('--ae-col', col + 'px');
}
