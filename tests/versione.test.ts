// La versione dell'app (src/regole/versione.ts): tag + numero di commit, con il fallback quando git non c'è.
import { describe, it, expect } from 'vitest';
import { componiVersione, VERSIONE_SENZA_GIT } from '../src/regole/versione.ts';

describe('componiVersione', () => {
  it('tag v0.3 sul commit di partenza: v0.3.0', () => {
    expect(componiVersione('v0.3', 0)).toBe('v0.3.0');
  });

  it('dodici commit dal tag: v0.3.12', () => {
    expect(componiVersione('v0.3', 12)).toBe('v0.3.12');
  });

  it('la 0.4 cambia solo il tag', () => {
    expect(componiVersione('v0.4', 1)).toBe('v0.4.1');
  });

  it('senza tag o senza conteggio: il fallback', () => {
    expect(componiVersione(null, 5)).toBe(VERSIONE_SENZA_GIT);
    expect(componiVersione('v0.3', null)).toBe(VERSIONE_SENZA_GIT);
    expect(VERSIONE_SENZA_GIT).toBe('v0.3.?');
  });

  it('un tag che non è vN.N (per esempio main-v273) non si usa: il fallback', () => {
    expect(componiVersione('main-v273', 3)).toBe(VERSIONE_SENZA_GIT);
    expect(componiVersione('v0.3.1', 3)).toBe(VERSIONE_SENZA_GIT);
  });

  it('un conteggio che non è un numero intero positivo: il fallback', () => {
    expect(componiVersione('v0.3', -1)).toBe(VERSIONE_SENZA_GIT);
    expect(componiVersione('v0.3', 1.5)).toBe(VERSIONE_SENZA_GIT);
    expect(componiVersione('v0.3', Number.NaN)).toBe(VERSIONE_SENZA_GIT);
  });
});
