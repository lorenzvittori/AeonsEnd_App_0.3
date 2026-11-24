// Conti del number scrubbing sui box delle vite (src/ui/schermate/vite-scrub.ts): quando parte, passi da 30px, limiti
// 0 e massimo, cambio mostrato.
import { describe, it, expect } from 'vitest';
import { LIFE_SCRUB_PX, LIFE_SCRUB_START, scrubDelta, scrubStart, scrubValue } from '../src/ui/schermate/vite-scrub.ts';

describe('scrubbing delle vite', () => {
  it('parte dopo 6px in verticale, se più in verticale che di lato; di lato oltre 6px si annulla', () => {
    expect([LIFE_SCRUB_PX, LIFE_SCRUB_START]).toEqual([30, 6]);
    expect(scrubStart(5, 0)).toBe('wait');
    expect(scrubStart(6, 0)).toBe('start');
    expect(scrubStart(-6, 2)).toBe('start');
    expect(scrubStart(7, 8)).toBe('cancel');
    expect(scrubStart(3, 6)).toBe('wait');
    expect(scrubStart(3, 7)).toBe('cancel');
    expect(scrubStart(10, 10)).toBe('start');
  });

  it('1 punto ogni 30px (arrotondato), in su sale e in giù scende, tra 0 e il massimo', () => {
    expect(scrubValue(20, 0, 30)).toBe(20);
    expect(scrubValue(20, 14, 30)).toBe(20);
    expect(scrubValue(20, 15, 30)).toBe(21);
    expect(scrubValue(20, 30, 30)).toBe(21);
    expect(scrubValue(20, 45, 30)).toBe(22);
    expect(scrubValue(20, -44, 30)).toBe(19);
    expect(scrubValue(20, -46, 30)).toBe(18);
    expect(scrubValue(20, 30 * 50, 30)).toBe(30);
    expect(scrubValue(20, -30 * 50, 30)).toBe(0);
    expect(scrubValue(35, 30, 35)).toBe(35);
  });

  it('cambio come nella finestra: +x, −y, niente se uguale', () => {
    expect(scrubDelta(3)).toBe('+3');
    expect(scrubDelta(-2)).toBe('−2');
    expect(scrubDelta(0)).toBe('');
  });
});
