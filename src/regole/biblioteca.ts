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

// Filtri combinabili: testo (nome, id o effetto), set (codici di products.json, vuoto = tutti), meccaniche (nomi nell'app,
// vuoto = tutte; una carta passa se ha almeno una di quelle scelte), costo (fascia, null = tutti)
export interface Filtri {
  ricerca: string;
  set: ReadonlySet<string>;
  meccaniche: ReadonlySet<string>;
  costo: number | null;
}

// Testo confrontabile: senza maiuscole e senza accenti (e senza spazi ai bordi)
function normalizza(testo: string): string {
  return testo.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('en');
}

// La ricerca guarda nome, id ed effetto della carta
function cercaNella(carta: CartaSupply, q: string): boolean {
  return [carta.name, carta.id, carta.effect ?? ''].some(testo => normalizza(testo).includes(q));
}

// Le carte di una categoria che passano tutti i filtri
export function filtra(carte: readonly CartaSupply[], categoria: TipoSupply, filtri: Filtri): CartaSupply[] {
  const q = normalizza(filtri.ricerca);
  return carte.filter(c => c.type === categoria
    && (filtri.set.size === 0 || filtri.set.has(c.boxCode))
    && (filtri.meccaniche.size === 0 || c.mechanics.some(m => filtri.meccaniche.has(m)))
    && (filtri.costo === null || fasciaCosto(c.cost) === filtri.costo)
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

// Una meccanica offerta nel filtro della categoria attiva: il nome nell'app e quante carte di quella categoria la hanno
export interface VoceMeccanica {
  name: string;
  carte: number;
}

// Le meccaniche da offrire nel filtro di una categoria: solo quelle che hanno almeno una carta di quella categoria
// (così nelle Gemme non compaiono le meccaniche degli Incantesimi), in ordine alfabetico del nome nell'app
export function meccanicheDiCategoria(carte: readonly CartaSupply[], meccaniche: readonly Meccanica[],
  categoria: TipoSupply): VoceMeccanica[] {
  const conta = new Map<string, number>();
  for (const c of carte) {
    if (c.type !== categoria) continue;
    for (const m of c.mechanics) conta.set(m, (conta.get(m) ?? 0) + 1);
  }
  return meccaniche
    .filter(m => (conta.get(m.name) ?? 0) > 0)
    .map(m => ({ name: m.name, carte: conta.get(m.name) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
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
