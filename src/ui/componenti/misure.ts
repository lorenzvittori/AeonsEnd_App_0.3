// ui/componenti/misure.ts: la misura delle carte grandi, una sola regola per turno giocatori e turno nemesi
// (sharedCardWidth), e la colonna centrale su tablet e desktop (sizeColumn).
// Livello 3 (ui/componenti/). Dipende da: ui/pagina.ts. Usato da: schermate turno giocatori e turno nemesi.
import { app, CARD_RATIO } from '../pagina.ts';

export const PEEK_VISIBLE = 14;

// spazio tra le carte
export const PEEK_GAP = 12;

// Larghezza della carta grande: UNA sola regola per turno giocatori e turno nemesi, così sono sempre uguali.
// Sopra la carta il box vita/token (STATUS_H + 8 di spazio); i comandi del turno giocatori (52px) stanno sotto, quindi
// si riserva lo spazio anche nel turno nemesi; il blocco è centrato in verticale.
// Altezza della riga vita/token sopra la carta: deve restare uguale a turno-nemesi.css .ae-focus-status e turno-giocatori.css .queue-slot
export const STATUS_H = 37;

export function sharedCardWidth(boxW: number, boxH: number, padY: number, peekRoom: number): number {
  const byWidth = boxW - 16 - peekRoom; // 8px di margine per lato
  const byHeight = (boxH - padY - STATUS_H - 8) / CARD_RATIO;
  const byControls = (boxH - 2 * 52 - STATUS_H - 8) / CARD_RATIO;
  return Math.floor(Math.min(byWidth, byHeight, byControls));
}

// Tablet e desktop (da 768px): la partita sta in una colonna al centro (--ae-col su .ae-shell, base.css). La colonna
// è larga quanto la carta grande (misurata solo dall'altezza: in larghezza c'è spazio) più un pezzo delle vicine
// (COLUMN_PEEK per lato), mai meno di COLUMN_MIN né più dello schermo. Sotto i 768px la colonna è lo schermo intero.
export const COLUMN_MIN = 440;

export const COLUMN_PEEK = 42;

export function sizeColumn(box: HTMLElement): void {
  if (window.innerWidth < 768) { app.style.removeProperty('--ae-col'); return; }
  const style = getComputedStyle(box);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const card = sharedCardWidth(Infinity, box.clientHeight, padY, 0);
  if (!isFinite(card) || card <= 0) return;
  const col = Math.min(window.innerWidth, Math.max(COLUMN_MIN, card + 2 * (COLUMN_PEEK + PEEK_GAP) + 16));
  const current = parseFloat(app.style.getPropertyValue('--ae-col')) || 0;
  if (Math.abs(current - col) >= 1) app.style.setProperty('--ae-col', col + 'px');
}
