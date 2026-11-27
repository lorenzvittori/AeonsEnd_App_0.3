// dati/controllo.ts: controllo leggero dei JSON letti all'avvio (cards_nemesis.json, nemesis.json, products.json,
// deck-setup.json, nemesis-art.json) e di quelli della biblioteca (cards_supply.json, cards_treasure.json, letti dopo):
// campi obbligatori, tipo di ogni campo e valori ammessi dei tipi in tipi/dati.ts.
// I file li produce tools/import-db.py dal DataBase: se qualcosa non torna, l'errore dice quale carta (id) o nemesi
// (nome) e quale campo. Una carta o una nemesi sbagliata si scarta (l'app continua con le altre) e si segnala in console;
// un file con la forma sbagliata (non un elenco, non un oggetto) è un errore che ferma l'avvio.
// Riceve il contenuto dei file (`unknown`); restituisce i dati con il loro tipo e l'elenco dei problemi.
// Dipende da: regole/json.ts (isRecord), tipi/dati.ts. Usato da: avvio.ts, test in tests/dati-json.test.ts.

import { isRecord } from '../regole/json.ts';
import type { ArteNemesi, ArteNemesiTutte, BattagliaDeckSetup, Carta, CartaSupply, CartaTesoro, Categoria, CartePerTier, DeckSetup,
  Meccanica, Nemesi, Prodotti, RigaDeckSetup, TipoCarta, TipoSupply, TipoTesoro } from '../tipi/dati.ts';

// Valori ammessi
const CATEGORIE: readonly Categoria[] = ['Basic', 'Upgraded', 'Specific'];
const TIPI: readonly TipoCarta[] = ['Power', 'Minion', 'Attack', 'Corruption', 'Strike', 'Gem', 'Curse', 'Rush', 'Reminder'];

// Esito di un controllo: i dati buoni e i problemi trovati (uno per riga, con l'id)
export interface Controllato<T> {
  value: T;
  problems: string[];
}

// Controlli dei singoli campi: restituiscono la descrizione del problema, o null se il valore va bene
type Regola = (v: unknown) => string | null;
const str: Regola = v => (typeof v === 'string' ? null : 'deve essere un testo');
const strOrNull: Regola = v => (v === null || typeof v === 'string' ? null : 'deve essere un testo o null');
const num: Regola = v => (typeof v === 'number' && Number.isFinite(v) ? null : 'deve essere un numero');
const numOrNull: Regola = v => (v === null || (typeof v === 'number' && Number.isFinite(v)) ? null : 'deve essere un numero o null');
const bool: Regola = v => (typeof v === 'boolean' ? null : 'deve essere true o false');
const listaDiTesti: Regola = v => (Array.isArray(v) && v.every(x => typeof x === 'string') ? null : 'deve essere un elenco di testi');
const oneOf = (allowed: readonly string[]): Regola => v => (typeof v === 'string' && allowed.includes(v) ? null : `deve essere uno di ${allowed.join(', ')}`);
const tier: Regola = v => (v === null || v === '9+' || (typeof v === 'number' && Number.isInteger(v)) ? null : "deve essere un numero intero, '9+' o null");

const REGOLE_CARTA: Record<keyof Omit<Carta, 'thumb' | 'back'>, Regola> = {
  id: v => (typeof v === 'string' && v.length > 0 ? null : 'deve essere un testo non vuoto'),
  name: str, boxCode: str, box: strOrNull, miniExpansion: strOrNull, mechanics: listaDiTesti, category: oneOf(CATEGORIE), nemesis: strOrNull, tier, type: str, subType: strOrNull,
  hp: numOrNull, hpVariable: bool, shield: numOrNull, powerTokens: numOrNull, removalCost: numOrNull, removable: bool,
  inNemesisDeck: bool, quantity: num, effect: str, toDiscardSpend: numOrNull, image: str
};

const REGOLE_NEMESI: Record<keyof Nemesi, Regola> = {
  name: v => (typeof v === 'string' && v.length > 0 ? null : 'deve essere un testo non vuoto'),
  boxCode: strOrNull, waveOrder: num, battle: numOrNull, flagBattle5: strOrNull, owned: bool, life: numOrNull,
  difficulty: numOrNull
};

