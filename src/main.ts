// main.ts: avvio dell'app (punto d'ingresso di Vite, caricato da index.html).
// 1. Il CSS: tutti i file, nell'ordine della cascata, da stili/indice.ts.
// 2. I moduli: al caricamento non fanno niente (dichiarano solo funzioni e costanti); il codice di avvio è nella
//    avvio() di ogni modulo, chiamata qui nell'ordine giusto (l'ordine conta: per esempio ui/pagina.ts, che legge gli
//    elementi della pagina, prima di tutto il resto, avvio.ts per ultimo). Così l'ordine di esecuzione non dipende da
//    come i moduli si importano a vicenda. Lo stato (stato/: catalogo, preferenze, partita) non ha avvio(): i suoi
//    valori iniziali ci sono già al caricamento.
// 3. window.app: l'unico oggetto globale, per la console, la pagina scheletri/ e le prove (vedi sotto).
// Dipende da: tutti i moduli di src/. Usato da: index.html.

import './stili/indice.ts';

import * as compatibilita from './ui/compatibilita.ts';
import * as testi from './ui/testi.ts';
import * as pagina from './ui/pagina.ts';
import * as dati from './dati/dati.ts';
import * as collezione from './dati/collezione.ts';
import * as statoCatalogo from './stato/catalogo.ts';
import * as statoPreferenze from './stato/preferenze.ts';
import * as statoPartita from './stato/partita.ts';
import * as statoSalvataggio from './stato/salvataggio.ts';
import * as ripristino from './ui/ripristino.ts';
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

// Nell'ordine in cui le avvio() devono partire (lo stato e le regole pure non hanno avvio(): non sono nell'elenco)
const MODULI: ModuloAvviato[] = [compatibilita, testi, pagina, dati, collezione, componenti, dialoghi,
  turnoGiocatori, scarti, menu, opzioni, turnoNemesi, eventi, mazzoTurniFinestra, testata, statistiche,
  creaMazzo, pescaUndo, menuLaterale, rete, test, avvio];

// Moduli senza avvio() le cui funzioni stanno comunque in window.app (stato e ripristino)
const SENZA_AVVIO: object[] = [statoCatalogo, statoPreferenze, statoPartita, statoSalvataggio, ripristino];

// window.app: tutto quello che i moduli esportano (app.render(), app.makeEntry, app.act(), app.SCENARI, app.ui...) più
// i campi dello stato, leggibili e (solo per il debug) assegnabili per nome: del catalogo (app.allCards, app.nemeses...),
// delle preferenze (app.settings, app.collection) e della partita (app.queue, app.turn, app.turnOrder, app.undoStack...).
// app.catalogo, app.preferenze e app.partita sono gli oggetti interi; app.app è l'elemento della shell (#app);
// app.noSave = true spegne il salvataggio (pagina scheletri/). Si legge sempre il valore attuale (i nomi sono proprietà
// con get). L'assegnazione di un campo della partita da qui è l'unica fuori da stato/partita.ts: serve alla pagina
// scheletri/ e alla console, non all'app. I valori si leggono per nome con Reflect: chi li usa da fuori sa cosa sono,
// qui restano `unknown`
const debug: Record<string, unknown> = {};
[...MODULI, ...SENZA_AVVIO].forEach(mod => Object.keys(mod).forEach(name => {
  if (name === 'avvio' || name in debug) return;
  Object.defineProperty(debug, name, { enumerable: true, get: (): unknown => Reflect.get(mod, name) });
}));
// Un campo di un oggetto dello stato, letto e assegnato per nome
function shareField(target: object, name: string): void {
  if (Object.prototype.hasOwnProperty.call(debug, name)) return;
  Object.defineProperty(debug, name, { enumerable: true, get: (): unknown => Reflect.get(target, name), set: (v: unknown) => { Reflect.set(target, name, v); } });
}
// Le regole pure (src/regole/), per provarle da console: app.regole.turnoNemesi.isVictory(app.partita)...
Object.defineProperty(debug, 'regole', { value: { caso: regoleCaso, mazzoNemesi: regoleMazzoNemesi, mazzoTurni: regoleMazzoTurni,
  turnoNemesi: regoleTurnoNemesi, vite: regoleVite, salvataggio: regoleSalvataggio } });
window.app = debug;

// Il caricatore di index.html aggiunge "ready" quando i CSS sono pronti
document.documentElement.classList.add('ready');
MODULI.forEach(mod => mod.avvio());
// I campi dello stato in window.app (dopo le avvio(), come sempre)
[statoCatalogo.catalogo, statoPreferenze.preferenze, statoPartita.partita].forEach(obj => Object.keys(obj).forEach(name => shareField(obj, name)));
shareField(statoSalvataggio.opzioniSalvataggio, 'noSave');
