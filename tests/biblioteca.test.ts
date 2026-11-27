// La logica della Biblioteca (src/regole/biblioteca.ts) con le carte supply vere (public/cards_supply.json) e le
// meccaniche vere (public/mechanics.json): ricerca su nome, id ed effetto, filtro per meccanica combinato con set e costo,
// fasce di costo (8 e oltre in "8+"), raggruppamento a ordine fisso, set presenti, preferenze salvate (anche quelle vecchie).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkMechanics, checkSupplyCards } from '../src/dati/controllo.ts';
import type { CartaSupply, Meccanica } from '../src/tipi/dati.ts';
import { PREFERENZE_BIBLIOTECA_PREDEFINITE, etichettaCosto, fasceCostoPresenti, filtra, fasciaCosto,
  leggiPreferenzeBiblioteca, meccanicheDiCategoria, raggruppaPerCosto, setPresenti } from '../src/regole/biblioteca.ts';
import type { Filtri } from '../src/regole/biblioteca.ts';

const public_ = join(process.cwd(), 'public');
const carte: CartaSupply[] = checkSupplyCards(JSON.parse(readFileSync(join(public_, 'cards_supply.json'), 'utf8'))).value;
const prodotti: Record<string, string> = JSON.parse(readFileSync(join(public_, 'products.json'), 'utf8'));
const meccaniche: Meccanica[] = checkMechanics(JSON.parse(readFileSync(join(public_, 'mechanics.json'), 'utf8'))).value;

const nessuno = new Set<string>();
const tutti: Filtri = { ricerca: '', set: nessuno, meccaniche: nessuno, costo: null };

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

  it('la ricerca trova anche per id e per una parola dell\'effetto', () => {
    const carta = carte.find(c => c.type === 'Gem' && c.effect !== null && c.effect.length > 20)!;
    expect(carta).toBeDefined();
    // per id (anche scritto in maiuscole, o solo la parte prima della virgola)
    expect(filtra(carte, 'Gem', { ...tutti, ricerca: carta.id.toUpperCase() }).includes(carta)).toBe(true);
    // per una parola lunga dell'effetto
    const parola = carta.effect!.match(/[A-Za-z]{6,}/)![0];
    expect(filtra(carte, 'Gem', { ...tutti, ricerca: `  ${parola.toUpperCase()} ` }).includes(carta)).toBe(true);
    // un testo che non c'è in nessun campo: nessun risultato
    expect(filtra(carte, 'Gem', { ...tutti, ricerca: 'zzzz-nessuna' })).toEqual([]);
  });

  it('la ricerca ignora gli accenti (nome, id ed effetto)', () => {
    const finta: CartaSupply = { ...carte[0], id: 'AE-é1', name: 'Élan Caffè', effect: 'Più forte' };
    const r = [finta];
    expect(filtra(r, finta.type, { ...tutti, ricerca: 'elan' })).toEqual(r);
    expect(filtra(r, finta.type, { ...tutti, ricerca: 'CAFFE' })).toEqual(r);
    expect(filtra(r, finta.type, { ...tutti, ricerca: 'piu forte' })).toEqual(r);
    expect(filtra(r, finta.type, { ...tutti, ricerca: 'ae-e1' })).toEqual(r);
  });

  it('il costo sceglie la fascia, "8+" comprende 8 e oltre', () => {
    const otto = filtra(carte, 'Spell', { ...tutti, costo: 8 });
    expect(otto.every(c => c.cost >= 8)).toBe(true);
  });

  it('i set si combinano con gli altri filtri (multipla, poi costo e ricerca)', () => {
    const set = new Set(['1', '4.2']);
    const r = filtra(carte, 'Gem', { ricerca: '', set, meccaniche: nessuno, costo: 5 });
    expect(r.every(c => set.has(c.boxCode) && c.cost === 5 && c.type === 'Gem')).toBe(true);
    // Un set senza carte di quel costo: nessun risultato, non un errore
    expect(filtra(carte, 'Gem', { ricerca: 'zzzz-nessuna', set, meccaniche: nessuno, costo: null })).toEqual([]);
  });
});

