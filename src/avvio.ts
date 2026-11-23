// avvio.ts: telefono in orizzontale, tasto Indietro e avvio dell'app (init: lettura e controllo dei dati, pagina
// iniziale).
// I dati letti vanno nel catalogo (stato/catalogo.ts); poi la prima partita da zero (nuovaPartita, come sempre: il mazzo
// della nemesi scelta è pronto per la pagina iniziale).
// Dipende da: stato/ (catalogo, partita), dati/ (dati, controllo), ui/ (pagina, componenti, dialoghi, scarti, menu,
// opzioni, turno-nemesi, pesca-undo). Usato da: main.ts (avvio, ultimo modulo), ui/schermate/opzioni (Riprova).

import { I18N_IT } from './ui/testi.ts';
import { loadJson } from './dati/dati.ts';
import { checkCards, checkDeckSetup, checkNemesisArt, checkNemeses, checkProducts, reportProblems } from './dati/controllo.ts';
import { nuovaPartita } from './stato/partita.ts';
import { el } from './ui/componenti/componenti.ts';
import { loadImage, modals, showToast, updateInert } from './ui/componenti/dialoghi.ts';
import { closeDiscard } from './ui/componenti/scarti.ts';
import { buildStartPage, setStartMode, startMode } from './ui/schermate/menu.ts';
import { showStartError, showStartSkeleton } from './ui/schermate/opzioni.ts';
import { preloadBannerFont, render } from './ui/schermate/turno-nemesi.ts';
import { closeDeckPopover, closeUndoFloat, deckPopover, undoFloat } from './ui/componenti/pesca-undo.ts';
import { caricaCatalogo } from './stato/catalogo.ts';
import { CARD_BACK, DATA_ROOT, THUMB_DIR, discardLayer, startBtn, startError, startLayer } from './ui/pagina.ts';

// Tasto / gesto Indietro (Android, swipe di iOS): chiude il livello in primo piano invece di uscire dall'app.
// Nella cronologia c'è sempre una voce in più (stesso indirizzo): Indietro la consuma e qui la si rimette.
// Se non c'è niente da chiudere, il primo Indietro mostra "Premi di nuovo Indietro per uscire" e il secondo esce.
export function closeTopForBack(): boolean {
  if (modals.length) { modals[modals.length - 1].onCancel(); return true; }
  if (undoFloat) { closeUndoFloat(); return true; }
  if (deckPopover) { closeDeckPopover(); return true; }
  // La mia collezione sopra le Opzioni: si chiude prima quella in cima
  const screens = document.querySelectorAll('.collection-screen');
  if (screens.length) {
    const close = screens[screens.length - 1].querySelector('.collection-head .ae-icon-button');
    if (close instanceof HTMLElement) close.click();
    else throw new TypeError('pulsante di chiusura della collezione mancante');
    return true;
  }
  if (!discardLayer.hidden) { closeDiscard(); return true; }
  // Pagina "Nuova partita": Indietro torna al menu iniziale
  if (!startLayer.hidden && startMode === 'setup') { setStartMode('home', true); return true; }
  return false;
}

export function armBackGuard(): void { history.pushState({ aeBackGuard: true }, ''); }

// La voce in più della cronologia è già al suo posto
function backGuardArmed(): boolean {
  const state: unknown = history.state;
  return typeof state === 'object' && state !== null && 'aeBackGuard' in state && !!state.aeBackGuard;
}

// Avvio: legge cards.json, deck-setup.json, nemesis.json e products.json (e le immagini delle nemesi, facoltative), li
// controlla (dati/controllo.ts: carte e nemesi sbagliate si scartano con un errore in console) e mostra la pagina
// iniziale (con "Riprendi partita" se ce n'è una salvata)
export let initRunning = false;

export async function init(): Promise<void> {
  if (initRunning) return;
  initRunning = true;
  startError.hidden = true;
  startBtn.disabled = true;
  showStartSkeleton();
  updateInert();
  try {
    const [cardsData, setupData, nemesisData, productData, artData] = await Promise.all([
      loadJson(DATA_ROOT + 'cards.json'), loadJson(DATA_ROOT + 'deck-setup.json'), loadJson(DATA_ROOT + 'nemesis.json'),
      loadJson(DATA_ROOT + 'products.json'), loadJson('Assets/nemesis/nemesis-art.json').catch(() => ({}))
    ]);
    const art = checkNemesisArt(artData || {});
    const products = checkProducts(productData || {});
    const cards = checkCards(cardsData);
    const nemeses = checkNemeses(nemesisData);
    const setup = checkDeckSetup(setupData);
    reportProblems([...cards.problems, ...nemeses.problems, ...products.problems, ...art.problems]);
    if (cards.value.length === 0) throw new Error('Nessuna carta trovata in cards.json');
    // Le scansioni delle carte stanno nella cartella Data/, le miniature in thumbs/ con lo stesso percorso
    cards.value.forEach(c => {
      c.thumb = DATA_ROOT + String(c.image).replace(/^Data\//, THUMB_DIR);
      c.image = DATA_ROOT + c.image;
    });
    caricaCatalogo({ cards: cards.value, deckSetup: setup, nemeses: nemeses.value, products: products.value, nemesisArt: art.value });
    buildStartPage();
    nuovaPartita();
    // Il retro si scarica subito, così alla prima pesca è già pronto
    loadImage(CARD_BACK);
    preloadBannerFont();
    render();
    setStartMode('home', true);
  } catch (err) {
    console.error(err);
    // Senza replaceChildren: se l'errore viene da un browser vecchio, qui non deve fallire di nuovo
    const list = document.getElementById('nemesis-list');
    if (list) list.innerHTML = '';
    // Sotto il messaggio, il motivo tecnico (utile per capire il problema su un dispositivo che non si può ispezionare)
    showStartError(I18N_IT.loadError + '\n(' + (err instanceof Error && err.message ? err.message : String(err)) + ')', true);
  } finally {
    initRunning = false;
  }
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  // Telefono in orizzontale: lo spazio in altezza non basta per le carte; si chiede di girarlo (CSS: .ae-rotate)
  document.body.appendChild(el('div', 'ae-rotate', I18N_IT.rotatePhone));

  window.addEventListener('popstate', () => {
    if (closeTopForBack()) armBackGuard();
    else {
      showToast(I18N_IT.backAgainToExit);
      // Passato il messaggio, Indietro torna a chiudere i livelli (e il prossimo "uscire" chiede di nuovo conferma)
      setTimeout(() => { if (!backGuardArmed()) armBackGuard(); }, 2500);
    }
  });

  if (!backGuardArmed()) armBackGuard();

  init();
}
