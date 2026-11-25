// La preferenza della lingua (src/stato/preferenze.ts): al primo avvio vale la lingua del browser (it* = italiano, tutto il
// resto = inglese); una scelta salvata vince sul browser; una scelta rovinata si ignora.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { LANGUAGE_KEY, eLingua, lingua, linguaDelBrowser, linguaScelta, setLingua } from '../src/stato/preferenze.ts';

describe('lingua del browser', () => {
  it('it* = italiano, tutto il resto = inglese', () => {
    for (const l of ['it', 'it-IT', 'it-CH', 'IT', 'ita']) expect(linguaDelBrowser(l), l).toBe('it');
    for (const l of ['en', 'en-US', 'de-DE', 'fr', 'es-ES', 'ja', '']) expect(linguaDelBrowser(l), l).toBe('en');
  });

  it('con un elenco vale la prima lingua preferita; senza niente, inglese', () => {
    expect(linguaDelBrowser(['it-IT', 'en-US'])).toBe('it');
    expect(linguaDelBrowser(['en-US', 'it-IT'])).toBe('en');
    expect(linguaDelBrowser([])).toBe('en');
    expect(linguaDelBrowser(null)).toBe('en');
    expect(linguaDelBrowser(undefined)).toBe('en');
  });
});

describe('scelta salvata e lingua del browser', () => {
  it('senza scelta salvata vale il browser', () => {
    expect(linguaScelta(null, 'it-IT')).toBe('it');
    expect(linguaScelta(null, 'en-GB')).toBe('en');
  });

  it('la scelta salvata vince sul browser', () => {
    expect(linguaScelta('en', 'it-IT')).toBe('en');
    expect(linguaScelta('it', 'en-US')).toBe('it');
  });

  it('una scelta salvata che non è una lingua nota si ignora', () => {
    expect(eLingua('fr')).toBe(false);
    expect(eLingua(null)).toBe(false);
    expect(linguaScelta('fr', 'it-IT')).toBe('it');
    expect(linguaScelta('', 'en-US')).toBe('en');
    expect(linguaScelta(7, 'en-US')).toBe('en');
  });
});

describe('lingua() e setLingua() con il browser', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  // Un browser finto: finestra, localStorage (in un oggetto) e navigator
  function browserFinto(salvata: string | null, lingue: string[]): Record<string, string> {
    const archivio: Record<string, string> = salvata === null ? {} : { [LANGUAGE_KEY]: salvata };
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: (k: string) => archivio[k] ?? null, setItem: (k: string, v: string) => { archivio[k] = v; } });
    vi.stubGlobal('navigator', { languages: lingue, language: lingue[0] });
    return archivio;
  }

  it('primo avvio: la lingua del browser', () => {
    browserFinto(null, ['it-IT', 'en']);
    expect(lingua()).toBe('it');
    browserFinto(null, ['en-US']);
    expect(lingua()).toBe('en');
  });

  it('la scelta salvata vince sul browser', () => {
    browserFinto('en', ['it-IT']);
    expect(lingua()).toBe('en');
    browserFinto('it', ['en-US']);
    expect(lingua()).toBe('it');
  });

  it('setLingua salva la scelta, e lingua() la rilegge', () => {
    const archivio = browserFinto(null, ['it-IT']);
    setLingua('en');
    expect(archivio[LANGUAGE_KEY]).toBe('en');
    expect(lingua()).toBe('en');
  });

  it('localStorage che non funziona: si segue il browser', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloccato'); } });
    vi.stubGlobal('navigator', { languages: ['it-IT'], language: 'it-IT' });
    expect(lingua()).toBe('it');
  });
});
