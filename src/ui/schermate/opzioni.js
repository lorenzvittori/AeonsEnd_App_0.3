// ui/schermate/opzioni.js: Opzioni, La mia collezione, inizio e ripresa della partita. Provvisorio: inizio e ripresa andranno con il menu.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../../stato/condivise.js';
import { I18N_IT } from '../testi.js';
import { nemesisBtn, resolveBtn, retryBtn, startError, startErrorText, startLayer, ui } from '../../stato/stato.js';
import { battleOf } from '../../dati/dati.js';
import { collectionCatalog, collectionWaveEnabled, isMiniCode, productName, productOfNemesis, saveCollection, waveOfNemesis } from '../../dati/collezione.js';
import { newGame, setTurnPairs, turnPairsOn } from '../../regole/mazzo.js';
import { el, icon } from '../componenti/componenti.js';
import { button, closeAllModals, dialogShell, openModal, showToast, updateInert } from '../componenti/dialoghi.js';
import { closeDiscard } from '../componenti/scarti.js';
import { renderStartChoices, setStartMode, updateHomeCollection, waveLabel } from './menu.js';
import { clearTransition, readSave, restore } from '../../stato/salvataggio.js';
import { render } from './turno-nemesi.js';
import { showDeckBuild } from './crea-mazzo.js';
import { slideToGame } from '../componenti/pesca-undo.js';
import { backgroundChoiceButton, cardBackChoiceButton } from '../componenti/menu-laterale.js';
import { prefetchDeckImages } from '../../dati/rete.js';
import { endTest } from './test.js';

// Il pulsante "La mia collezione" non è più nella pagina "Nuova partita" (sta in Opzioni e nel Menu): si toglie anche
// da una versione vecchia
export function ensureCollectionButton() {
  const row = document.getElementById('collection-row');
  if (row) row.remove();
}

export function collectionSummaryText() {
  const waves = new Set([...G.collection].map(id => id.split('|')[0]));
  return I18N_IT.collectionSummary(waves.size, G.collection.size);
}

// Opzioni (dal menu iniziale): La mia collezione (con il riepilogo), Dorso delle carte e Sfondo
export function openOptions(trigger) {
  const layer = el('div', 'collection-screen options-screen');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', I18N_IT.options);
  const head = el('div', 'collection-head');
  const close = () => {
    layer.remove();
    startLayer.inert = false;
    updateInert();
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', I18N_IT.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', I18N_IT.options), x);
  const body = el('div', 'collection-body');
  const item = el('button', 'options-item');
  item.type = 'button';
  const summary = el('span', 'options-item-note', collectionSummaryText());
  item.append(el('span', 'options-item-label', I18N_IT.myCollection), summary);
  item.addEventListener('click', () => openCollection(item, () => { summary.textContent = collectionSummaryText(); }));
  // Dorso delle carte: miniatura e nome del dorso scelto; si tocca per la griglia di tutti i dorsi. Chiusa la griglia,
  // la pagina iniziale resta coperta dalle Opzioni
  // (la miniatura sta piccola a destra della scritta)
  const backItem = el('div', 'options-item options-item--row');
  backItem.append(el('span', 'options-item-label', I18N_IT.cardBack),
    cardBackChoiceButton(() => { if (layer.isConnected) startLayer.inert = true; }, { compact: true }));
  // Sfondo: anteprima e nome dello sfondo scelto; si tocca per le anteprime di tutti gli sfondi
  const bgItem = el('div', 'options-item options-item--row');
  bgItem.append(el('span', 'options-item-label', I18N_IT.background),
    backgroundChoiceButton(() => { if (layer.isConnected) startLayer.inert = true; }, { compact: true }));
  // Carte turno 1/2 e 3/4 (wave 4, v192; dalla v193 qui e non nel Menu della partita): interruttore, attivo di default
  const pairsItem = el('label', 'options-item options-item--row ae-switch-row options-switch');
  const pairsInput = document.createElement('input');
  pairsInput.type = 'checkbox';
  pairsInput.setAttribute('role', 'switch');
  pairsInput.checked = turnPairsOn();
  pairsInput.addEventListener('change', () => setTurnPairs(pairsInput.checked));
  const pairsSw = el('span', 'ae-switch');
  pairsSw.setAttribute('aria-hidden', 'true');
  const pairsText = el('span', 'options-switch-text');
  pairsText.append(el('span', 'options-item-label', I18N_IT.turnPairsOption), el('span', 'options-item-note', I18N_IT.turnPairsHint));
  pairsItem.append(pairsText, pairsInput, pairsSw);
  body.append(item, backItem, bgItem, pairsItem);
  layer.append(head, body);
  layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(layer);
  startLayer.inert = true;
  item.focus();
}

