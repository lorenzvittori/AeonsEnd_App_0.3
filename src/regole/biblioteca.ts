// regole/biblioteca.ts: la logica pura della Biblioteca (mercato): filtri combinabili (ricerca, set, meccanica, costo),
// fasce di costo, raggruppamento delle carte supply (ordine fisso), set e meccaniche presenti, preferenze salvate nel
// browser. Nessun DOM, nessuno stato della partita.
// Riceve: le carte supply (CartaSupply[]), le meccaniche (Meccanica[]), i filtri e le preferenze come testo; restituisce
// liste e valori. Dipende da: tipi/dati.ts. Usato da: ui/finestre/biblioteca.ts, tests/biblioteca.test.ts.

import type { CartaSupply, Meccanica, Prodotti, TipoSupply } from '../tipi/dati.ts';

// Le tre categorie del Mercato (barra inferiore): Gemme, Reliquie, Incantesimi
export const CATEGORIE_MERCATO: readonly TipoSupply[] = ['Gem', 'Relic', 'Spell'];

// Costo dalla fascia 8 in su: "8+" (il costo massimo nel catalogo supply è 8)
export const COSTO_FASCIA_ALTA = 8;

// Fascia di costo di una carta: il costo, o 8 per 8 e oltre
export function fasciaCosto(costo: number): number {
  return Math.min(costo, COSTO_FASCIA_ALTA);
}

// Etichetta di una fascia di costo: "5", "8+"
export function etichettaCosto(fascia: number): string {
  return fascia >= COSTO_FASCIA_ALTA ? `${COSTO_FASCIA_ALTA}+` : String(fascia);
}

// Filtri combinabili (AND tra tipi diversi, OR dentro lo stesso tipo): testo (nome, id o effetto), set (codici di
// products.json, vuoto = tutti), meccaniche (nomi nell'app, vuoto = tutte; una carta passa se ha almeno una di quelle),
// costi (fasce, vuoto = tutti), preferite (chiavi di chiaveCarta, null = filtro spento)
export interface Filtri {
  ricerca: string;
  set: ReadonlySet<string>;
  meccaniche: ReadonlySet<string>;
  costi: ReadonlySet<number>;
  preferite: ReadonlySet<string> | null;
}

// Chiave che identifica una carta preferita: sezione, tipo, set e id (l'id da solo non basta: "[AE055, AE061]" più copie).
// Le preferite sono salvate così nel browser; le carte del Mercato hanno sezione 'mercato'
export function chiaveCarta(sezione: string, carta: Pick<CartaSupply, 'type' | 'boxCode' | 'id'>): string {
  return [sezione, carta.type, carta.boxCode, carta.id].join('|');
}

// Le chiavi preferite lette dal testo salvato: un array di testi, senza doppioni; il resto si scarta
export function leggiPreferiti(testo: string | null): string[] {
  if (testo === null) return [];
  let dati: unknown;
  try {
    dati = JSON.parse(testo);
  } catch {
    return [];
  }
  if (!Array.isArray(dati)) return [];
  return [...new Set(dati.filter((v): v is string => typeof v === 'string' && v !== ''))];
}

// Testo confrontabile: senza maiuscole e senza accenti (e senza spazi ai bordi)
function normalizza(testo: string): string {
  return testo.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('en');
}

// La ricerca guarda nome, id ed effetto della carta
function cercaNella(carta: CartaSupply, q: string): boolean {
  return [carta.name, carta.id, carta.effect ?? ''].some(testo => normalizza(testo).includes(q));
}

// Le carte di una categoria (null = tutte le categorie) che passano tutti i filtri
export function filtra(carte: readonly CartaSupply[], categoria: TipoSupply | null, filtri: Filtri): CartaSupply[] {
  const q = normalizza(filtri.ricerca);
  return carte.filter(c => (categoria === null || c.type === categoria)
    && (filtri.set.size === 0 || filtri.set.has(c.boxCode))
    && (filtri.meccaniche.size === 0 || c.mechanics.some(m => filtri.meccaniche.has(m)))
    && (filtri.costi.size === 0 || filtri.costi.has(fasciaCosto(c.cost)))
    && (filtri.preferite === null || filtri.preferite.has(chiaveCarta('mercato', c)))
    && (q === '' || cercaNella(c, q)));
}

// Fasce di costo presenti nelle carte di una categoria (i pulsanti di costo si adattano al catalogo), in ordine crescente
export function fasceCostoPresenti(carte: readonly CartaSupply[], categoria: TipoSupply): number[] {
  const fasce = new Set(carte.filter(c => c.type === categoria).map(c => fasciaCosto(c.cost)));
  return [...fasce].sort((a, b) => a - b);
}

// Un gruppo "COSTO N": la fascia e le sue carte, già ordinate
export interface GruppoCosto {
  fascia: number;
  carte: CartaSupply[];
}

