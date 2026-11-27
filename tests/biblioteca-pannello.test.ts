// Il pannello sotto ogni carta della Biblioteca: l'etichetta del box ("x" o "x - y"), i tag delle meccaniche e i colori.
import { describe, expect, it } from 'vitest';
import { etichettaBox, meccanicheCarta } from '../src/regole/biblioteca.ts';
import { coloreMeccanica } from '../src/ui/colori-meccaniche.ts';
import { readFileSync } from 'node:fs';

describe('etichettaBox', () => {
  it('scatola grande senza espansione: solo il nome del box', () => {
    expect(etichettaBox({ box: 'The New Age', miniExpansion: null })).toBe('The New Age');
  });
  it('con mini espansione: "box - espansione"', () => {
    expect(etichettaBox({ box: 'Aeon\'s End (Core Box)', miniExpansion: 'The Depths' })).toBe('Aeon\'s End (Core Box) - The Depths');
  });
  it('box mancante: stringa vuota (non si inventa un nome)', () => {
    expect(etichettaBox({ box: null, miniExpansion: 'The Depths' })).toBe('');
    expect(etichettaBox({ box: '  ', miniExpansion: null })).toBe('');
  });
  it('espansione vuota o di spazi: come se non ci fosse', () => {
    expect(etichettaBox({ box: 'The New Age', miniExpansion: ' ' })).toBe('The New Age');
  });
});

describe('meccanicheCarta', () => {
  it('nessuna meccanica: lista vuota', () => {
    expect(meccanicheCarta({ mechanics: [] })).toEqual([]);
  });
  it('toglie vuote e ripetute, mantiene l\'ordine del file', () => {
    expect(meccanicheCarta({ mechanics: ['Echo', '', 'Attach', 'Echo', ' Attach '] })).toEqual(['Echo', 'Attach']);
  });
});

describe('colori delle meccaniche', () => {
  it('ogni meccanica di mechanics.json ha un colore, e i colori sono quelli della specifica', () => {
    const meccaniche = JSON.parse(readFileSync('public/mechanics.json', 'utf8')) as { name: string }[];
    for (const m of meccaniche) expect(coloreMeccanica(m.name), m.name).toMatch(/^#[0-9A-F]{6}$/);
    expect(coloreMeccanica('Aether Token')).toBe('#E0B363');
    expect(coloreMeccanica('Trinket Interaction')).toBe('#BDA58A');
  });
  it('una meccanica non in elenco non ha colore (il CSS usa il grigio neutro)', () => {
    expect(coloreMeccanica('Meccanica inventata')).toBeNull();
  });
  it('il simbolo Aether è negli asset', () => {
    expect(readFileSync('public/Assets/ui/icons/aether.svg', 'utf8')).toContain('<svg');
  });
});