// Schermata "La mia collezione": per ogni wave un interruttore (la wave, cioè la sua scatola base) e sotto le sue
// mini espansioni. Togliendo una wave si tolgono anche le sue mini espansioni. Le scelte valgono solo con
// "Salva collezione"; la X torna indietro senza salvare.
export function openCollection(trigger, onSaved) {
  const draft = new Set(G.collection);
  const layer = el('div', 'collection-screen');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', I18N_IT.myCollection);
  const head = el('div', 'collection-head');
  const close = () => {
    layer.remove();
    updateInert();
    // Aperta da Opzioni: la pagina iniziale resta coperta dalle Opzioni
    if (document.querySelector('.options-screen')) startLayer.inert = true;
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', I18N_IT.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', I18N_IT.myCollection), x);
  const body = el('div', 'collection-body');
  body.appendChild(el('p', 'start-note', I18N_IT.collectionHint));
  // Seleziona tutto / Deseleziona tutto: spuntano o tolgono tutte le wave e le mini espansioni (valgono con "Salva")
  const bulk = el('div', 'collection-bulk');
  // (solo le wave che si possono scegliere, v199)
  const setAll = on => {
    collectionCatalog().filter(({ wave }) => collectionWaveEnabled(wave))
      .forEach(({ products }) => products.forEach(p => { if (on) draft.add(p.id); else draft.delete(p.id); }));
    body.querySelectorAll('.collection-wave:not(.is-locked) .collection-item input').forEach(input => {
      input.checked = on;
      if (input.closest('.is-mini')) input.disabled = !on;
    });
    body.querySelectorAll('.collection-wave:not(.is-locked) .collection-item.is-mini').forEach(r => r.classList.toggle('is-disabled', !on));
  };
  bulk.append(button(I18N_IT.selectAll, 'secondary', () => setAll(true)), button(I18N_IT.deselectAll, 'secondary', () => setAll(false)));
  body.appendChild(bulk);

  const toggle = (label, id, extraClass) => {
    const row = el('label', 'ae-switch-row collection-item' + (extraClass ? ' ' + extraClass : ''));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.checked = draft.has(id);
    input.dataset.id = id;
    const sw = el('span', 'ae-switch');
    sw.setAttribute('aria-hidden', 'true');
    row.append(el('span', '', label), input, sw);
    return row;
  };
  collectionCatalog().forEach(({ wave, products }) => {
    const block = el('section', 'collection-wave');
    const base = products[0];
    const waveRow = toggle(waveLabel(wave), base.id, 'is-wave');
    const minis = products.slice(1).map(m => toggle(m.name, m.id, 'is-mini'));
    const sync = () => {
      const on = draft.has(base.id);
      minis.forEach(r => {
        const input = r.querySelector('input');
        input.disabled = !on;
        r.classList.toggle('is-disabled', !on);
      });
    };
    waveRow.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) draft.add(base.id);
      else { draft.delete(base.id); products.slice(1).forEach(m => draft.delete(m.id)); minis.forEach(r => { r.querySelector('input').checked = false; }); }
      sync();
    });
    minis.forEach(r => r.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) draft.add(e.target.dataset.id); else draft.delete(e.target.dataset.id);
    }));
    block.append(waveRow, ...minis);
    sync();
    // Wave non ancora disponibili (v199): visibili ma spente e non si toccano
    if (!collectionWaveEnabled(wave)) {
      block.classList.add('is-locked');
      [waveRow, ...minis].forEach(r => {
        const input = r.querySelector('input');
        input.checked = false;
        input.disabled = true;
        r.classList.add('is-disabled');
      });
      waveRow.querySelector('span').append(el('span', 'collection-locked-note', I18N_IT.collectionLocked));
    }
    body.appendChild(block);
  });
  const footer = el('div', 'collection-footer');
  const saveBtn = button(I18N_IT.collectionSave, 'primary', () => {
    G.collection = draft;
    saveCollection();
    close();
    renderStartChoices();
    updateHomeCollection();
    if (onSaved) onSaved();
    showToast(I18N_IT.collectionSaved);
  });
  saveBtn.classList.add('ae-button--full');
  footer.appendChild(saveBtn);
  layer.append(head, body, footer);
  layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(layer);
  startLayer.inert = true;
  x.focus();
}

