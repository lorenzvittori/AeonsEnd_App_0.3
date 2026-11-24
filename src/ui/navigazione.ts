// ui/navigazione.ts: il coordinatore dell'interfaccia. Sa dove si è (schermataAttuale), è l'unico modulo che mostra e
// nasconde i blocchi fissi della pagina (#start, #queue-view, #resolve-view) e decide quale schermata disegnare
// (render: la testata, i pezzi comuni, poi il disegno della schermata attuale). Qui anche: pagina iniziale (menu
// iniziale ↔ Nuova partita, apertura e chiusura), inizio e ripresa della partita, passaggi tra le schermate, tasto
// Indietro ed Esc, Vittoria a mazzo vuoto, i pulsanti fissi della pagina e la registrazione degli agganci
// (ui/ridisegno.ts) con cui i livelli sotto chiedono queste cose.
// Lo stato della navigazione (la pagina iniziale aperta e in quale modo) e la decisione del tasto Indietro sono in
// navigazione-stato.ts (supporto, senza DOM).
// Livello 6. Dipende da: stato/, dati/, ui/ base (pagina, testi, dom, ridisegno), ui/componenti/, ui/finestre/,
// ui/schermate/. Usato da: avvio.ts (init: render, setStartMode), main.ts (avvio, window.app), test.

import { I18N_IT } from './testi.ts';
import { battleOf } from '../dati/dati.ts';
import { collectionWaveEnabled, saveCollection, waveOfNemesis } from '../dati/collezione.ts';
import { prefetchDeckImages } from '../dati/rete.ts';
import { impostaUndo, isVictory, nuovaPartita, partita } from '../stato/partita.ts';
import { readSave, statoSalvataggio } from '../stato/salvataggio.ts';
import { catalogo } from '../stato/catalogo.ts';
import { loadDeckOptions, preferenze } from '../stato/preferenze.ts';
import type { SalvataggioValido } from '../tipi/salvataggio.ts';
import { app, backBtn, CARD_BACK, discardLayer, focusEl, nemesisBtn, queueView, queueViewport, rail, reducedMotion,
  resolveBtn, resolveHint, resolveView, resumeBtn, startBtn, startError, startLayer, ui, undoBtn } from './pagina.ts';
import { el } from './dom.ts';
import { registraAgganci } from './ridisegno.ts';
import { clearTransition, MORPH_MS } from './componenti/animazioni.ts';
import { showBanner, TIER_BANNER_MS } from './componenti/banner.ts';
import { creaBarraTurni, renderTurnTrack } from './componenti/barra-turni.ts';
import { closeAllModals, focusables, loadImage, modals, showToast, topLayer,
  updateInert } from './componenti/dialoghi.ts';
import { closeDeckPopover, closeUndoFloat, deckPopover, undoFloat } from './componenti/pesca-undo.ts';
import { restore, undo, updateUndoBtn } from './componenti/ripristino.ts';
import { closeDiscard } from './componenti/scarti.ts';
import { currentBackground } from './componenti/sfondi.ts';
import { disegnaTestata, fitPhaseName, renderDockPiles } from './componenti/testata.ts';
import { renderLives } from './componenti/vite.ts';
import { openTurnScreen } from './finestre/mazzo-turni.ts';
import { openSideMenu } from './finestre/menu-laterale.ts';
import { openMissingNemesis } from './finestre/opzioni.ts';
import { showDefeat, showVictory } from './finestre/statistiche.ts';
import { endTest, restartScenario } from './finestre/test.ts';
import { openLifeDialog } from './finestre/vita.ts';
import { closeDeckBuild, openGameSetup, rebuildDeck, showDeckBuild, specificCardsOf } from './schermate/crea-mazzo.ts';
import { disegnaMenu, showStartError, updateHomeCollection } from './schermate/menu.ts';
import { disegnaNuovaPartita, renderStartChoices } from './schermate/nuova-partita.ts';
import { centredQueueUid, disegnaAnnullaModifiche, disegnaPulsantePrincipale, disegnaTurnoGiocatori, ensureQueueRail,
  impostaAnnullaModifiche, onNemesisClick, queueRail, sizeQueue, toPlayersTurn } from './schermate/turno-giocatori.ts';
