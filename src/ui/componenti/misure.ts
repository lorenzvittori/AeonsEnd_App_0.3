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

// Quanto si vede delle carte vicine ai lati e lo spazio tra le carte, nel calcolo della misura (lo spazio è quello del
// carosello del turno nemesi, usato anche per la coda del turno giocatori)
export function spazioVicine(): number {
  return 2 * (misura('--carte-grandi-vicine-visibili') + misura('--carte-grandi-spazio-nemesi'));
}

// Larghezza della carta grande: UNA sola regola per turno giocatori e turno nemesi, così sono sempre uguali.
// Sopra la carta la riga vita/token (con il suo spazio); i comandi del turno giocatori (zona 6) stanno sotto, quindi si
// riserva lo spazio anche nel turno nemesi; il blocco è centrato in verticale.
export function sharedCardWidth(boxW: number, boxH: number, padY: number, peekRoom: number): number {
  const ratio = rapportoCarta();
  const statusH = misura('--carte-grandi-riga-stato-altezza');
  const statusGap = misura('--carte-grandi-riga-stato-distanza');
  const controls = misura('--interattivi-altezza') + misura('--interattivi-distanza');
  const byWidth = boxW - 2 * misura('--carte-grandi-margine-lato') - peekRoom;
  const byHeight = (boxH - padY - statusH - statusGap) / ratio;
  const byControls = (boxH - 2 * controls - statusH - statusGap) / ratio;
  return Math.floor(Math.min(byWidth, byHeight, byControls));
}

// Tablet e desktop (da 768px): la partita sta in una colonna al centro (--ae-col su .ae-shell, base.css). La colonna
// è larga quanto la carta grande (misurata solo dall'altezza: in larghezza c'è spazio) più un pezzo delle vicine
// (--colonna-vicine-visibili per lato), mai meno di --colonna-larghezza-minima né più dello schermo. Sotto i 768px la
// colonna è lo schermo intero.
export function sizeColumn(box: HTMLElement): void {
  if (window.innerWidth < 768) { app.style.removeProperty('--ae-col'); return; }
  const style = getComputedStyle(box);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const card = sharedCardWidth(Infinity, box.clientHeight, padY, 0);
  if (!isFinite(card) || card <= 0) return;
  const peek = misura('--colonna-vicine-visibili') + misura('--carte-grandi-spazio-nemesi');
  const col = Math.min(window.innerWidth, Math.max(misura('--colonna-larghezza-minima'),
    card + 2 * peek + 2 * misura('--carte-grandi-margine-lato')));
  const current = parseFloat(app.style.getPropertyValue('--ae-col')) || 0;
  if (Math.abs(current - col) >= 1) app.style.setProperty('--ae-col', col + 'px');
}