export function showStartSkeleton() {
  document.getElementById('nemesis-list').replaceChildren(...[0, 1, 2, 3].map(() => el('div', 'nemesis-skeleton')));
}

export function openStart() {
  // (v215: uscendo da un test, Esci dal test o Menu iniziale della Vittoria, tornano le scelte di prima)
  endTest();
  closeAllModals();
  closeDiscard();
  renderStartChoices();
  startLayer.hidden = false;
  updateInert();
  setStartMode('home', true);
}

export function closeStart() {
  startLayer.hidden = true;
  updateInert();
}

// Inizia partita: la scelta "Nuova partita" nella finestra sotto il titolo vale già come conferma di sostituire
// la partita salvata, quindi qui non si chiede altro
export function onStartClick() {
  startGame();
}

// Inizia: nuova partita con le scelte fatte (la partita salvata viene sostituita)
export function startGame() {
  if (!battleOf(G.settings.nemesis)) return;
  clearTransition();
  closeAllModals();
  G.queue = [];
  G.resolving = false;
  G.currentIndex = 0;
  G.newIndex = -1;
  ui.viewedUid = null;
  ui.reveal = null;
  ui.lastDrawnUid = null;
  ui.drafts.clear();
  ui.flyingDiscards = 0;
  G.undoStack = [];
  ui.gameSaved = false;
  newGame();
  // Prima del turno giocatori: i 9 mazzi da cui nasce il mazzo nemesi e il pulsante "Crea mazzo"
  ui.deckBuilding = true;
  ui.deckShown = 0;
  ui.deckDark = true;
  showDeckBuild();
  render();
  slideToGame(() => nemesisBtn.focus());
  prefetchDeckImages();
}

// Riprendi partita: si ricarica lo stato salvato nel browser, compreso l'undo.
// v194: se la nemesi della partita non è più nella collezione, una finestra lo dice; "Continua" rimette nella
// collezione il suo prodotto (e la scatola base della sua wave) e riprende la partita.
export function resumeGame() {
  const saved = readSave();
  if (!saved) return;
  const info = G.nemeses.find(n => n.name === saved.settings.nemesis);
  // (nemesi di una wave non ancora disponibile nella collezione, v199: si riprende e basta)
  if (info && info.boxCode && G.collection && collectionWaveEnabled(waveOfNemesis(info)) && !G.collection.has(productOfNemesis(info))) {
    openMissingNemesis(info, () => {
      G.collection.add(waveOfNemesis(info));
      G.collection.add(productOfNemesis(info));
      saveCollection();
      renderStartChoices();
      updateHomeCollection();
      resumeSavedGame(saved);
    });
    return;
  }
  resumeSavedGame(saved);
}

export function openMissingNemesis(info, onContinue) {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(I18N_IT.nemesisMissingTitle, '', cancel, { displayTitle: false });
  dialog.classList.add('ae-exit-confirm');
  dialog.appendChild(el('p', 'ae-modal-text', I18N_IT.nemesisMissingText(info.name,
    isMiniCode(info.boxCode) ? productName(info.boxCode) : waveLabel(waveOfNemesis(info)))));
  const footer = el('div', 'ae-modal-footer');
  const go = button(I18N_IT.continueLabel, 'primary', () => { close(); onContinue(); });
  footer.append(button(I18N_IT.cancel, 'secondary', cancel), go);
  dialog.appendChild(footer);
  close = openModal(dialog, { onCancel: cancel, initialFocus: go });
}

export function resumeSavedGame(saved) {
  try {
    const previousSettings = G.settings;
    G.settings = saved.settings;
    try {
      restore(saved.state);
    } catch (err) {
      G.settings = previousSettings;
      throw err;
    }
    G.undoStack = Array.isArray(saved.undo) ? saved.undo : [];
    ui.gameSaved = true;
    ui.deckDark = false;
    startError.hidden = true;
    closeStart();
    render();
    prefetchDeckImages();
    (G.resolving ? resolveBtn : nemesisBtn).focus();
  } catch (err) {
    console.error(err);
    showStartError(I18N_IT.resumeError, false);
  }
}

export function showStartError(text, withRetry) {
  startError.hidden = false;
  startErrorText.textContent = text;
  retryBtn.hidden = !withRetry;
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
