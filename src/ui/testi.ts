// ui/testi.ts: unico punto di accesso ai testi dell'interfaccia: `T` e il tipo `Testi`.
// I dizionari stanno in ui/testi-it.ts e ui/testi-en.ts (stesse chiavi: il tipo Testi lo impone).
// Livello 2 (ui/ base). Dipende da: ui/testi-it.ts. Usato da: quasi tutti i moduli di ui/ e avvio.ts.

import { I18N_IT } from './testi-it.ts';

export type Testi = typeof I18N_IT;

// I testi in uso
export const T: Testi = I18N_IT;

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
