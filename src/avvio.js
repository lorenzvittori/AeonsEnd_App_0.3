// avvio.js: Telefono in orizzontale, tasto Indietro e avvio (init).
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from './stato/condivise.ts';
import { I18N_IT } from './ui/testi.js';
import { CARD_BACK, DATA_ROOT, THUMB_DIR, discardLayer, startBtn, startError, startLayer } from './stato/stato.ts';
import { loadJson } from './dati/dati.ts';
import { newGame } from './stato/partita.ts';
import { el } from './ui/componenti/componenti.js';
import { loadImage, modals, showToast, updateInert } from './ui/componenti/dialoghi.js';
import { closeDiscard } from './ui/componenti/scarti.js';
import { buildStartPage, setStartMode, startMode } from './ui/schermate/menu.js';
import { showStartError, showStartSkeleton } from './ui/schermate/opzioni.js';
import { preloadBannerFont, render } from './ui/schermate/turno-nemesi.js';
import { closeDeckPopover, closeUndoFloat, deckPopover, undoFloat } from './ui/componenti/pesca-undo.js';

// Tasto / gesto Indietro (Android, swipe di iOS): chiude il livello in primo piano invece di uscire dall'app.
// Nella cronologia c'è sempre una voce in più (stesso indirizzo): Indietro la consuma e qui la si rimette.
// Se non c'è niente da chiudere, il primo Indietro mostra "Premi di nuovo Indietro per uscire" e il secondo esce.
export function closeTopForBack() {
  if (modals.length) { modals[modals.length - 1].onCancel(); return true; }
  if (undoFloat) { closeUndoFloat(); return true; }
  if (deckPopover) { closeDeckPopover(); return true; }
  // La mia collezione sopra le Opzioni: si chiude prima quella in cima
  const screens = document.querySelectorAll('.collection-screen');
  if (screens.length) { screens[screens.length - 1].querySelector('.collection-head .ae-icon-button').click(); return true; }
  if (!discardLayer.hidden) { closeDiscard(); return true; }
  // Pagina "Nuova partita": Indietro torna al menu iniziale
  if (!startLayer.hidden && startMode === 'setup') { setStartMode('home', true); return true; }
  return false;
}

export function armBackGuard() { history.pushState({ aeBackGuard: true }, ''); }

// Avvio: legge cards.json, deck-setup.json e nemesis.json, mostra la pagina iniziale (con "Riprendi partita" se ce n'è una salvata)
export let initRunning = false;

export async function init() {
  if (initRunning) return;
  initRunning = true;
  startError.hidden = true;
  startBtn.disabled = true;
  showStartSkeleton();
  updateInert();
  try {
    const [cards, setup, nemesisList, productList, art] = await Promise.all([
      loadJson(DATA_ROOT + 'cards.json'), loadJson(DATA_ROOT + 'deck-setup.json'), loadJson(DATA_ROOT + 'nemesis.json'),
      loadJson(DATA_ROOT + 'products.json'), loadJson('Assets/nemesis/nemesis-art.json').catch(() => ({}))
    ]);
    G.nemesisArt = art || {};
    G.products = productList || {};
    if (cards.length === 0) throw new Error('Nessuna carta trovata in cards.json');
    // Le scansioni delle carte stanno nella cartella Data/, le miniature in thumbs/ con lo stesso percorso
    cards.forEach(c => {
      c.thumb = DATA_ROOT + String(c.image).replace(/^Data\//, THUMB_DIR);
      c.image = DATA_ROOT + c.image;
    });
    G.allCards = cards;
    G.deckSetup = setup;
    G.nemeses = nemesisList;
    G.cardsById = new Map(G.allCards.map(c => [c.id, c]));
    buildStartPage();
    newGame();
    // Il retro si scarica subito, così alla prima pesca è già pronto
    loadImage(CARD_BACK);
    preloadBannerFont();
    render();
    setStartMode('home', true);
  } catch (err) {
    console.error(err);
    // Senza replaceChildren: se l'errore viene da un browser vecchio, qui non deve fallire di nuovo
    document.getElementById('nemesis-list').innerHTML = '';
    // Sotto il messaggio, il motivo tecnico (utile per capire il problema su un dispositivo che non si può ispezionare)
    showStartError(I18N_IT.loadError + '\n(' + (err && err.message ? err.message : String(err)) + ')', true);
  } finally {
    initRunning = false;
  }
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
  // Telefono in orizzontale: lo spazio in altezza non basta per le carte; si chiede di girarlo (CSS: .ae-rotate)
  document.body.appendChild(el('div', 'ae-rotate', I18N_IT.rotatePhone));

  window.addEventListener('popstate', () => {
    if (closeTopForBack()) armBackGuard();
    else {
      showToast(I18N_IT.backAgainToExit);
      // Passato il messaggio, Indietro torna a chiudere i livelli (e il prossimo "uscire" chiede di nuovo conferma)
      setTimeout(() => { if (!(history.state && history.state.aeBackGuard)) armBackGuard(); }, 2500);
    }
  });

  if (!(history.state && history.state.aeBackGuard)) armBackGuard();

  init();
}
