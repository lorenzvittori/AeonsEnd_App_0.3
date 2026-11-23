// stato/stato.ts: elementi della pagina, costanti, dorso delle carte, stato iniziale della partita (in G) e stato
// dell'interfaccia (ui). Provvisorio: elementi e costanti dell'interfaccia andranno in ui/, lo stato nella fase D.
// Al caricamento il modulo dichiara solo funzioni e costanti; elementi e valori iniziali si scrivono in avvio(),
// chiamata da main.ts nell'ordine di sempre.
// Dipende da: regole/ (vite, turno-nemesi, mazzo-turni), stato/condivise.ts, ui/componenti/dialoghi (loadImage).
// Usato da: quasi tutti i moduli di stato/, dati/ e ui/.

import * as Nemesi from '../regole/turno-nemesi.ts';
import * as Vite from '../regole/vite.ts';
import { GRAVEHOLD_LIFE } from '../regole/vite.ts';
import { newTurnOrder } from '../regole/mazzo-turni.ts';
import { G } from './condivise.ts';
import { loadImage } from '../ui/componenti/dialoghi.ts';
import type { Carta } from '../tipi/dati.ts';
import type { BozzaCarta, GruppoStatistiche, Statistiche } from '../tipi/partita.ts';

// Elemento di index.html con il suo tipo; errore chiaro se manca o non è del tipo atteso (index.html li ha tutti)
export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`Elemento #${id} mancante o di tipo diverso in index.html`);
  return node;
}

// Elementi della pagina (assegnati in avvio)
export let app: HTMLDivElement;
export let mainEl: HTMLElement;
export let phaseLabel: HTMLSpanElement;
export let undoBtn: HTMLButtonElement;
export let queueView: HTMLElement;
export let queueViewport: HTMLDivElement;
export let queueList: HTMLDivElement;
export let queueEmpty: HTMLDivElement;
export let resolveView: HTMLElement;
export let rail: HTMLDivElement;
export let focusEl: HTMLDivElement;
export let infoRow: HTMLDivElement;
export let turnInfo: HTMLSpanElement;
export let discardBtn: HTMLButtonElement;
export let menuBtn: HTMLButtonElement;
export let resolveHint: HTMLParagraphElement;
export let nemesisBtn: HTMLButtonElement;
export let resolveBtn: HTMLButtonElement;
export let backBtn: HTMLButtonElement;
export let startLayer: HTMLDivElement;
export let startBtn: HTMLButtonElement;
export let resumeBtn: HTMLButtonElement;
export let startError: HTMLDivElement;
export let startErrorText: HTMLParagraphElement;
export let retryBtn: HTMLButtonElement;
export let discardLayer: HTMLDivElement;
export let discardTitle: HTMLHeadingElement;
export let discardGrid: HTMLDivElement;
export let discardEmpty: HTMLDivElement;
export let discardClose: HTMLButtonElement;
export let dialogRoot: HTMLDivElement;
export let toastRoot: HTMLDivElement;
export let liveRegion: HTMLDivElement;

// Rapporto carta standard: 63 x 88 mm
export const CARD_RATIO = 88 / 63;

// Distanza minima (px) di uno slide per cambiare carta in VistaRisoluzione
export const SWIPE_MIN_DISTANCE = 50;

// Oltre questo spostamento (px) un tocco sulla coda è uno scorrimento, non un tocco sulla carta
export const DRAG_THRESHOLD = 8;

// Preferenza "riduci movimento" del sistema (assegnata in avvio)
export let reducedMotion: MediaQueryList;

// Durate (ms) delle animazioni dopo un'azione (come in design-tokens.css); con riduzione movimento al massimo 100ms.
// Durante queste animazioni il pulsante principale non accetta altri tocchi.
export const DURATION = { token: 220, discard: 240, focus: 220, phase: 280 };

export const DRAW_MS = 350;

export function duration(name: keyof typeof DURATION): number {
  return reducedMotion.matches ? Math.min(100, DURATION[name]) : DURATION[name];
}

// Dove si allinea la carta appena pescata nella coda: centro della carta a questa frazione della larghezza visibile
// (0.5 = al centro, come 'center')
export const ANCHOR_RATIO = 0.5;