function confrontoNome(a: CartaSupply, b: CartaSupply): number {
  return a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en');
}

// Raggruppa per costo crescente (solo gruppi con almeno una carta); le carte dentro ciascun gruppo sono in ordine
// alfabetico del nome. L'ordine è fisso: non c'è un menu per cambiarlo
export function raggruppaPerCosto(carte: readonly CartaSupply[]): GruppoCosto[] {
  const mappa = new Map<number, CartaSupply[]>();
  for (const c of carte) {
    const fascia = fasciaCosto(c.cost);
    const lista = mappa.get(fascia);
    if (lista) lista.push(c);
    else mappa.set(fascia, [c]);
  }
  return [...mappa]
    .map(([fascia, lista]) => ({ fascia, carte: [...lista].sort(confrontoNome) }))
    .sort((a, b) => a.fascia - b.fascia);
}

// Un set (espansione) da scegliere: il codice di products.json e il nome
export interface SetMercato {
  codice: string;
  nome: string;
}

// Confronto dei codici di prodotto: "1" < "1.1" < "1.2" < "2"
function confrontoCodici(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

// I set presenti nelle carte supply, con il nome di products.json (se manca, il codice)
export function setPresenti(carte: readonly CartaSupply[], prodotti: Readonly<Prodotti>): SetMercato[] {
  const codici = new Set(carte.map(c => c.boxCode));
  return [...codici].sort(confrontoCodici).map(codice => ({ codice, nome: prodotti[codice] ?? codice }));
}

// Una meccanica offerta nel filtro: il nome nell'app e quante carte la hanno
export interface VoceMeccanica {
  name: string;
  carte: number;
}

// Le meccaniche da offrire nel filtro, per le carte date: solo quelle che hanno almeno una carta (in ordine alfabetico)
export function meccanicheDi(carte: readonly CartaSupply[], meccaniche: readonly Meccanica[]): VoceMeccanica[] {
  const conta = new Map<string, number>();
  for (const c of carte) {
    for (const m of c.mechanics) conta.set(m, (conta.get(m) ?? 0) + 1);
  }
  return meccaniche
    .filter(m => (conta.get(m.name) ?? 0) > 0)
    .map(m => ({ name: m.name, carte: conta.get(m.name) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

// Le meccaniche del filtro di una categoria: così nelle Gemme non compaiono le meccaniche degli Incantesimi
export function meccanicheDiCategoria(carte: readonly CartaSupply[], meccaniche: readonly Meccanica[],
  categoria: TipoSupply): VoceMeccanica[] {
  return meccanicheDi(carte.filter(c => c.type === categoria), meccaniche);
}

// L'etichetta del box di una carta: il nome del box ("The New Age"), o "box - mini espansione" se la carta è di una
// mini espansione ("The New Age - Shattered Dreams"). Vuota se il box manca (non si inventa un nome)
export function etichettaBox(carta: Pick<CartaSupply, 'box' | 'miniExpansion'>): string {
  const box = carta.box?.trim() ?? '';
  if (box === '') return '';
  const mini = carta.miniExpansion?.trim() ?? '';
  return mini === '' ? box : `${box} - ${mini}`;
}

// I tag di una carta: le sue meccaniche di cards_supply.json (il nome nell'app), senza vuote né ripetute, nell'ordine del file
export function meccanicheCarta(carta: Pick<CartaSupply, 'mechanics'>): string[] {
  return [...new Set(carta.mechanics.map(m => m.trim()).filter(m => m !== ''))];
}

// Preferenze della Biblioteca salvate nel browser: la categoria (i filtri restano per la sessione). Il vecchio campo
// "ordine" (menu dell'ordinamento, tolto) si ignora: una preferenza salvata con quel campo si legge senza errori
export interface PreferenzeBiblioteca {
  categoria: TipoSupply;
}

export const PREFERENZE_BIBLIOTECA_PREDEFINITE: PreferenzeBiblioteca = { categoria: 'Gem' };

// Legge le preferenze dal testo salvato: un valore sbagliato o assente dà quelle predefinite
export function leggiPreferenzeBiblioteca(testo: string | null): PreferenzeBiblioteca {
  if (testo === null) return { ...PREFERENZE_BIBLIOTECA_PREDEFINITE };
  let dati: unknown;
  try {
    dati = JSON.parse(testo);
  } catch {
    return { ...PREFERENZE_BIBLIOTECA_PREDEFINITE };
  }
  if (typeof dati !== 'object' || dati === null) return { ...PREFERENZE_BIBLIOTECA_PREDEFINITE };
  const { categoria } = dati as Record<string, unknown>;
  return {
    categoria: CATEGORIE_MERCATO.find(c => c === categoria) ?? PREFERENZE_BIBLIOTECA_PREDEFINITE.categoria
  };
}
