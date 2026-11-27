// ui/colori-meccaniche.ts: il colore fisso di ogni meccanica (il nome nell'app, quello di mechanics.json e delle carte),
// in un posto solo: così ogni meccanica ha lo stesso colore in tutta l'app, anche nei filtri futuri.
// Non dipende da niente. Usato da: ui/finestre/biblioteca.ts. Per aggiungere una meccanica: una riga in COLORI_MECCANICHE.

const COLORI_MECCANICHE: ReadonlyMap<string, string> = new Map([
  ['Aether Token', '#E0B363'],
  ['Attach', '#B5A1D8'],
  ['Conjure', '#CA8BD5'],
  ['Develop', '#90B97D'],
  ['Dual Breach', '#7D9BDD'],
  ['Echo', '#74C3C7'],
  ['Elemental Token', '#D99668'],
  ['Link', '#C1B5E5'],
  ['Pulse Token', '#D88199'],
  ['Recall', '#82B6DD'],
  ['Shield Token', '#A2B0C4'],
  ['Trinket Interaction', '#BDA58A'],
]);

// Il colore HEX di una meccanica, o null se non è in elenco (il tag allora prende il colore neutro del CSS)
export function coloreMeccanica(nome: string): string | null {
  return COLORI_MECCANICHE.get(nome) ?? null;
}
