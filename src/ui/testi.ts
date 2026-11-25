// ui/testi.ts: unico punto di accesso ai testi dell'interfaccia: `T` e il tipo `Testi`.
// I dizionari stanno in ui/testi-it.ts e ui/testi-en.ts (stesse chiavi: il tipo Testi lo impone).
// I testi fissi di index.html non sono scritti nel file: portano un attributo che dice la chiave, e avvio() li scrive:
//   data-testo="chiave"        il testo dell'elemento
//   data-testo-aria="chiave"   l'attributo aria-label
//   data-testo-title="chiave"  l'attributo title
// La lingua si sceglie una volta sola, all'avvio, dalla preferenza (stato/preferenze.ts); cambiandola l'app si ricarica.
// Livello 2 (ui/ base). Dipende da: stato/preferenze.ts, ui/testi-it.ts, ui/testi-en.ts. Usato da: quasi tutti i moduli di ui/ e avvio.ts.

import { lingua } from '../stato/preferenze.ts';
import type { Lingua } from '../stato/preferenze.ts';
import { I18N_IT } from './testi-it.ts';
import type { Testi } from './testi-it.ts';
import { I18N_EN } from './testi-en.ts';

export type { Testi };

// I dizionari, per lingua (anche i test li usano, per provare tutte le lingue)
export const DIZIONARI: Record<Lingua, Testi> = { it: I18N_IT, en: I18N_EN };

// La lingua in uso e i suoi testi
export const LINGUA: Lingua = lingua();
export const T: Testi = DIZIONARI[LINGUA];

// Il testo di una chiave del dizionario che sia una scritta fissa (non una funzione né un gruppo); null se non lo è
export function testoDi(testi: Testi, chiave: string): string | null {
  const valore: unknown = Reflect.get(testi, chiave);
  return typeof valore === 'string' ? valore : null;
}

// Scrive i testi fissi di una pagina (index.html) con i testi dati
export function applicaTestiFissi(radice: ParentNode, testi: Testi): void {
  const scrivi = (selettore: string, attributo: string | null, dataset: string) => {
    radice.querySelectorAll<HTMLElement>(selettore).forEach(elemento => {
      const chiave = elemento.getAttribute(dataset) ?? '';
      const testo = testoDi(testi, chiave);
      if (testo === null) { console.warn('Testo fisso senza chiave valida: ' + chiave); return; }
      if (attributo) elemento.setAttribute(attributo, testo);
      else elemento.textContent = testo;
    });
  };
  scrivi('[data-testo]', null, 'data-testo');
  scrivi('[data-testo-aria]', 'aria-label', 'data-testo-aria');
  scrivi('[data-testo-title]', 'title', 'data-testo-title');
}

// Codice eseguito all'avvio (main.ts chiama avvio() di ogni modulo, testi per primo dopo compatibilita)
export function avvio(): void {
  document.documentElement.lang = LINGUA;
  applicaTestiFissi(document, T);
}