import { backToActive, disegnaTurnoNemesi, enterNemesisTurnView, onResolveClick } from './schermate/turno-nemesi.ts';
import { fasciaTurnoNemesi, sizeFocus } from './schermate/turno-nemesi-carosello.ts';
import { createDeckSlider, disegnaCursore } from './schermate/crea-mazzo-cursore.ts';
import { cosaChiudeIndietro, impostaInizio, paginaIniziale } from './navigazione-stato.ts';

// --- Dove si è ---

// Lo stato della navigazione e la schermata attuale sono in navigazione-stato.ts (senza DOM, provati nei test)
export { schermataAttuale } from './navigazione-stato.ts';
export type { Schermata } from './navigazione-stato.ts';

// --- Blocchi fissi ---

// Pagina iniziale mostrata o nascosta (l'unico punto che tocca #start.hidden)
function mostraInizio(aperta: boolean): void {
  startLayer.hidden = !aperta;
  updateInert();
}

// Turno giocatori (#queue-view) o turno nemesi (#resolve-view), con le classi dell'app che dipendono dal turno
function mostraTurno(): void {
  queueView.hidden = partita.resolving;
  // la classe si toglie solo a vista nascosta (toglierla a vista visibile farebbe ripartire la dissolvenza)
  if (partita.resolving) queueView.classList.remove('is-from-nemesis');
  resolveView.hidden = !partita.resolving;
  app.classList.toggle('is-nemesis-turn', partita.resolving);
  if (!partita.resolving) app.classList.remove('is-draw-phase');
}

// --- Disegno ---

// Disegna tutto in base allo stato: la testata, i blocchi fissi, i comandi in basso, i pezzi comuni ai due turni (pile,
// barra dei turni, Undo, banner Tier, vite), poi la schermata attuale della partita. L'ordine conta: il nome della
// nemesi si misura dopo le classi dell'app, la scelta 1/2 e 3/4 (barra dei turni) dopo il pulsante principale.
export function render(): void {
  disegnaTestata(openGameSetup);
  mostraTurno();
  disegnaPulsantePrincipale();
  disegnaCursore();
  fitPhaseName();
  disegnaAnnullaModifiche();
  renderDockPiles();
  renderTurnTrack();
  updateUndoBtn();
  if (ui.tierBanner) {
    ui.tierWaitUntil = performance.now() + TIER_BANNER_MS;
    showBanner(I18N_IT.tierN(ui.tierBanner));
    ui.tierBanner = null;
  }
  // La riga delle vite sta sotto la fascia del turno attivo
  renderLives(partita.resolving ? fasciaTurnoNemesi() : ensureQueueRail());
  if (partita.resolving) disegnaTurnoNemesi();
  else {
    // I comandi del turno nemesi non ci sono nel turno giocatori
    resolveBtn.hidden = true;
    backBtn.hidden = true;
    resolveHint.hidden = true;
    disegnaTurnoGiocatori();
  }
  checkVictory();
}

// Finestra "Vittoria" quando la condizione si avvera nel turno giocatori. Chiusa una volta, non si ripropone finché lo
// stato non cambia (per esempio con Undo si torna indietro e la condizione non vale più): ui.victoryKey è la partita
// (turno, scarti, coda) per cui è già stata mostrata. Stato dell'interfaccia, non della partita
export function checkVictory(): void {
  if (partita.resolving || !isVictory()) { ui.victoryKey = ''; return; }
  const key = partita.turn + ':' + partita.discard.length + ':' + partita.queue.length;
  if (ui.victoryKey === key || modals.length || !startLayer.hidden) return;
  ui.victoryKey = key;
  setTimeout(() => {
    if (partita.resolving || !isVictory() || modals.length) return;
    showVictory();
  }, reducedMotion.matches ? 0 : MORPH_MS + 100);
}

// --- Pagina iniziale ---

