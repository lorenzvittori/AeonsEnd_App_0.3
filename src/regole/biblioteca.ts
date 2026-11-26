// regole/biblioteca.ts: la logica pura della Biblioteca (mercato): filtri combinabili, fasce di costo, raggruppamento e
// ordinamento delle carte supply, set presenti, preferenze salvate nel browser. Nessun DOM, nessuno stato della partita.
// Riceve: le carte supply (CartaSupply[]), i filtri e le preferenze come testo; restituisce liste e valori.
// Dipende da: tipi/dati.ts. Usato da: ui/finestre/biblioteca.ts, tests/biblioteca.test.ts.

import type { CartaSupply, Prodotti, TipoSupply } from '../tipi/dati.ts';

// Le tre categorie del Mercato (barra inferiore): Gemme, Reliquie, Incantesimi
export const CATEGORIE_MERCATO: readonly TipoSupply[] = ['Gem', 'Relic', 'Spell'];

// Ordinamento: costo crescente (predefinito), costo decrescente, nome
export type Ordine = 'costo-asc' | 'costo-desc' | 'nome';
export const ORDINI: readonly Ordine[] = ['costo-asc', 'costo-desc', 'nome'];

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

// Filtri combinabili: testo nel nome, set (codici di products.json, vuoto = tutti), costo (fascia, null = tutti)
export interface Filtri {
  ricerca: string;
  set: ReadonlySet<string>;
  costo: number | null;
}

function normalizza(testo: string): string {
  return testo.trim().toLocaleLowerCase('en');
}

// Le carte di una categoria che passano tutti i filtri
export function filtra(carte: readonly CartaSupply[], categoria: TipoSupply, filtri: Filtri): CartaSupply[] {
  const q = normalizza(filtri.ricerca);
  return carte.filter(c => c.type === categoria
    && (filtri.set.size === 0 || filtri.set.has(c.boxCode))
    && (filtri.costo === null || fasciaCosto(c.cost) === filtri.costo)
    && (q === '' || normalizza(c.name).includes(q)));
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

// Raggruppa per costo (solo gruppi con almeno una carta). Con "nome" i gruppi restano per costo crescente e le carte
// dentro ciascuno sono in ordine alfabetico; con i costi le carte di ogni gruppo sono in ordine alfabetico
export function raggruppaPerCosto(carte: readonly CartaSupply[], ordine: Ordine): GruppoCosto[] {
  const mappa = new Map<number, CartaSupply[]>();
  for (const c of carte) {
    const fascia = fasciaCosto(c.cost);
    const lista = mappa.get(fascia);
    if (lista) lista.push(c);
    else mappa.set(fascia, [c]);
  }
  const gruppi = [...mappa].map(([fascia, lista]) => ({ fascia, carte: [...lista].sort(confrontoNome) }));
  gruppi.sort((a, b) => (ordine === 'costo-desc' ? b.fascia - a.fascia : a.fascia - b.fascia));
  return gruppi;
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

// Preferenze della Biblioteca salvate nel browser: la categoria e l'ordinamento (i filtri restano per la sessione)
export interface PreferenzeBiblioteca {
  categoria: TipoSupply;
  ordine: Ordine;
}

export const PREFERENZE_BIBLIOTECA_PREDEFINITE: PreferenzeBiblioteca = { categoria: 'Gem', ordine: 'costo-asc' };

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
  const { categoria, ordine } = dati as Record<string, unknown>;
  return {
    categoria: CATEGORIE_MERCATO.find(c => c === categoria) ?? PREFERENZE_BIBLIOTECA_PREDEFINITE.categoria,
    ordine: ORDINI.find(o => o === ordine) ?? PREFERENZE_BIBLIOTECA_PREDEFINITE.ordine
  };
}
