// Vite di Gravehold e della nemesi (src/regole/vite.js) con nemesis.json vero: valori iniziali, tetto, passi,
// Vittoria a 0 della nemesi, Sconfitta a 0 di Gravehold.
import { describe, it, expect } from 'vitest';
import * as V from '../src/regole/vite.ts';
import { nemeses } from './aiuto.js';

describe('vite e fine partita', () => {
  it('valori iniziali: Gravehold 30, nemesi dal campo life di nemesis.json', () => {
    expect(V.GRAVEHOLD_LIFE).toBe(30);
    const withLife = nemeses.filter(n => typeof n.life === 'number');
    expect(withLife.length).toBeGreaterThan(10);
    withLife.forEach(n => {
      expect(V.nemesisStartLife(nemeses, n.name), n.name).toBe(n.life);
      expect(V.startLife('nemesis', nemeses, n.name)).toBe(n.life);
      expect(V.startLife('grave', nemeses, n.name)).toBe(30);
    });
    expect(V.nemesisStartLife(nemeses, 'Nessuna')).toBe(0);
    expect(V.nemesisStartLife(null, 'Rageborne')).toBe(0);
    expect(V.nemesisStartLife([{ name: 'X', life: '70' }], 'X'), 'life non numerico').toBe(0);
  });

  it('tetto: il valore iniziale, o la vita attuale se è più alta; passi tra 0 e il tetto', () => {
    expect(V.lifeCap(20, 30)).toBe(30);
    expect(V.lifeCap(34, 30)).toBe(34);
    expect(V.stepLife(28, 5, 30)).toBe(30);
    expect(V.stepLife(3, -5, 30)).toBe(0);
    expect(V.stepLife(10, -1, 30)).toBe(9);
    expect(V.stepLife(34, 1, V.lifeCap(34, 30))).toBe(34);
  });

  it('scrittura della vita: solo il campo giusto della partita', () => {
    const g = { graveLife: 30, nemesisLife: 70, other: 1 };
    V.setLife(g, 'grave', 12);
    expect(g).toEqual({ graveLife: 12, nemesisLife: 70, other: 1 });
    V.setLife(g, 'nemesis', 0);
    expect(g).toEqual({ graveLife: 12, nemesisLife: 0, other: 1 });
  });

  it('fine partita: Vittoria a 0 della nemesi, Sconfitta a 0 di Gravehold, solo se la vita è cambiata', () => {
    expect(V.lifeOutcome('nemesis', 0, true)).toBe('victory');
    expect(V.lifeOutcome('grave', 0, true)).toBe('defeat');
    expect(V.lifeOutcome('grave', 0, false)).toBe(null);
    expect(V.lifeOutcome('nemesis', 1, true)).toBe(null);
    expect(V.lifeOutcome('grave', 5, true)).toBe(null);
  });
});
