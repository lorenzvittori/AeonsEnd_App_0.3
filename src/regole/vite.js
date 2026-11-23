// regole/vite.js: le vite di Gravehold e della nemesi, e la fine della partita a 0.
// Riceve: kind ('grave' = Gravehold, 'nemesis' = nemesi), i valori delle vite, nemeses (nemesis.json) e il nome della
// nemesi; setLife riceve `g` (la partita) e ne cambia graveLife / nemesisLife.
// Restituisce numeri (vite, tetto) o l'esito della partita ('victory', 'defeat', null); solo setLife modifica qualcosa.
// Usato da: stato/partita.js, ui/schermate/turno-nemesi.js (finestra della vita, attraverso stato/partita.js),
// regole/salvataggio.js, test in tests/vite.test.js.
//
// Come funziona: Gravehold parte da 30, la nemesi dal campo "life" di nemesis.json (0 se manca). Nella finestra della
// vita i passi (−5 −1 +1 +5) non scendono sotto 0 né salgono sopra il tetto (il valore iniziale, o la vita attuale se è
// più alta). Alla chiusura, se la vita è cambiata ed è arrivata a 0: nemesi a 0 = Vittoria, Gravehold a 0 = Sconfitta.

export const GRAVEHOLD_LIFE = 30;

// Vita iniziale della nemesi (campo "life" di nemesis.json); 0 se la nemesi non c'è o non ha il campo
export function nemesisStartLife(nemeses, nemesisName) {
  const n = (nemeses || []).find(x => x.name === nemesisName);
  return n && typeof n.life === 'number' ? n.life : 0;
}

// Vita iniziale di Gravehold o della nemesi
export function startLife(kind, nemeses, nemesisName) {
  return kind === 'grave' ? GRAVEHOLD_LIFE : nemesisStartLife(nemeses, nemesisName);
}

// Tetto della vita: il valore iniziale, o la vita attuale se è più alta
export function lifeCap(current, start) {
  return Math.max(current, start);
}

// Un passo della finestra della vita: tra 0 e il tetto
export function stepLife(value, step, cap) {
  return Math.min(cap, Math.max(0, value + step));
}

// Scrive la vita. Modifica g (graveLife o nemesisLife)
export function setLife(g, kind, value) {
  if (kind === 'grave') g.graveLife = value; else g.nemesisLife = value;
}

// Fine della partita dopo un cambio di vita: 'defeat' (Gravehold a 0), 'victory' (nemesi a 0), null altrimenti
// (anche se la vita non è cambiata)
export function lifeOutcome(kind, value, changed) {
  if (!changed || value !== 0) return null;
  return kind === 'grave' ? 'defeat' : 'victory';
}
