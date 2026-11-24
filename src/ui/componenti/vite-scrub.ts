// ui/componenti/vite-scrub.ts: i conti dello scrubbing delle vite (quando parte, valore dal trascinamento, cambio
// mostrato), senza DOM, così si provano nei test. File di supporto di vite.ts.
// Livello 3 (ui/componenti/). Non dipende da niente. Usato da: ui/componenti/vite.ts, tests/vite-scrub.test.ts.

// Pixel di trascinamento verticale per un punto di vita
export const LIFE_SCRUB_PX = 30;
// Pixel di movimento prima che lo scrubbing parta (o che il gesto, di lato, si annulli)
export const LIFE_SCRUB_START = 6;

// Dal punto in cui il dito è sceso: up = quanto è salito (positivo in su), side = spostamento di lato.
// 'start': parte lo scrubbing (almeno LIFE_SCRUB_START in verticale e più in verticale che di lato); 'cancel': il dito
// è andato di lato oltre LIFE_SCRUB_START prima di partire (il gesto non è uno scrubbing); 'wait': ancora niente
export function scrubStart(up: number, side: number): 'start' | 'cancel' | 'wait' {
  if (Math.abs(up) < LIFE_SCRUB_START || Math.abs(up) < Math.abs(side)) return Math.abs(side) > LIFE_SCRUB_START ? 'cancel' : 'wait';
  return 'start';
}

// Vita dopo uno spostamento di `up` pixel in su (negativo = in giù) da quando lo scrubbing è partito: 1 punto ogni
// LIFE_SCRUB_PX (arrotondato), mai sotto 0 né sopra `cap`
export function scrubValue(start: number, up: number, cap: number): number {
  return Math.min(cap, Math.max(0, start + Math.round(up / LIFE_SCRUB_PX)));
}

// Il cambio rispetto all'inizio, come nella finestra della vita: "+x", "−y" (segno meno tipografico) o '' se uguale
export function scrubDelta(change: number): string {
  return change > 0 ? '+' + change : change < 0 ? '−' + Math.abs(change) : '';
}
