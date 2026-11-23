// dati/controllo.ts: controllo leggero dei JSON letti all'avvio (cards.json, nemesis.json, products.json,
// deck-setup.json, nemesis-art.json): campi obbligatori, tipo di ogni campo e valori ammessi dei tipi in tipi/dati.ts.
// I file li produce tools/import-db.py dal DataBase: se qualcosa non torna, l'errore dice quale carta (id) o nemesi
// (nome) e quale campo. Una carta o una nemesi sbagliata si scarta (l'app continua con le altre) e si segnala in console;
// un file con la forma sbagliata (non un elenco, non un oggetto) è un errore che ferma l'avvio.
// Riceve il contenuto dei file (`unknown`); restituisce i dati con il loro tipo e l'elenco dei problemi.
// Dipende da: regole/json.ts (isRecord), tipi/dati.ts. Usato da: avvio.ts, test in tests/dati-json.test.ts.

import { isRecord } from '../regole/json.ts';
import type { ArteNemesi, ArteNemesiTutte, BattagliaDeckSetup, Carta, Categoria, CartePerTier, DeckSetup, Nemesi, Prodotti,
  RigaDeckSetup, TipoCarta } from '../tipi/dati.ts';

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
const oneOf = (allowed: readonly string[]): Regola => v => (typeof v === 'string' && allowed.includes(v) ? null : `deve essere uno di ${allowed.join(', ')}`);
const tier: Regola = v => (v === null || v === '9+' || (typeof v === 'number' && Number.isInteger(v)) ? null : "deve essere un numero intero, '9+' o null");

const REGOLE_CARTA: Record<keyof Omit<Carta, 'thumb'>, Regola> = {
  id: v => (typeof v === 'string' && v.length > 0 ? null : 'deve essere un testo non vuoto'),
  name: str, boxCode: str, category: oneOf(CATEGORIE), nemesis: strOrNull, tier, type: oneOf(TIPI), subType: strOrNull,
  hp: numOrNull, hpVariable: bool, shield: numOrNull, powerTokens: numOrNull, removalCost: numOrNull, removable: bool,
  inNemesisDeck: bool, quantity: num, effect: str, toDiscard: strOrNull, immediately: strOrNull, persistent: strOrNull,
  powerEffect: strOrNull, image: str
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
  return out;
}

// Controlla ogni campo: dopo questo l'oggetto ha la forma di T (è il punto in cui un dato letto diventa tipizzato)
function hasShape<T>(item: Record<string, unknown>, rules: Record<string, Regola>): item is Record<string, unknown> & T {
  return problemsOf(item, rules).length === 0;
}

// cards.json: elenco di carte. Le carte sbagliate si scartano con il loro id nei problemi
export function checkCards(data: unknown): Controllato<Carta[]> {
  if (!Array.isArray(data)) throw new Error('cards.json non è un elenco di carte');
  const value: Carta[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  data.forEach((item: unknown, i) => {
    if (!isRecord(item)) { problems.push(`cards.json, posizione ${i}: non è un oggetto`); return; }
    const id = typeof item.id === 'string' ? item.id : `(posizione ${i})`;
    const own = problemsOf(item, REGOLE_CARTA);
    if (!own.length && hasShape<Carta>(item, REGOLE_CARTA)) {
      own.push(...cardConsistency(item));
      if (seen.has(item.id)) own.push('id ripetuto');
      seen.add(item.id);
      if (!own.length) { value.push(item); return; }
    }
    problems.push(...own.map(p => `cards.json, carta ${id}: ${p}`));
  });
  return { value, problems };
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