// Menu iniziale ('home') o Nuova partita ('setup') nella pagina iniziale:
//   'home':  menu iniziale. Se c'è una partita salvata, la finestra "Partita in corso" (nemesi, giocatori, Riprendi
//            partita); sotto, sempre, "Nuova partita" e "Opzioni" (La mia collezione).
//   'setup': scelte della nuova partita (giocatori, wave, nemesi) e "Inizia partita"; in alto la X (menu iniziale).
// focus: il fuoco va al pulsante principale della schermata
export function setStartMode(mode: string, focus?: boolean): void {
  const saved = readSave();
  impostaInizio(mode === 'setup' ? 'nuova-partita' : 'menu');
  const isHome = paginaIniziale() === 'menu';
  // Pagina Nuova partita: le opzioni del mazzo ripartono dalla preferenza del browser
  if (!isHome) Object.assign(preferenze.settings, loadDeckOptions());
  const homeTarget = disegnaMenu(saved, isHome);
  startLayer.classList.toggle('is-setup', !isHome);
  startLayer.scrollTop = 0;
  const setupTarget = disegnaNuovaPartita(isHome);
  if (focus) {
    const target = isHome ? homeTarget : setupTarget;
    if (target) target.focus({ preventScroll: true });
  }
}

// Pagina iniziale aperta sul menu iniziale (Esci dalla partita, Menu iniziale della Vittoria)
export function openStart(): void {
  // Uscendo da un test (Esci dal test o Menu iniziale della Vittoria) tornano le scelte di prima
  endTest();
  closeAllModals();
  closeDiscard();
  renderStartChoices();
  impostaInizio('menu');
  mostraInizio(true);
  setStartMode('home', true);
}

// Pagina iniziale chiusa: si è nella partita
export function closeStart(): void {
  impostaInizio(null);
  mostraInizio(false);
}

// La collezione è cambiata: scelte della Nuova partita e menu iniziale di nuovo
function aggiornaInizio(): void {
  renderStartChoices();
  updateHomeCollection();
}

// --- Partita: inizio, ripresa, passaggi tra le schermate ---

// Dalla pagina iniziale alla partita: la pagina iniziale esce a sinistra e la partita entra da destra
export const START_SLIDE_MS = 380;

export function slideToGame(then?: () => void): void {
  if (reducedMotion.matches) {
    closeStart();
    if (then) then();
    return;
  }
  // Perché non vada a scatti: prima si aspettano le immagini della creazione del mazzo (dorsi, Specifiche) e lo sfondo
  // (al massimo 400 ms), le due pagine diventano livelli separati (will-change), e l'animazione parte un attimo dopo,
  // a disegno finito; altrimenti i primi fotogrammi vanno persi e la pagina "salta".
  // (String: una carta senza miniatura dà "undefined", come l'indirizzo dell'immagine assegnato direttamente)
  const images = [CARD_BACK, currentBackground().src,
    ...[1, 2, 3].flatMap(t => specificCardsOf(t).map(c => String(c.thumb)))];
  const ready = Promise.race([Promise.all(images.map(src => loadImage(src))), new Promise(r => setTimeout(r, 400))]);
  startLayer.style.willChange = 'transform';
  app.style.willChange = 'transform';
  ready.then(() => setTimeout(() => {
    void app.offsetWidth;
    startLayer.classList.add('is-sliding-out');
    app.classList.add('is-sliding-in');
    setTimeout(() => {
      startLayer.classList.remove('is-sliding-out');
      app.classList.remove('is-sliding-in');
      startLayer.style.willChange = '';
      app.style.willChange = '';
      closeStart();
      if (then) then();
    }, START_SLIDE_MS);
  }, 30));
}

// Inizia partita: la scelta "Nuova partita" nella finestra sotto il titolo vale già come conferma di sostituire
// la partita salvata, quindi qui non si chiede altro
export function onStartClick(): void {
  startGame();
}