describe('filtro per meccanica', () => {
  it('da solo: passano le carte che hanno almeno una delle meccaniche scelte, in tutte le categorie', () => {
    const scelta = new Set(['Attach']);
    const attese = carte.filter(c => c.mechanics.includes('Attach'));
    expect(attese.length).toBeGreaterThan(0);
    const trovate = (['Gem', 'Relic', 'Spell'] as const).flatMap(cat => filtra(carte, cat, { ...tutti, meccaniche: scelta }));
    expect(trovate.length).toBe(attese.length);
    expect(trovate.every(c => c.mechanics.includes('Attach'))).toBe(true);
  });

  it('più meccaniche scelte: basta che la carta ne abbia una (unione, non intersezione)', () => {
    const due = new Set(['Attach', 'Echo']);
    const r = carte.filter(c => c.type === 'Gem' && c.mechanics.some(m => due.has(m)));
    expect(filtra(carte, 'Gem', { ...tutti, meccaniche: due })).toEqual(r);
  });

  it('combinato con set e costo: tutti i filtri devono passare', () => {
    const carta = carte.find(c => c.mechanics.length > 0)!;
    const r = filtra(carte, carta.type, { ricerca: '', set: new Set([carta.boxCode]), meccaniche: new Set([carta.mechanics[0]]), costo: fasciaCosto(carta.cost) });
    expect(r.includes(carta)).toBe(true);
    expect(r.every(c => c.boxCode === carta.boxCode && c.mechanics.includes(carta.mechanics[0]) && fasciaCosto(c.cost) === fasciaCosto(carta.cost))).toBe(true);
  });

  it('nel filtro di una categoria si offrono solo le meccaniche che hanno carte di quella categoria, in ordine alfabetico', () => {
    const finte: CartaSupply[] = [
      { ...carte[0], type: 'Gem', mechanics: ['Zeta', 'beta'] },
      { ...carte[0], type: 'Gem', mechanics: ['beta'] },
      { ...carte[0], type: 'Spell', mechanics: ['Alfa'] },
    ];
    const lista: Meccanica[] = [
      { name: 'Zeta', dbName: 'Zeta', it: null, cards: 1 },
      { name: 'Alfa', dbName: 'Alfa', it: null, cards: 1 },
      { name: 'beta', dbName: 'Beta Db', it: null, cards: 2 },
    ];
    expect(meccanicheDiCategoria(finte, lista, 'Gem')).toEqual([{ name: 'beta', carte: 2 }, { name: 'Zeta', carte: 1 }]);
    expect(meccanicheDiCategoria(finte, lista, 'Spell')).toEqual([{ name: 'Alfa', carte: 1 }]);
    expect(meccanicheDiCategoria(finte, lista, 'Relic')).toEqual([]);
  });

  it('con i dati veri: ogni categoria offre solo le meccaniche delle sue carte, con il conteggio giusto', () => {
    for (const cat of ['Gem', 'Relic', 'Spell'] as const) {
      const voci = meccanicheDiCategoria(carte, meccaniche, cat);
      const delleCarte = new Map<string, number>();
      carte.filter(c => c.type === cat).forEach(c => c.mechanics.forEach(m => delleCarte.set(m, (delleCarte.get(m) ?? 0) + 1)));
      expect(voci.map(v => v.name)).toEqual([...delleCarte.keys()].sort((a, b) => a.localeCompare(b, 'en')));
      voci.forEach(v => expect(v.carte, `${cat} ${v.name}`).toBe(delleCarte.get(v.name)));
    }
  });

  it('le meccaniche degli Incantesimi non compaiono nelle Gemme (se non ci sono anche lì)', () => {
    const gemme = new Set(meccanicheDiCategoria(carte, meccaniche, 'Gem').map(v => v.name));
    const incantesimi = carte.filter(c => c.type === 'Spell').flatMap(c => c.mechanics);
    const soloIncantesimi = [...new Set(incantesimi)].filter(m => !carte.some(c => c.type !== 'Spell' && c.mechanics.includes(m)));
    soloIncantesimi.forEach(m => expect(gemme.has(m), m).toBe(false));
  });
});

describe('raggruppamento', () => {
  it('sempre per costo crescente, senza menu per cambiarlo', () => {
    const gruppi = raggruppaPerCosto(carte).map(g => g.fascia);
    expect(gruppi).toEqual([...gruppi].sort((a, b) => a - b));
  });

  it('nessun gruppo vuoto, e le carte sono tutte in un gruppo del loro costo', () => {
    const gruppi = raggruppaPerCosto(carte);
    expect(gruppi.every(g => g.carte.length > 0)).toBe(true);
    expect(gruppi.reduce((n, g) => n + g.carte.length, 0)).toBe(carte.length);
    gruppi.forEach(g => expect(g.carte.every(c => fasciaCosto(c.cost) === g.fascia)).toBe(true));
  });

  it('le carte di ogni gruppo sono in ordine alfabetico', () => {
    raggruppaPerCosto(carte).forEach(g => {
      const nomi = g.carte.map(c => c.name);
      expect(nomi).toEqual([...nomi].sort((a, b) => a.localeCompare(b, 'en') || 0));
    });
  });

  it('un costo solo non produce gruppi vuoti (risultati vuoti gestiti dal filtro)', () => {
    const r = filtra(carte, 'Relic', { ...tutti, costo: 7 });
    const gruppi = raggruppaPerCosto(r);
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
    expect(leggiPreferenzeBiblioteca('{"categoria":"Nemesi"}')).toEqual(PREFERENZE_BIBLIOTECA_PREDEFINITE);
  });

  it('la categoria valida si ricorda', () => {
    expect(leggiPreferenzeBiblioteca('{"categoria":"Spell"}')).toEqual({ categoria: 'Spell' });
  });

  it('una preferenza vecchia con "ordine" si legge senza errori: il campo si ignora', () => {
    expect(leggiPreferenzeBiblioteca('{"categoria":"Spell","ordine":"costo-desc"}')).toEqual({ categoria: 'Spell' });
    expect(leggiPreferenzeBiblioteca('{"categoria":"Relic","ordine":"nome"}')).toEqual({ categoria: 'Relic' });
    expect(leggiPreferenzeBiblioteca('{"ordine":"x"}')).toEqual(PREFERENZE_BIBLIOTECA_PREDEFINITE);
  });
});
