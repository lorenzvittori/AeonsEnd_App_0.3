// regole/versione.ts: la versione dell'app (v0.3.x) composta dal tag e dal numero di commit.
// Riceve: il tag (per esempio "v0.3", l'ultimo vN.N da `git describe`) e il numero di commit dal tag (`git rev-list --count`).
// Restituisce "v0.3.12". Se manca il tag o il conteggio (git non c'è, nessun tag), restituisce VERSIONE_SENZA_GIT.
// Non dipende da niente. Usato da: vite.config.ts (la versione diventa la costante __VERSIONE__), test.

// Versione quando git non si legge: il punto di domanda dice che il numero non si conosce, non che è zero
export const VERSIONE_SENZA_GIT = 'v0.3.?';

export function componiVersione(tag: string | null, commit: number | null): string {
  if (tag === null || !/^v\d+\.\d+$/.test(tag)) return VERSIONE_SENZA_GIT;
  if (commit === null || !Number.isInteger(commit) || commit < 0) return VERSIONE_SENZA_GIT;
  return `${tag}.${commit}`;
}