// Inizia: nuova partita con le scelte fatte (la partita salvata viene sostituita)
export function startGame(): void {
  if (!battleOf(preferenze.settings.nemesis)) return;
  clearTransition();
  closeAllModals();
  ui.viewedUid = null;
  ui.reveal = null;
  ui.lastDrawnUid = null;
  ui.drafts.clear();
  ui.flyingDiscards = 0;
  statoSalvataggio.gameSaved = false;
  // Partita da zero (coda vuota, niente undo) con il mazzo nuovo
  nuovaPartita();
  // Prima del turno giocatori: i 9 mazzi da cui nasce il mazzo nemesi e il pulsante "Crea mazzo"
  ui.deckBuilding = true;
  ui.deckShown = 0;
  ui.deckDark = true;
  showDeckBuild();
  render();
  slideToGame(() => nemesisBtn.focus());
  prefetchDeckImages();
}

// Riprendi partita: si ricarica lo stato salvato nel browser, compreso l'undo. Se la nemesi della partita non è più
// nella collezione, una finestra lo dice; "Continua" rimette nella collezione il suo prodotto (e la scatola base della
// sua wave) e riprende la partita. Nemesi di una wave non ancora disponibile nella collezione: si riprende e basta
export function resumeGame(): void {
  const saved = readSave();
  if (!saved) return;
  const info = catalogo.nemeses.find(n => n.name === saved.settings.nemesis);
  const owned = preferenze.collection;
  const product = info ? info.boxCode : null;
  const wave = info ? waveOfNemesis(info) : null;
  if (info && product && wave && owned && collectionWaveEnabled(wave) && !owned.has(product)) {
    openMissingNemesis(info, () => {
      owned.add(wave);
      owned.add(product);
      saveCollection();
      aggiornaInizio();
      resumeSavedGame(saved);
    });
    return;
  }
  resumeSavedGame(saved);
}

export function resumeSavedGame(saved: SalvataggioValido): void {
  try {
    const previousSettings = preferenze.settings;
    preferenze.settings = saved.settings;
    try {
      restore(saved.state);
    } catch (err) {
      preferenze.settings = previousSettings;
      throw err;
    }
    impostaUndo(Array.isArray(saved.undo) ? saved.undo : []);
    statoSalvataggio.gameSaved = true;
    ui.deckDark = false;
    startError.hidden = true;
    closeStart();
    render();
    prefetchDeckImages();
    (partita.resolving ? resolveBtn : nemesisBtn).focus();
  } catch (err) {
    console.error(err);
    showStartError(I18N_IT.resumeError, false);
  }
}

// --- Indietro ed Esc ---

// Tasto / gesto Indietro (Android, swipe di iOS): chiude il livello in primo piano invece di uscire dall'app.
// Nella cronologia c'è sempre una voce in più (stesso indirizzo): Indietro la consuma e qui la si rimette.
// Se non c'è niente da chiudere, il primo Indietro mostra "Premi di nuovo Indietro per uscire" e il secondo esce.
// Restituisce true se ha chiuso qualcosa (finestre, scarti, pagina Nuova partita)
export function closeTopForBack(): boolean {
  const screens = document.querySelectorAll('.collection-screen');
  const what = cosaChiudeIndietro({ finestre: modals.length, annullaSospeso: !!undoFloat, pescaCarta: !!deckPopover,
    schermiCollezione: screens.length, scarti: !discardLayer.hidden });
  if (what === 'finestra') modals[modals.length - 1].onCancel();
  else if (what === 'annulla-sospeso') closeUndoFloat();
  else if (what === 'pesca-carta') closeDeckPopover();
  else if (what === 'collezione') {
    // La mia collezione sopra le Opzioni: si chiude prima quella in cima
    const close = screens[screens.length - 1].querySelector('.collection-head .ae-icon-button');
    if (close instanceof HTMLElement) close.click();
    else throw new TypeError('pulsante di chiusura della collezione mancante');
  } else if (what === 'scarti') closeDiscard();
  // Pagina "Nuova partita": Indietro torna al menu iniziale
  else if (what === 'menu') setStartMode('home', true);
  return what !== null;
}

export function armBackGuard(): void { history.pushState({ aeBackGuard: true }, ''); }

