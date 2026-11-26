// regole/mazzo-nemesi.ts: il mazzo nemesi (Nemesis Deck Setup) e le nemesi che si possono giocare.
// Riceve:
// - db = { cards, nemeses, deckSetup }: i dati di public/ (cards_nemesis.json, nemesis.json, deck-setup.json);
// - collection: Set dei codici prodotto posseduti ("4" scatola base, "4.1" mini espansione), o null = tutto ammesso;
// - s = { players, nemesis, battleMode, mergeCollection }: le scelte della partita (battleMode e mergeCollection
//   mancanti = attive);
// - random (solo buildDeck): funzione che dà un numero in [0, 1).
// Restituisce valori nuovi; non cambia niente di quello che riceve.
// Dipende da: regole/caso.ts, tipi/. Usato da: stato/partita.ts, dati/ (collezione, nemesi), test in
// tests/mazzo-nemesi.test.ts.
//
// Come si fa il mazzo: per ogni Tier 1-3 si prendono a caso le carte Basic e Upgraded indicate dalla riga di
// deck-setup.json (battaglia della nemesi e numero di giocatori) tra quelle ammesse (solo carte con inNemesisDeck e quel
// tier, della collezione e, senza "Unisci", della wave della nemesi), più tutte le carte Specific della nemesi di quel
// Tier. Ogni Tier è mescolato a parte. Si pesca dalla fine dell'array: in cima il Tier 1, in fondo il Tier 3.
// - "Modalità battaglia" spenta: sempre la riga della battaglia 1 con le Upgraded a 0 (setup standard).
// - "Unisci" spento: Basic e Upgraded solo dei prodotti della wave della nemesi. Blocco: con la Modalità battaglia, se
//   la battaglia chiede Upgraded e la wave della nemesi (nella collezione) non ne ha, "Unisci" vale come acceso.
// - Se le carte ammesse non bastano, il Tier esce più corto (deckShortfall dice quante ne mancano).

import { pickRandom, shuffle } from './caso.ts';
import type { Caso } from './caso.ts';
import type { Carta, CodiceProdotto, DatiRegole, Nemesi, RigaDeckSetup } from '../tipi/dati.ts';
import type { PianoMazzo, SceltePerMazzo } from '../tipi/partita.ts';

// Collezione: codici prodotto posseduti; null = tutto ammesso
export type Collezione = ReadonlySet<CodiceProdotto> | null;

// Mazzo corto: carte Basic e Upgraded chieste da deck-setup.json e quelle che ci sono
export interface MazzoCorto {
  want: number;
  have: number;
}

const TIERS = [1, 2, 3] as const;

// Wave di un codice prodotto: la parte prima del punto ("4.1" -> "4"); null per un codice mancante
export function waveOfCode(code: CodiceProdotto | null | undefined): string | null {
  return code === null || code === undefined ? null : String(code).split('.')[0];
}

// Mini espansione: il codice ha il punto ("4.1")
export function isMiniCode(code: CodiceProdotto | null | undefined): boolean {
  return code !== null && code !== undefined && String(code).includes('.');
}

// Prodotto posseduto (collection null = tutto)
export function ownsProduct(collection: Collezione, code: CodiceProdotto): boolean {
  return !collection || collection.has(code);
}

// Carta Basic / Upgraded ammessa: il suo prodotto è nella collezione (o la carta non ha prodotto)
export function cardAllowed(collection: Collezione, card: { boxCode: CodiceProdotto | null }): boolean {
  return !card.boxCode || ownsProduct(collection, card.boxCode);
}

function nemesisInfo(db: Pick<DatiRegole, 'nemeses'>, name: string | null): Nemesi | undefined {
  return db.nemeses.find(n => n.name === name);
}

// Battaglia della nemesi (nemesis.json); null se la nemesi non c'è
export function battleOf(db: Pick<DatiRegole, 'nemeses'>, nemesisName: string | null): number | null {
  const info = nemesisInfo(db, nemesisName);
  return info ? info.battle : null;
}

// Nemesi giocabile: ha un prodotto e una battaglia, il prodotto è nella collezione e ha carte Specific nei dati
export function isPlayable(db: Pick<DatiRegole, 'cards'>, collection: Collezione, info: Nemesi): boolean {
  return !!info.boxCode && info.battle !== null && ownsProduct(collection, info.boxCode)
    && db.cards.some(c => c.category === 'Specific' && c.nemesis === info.name);
}

// Riga di deck-setup.json usata dal mazzo: { basic: {1,2,3}, upgradedBasic: {1,2,3} }. Con "Modalità battaglia" la
// battaglia della nemesi, senza la battaglia 1 con le Upgraded a 0. null se la riga non c'è (nemesi senza battaglia)
export function deckSetupRow(db: DatiRegole, s: SceltePerMazzo): RigaDeckSetup | null {
  const battleMode = s.battleMode !== false;
  const battle = db.deckSetup.battles.find(b => b.battle === (battleMode ? battleOf(db, s.nemesis) : 1));
  const row = battle && battle.players[String(s.players)];
  if (!row) return null;
  return battleMode ? row : { basic: row.basic, upgradedBasic: { 1: 0, 2: 0, 3: 0 } };
}