// Problemi di un oggetto secondo le regole (campo mancante o sbagliato)
function problemsOf(item: Record<string, unknown>, rules: Record<string, Regola>): string[] {
  return Object.entries(rules).flatMap(([field, rule]) => {
    if (!(field in item)) return [`campo ${field} mancante`];
    const p = rule(item[field]);
    return p ? [`${field} ${p} (è ${JSON.stringify(item[field])})`] : [];
  });
}

// Coerenza tra campi delle carte del mazzo nemesi: Specific con la sua nemesi, Tier 1-3
function cardConsistency(c: Carta): string[] {
  const out: string[] = [];
  if (c.category === 'Specific' && !c.nemesis) out.push('carta Specific senza nemesi');
  if (c.inNemesisDeck && !(c.tier === 1 || c.tier === 2 || c.tier === 3)) out.push(`carta del mazzo nemesi con tier ${JSON.stringify(c.tier)} (ammessi 1, 2, 3)`);
  if (c.inNemesisDeck && !['Attack', 'Minion', 'Power'].includes(c.type)) out.push(`carta del mazzo nemesi con type ${JSON.stringify(c.type)} (ammessi Attack, Minion, Power)`);
  return out;
}

// Controlla ogni campo: dopo questo l'oggetto ha la forma di T (è il punto in cui un dato letto diventa tipizzato)
function hasShape<T>(item: Record<string, unknown>, rules: Record<string, Regola>): item is Record<string, unknown> & T {
  return problemsOf(item, rules).length === 0;
}