// Partita salvata nel browser (localStorage) e numero massimo di passi di undo conservati.
// lorenzvittori.github.io è lo stesso dominio per tutti i siti: la chiave è diversa da quella di AeonsEnd_APP
// (aeonsend-save-v1) e del suo prototipo new_design_0.2 (aeonsend-clone-save-v2), così le partite non si sovrascrivono.
export const SAVE_KEY = 'aeonsend-app-0.2-save';

// Versione del formato del salvataggio: le carte hanno gli id del DataBase; i salvataggi con un'altra versione (o
// senza) si ignorano e si cancellano
export const SAVE_VERSION = 2;

export const UNDO_LIMIT = 300;

// Cartella da cui si leggono dati e scansioni delle carte ('' = questa)
export const DATA_ROOT = '';

// Miniature WebP della coda (264 x 369, il doppio di 132 px): stesso percorso dell'immagine con thumbs/ al posto di Data/
export const THUMB_DIR = 'thumbs/';

// Dorso delle carte nemesi: mazzo, carta da pescare, creazione del mazzo. Si sceglie nel Menu ("Dorso delle carte"); la
// scelta resta salvata nel browser e non fa parte della partita. Predefinito: il logo Aeon's End.
// Ogni dorso è 630 x 880 WebP con una miniatura 150 x 210 per la scelta (Assets/ui/backs/).
export const CARD_BACK_KEY = 'aeonsend-app-0.2-card-back';

// Un dorso delle carte
export interface Dorso {
  id: string;                    // nome salvato nel browser
  src: string;                   // immagine
  thumb: string;                 // miniatura per la scelta
}

export let CARD_BACKS: Dorso[]; // assegnata in avvio()

export function currentCardBack(): Dorso {
  let id: string | null = null;
  try { id = localStorage.getItem(CARD_BACK_KEY); } catch (err) { /* si usa quello predefinito */ }
  return CARD_BACKS.find(b => b.id === id) || CARD_BACKS[0];
}

export let CARD_BACK: string; // assegnata in avvio()

export function setCardBack(id: string): void {
  try { localStorage.setItem(CARD_BACK_KEY, id); } catch (err) { console.warn(err); }
  CARD_BACK = currentCardBack().src;
  document.documentElement.style.setProperty('--ae-card-back', cssUrl(CARD_BACK));
  loadImage(CARD_BACK);
}

// Vita di Gravehold (parte da 30) e della nemesi (campo "life" di nemesis.json); entrano nel salvataggio e nell'undo
export { GRAVEHOLD_LIFE };

// Vita iniziale della nemesi della partita (regole/vite.ts)
export function nemesisStartLife(): number {
  return Vite.nemesisStartLife(G.nemeses, G.settings.nemesis);
}

// Statistiche di una partita nuova e carta aggiunta a un gruppo (regole/turno-nemesi.ts)
export function emptyStats(deckSize: number): Statistiche {
  return Nemesi.emptyStats(deckSize);
}

export function statCard(group: GruppoStatistiche, data: Carta): void {
  Nemesi.statCard(G.stats, group, data);
}

// Carta pescata da girare nel turno nemesi
export interface CartaDaGirare {
  uid: number;                   // carta in gioco
  status: 'loading' | 'ready' | 'error' | 'flipping' | 'done'; // immagine in caricamento, pronta, non caricata; carta
                                 // che si gira, girata
}

// Carta su cui allineare la coda al prossimo disegno
export interface AncoraCoda {
  uid: number;                   // carta in gioco
  align: 'center' | 'anchor' | 'nearest'; // al centro, alla frazione ANCHOR_RATIO, il minimo spostamento
}

