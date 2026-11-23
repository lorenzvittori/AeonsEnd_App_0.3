// regole/json.ts: copie e letture JSON con un tipo, senza far uscire l'`any` di JSON.parse.
// Riceve valori semplici (da copiare) o testo JSON (da leggere); restituisce copie nuove o `unknown` da controllare.
// Non dipende da niente. Usato da: regole/, stato/, dati/, ui/.

// Copia profonda passando da JSON (come JSON.parse(JSON.stringify(x))): i campi undefined e le funzioni spariscono,
// Map e Set diventano oggetti vuoti. Va usata solo su dati semplici (fotografie, statistiche, mazzo dei turni)
export function jsonCopy<T>(value: T): T {
  const copy: T = JSON.parse(JSON.stringify(value));
  return copy;
}

// Testo JSON letto da fuori (salvataggio nel browser, file): il risultato è `unknown` e va controllato da chi lo usa
export function parseJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  return value;
}

// Oggetto qualsiasi (non null, non array) da controllare campo per campo
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