// La voce in più della cronologia è già al suo posto
function backGuardArmed(): boolean {
  const state: unknown = history.state;
  return typeof state === 'object' && state !== null && 'aeBackGuard' in state && !!state.aeBackGuard;
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  registraAgganci({
    ridisegna: render,
    menuIniziale: openStart,
    finePartita: esito => { if (esito === 'defeat') showDefeat(); else showVictory(); },
    chiudiCreaMazzo: closeDeckBuild,
    menuLaterale: openSideMenu,
    ricominciaMazzo: rebuildDeck,
    ricominciaScenario: restartScenario,
    partitaDaScenario: closeStart,
    turnoGiocatoriDaNemesi: toPlayersTurn,
    // le carte grandi del turno nemesi partono da quella al centro del turno giocatori (letta quando serve)
    turnoNemesi: () => enterNemesisTurnView(() => queueRail ? queueRail.scrollLeft : 0, centredQueueUid),
    vaiA: schermata => setStartMode(schermata === 'nuova-partita' ? 'setup' : 'home', true),
    riprendiPartita: resumeGame,
    aggiornaInizio,
    vita: openLifeDialog
  });

  // Toccando la barra dei turni si apre il mazzo dei turni (rivela, rimescola dagli scarti, ordina)
  creaBarraTurni(() => openTurnScreen());

  startBtn.addEventListener('click', onStartClick);
  resumeBtn.addEventListener('click', resumeGame);
  undoBtn.addEventListener('click', undo);
  nemesisBtn.addEventListener('click', onNemesisClick);

  // Riga del pulsante principale: "Annulla modifiche" (turno giocatori), il pulsante principale e, durante "Crea mazzo",
  // il cursore al suo posto
  {
    const cancelDrafts = impostaAnnullaModifiche();
    const row = el('div', 'ae-main-row');
    nemesisBtn.before(row);
    const slider = createDeckSlider();
    row.append(cancelDrafts, nemesisBtn, slider.box);
  }

  resolveBtn.addEventListener('click', onResolveClick);
  backBtn.addEventListener('click', backToActive);

  // Interruttore "Includi carte base potenziate" tolto: si toglie anche da un index.html vecchio in cache
  {
    const upgradedRow = document.getElementById('upgraded-switch');
    const switchRow = upgradedRow && upgradedRow.closest('.ae-switch-row');
    if (switchRow) switchRow.remove();
  }

  window.addEventListener('resize', () => { sizeFocus(); sizeQueue(); });

  // Desktop: la rotella del mouse (verticale) scorre le carte grandi e le fasce piccole, che vanno in orizzontale
  [focusEl, queueViewport, rail].forEach(c => c.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || c.scrollWidth <= c.clientWidth + 1) return;
    e.preventDefault();
    c.scrollBy({ left: e.deltaY, behavior: 'auto' });
  }, { passive: false }));

  // Se lo spazio della carta grande cambia per altri motivi (font caricato, pulsanti del dock), si ridimensiona subito
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => sizeFocus()).observe(focusEl);
    new ResizeObserver(() => sizeQueue()).observe(queueViewport);
  }

  // Esc chiude il livello in primo piano; Tab resta dentro dialoghi, scarti e pagina iniziale
  document.addEventListener('keydown', e => {
    const top = topLayer();
    if (e.key === 'Escape') {
      if (undoFloat && !modals.length) { closeUndoFloat(); return; }
      if (deckPopover && !modals.length) { closeDeckPopover(); return; }
      if (modals.length) modals[modals.length - 1].onCancel();
      else if (top === discardLayer) closeDiscard();
      return;
    }
    if (e.key === 'Tab' && top !== app) {
      const items = focusables(top);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !top.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Indietro: chiude il livello in primo piano (closeTopForBack) e rimette la voce in più della cronologia
  window.addEventListener('popstate', () => {
    if (closeTopForBack()) armBackGuard();
    else {
      showToast(I18N_IT.backAgainToExit);
      // Passato il messaggio, Indietro torna a chiudere i livelli (e il prossimo "uscire" chiede di nuovo conferma)
      setTimeout(() => { if (!backGuardArmed()) armBackGuard(); }, 2500);
    }
  });

  if (!backGuardArmed()) armBackGuard();
}