// La collezione ha carte Upgraded del mazzo nemesi in quella wave
export function ownedUpgradedInWave(db: DatiRegole, collection: Collezione, wave: string | null): boolean {
  return db.cards.some(c => c.category === 'Upgraded' && c.inNemesisDeck === true && c.boxCode
    && waveOfCode(c.boxCode) === wave && ownsProduct(collection, c.boxCode));
}

// Blocco di "Unisci": la wave della nemesi se la battaglia chiede Upgraded e quella wave nella collezione non ne ha
// (con "Modalità battaglia"); altrimenti null
export function mergeLockedWave(db: DatiRegole, collection: Collezione, s: SceltePerMazzo): string | null {
  if (s.battleMode === false) return null;
  const info = nemesisInfo(db, s.nemesis);
  const row = deckSetupRow(db, s);
  if (!info || !info.boxCode || !row) return null;
  const wantsUpgraded = TIERS.some(t => (row.upgradedBasic[t] || 0) > 0);
  const wave = waveOfCode(info.boxCode);
  return wantsUpgraded && !ownedUpgradedInWave(db, collection, wave) ? wave : null;
}

// "Unisci" in vigore: acceso, o spento ma bloccato
export function mergeActive(db: DatiRegole, collection: Collezione, s: SceltePerMazzo): boolean {
  return s.mergeCollection !== false || !!mergeLockedWave(db, collection, s);
}

// Carte di una categoria ('Basic' / 'Upgraded') che possono entrare nel mazzo per un Tier
export function deckPool(db: DatiRegole, collection: Collezione, category: 'Basic' | 'Upgraded', tier: number, s: SceltePerMazzo): Carta[] {
  const info = nemesisInfo(db, s.nemesis);
  const wave = info ? waveOfCode(info.boxCode) : null;
  const merge = mergeActive(db, collection, s);
  return db.cards.filter(c => c.category === category && c.inNemesisDeck === true && c.tier === tier
    && cardAllowed(collection, c) && (merge || waveOfCode(c.boxCode) === wave));
}

// Mazzo corto: { want, have } (carte Basic e Upgraded chieste da deck-setup.json e quelle che ci sono), o null se
// bastano (o se la riga non c'è)
export function deckShortfall(db: DatiRegole, collection: Collezione, s: SceltePerMazzo): MazzoCorto | null {
  const row = deckSetupRow(db, s);
  if (!row) return null;
  let want = 0;
  let have = 0;
  TIERS.forEach(t => {
    const b = row.basic[t] || 0;
    const u = row.upgradedBasic[t] || 0;
    want += b + u;
    have += Math.min(b, deckPool(db, collection, 'Basic', t, s).length)
      + Math.min(u, deckPool(db, collection, 'Upgraded', t, s).length);
  });
  return have < want ? { want, have } : null;
}

// Mazzo nemesi: { deck, plan }. deck = carte di cards_nemesis.json (si pesca dalla fine); plan = quante carte vengono da ognuno
// dei 9 mazzi [{ tier, kind: 'basic' | 'upgraded' | 'specific', count }] per la schermata "Crea mazzo". Senza riga di
// deck-setup.json: mazzo e plan vuoti. Ordine del caso: per i Tier 3, 2, 1, mescola le Basic ammesse, le Upgraded
// ammesse e poi le carte del Tier.
export function buildDeck(db: DatiRegole, collection: Collezione, s: SceltePerMazzo, random: Caso): { deck: Carta[]; plan: PianoMazzo[] } {
  const plan: PianoMazzo[] = [];
  const setup = deckSetupRow(db, s);
  if (!setup) return { deck: [], plan };
  const deck: Carta[] = [];
  ([3, 2, 1] as const).forEach(tier => {
    const ofTier = (c: Carta) => c.inNemesisDeck === true && c.tier === tier;
    const basic = pickRandom(deckPool(db, collection, 'Basic', tier, s), setup.basic[tier] || 0, random);
    const upgraded = pickRandom(deckPool(db, collection, 'Upgraded', tier, s), setup.upgradedBasic[tier] || 0, random);
    const specific = db.cards.filter(c => c.category === 'Specific' && c.nemesis === s.nemesis && ofTier(c));
    plan.push({ tier, kind: 'basic', count: basic.length }, { tier, kind: 'upgraded', count: upgraded.length },
      { tier, kind: 'specific', count: specific.length });
    deck.push(...shuffle([...basic, ...upgraded, ...specific], random));
  });
  return { deck, plan };
}
