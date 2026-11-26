// ui/schermate/mazzo-turni-riga.ts: i conti della riga della schermata del mazzo dei turni (spazi tra gli oggetti,
// centratura, fascia delle zone di rilascio), senza DOM, così si provano nei test. File di supporto di mazzo-turni.ts.
// Livello 5 (ui/schermate/). Non dipende da niente. Usato da: ui/schermate/mazzo-turni.ts, tests/mazzo-turni-riga.test.ts.

// Un oggetto della riga (carte, cerchi, segmento verticale) con la sua larghezza visibile e la posizione
export interface OggettoRiga {
  kind: 'pile' | 'pileEmpty' | 'pileZone' | 'divider' | 'top' | 'deck' | 'deckEmpty' | 'bottom';
  i: number;                     // posizione della carta (scarti o mazzo); -1 per gli altri oggetti
  vis: number;                   // larghezza visibile
  left: number;                  // bordo sinistro visibile (dopo spaceItems)
  right: number;                 // bordo destro visibile (dopo spaceItems)
  on?: OggettoRiga;              // fuori dalla fila: centrato su questo oggetto (cerchio sul posto vuoto o sul segnaposto)
}

// Tra due carte vicine (scarti-scarti, mazzo-mazzo) lo spazio è questa frazione di quello tra gli altri oggetti
// (carta-cerchio, cerchio-segmento, carta-segmento)
export const CARD_GAP_K = 0.5;
// Con la guida tra due carte del mazzo, quelle due si scostano di tanto ciascuna (solo da vedere)
export const TURN_SPREAD = 3;
// Fascia verticale delle zone di rilascio: l'altezza delle carte più tanto sopra e tanto sotto
export const DROP_PAD_TOP = 24, DROP_PAD_BOTTOM = 32;

export function isCardItem(it: OggettoRiga): boolean {
  return it.kind === 'pile' || it.kind === 'deck' || it.kind === 'pileEmpty' || it.kind === 'deckEmpty';
}

// Mette in fila gli oggetti (tranne quelli con it.on) in una riga larga W: spazio g tra due oggetti, g * CARD_GAP_K tra
// due carte vicine, la fila occupa sempre tutta la riga (primo oggetto sul bordo sinistro, ultimo su quello destro; un
// oggetto solo sta al centro). Gli oggetti con it.on stanno al centro dell'oggetto it.on. Scrive left e right di ogni
// oggetto e restituisce g
export function spaceItems(items: OggettoRiga[], W: number): number {
  const flow = items.filter(it => !it.on);
  const sum = flow.reduce((s, it) => s + it.vis, 0);
  const f = flow.slice(1).map((it, i) => isCardItem(it) && isCardItem(flow[i]) ? CARD_GAP_K : 1);
  const units = f.reduce((s, x) => s + x, 0);
  const g = units ? (W - sum) / units : 0;
  let x = Math.max(0, (W - sum - g * units) / 2);
  flow.forEach((it, i) => { it.left = x; it.right = x + it.vis; x = it.right + g * (f[i] || 0); });
  items.forEach(it => {
    if (!it.on) return;
    it.left = it.on.left + it.on.vis / 2 - it.vis / 2;
    it.right = it.left + it.vis;
  });
  return g;
}

// y (centro della carta trascinata) è nella fascia delle zone di rilascio: tra laneTop − DROP_PAD_TOP e
// laneBottom + DROP_PAD_BOTTOM (bordi compresi)
export function inCardBand(y: number, laneTop: number, laneBottom: number): boolean {
  return y >= laneTop - DROP_PAD_TOP && y <= laneBottom + DROP_PAD_BOTTOM;
}
