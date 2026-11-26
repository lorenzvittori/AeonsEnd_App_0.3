// Conti della riga della finestra del mazzo dei turni (src/ui/schermate/mazzo-turni-riga.ts): spazi, metà tra due
// carte, centratura, oggetti centrati su un altro (it.on), fascia delle zone di rilascio.
import { describe, it, expect } from 'vitest';
import { CARD_GAP_K, DROP_PAD_BOTTOM, DROP_PAD_TOP, inCardBand, isCardItem, spaceItems } from '../src/ui/schermate/mazzo-turni-riga.ts';
import type { OggettoRiga } from '../src/ui/schermate/mazzo-turni-riga.ts';

const item = (kind: OggettoRiga['kind'], vis: number, on?: OggettoRiga): OggettoRiga => ({ kind, i: -1, vis, left: 0, right: 0, ...(on ? { on } : {}) });
const gaps = (its: OggettoRiga[]) => its.slice(1).map((it, i) => +(it.left - its[i].right).toFixed(6));

describe('spaceItems', () => {
  it('la fila riempie sempre la riga (bordo a bordo), metà spazio tra due carte vicine', () => {
    const its = [item('pile', 40), item('divider', 1), item('deck', 40), item('deck', 40)];
    const W = 343;
    const g = spaceItems(its, W);
    // carta-segmento, segmento-carta: g; carta-carta: g * CARD_GAP_K
    expect(gaps(its)).toEqual([g, g, g * CARD_GAP_K].map(x => +x.toFixed(6)));
    expect(its[0].left).toBeCloseTo(0, 9);
    expect(its[its.length - 1].right).toBeCloseTo(W, 9);
    its.forEach(it => expect(it.right - it.left).toBe(it.vis));
  });

  it('con tanti oggetti lo spazio è più piccolo e la fila riempie la riga', () => {
    const its = [item('pile', 30), item('pile', 30), item('pile', 30), item('pileZone', 9), item('divider', 1),
      item('top', 9), ...Array.from({ length: 8 }, () => item('deck', 30)), item('bottom', 9)];
    const W = 420;
    const g = spaceItems(its, W);
    expect(g).toBeGreaterThan(0);
    expect(its[0].left).toBeCloseTo(0, 9);
    expect(its[its.length - 1].right).toBeCloseTo(W, 9);
    // unità: 2 + 6 + 7 coppie carta-carta a metà, 5 coppie intere (pile-zona, zona-segmento, segmento-cima, cima-carta, carta-fondo)
    const units = 9 * CARD_GAP_K + 5;
    const sum = its.reduce((s, it) => s + it.vis, 0);
    expect(g).toBeCloseTo((W - sum) / units, 9);
    gaps(its).forEach((x, i) => expect(x).toBeCloseTo(isCardItem(its[i]) && isCardItem(its[i + 1]) ? g * CARD_GAP_K : g, 5));
  });

  it('gli oggetti con it.on non sono in fila: stanno al centro del loro oggetto', () => {
    const empty = item('pileEmpty', 44);
    const zone = item('pileZone', 13, empty);
    const deck0 = item('deck', 37.4);
    const top = item('top', 13, deck0);
    const its = [empty, zone, item('divider', 1), top, deck0, item('deck', 37.4)];
    const alone = [item('pileEmpty', 44), item('divider', 1), item('deck', 37.4), item('deck', 37.4)];
    const g = spaceItems(its, 343);
    expect(g).toBe(spaceItems(alone, 343));
    expect(empty.left).toBeCloseTo(alone[0].left, 9);
    expect(zone.left + zone.vis / 2).toBeCloseTo(empty.left + empty.vis / 2, 9);
    expect(top.left + top.vis / 2).toBeCloseTo(deck0.left + deck0.vis / 2, 9);
    expect(zone.right - zone.left).toBe(13);
  });

  it('un oggetto solo: spazio 0, al centro; riga troppo stretta: la fila parte da 0', () => {
    const one = [item('deckEmpty', 40)];
    expect(spaceItems(one, 100)).toBe(0);
    expect(one[0].left).toBe(30);
    const tight = [item('deck', 60), item('deck', 60)];
    spaceItems(tight, 100);
    expect(tight[0].left).toBe(0);
  });
});

describe('inCardBand', () => {
  it('24px sopra e 32px sotto la corsia, bordi compresi', () => {
    expect([DROP_PAD_TOP, DROP_PAD_BOTTOM]).toEqual([24, 32]);
    const top = 100, bottom = 160;
    expect(inCardBand(top - 23, top, bottom)).toBe(true);
    expect(inCardBand(top - 24, top, bottom)).toBe(true);
    expect(inCardBand(top - 25, top, bottom)).toBe(false);
    expect(inCardBand(bottom + 31, top, bottom)).toBe(true);
    expect(inCardBand(bottom + 32, top, bottom)).toBe(true);
    expect(inCardBand(bottom + 33, top, bottom)).toBe(false);
  });
});