// cards_nemesis.json: elenco di carte. Le carte sbagliate si scartano con il loro id nei problemi
export function checkCards(data: unknown): Controllato<Carta[]> {
  if (!Array.isArray(data)) throw new Error('cards_nemesis.json non è un elenco di carte');
  const value: Carta[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  data.forEach((item: unknown, i) => {
    if (!isRecord(item)) { problems.push(`cards_nemesis.json, posizione ${i}: non è un oggetto`); return; }
    const id = typeof item.id === 'string' ? item.id : `(posizione ${i})`;
    const own = problemsOf(item, REGOLE_CARTA);
    if ('back' in item && typeof item.back !== 'string') own.push(`back deve essere un testo (è ${JSON.stringify(item.back)})`);
    if (!own.length && hasShape<Carta>(item, REGOLE_CARTA)) {
      own.push(...cardConsistency(item));
      if (seen.has(item.id)) own.push('id ripetuto');
      seen.add(item.id);
      if (!own.length) { value.push(item); return; }
    }
    problems.push(...own.map(p => `cards_nemesis.json, carta ${id}: ${p}`));
  });
  return { value, problems };
}

// Carte della biblioteca (cards_supply.json, cards_treasure.json): non si leggono all'avvio, ma il controllo è lo stesso
// di cards_nemesis.json (campi, tipi, valori ammessi; le carte sbagliate si scartano con il loro id). Immagine e
// miniatura devono stare nella cartella giusta (Data/Supply/..., thumbs/Supply/...)
const TIPI_SUPPLY: readonly TipoSupply[] = ['Gem', 'Relic', 'Spell'];
const TIPI_TESORO: readonly TipoTesoro[] = ['Treasured Gem', 'Treasured Spell', 'Treasured Relic', 'Treasure Level 1',
  'Treasure Level 2', 'Treasure Level 3'];
const testoNonVuoto: Regola = v => (typeof v === 'string' && v.length > 0 ? null : 'deve essere un testo non vuoto');
const livello: Regola = v => (v === 1 || v === 2 || v === 3 ? null : 'deve essere 1, 2 o 3');

const REGOLE_SUPPLY: Record<keyof CartaSupply, Regola> = {
  id: testoNonVuoto, name: testoNonVuoto, boxCode: str, box: strOrNull, miniExpansion: strOrNull, type: oneOf(TIPI_SUPPLY),
  cost: num, mechanics: listaDiTesti,
  effect: strOrNull, image: str, thumb: str
};

const REGOLE_TESORO: Record<keyof CartaTesoro, Regola> = {
  id: testoNonVuoto, name: testoNonVuoto, boxCode: str, box: strOrNull, miniExpansion: strOrNull, type: oneOf(TIPI_TESORO),
  level: livello, cost: numOrNull, mechanics: listaDiTesti, effect: strOrNull, image: str, thumb: str
};

// public/mechanics.json (per la biblioteca, non letto all'avvio): elenco delle meccaniche delle supply. Quella sbagliata si scarta
const REGOLE_MECCANICA: Record<keyof Meccanica, Regola> = {
  name: testoNonVuoto, dbName: testoNonVuoto, it: strOrNull, cards: num
};

export function checkMechanics(data: unknown): Controllato<Meccanica[]> {
  if (!Array.isArray(data)) throw new Error('mechanics.json non è un elenco di meccaniche');
  const value: Meccanica[] = [];
  const problems: string[] = [];
  data.forEach((item: unknown, i) => {
    if (!isRecord(item)) { problems.push(`mechanics.json, posizione ${i}: non è un oggetto`); return; }
    const name = typeof item.name === 'string' ? item.name : `(posizione ${i})`;
    const own = problemsOf(item, REGOLE_MECCANICA);
    if (!own.length && hasShape<Meccanica>(item, REGOLE_MECCANICA)) { value.push(item); return; }
    problems.push(...own.map(p => `mechanics.json, meccanica ${name}: ${p}`));
  });
  return { value, problems };
}

// Livello del tesoro dal suo Type: "Treasure Level N" -> N; "Treasured ..." -> 1; altro -> null
function livelloDi(tipo: string): number | null {
  const m = /^Treasure Level (\d)$/.exec(tipo);
  if (m) return Number(m[1]);
  return tipo.startsWith('Treasured ') ? 1 : null;
}

// Immagine e miniatura nella cartella della carta (Data/<cartella>/ e thumbs/<cartella>/)
function percorsi(cartella: string) {
  return (c: { image: string; thumb: string }): string[] => [
    ...(c.image.startsWith(`Data/${cartella}/`) ? [] : [`image deve essere in Data/${cartella}/`]),
    ...(c.thumb.startsWith(`thumbs/${cartella}/`) ? [] : [`thumb deve essere in thumbs/${cartella}/`])
  ];
}

// Elenco di carte della biblioteca: come checkCards, con la coerenza propria di ogni tipo di carta
function checkElencoCarte<T extends { id: string }>(data: unknown, file: string, rules: Record<string, Regola>,
  coerenza: (c: T) => string[]): Controllato<T[]> {
  if (!Array.isArray(data)) throw new Error(`${file} non è un elenco di carte`);
  const value: T[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  data.forEach((item: unknown, i) => {
    if (!isRecord(item)) { problems.push(`${file}, posizione ${i}: non è un oggetto`); return; }
    const id = typeof item.id === 'string' ? item.id : `(posizione ${i})`;
    const own = problemsOf(item, rules);
    if (!own.length && hasShape<T>(item, rules)) {
      own.push(...coerenza(item));
      if (typeof item.id === 'string') {
        if (seen.has(item.id)) own.push('id ripetuto');
        seen.add(item.id);
      }
      if (!own.length) { value.push(item); return; }
    }
    problems.push(...own.map(p => `${file}, carta ${id}: ${p}`));
  });
  return { value, problems };
}

// cards_supply.json: carte supply (Gem, Relic, Spell), costo numerico in Æ
export function checkSupplyCards(data: unknown): Controllato<CartaSupply[]> {
  return checkElencoCarte<CartaSupply>(data, 'cards_supply.json', REGOLE_SUPPLY, percorsi('Supply'));
}

// cards_treasure.json: carte tesoro; il livello deve corrispondere al Type
export function checkTreasureCards(data: unknown): Controllato<CartaTesoro[]> {
  return checkElencoCarte<CartaTesoro>(data, 'cards_treasure.json', REGOLE_TESORO, c => [
    ...percorsi('Treasure')(c),
    ...(livelloDi(c.type) === c.level ? [] : [`level ${c.level} non corrisponde al Type "${c.type}"`])
  ]);
}

// nemesis.json: elenco di nemesi. Le nemesi sbagliate si scartano con il loro nome nei problemi
export function checkNemeses(data: unknown): Controllato<Nemesi[]> {
  if (!Array.isArray(data)) throw new Error('nemesis.json non è un elenco di nemesi');
  const value: Nemesi[] = [];
  const problems: string[] = [];
  data.forEach((item: unknown, i) => {
    if (!isRecord(item)) { problems.push(`nemesis.json, posizione ${i}: non è un oggetto`); return; }
    const name = typeof item.name === 'string' ? item.name : `(posizione ${i})`;
    if (hasShape<Nemesi>(item, REGOLE_NEMESI)) { value.push(item); return; }
    problems.push(...problemsOf(item, REGOLE_NEMESI).map(p => `nemesis.json, nemesi ${name}: ${p}`));
  });
  return { value, problems };
}

// products.json: codice -> nome. Un prodotto con il nome sbagliato si scarta
export function checkProducts(data: unknown): Controllato<Prodotti> {
  if (!isRecord(data)) throw new Error('products.json non è un oggetto { codice: nome }');
  const value: Prodotti = {};
  const problems: string[] = [];
  Object.entries(data).forEach(([code, name]) => {
    if (!/^\d+(\.\d+)?$/.test(code)) problems.push(`products.json, prodotto ${code}: il codice deve essere "N" o "N.M"`);
    else if (typeof name !== 'string' || !name) problems.push(`products.json, prodotto ${code}: il nome deve essere un testo non vuoto`);
    else value[code] = name;
  });
  return { value, problems };
}

// Carte per Tier di deck-setup.json ({ "1": n, "2": n, "3": n })
function isPerTier(v: unknown): v is CartePerTier {
  return isRecord(v) && typeof v['1'] === 'number' && typeof v['2'] === 'number' && typeof v['3'] === 'number';
}

function isRiga(v: unknown): v is RigaDeckSetup {
  return isRecord(v) && isPerTier(v.basic) && isPerTier(v.upgradedBasic);
}

function isBattaglia(v: unknown): v is BattagliaDeckSetup {
  return isRecord(v) && typeof v.battle === 'number' && isRecord(v.players) && Object.values(v.players).every(isRiga);
}

// deck-setup.json: tutta la tabella deve essere giusta (senza una riga il mazzo non si può fare): errore, con la
// battaglia sbagliata, se non lo è. Restituisce i dati così come sono nel file
export function checkDeckSetup(data: unknown): DeckSetup {
  if (!isRecord(data) || !Array.isArray(data.battles)) throw new Error('deck-setup.json: manca l\'elenco "battles"');
  const battles: unknown[] = data.battles;
  const bad = battles.findIndex(b => !isBattaglia(b));
  if (bad >= 0) {
    throw new Error(`deck-setup.json: battaglia in posizione ${bad}: servono "battle" e, per ogni numero di giocatori, "basic" e "upgradedBasic" con i Tier 1, 2, 3`);
  }
  if (data.description !== undefined && typeof data.description !== 'string') throw new Error('deck-setup.json: "description" deve essere un testo');
  const description = data.description;
  if (!battles.every(isBattaglia)) throw new Error('deck-setup.json: battaglie non valide');
  return Object.assign(data, { battles, description });
}

function isArte(v: unknown): v is ArteNemesi {
  return isRecord(v) && typeof v.card === 'string' && (v.portrait === undefined || typeof v.portrait === 'string')
    && (v.ratio === undefined || typeof v.ratio === 'number') && (v.back === undefined || typeof v.back === 'string');
}

// nemesis-art.json (facoltativo): nome -> immagini. Le voci sbagliate si scartano
export function checkNemesisArt(data: unknown): Controllato<ArteNemesiTutte> {
  const value: ArteNemesiTutte = {};
  const problems: string[] = [];
  if (!isRecord(data)) return { value, problems: ['nemesis-art.json non è un oggetto { nome: immagini }'] };
  Object.entries(data).forEach(([name, art]) => {
    if (isArte(art)) value[name] = art;
    else problems.push(`nemesis-art.json, nemesi ${name}: serve "card" (testo); "portrait" e "back" testi, "ratio" numero`);
  });
  return { value, problems };
}

// Problemi in console, uno per riga (con l'id della carta o il nome della nemesi)
export function reportProblems(problems: readonly string[]): void {
  problems.forEach(p => console.error('Dati non validi: ' + p));
}
