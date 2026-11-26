// La logica della Biblioteca (src/regole/biblioteca.ts) con le carte supply vere (public/cards_supply.json): filtri
// combinabili, fasce di costo (8 e oltre in "8+"), raggruppamento e ordinamento, set presenti, preferenze salvate.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkSupplyCards } from '../src/dati/controllo.ts';
import type { CartaSupply } from '../src/tipi/dati.ts';
import { PREFERENZE_BIBLIOTECA_PREDEFINITE, etichettaCosto, fasceCostoPresenti, filtra, fasciaCosto,
  leggiPreferenzeBiblioteca, raggruppaPerCosto, setPresenti } from '../src/regole/biblioteca.ts';
import type { Filtri } from '../src/regole/biblioteca.ts';

const public_ = join(process.cwd(), 'public');
const carte: CartaSupply[] = checkSupplyCards(JSON.parse(readFileSync(join(public_, 'cards_supply.json'), 'utf8'))).value;
const prodotti: Record<string, string> = JSON.parse(readFileSync(join(public_, 'products.json'), 'utf8'));

const tutti: Filtri = { ricerca: '', set: new Set(), costo: null };

describe('fasce di costo', () => {
  it('8 e oltre sono "8+", il resto il numero', () => {
    expect(fasciaCosto(5)).toBe(5);
    expect(fasciaCosto(8)).toBe(8);
    expect(fasciaCosto(11)).toBe(8);
    expect(etichettaCosto(8)).toBe('8+');
    expect(etichettaCosto(3)).toBe('3');
  });

  it('i pulsanti di costo sono quelli presenti nel catalogo (supply: 2-8)', () => {
    expect(fasceCostoPresenti(carte, 'Gem')).toEqual([...new Set(carte.filter(c => c.type === 'Gem').map(c => fasciaCosto(c.cost)))].sort((a, b) => a - b));
    const tutte = fasceCostoPresenti(carte, 'Gem').concat(fasceCostoPresenti(carte, 'Relic'), fasceCostoPresenti(carte, 'Spell'));
    expect(Math.min(...tutte)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...tutte)).toBe(8);
  });
});

describe('filtri', () => {
  it('la categoria seleziona solo il suo tipo', () => {
    const gemme = filtra(carte, 'Gem', tutti);
    expect(gemme.length).toBeGreaterThan(0);
    expect(gemme.every(c => c.type === 'Gem')).toBe(true);
    expect(gemme.length).toBe(carte.filter(c => c.type === 'Gem').length);
  });

  it('la ricerca per nome ignora maiuscole e spazi ai bordi', () => {
    const trovate = filtra(carte, 'Gem', { ...tutti, ricerca: '  BURNING ' });
    expect(trovate.some(c => c.name === 'Burning Opal')).toBe(true);
    expect(trovate.every(c => c.name.toLowerCase().includes('burning'))).toBe(true);
  });

  it('il costo sceglie la fascia, "8+" comprende 8 e oltre', () => {
    const otto = filtra(carte, 'Spell', { ...tutti, costo: 8 });
    expect(otto.every(c => c.cost >= 8)).toBe(true);
  });

  it('i set si combinano con gli altri filtri (multipla, poi costo e ricerca)', () => {
    const set = new Set(['1', '4.2']);
    const r = filtra(carte, 'Gem', { ricerca: '', set, costo: 5 });
    expect(r.every(c => set.has(c.boxCode) && c.cost === 5 && c.type === 'Gem')).toBe(true);
    // Un set senza carte di quel costo: nessun risultato, non un errore
    expect(filtra(carte, 'Gem', { ricerca: 'zzzz-nessuna', set, costo: null })).toEqual([]);
  });
});

describe('raggruppamento', () => {
  it('per costo crescente per default, con ordine decrescente a scelta', () => {
    const asc = raggruppaPerCosto(carte, 'costo-asc').map(g => g.fascia);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = raggruppaPerCosto(carte, 'costo-desc').map(g => g.fascia);
    expect(desc).toEqual([...asc].reverse());
  });

  it('nessun gruppo vuoto, e le carte sono tutte in un gruppo del loro costo', () => {
    const gruppi = raggruppaPerCosto(carte, 'costo-asc');
    expect(gruppi.every(g => g.carte.length > 0)).toBe(true);
    expect(gruppi.reduce((n, g) => n + g.carte.length, 0)).toBe(carte.length);
    gruppi.forEach(g => expect(g.carte.every(c => fasciaCosto(c.cost) === g.fascia)).toBe(true));
  });

  it('con "nome" le carte di ogni gruppo sono in ordine alfabetico', () => {
    raggruppaPerCosto(carte, 'nome').forEach(g => {
      const nomi = g.carte.map(c => c.name);
      expect(nomi).toEqual([...nomi].sort((a, b) => a.localeCompare(b, 'en') || 0));
    });
  });

  it('un costo solo non produce gruppi vuoti (risultati vuoti gestiti dal filtro)', () => {
    const r = filtra(carte, 'Relic', { ...tutti, costo: 7 });
    const gruppi = raggruppaPerCosto(r, 'costo-asc');
    expect(gruppi.length).toBeLessThanOrEqual(1);
  });
});

describe('set', () => {
  it('i set presenti hanno il nome di products.json, in ordine di codice', () => {
    const set = setPresenti(carte, prodotti);
    expect(set.length).toBeGreaterThan(0);
    set.forEach(s => expect(s.nome).toBe(prodotti[s.codice] ?? s.codice));
    const codici = set.map(s => s.codice);
    const primo = codici.indexOf('1');
    const secondo = codici.indexOf('1.1');
    if (primo >= 0 && secondo >= 0) expect(primo).toBeLessThan(secondo);
  });
});

describe('preferenze salvate', () => {
  it('senza dati o con dati sbagliati: le predefinite', () => {
    expect(leggiPreferenzeBiblioteca(null)).toEqual(PREFERENZE_BIBLIOTECA_PREDEFINITE);
    expect(leggiPreferenzeBiblioteca('non json')).toEqual(PREFERENZE_BIBLIOTECA_PREDEFINITE);
    expect(leggiPreferenzeBiblioteca('[1,2]')).toEqual(PREFERENZE_BIBLIOTECA_PREDEFINITE);
    expect(leggiPreferenzeBiblioteca('{"categoria":"Nemesi","ordine":"x"}')).toEqual(PREFERENZE_BIBLIOTECA_PREDEFINITE);
  });

  it('categoria e ordinamento validi si ricordano', () => {
    expect(leggiPreferenzeBiblioteca('{"categoria":"Spell","ordine":"costo-desc"}'))
      .toEqual({ categoria: 'Spell', ordine: 'costo-desc' });
  });
});
