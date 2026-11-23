// regole/caso.ts: il caso nelle regole (mescolare, scegliere a caso).
// Riceve: una lista e `random`, una funzione che dà un numero in [0, 1) (nell'app Math.random, passata da
// stato/partita.ts; nei test un generatore ripetibile). Restituisce liste nuove: non cambia quella ricevuta.
// Non dipende da niente. Usato da: regole/mazzo-nemesi.ts, regole/mazzo-turni.ts, dati/dati.ts (con Math.random), test.

// Funzione del caso: un numero in [0, 1)
export type Caso = () => number;

// Copia mescolata della lista (Fisher-Yates: dall'ultima posizione alla seconda, scambio con una posizione a caso tra
// 0 e quella). Usa random() una volta per ogni posizione da length-1 a 1.
export function shuffle<T>(list: readonly T[], random: Caso): T[] {
  const result = list.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// n elementi a caso della lista: la lista mescolata (tutta) e poi i primi n
export function pickRandom<T>(list: readonly T[], n: number, random: Caso): T[] {
  return shuffle(list, random).slice(0, n);
}
