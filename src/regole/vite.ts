// regole/vite.ts: le vite di Gravehold e della nemesi, e la fine della partita a 0.
// Riceve: kind ('grave' = Gravehold, 'nemesis' = nemesi), i valori delle vite, nemeses (nemesis.json) e il nome della
// nemesi; setLife riceve `g` (la partita) e ne cambia graveLife / nemesisLife.
// Restituisce numeri (vite, tetto) o l'esito della partita ('victory', 'defeat', null); solo setLife modifica qualcosa.
// Dipende da: tipi/. Usato da: stato/partita.ts, ui/schermate/turno-nemesi.ts (finestra della vita),
// regole/salvataggio.ts, test in tests/vite.test.ts.
//
// Come funziona: Gravehold parte da 30, la nemesi dal campo "life" di nemesis.json (0 se manca). Nella finestra della
// vita i passi (−5 −1 +1 +5) non scendono sotto 0 né salgono sopra il tetto (il valore iniziale, o la vita attuale se è
// più alta). Alla chiusura, se la vita è cambiata ed è arrivata a 0: nemesi a 0 = Vittoria, Gravehold a 0 = Sconfitta.

import type { Nemesi } from '../tipi/dati.ts';
import type { Partita, TipoVita } from '../tipi/partita.ts';

// Esito della partita dopo un cambio di vita
export type EsitoVita = 'victory' | 'defeat' | null;

export const GRAVEHOLD_LIFE = 30;

// Vita iniziale della nemesi (campo "life" di nemesis.json); 0 se la nemesi non c'è o non ha il campo
export function nemesisStartLife(nemeses: readonly Nemesi[] | null, nemesisName: string | null): number {
  const n = (nemeses || []).find(x => x.name === nemesisName);
  return n && typeof n.life === 'number' ? n.life : 0;
}

// Vita iniziale di Gravehold o della nemesi
export function startLife(kind: TipoVita, nemeses: readonly Nemesi[] | null, nemesisName: string | null): number {
  return kind === 'grave' ? GRAVEHOLD_LIFE : nemesisStartLife(nemeses, nemesisName);
}

// Tetto della vita: il valore iniziale, o la vita attuale se è più alta
export function lifeCap(current: number, start: number): number {
  return Math.max(current, start);
}

// Un passo della finestra della vita: tra 0 e il tetto
export function stepLife(value: number, step: number, cap: number): number {
  return Math.min(cap, Math.max(0, value + step));
}

// Scrive la vita. Modifica g (graveLife o nemesisLife)
export function setLife(g: Pick<Partita, 'graveLife' | 'nemesisLife'>, kind: TipoVita, value: number): void {
  if (kind === 'grave') g.graveLife = value; else g.nemesisLife = value;
}

// Fine della partita dopo un cambio di vita: 'defeat' (Gravehold a 0), 'victory' (nemesi a 0), null altrimenti
// (anche se la vita non è cambiata)
export function lifeOutcome(kind: TipoVita, value: number, changed: boolean): EsitoVita {
  if (!changed || value !== 0) return null;
  return kind === 'grave' ? 'defeat' : 'victory';
}
