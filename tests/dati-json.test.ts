// I JSON VERI di public/ rispettano i tipi di src/tipi/dati.ts (controllo di src/dati/controllo.ts): se il ponte del
// DataBase (tools/import-db.py) produce dati sbagliati, questo test lo dice con l'id della carta o il nome della nemesi.
// Più qualche dato sbagliato fatto a mano, per vedere che il controllo lo trova e lo descrive.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCards, checkDeckSetup, checkNemesisArt, checkNemeses, checkProducts } from '../src/dati/controllo.ts';
import { isRecord, parseJson } from '../src/regole/json.ts';

const ROOT = join(import.meta.dirname, '..');
const file = (name: string): unknown => parseJson(readFileSync(join(ROOT, 'public', name), 'utf8'));

describe('JSON veri di public/', () => {
  it('cards.json: ogni carta ha tutti i campi, con tipi e valori ammessi', () => {
    const data = file('cards.json');
    const r = checkCards(data);
    expect(r.problems).toEqual([]);
    expect(Array.isArray(data) && r.value.length === data.length).toBe(true);
    expect(r.value.length).toBeGreaterThan(200);
  });

  it('nemesis.json: ogni nemesi ha tutti i campi', () => {
    const data = file('nemesis.json');
    const r = checkNemeses(data);
    expect(r.problems).toEqual([]);
    expect(Array.isArray(data) && r.value.length === data.length).toBe(true);
  });

  it('products.json, deck-setup.json, nemesis-art.json', () => {
    const products = checkProducts(file('products.json'));
    expect(products.problems).toEqual([]);
    expect(Object.keys(products.value).length).toBeGreaterThan(5);
    const setup = checkDeckSetup(file('deck-setup.json'));
    expect(setup.battles.map(b => b.battle)).toEqual([1, 2, 3, 4]);
    const art = checkNemesisArt(file('Assets/nemesis/nemesis-art.json'));
    expect(art.problems).toEqual([]);
  });

  it('coerenza tra i file: nemesi delle carte Specific, prodotti di carte e nemesi, battaglie', () => {
    const cards = checkCards(file('cards.json')).value;
    const nemeses = checkNemeses(file('nemesis.json')).value;
    const products = checkProducts(file('products.json')).value;
    const setup = checkDeckSetup(file('deck-setup.json'));
    const names = new Set(nemeses.map(n => n.name));
    cards.filter(c => c.category === 'Specific').forEach(c => expect(names.has(String(c.nemesis)), `${c.id}: nemesi ${c.nemesis}`).toBe(true));
    cards.forEach(c => expect(c.boxCode in products, `${c.id}: prodotto ${c.boxCode}`).toBe(true));
    nemeses.filter(n => n.boxCode).forEach(n => expect(String(n.boxCode) in products, `${n.name}: prodotto ${n.boxCode}`).toBe(true));
    const battles = new Set(setup.battles.map(b => b.battle));
    nemeses.filter(n => n.battle !== null).forEach(n => expect(battles.has(Number(n.battle)), `${n.name}: battaglia ${n.battle}`).toBe(true));
  });
});

describe('dati sbagliati', () => {
  const good = (): Record<string, unknown>[] => {
    const data = file('cards.json');
    if (!Array.isArray(data)) throw new Error('cards.json non è un elenco');
    const list: unknown[] = data;
    return list.slice(0, 3).filter(isRecord);
  };

  it('carta con un campo mancante o un valore non ammesso: scartata, con id e campo nel problema', () => {
    const [a, b, c] = good();
    const broken = [{ ...a, category: 'Basik' }, { ...b, inNemesisDeck: 'sì' }, c];
    delete broken[2].hpVariable;
    const r = checkCards(broken);
    expect(r.value).toEqual([]);
    expect(r.problems.join('\n')).toContain(`carta ${a.id}: category deve essere uno di Basic, Upgraded, Specific`);
    expect(r.problems.join('\n')).toContain(`carta ${b.id}: inNemesisDeck deve essere true o false`);
    expect(r.problems.join('\n')).toContain(`carta ${c.id}: campo hpVariable mancante`);
  });

  it('carta del mazzo con Tier fuori da 1-3, Specific senza nemesi, id ripetuto', () => {
    const [a, b] = good();
    const r = checkCards([{ ...a, inNemesisDeck: true, tier: 0 }, { ...b, category: 'Specific', nemesis: null }, { ...b }]);
    expect(r.problems.some(p => p.includes(`carta ${a.id}: carta del mazzo nemesi con tier 0`))).toBe(true);
    expect(r.problems.some(p => p.includes(`carta ${b.id}: carta Specific senza nemesi`))).toBe(true);
    expect(r.problems.some(p => p.includes('id ripetuto'))).toBe(true);
  });

  it('file con la forma sbagliata: errore che ferma l\'avvio', () => {
    expect(() => checkCards({})).toThrow(/cards\.json/);
    expect(() => checkNemeses(null)).toThrow(/nemesis\.json/);
    expect(() => checkProducts([])).toThrow(/products\.json/);
    expect(() => checkDeckSetup({ battles: [{ battle: 1, players: { 2: { basic: { 1: 1 } } } }] })).toThrow(/battaglia in posizione 0/);
    expect(checkNemeses([{ name: 'X', boxCode: 4 }]).problems[0]).toContain('nemesi X: boxCode');
    expect(checkProducts({ 'x': 'Y', '4': '' }).problems.length).toBe(2);
  });
});
