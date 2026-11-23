// main.js: avvio dell'app (punto d'ingresso di Vite, caricato da index.html).
// 1. Il CSS di oggi, così com'è e nello stesso ordine (la divisione per schermata è la fase E).
// 2. I moduli: al caricamento non fanno niente (dichiarano solo funzioni e costanti); il codice che prima girava al
//    caricamento di script.js è nella avvio() di ogni modulo, chiamata qui nell'ordine di prima. Così l'ordine di
//    esecuzione è quello dello script unico, anche se i moduli si importano a vicenda.
// 3. window.app: l'unico oggetto globale, per la console, la pagina scheletri/ e le prove (vedi sotto).

import './stili/design-tokens.css';
import './stili/components.css';
import './stili/style.css';

import { G } from './stato/condivise.ts';
import * as compatibilita from './ui/compatibilita.js';
import * as testi from './ui/testi.js';
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
import * as componenti from './ui/componenti/componenti.js';
import * as dialoghi from './ui/componenti/dialoghi.js';
import * as turnoGiocatori from './ui/schermate/turno-giocatori.js';
import * as scarti from './ui/componenti/scarti.js';
import * as menu from './ui/schermate/menu.js';
import * as opzioni from './ui/schermate/opzioni.js';
import * as salvataggio from './stato/salvataggio.ts';
import * as turnoNemesi from './ui/schermate/turno-nemesi.js';
import * as eventi from './ui/eventi.js';
import * as mazzoTurniFinestra from './ui/schermate/mazzo-turni.js';
import * as testata from './ui/componenti/testata.js';
import * as statistiche from './ui/schermate/statistiche.js';
import * as creaMazzo from './ui/schermate/crea-mazzo.js';
import * as pescaUndo from './ui/componenti/pesca-undo.js';
import * as menuLaterale from './ui/componenti/menu-laterale.js';
import * as rete from './dati/rete.ts';
import * as test from './ui/schermate/test.js';
import * as avvio from './avvio.js';

// Nell'ordine in cui le parti stavano in script.js (l'ordine delle avvio() conta)
// (stato/partita.js sta dove c'erano i file delle regole di prima: le regole pure non hanno avvio())
const MODULI = [compatibilita, testi, stato, dati, collezione, partita, componenti, dialoghi,
  turnoGiocatori, scarti, menu, opzioni, salvataggio, turnoNemesi, eventi, mazzoTurniFinestra, testata, statistiche,
  creaMazzo, pescaUndo, menuLaterale, rete, test, avvio];

// window.app (oggetto di debug, l'unico globale): tutto quello che i moduli esportano (app.render(), app.makeEntry,
// app.SCENARI, app.ui...) più le variabili condivise di G, leggibili e assegnabili (app.queue, app.settings,
// app.turnOrder...). app.app è l'elemento della shell (#app). app.noSave = true spegne il salvataggio (pagina
// scheletri/). Si legge sempre il valore attuale (i nomi sono proprietà con get).
const debug = {};
MODULI.forEach(mod => Object.keys(mod).forEach(name => {
  if (name === 'avvio' || name in debug) return;
  Object.defineProperty(debug, name, { enumerable: true, get: () => mod[name] });
}));
function shareG(name) {
  if (Object.prototype.hasOwnProperty.call(debug, name)) return;
  Object.defineProperty(debug, name, { enumerable: true, get: () => G[name], set: v => { G[name] = v; } });
}
Object.defineProperty(debug, 'G', { value: G });
// Le regole pure (src/regole/), per provarle da console: app.regole.turnoNemesi.isVictory(app.G)...
Object.defineProperty(debug, 'regole', { value: { caso: regoleCaso, mazzoNemesi: regoleMazzoNemesi, mazzoTurni: regoleMazzoTurni,
  turnoNemesi: regoleTurnoNemesi, vite: regoleVite, salvataggio: regoleSalvataggio } });
window.app = debug;

// Prima: il caricatore di index.html aggiungeva "ready" quando i CSS erano pronti, poi caricava script.js
document.documentElement.classList.add('ready');
MODULI.forEach(mod => mod.avvio());
// Le variabili condivise esistono dopo le avvio(): le si aggiunge a window.app
Object.keys(G).forEach(shareG);
shareG('noSave');
