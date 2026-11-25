// ui/testi.ts: unico punto di accesso ai testi dell'interfaccia: `T` e il tipo `Testi`.
// I dizionari stanno in ui/testi-it.ts e ui/testi-en.ts (stesse chiavi: il tipo Testi lo impone).
// I testi fissi di index.html non sono scritti nel file: portano un attributo che dice la chiave, e avvio() li scrive:
//   data-testo="chiave"        il testo dell'elemento
//   data-testo-aria="chiave"   l'attributo aria-label
//   data-testo-title="chiave"  l'attributo title
// Livello 2 (ui/ base). Dipende da: ui/testi-it.ts. Usato da: quasi tutti i moduli di ui/ e avvio.ts.

import { I18N_IT } from './testi-it.ts';

export type Testi = typeof I18N_IT;

// I testi in uso
export const T: Testi = I18N_IT;

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
  applicaTestiFissi(document, T);
}
