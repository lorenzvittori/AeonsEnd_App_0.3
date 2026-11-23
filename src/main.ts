// main.ts: avvio dell'app (punto d'ingresso di Vite, caricato da index.html).
// 1. Il CSS, nello stesso ordine di sempre (la divisione per schermata è la fase E).
// 2. I moduli: al caricamento non fanno niente (dichiarano solo funzioni e costanti); il codice di avvio è nella
//    avvio() di ogni modulo, chiamata qui nell'ordine giusto (l'ordine conta: per esempio stato prima di tutto il resto,
//    avvio.ts per ultimo). Così l'ordine di esecuzione non dipende da come i moduli si importano a vicenda.
// 3. window.app: l'unico oggetto globale, per la console, la pagina scheletri/ e le prove (vedi sotto).
// Dipende da: tutti i moduli di src/. Usato da: index.html.

import './stili/design-tokens.css';
import './stili/components.css';
import './stili/style.css';

import { G } from './stato/condivise.ts';
import * as compatibilita from './ui/compatibilita.ts';
import * as testi from './ui/testi.ts';
import * as stato from './stato/stato.ts';
import * as dati from './dati/dati.ts';
import * as collezione from './dati/collezione.ts';
import * as partita from './stato/partita.ts';
import * as regoleCaso from './regole/caso.ts';
import * as regoleMazzoNemesi from './regole/mazzo-nemesi.ts';
import * as regoleMazzoTurni from './regole/mazzo-turni.ts';
import * as regoleTurnoNemesi from './regole/turno-nemesi.ts';
import * as regoleVite from './regole/vite.ts';
import * as regoleSalvataggio from './regole/salvataggio.ts';
import * as componenti from './ui/componenti/componenti.ts';
import * as dialoghi from './ui/componenti/dialoghi.ts';
import * as turnoGiocatori from './ui/schermate/turno-giocatori.ts';
import * as scarti from './ui/componenti/scarti.ts';
import * as menu from './ui/schermate/menu.ts';
import * as opzioni from './ui/schermate/opzioni.ts';
import * as salvataggio from './stato/salvataggio.ts';
import * as turnoNemesi from './ui/schermate/turno-nemesi.ts';
import * as eventi from './ui/eventi.ts';
import * as mazzoTurniFinestra from './ui/schermate/mazzo-turni.ts';
import * as testata from './ui/componenti/testata.ts';
import * as statistiche from './ui/schermate/statistiche.ts';
import * as creaMazzo from './ui/schermate/crea-mazzo.ts';
import * as pescaUndo from './ui/componenti/pesca-undo.ts';
import * as menuLaterale from './ui/componenti/menu-laterale.ts';
import * as rete from './dati/rete.ts';
import * as test from './ui/schermate/test.ts';
import * as avvio from './avvio.ts';

// window.app (oggetto di debug, l'unico globale): i suoi campi sono letti dalla console, dalla pagina scheletri/ e
// dalle prove, che li conoscono per nome
declare global {
  interface Window {
    app: Record<string, unknown>;
  }
}

// Un modulo dell'app: ha il suo codice di avvio
type ModuloAvviato = { avvio: () => void };

// Nell'ordine in cui le avvio() devono partire (le regole pure di src/regole/ non hanno avvio(): non sono nell'elenco)
const MODULI: ModuloAvviato[] = [compatibilita, testi, stato, dati, collezione, partita, componenti, dialoghi,
  turnoGiocatori, scarti, menu, opzioni, salvataggio, turnoNemesi, eventi, mazzoTurniFinestra, testata, statistiche,
  creaMazzo, pescaUndo, menuLaterale, rete, test, avvio];

// window.app: tutto quello che i moduli esportano (app.render(), app.makeEntry, app.SCENARI, app.ui...) più le
// variabili condivise di G, leggibili e assegnabili (app.queue, app.settings, app.turnOrder...). app.app è l'elemento
// della shell (#app). app.noSave = true spegne il salvataggio (pagina scheletri/). Si legge sempre il valore attuale
// (i nomi sono proprietà con get). I valori si leggono per nome con Reflect: chi li usa da fuori sa cosa sono, qui
// restano `unknown`
const debug: Record<string, unknown> = {};
MODULI.forEach(mod => Object.keys(mod).forEach(name => {
  if (name === 'avvio' || name in debug) return;
  Object.defineProperty(debug, name, { enumerable: true, get: (): unknown => Reflect.get(mod, name) });
}));
function shareG(name: string): void {
  if (Object.prototype.hasOwnProperty.call(debug, name)) return;
  Object.defineProperty(debug, name, { enumerable: true, get: (): unknown => Reflect.get(G, name), set: (v: unknown) => { Reflect.set(G, name, v); } });
}
Object.defineProperty(debug, 'G', { value: G });
// Le regole pure (src/regole/), per provarle da console: app.regole.turnoNemesi.isVictory(app.G)...
Object.defineProperty(debug, 'regole', { value: { caso: regoleCaso, mazzoNemesi: regoleMazzoNemesi, mazzoTurni: regoleMazzoTurni,
  turnoNemesi: regoleTurnoNemesi, vite: regoleVite, salvataggio: regoleSalvataggio } });
window.app = debug;

// Il caricatore di index.html aggiunge "ready" quando i CSS sono pronti
document.documentElement.classList.add('ready');
MODULI.forEach(mod => mod.avvio());
// Le variabili condivise ci sono tutte dopo le avvio(): le si aggiunge a window.app
Object.keys(G).forEach(shareG);
shareG('noSave');