// Stato solo dell'interfaccia (non entra nel salvataggio né nell'undo)
export interface StatoUi {
  viewedUid: number | null;      // carta mostrata grande in VistaRisoluzione (DRAW_UID = passo Pesca)
  holdUid: number | null;        // carta appena risolta ancora in primo piano mentre la sua animazione finisce
  isTransitioning: boolean;      // dopo un'azione, fino alla fine dell'animazione: niente secondo tocco
  transitionTimer: ReturnType<typeof setTimeout> | null; // timer della fine dell'animazione
  reveal: CartaDaGirare | null;  // carta pescata da girare
  queueAnchor: AncoraCoda | null;// carta su cui allineare la coda al prossimo disegno
  lastDrawnUid: number | null;   // ultima carta pescata
  drafts: Map<number, BozzaCarta>; // turno giocatori: modifiche non ancora salvate per carta
  flyingDiscards: number;        // carte in volo verso la pila degli scarti (non ancora contate)
  tierWaitUntil: number;         // fino a quando il banner Tier copre l'app (token e vita compaiono dopo)
  tierBanner: number | null;     // Tier da annunciare al prossimo render ("Tier 2" / "Tier 3")
  fromScroll: boolean;           // render causato dallo scorrimento del carosello col dito (non va ricentrato)
  bgSlideUntil: number;          // fine dello scorrimento dello sfondo verso il lato della nemesi
  autoTokenKey: string | null;   // potere da risolvere su cui è partita l'animazione del token ...
  autoTokenAt: number;           // ... e quando è partita (la fascia e la carta grande restano allineate)
  deckBuilding: boolean;         // schermata "Crea mazzo" prima del primo turno giocatori
  deckShown: number | null;      // durante "Crea mazzo": carte già arrivate nel mazzo in alto (null = mazzo vero)
  gameSaved: boolean;            // la partita in corso è già stata scritta nel browser (save)
  deckDark: boolean;             // sfondo nero da "Crea mazzo" fino alla fine del banner "Partita iniziata"
  trackPreview?: boolean;        // barra dei turni in anteprima nella finestra del mazzo dei turni
  trackShuffle?: boolean;        // barra dei turni durante la mescolata di un giro nuovo
  pairMinimized?: string | null; // scelta 1/2 o 3/4 ridotta a icona (firma della scelta)
}

export const ui: StatoUi = {
  viewedUid: null,
  holdUid: null,
  isTransitioning: false,
  transitionTimer: null,
  reveal: null,
  queueAnchor: null,
  lastDrawnUid: null,
  drafts: new Map(),
  flyingDiscards: 0,
  tierWaitUntil: 0,
  tierBanner: null,
  fromScroll: false,
  bgSlideUntil: 0,
  autoTokenKey: null,
  autoTokenAt: 0,
  deckBuilding: false,
  deckShown: null,
  gameSaved: false,
  deckDark: false
};

// Valore url() con l'indirizzo assoluto, per le variabili CSS impostate da JS (--ae-card-back, --ae-battle-bg,
// --ae-nemesis-art, --ae-players-icon, --ae-life-bg): Chrome risolve un url() relativo dentro una variabile rispetto
// al file CSS che la usa, e con Vite il CSS sta in app/; assoluto, punta sempre alla stessa immagine
export function cssUrl(path: string): string {
  return `url("${new URL(path, document.baseURI).href}")`;
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  app = byId('app', HTMLDivElement);

  // Testata trasparente (sopra lo sfondo della vista): Undo, nome della nemesi, Menu. Uguale nei due turni.
  app.classList.add('clear-header');

  mainEl = byId('main', HTMLElement);
  phaseLabel = byId('phase-label', HTMLSpanElement);
  undoBtn = byId('undo-btn', HTMLButtonElement);
  queueView = byId('queue-view', HTMLElement);
  queueViewport = byId('queue', HTMLDivElement);
  queueList = byId('queue-list', HTMLDivElement);
  queueEmpty = byId('queue-empty', HTMLDivElement);
  resolveView = byId('resolve-view', HTMLElement);
  rail = byId('rail', HTMLDivElement);
  focusEl = byId('focus', HTMLDivElement);
  infoRow = byId('info-row', HTMLDivElement);
  turnInfo = byId('turn-info', HTMLSpanElement);
  discardBtn = byId('discard-btn', HTMLButtonElement);
  menuBtn = byId('menu-btn', HTMLButtonElement);
  resolveHint = byId('resolve-hint', HTMLParagraphElement);
  nemesisBtn = byId('nemesis-btn', HTMLButtonElement);
  G.cancelDraftsBtn = null;
  resolveBtn = byId('resolve-btn', HTMLButtonElement);
  backBtn = byId('back-btn', HTMLButtonElement);
  startLayer = byId('start', HTMLDivElement);
  startBtn = byId('start-btn', HTMLButtonElement);
  resumeBtn = byId('resume-btn', HTMLButtonElement);
  startError = byId('start-error', HTMLDivElement);
  startErrorText = byId('start-error-text', HTMLParagraphElement);
  retryBtn = byId('retry-btn', HTMLButtonElement);
  discardLayer = byId('discard', HTMLDivElement);
  discardTitle = byId('discard-title', HTMLHeadingElement);
  discardGrid = byId('discard-grid', HTMLDivElement);
  discardEmpty = byId('discard-empty', HTMLDivElement);
  discardClose = byId('discard-close', HTMLButtonElement);
  dialogRoot = byId('dialog-root', HTMLDivElement);
  toastRoot = byId('toast-root', HTMLDivElement);
  liveRegion = byId('live', HTMLDivElement);

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Partita di test in corso (Modalità test): con un test in corso save() non scrive niente, la partita salvata vera
  // non cambia
  G.testRun = null;

  CARD_BACKS = [
    { id: 'logo', src: 'Assets/ui/decor/card-back-logo.webp', thumb: 'Assets/ui/backs/logo-thumb.webp' },
    ...['owlRed:owl-red', 'owlGold:owl-gold', 'lily:lily', 'plaid:plaid', 'crystals:crystals', 'veins:veins', 'mask:mask',
      'demon:demon', 'tentacles:tentacles', 'ruins:ruins', 'runeCircle:rune-circle', 'runesRed:runes-red',
      'blueFlame:blue-flame', 'glassCrystal:glass-crystal', 'popCrystal:pop-crystal', 'violetPortal:violet-portal',
      'blueCrystals:blue-crystals', 'fireVortex:fire-vortex', 'crackedStone:cracked-stone', 'gothicGlass:gothic-glass',
      'watercolor:watercolor', 'popArt:pop-art', 'minimal:minimal', 'impressionist:impressionist', 'geometric:geometric',
      'ink:ink', 'organic:organic', 'arcane:arcane']
      .map(s => { const [id, file] = s.split(':'); return { id, src: `Assets/ui/backs/${file}.webp`, thumb: `Assets/ui/backs/${file}-thumb.webp` }; })
  ];

  CARD_BACK = currentCardBack().src;

  // Il dorso dietro la carta che si gira (style.css .ae-flip-face--front) segue la stessa scelta
  document.documentElement.style.setProperty('--ae-card-back', cssUrl(CARD_BACK));

  // Tutte le carte (cards.json) e la tabella Nemesis Deck Setup (deck-setup.json), lette all'avvio
  G.allCards = [];
  G.cardsById = new Map();
  G.deckSetup = null;

  // Nemesi con prodotto (boxCode) e battaglia (nemesis.json)
  G.nemeses = [];

  // Prodotti (products.json): { "4": "The New Age", "4.1": "Shattered Dreams", ... }; la wave è la parte prima del punto
  G.products = {};

  // Scelte della pagina iniziale: giocatori e nemesi (da cui dipende la battaglia)
  G.settings = { players: 2, nemesis: null, includeUpgraded: true };

  // Immagini delle nemesi per il menu (Assets/nemesis/nemesis-art.json, fatto da tools/import-db.py):
  // { "Arachnos": { card, portrait, ratio } }. Facoltativo: se manca, i pulsanti restano senza illustrazione.
  G.nemesisArt = {};

  G.startOptions = null;

  // Coda in gioco: dalla carta più vecchia alla più recente. Ogni carta in gioco ha un uid stabile
  // (anche se la stessa carta compare due volte o cambia posizione) e il suo stato: token, vita, appena pescata.
  G.queue = [];
  G.nextUid = 1;

  // Stato della VistaRisoluzione (false = VistaCoda)
  G.resolving = false;

  // Posizione della carta da risolvere (cambia solo con il pulsante principale)
  G.currentIndex = 0;

  // Posizione della carta appena pescata alla fine della risoluzione (-1 = nessuna)
  G.newIndex = -1;

  // Mazzo nemesi (si pesca dalla fine), pila degli scarti e numero di turni nemesi giocati
  G.deck = [];
  G.discard = [];
  G.turn = 0;

  // Mazzo dei turni, vuoto finché non comincia una partita (regole/mazzo-turni.ts)
  G.turnOrder = newTurnOrder();

  // Tier più alto pescato finora: alla prima carta del Tier 2 e del Tier 3 compare la scritta "Tier N"
  G.maxTierDrawn = 0;

  G.graveLife = GRAVEHOLD_LIFE;
  G.nemesisLife = 0;

  // Statistiche della partita (finestra Statistiche della Vittoria): entrano nel salvataggio e nell'undo
  G.stats = emptyStats(0);

  // Undo: uno stato della partita salvato prima di ogni azione
  G.undoStack = [];
}
