// ui/finestre/opzioni.ts: le Opzioni del menu iniziale (La mia collezione con il riepilogo, dorso, sfondo, carte turno
// 1/2 e 3/4, lingua), la schermata La mia collezione e la finestra "nemesi non più nella collezione" della ripresa.
// Livello 4 (ui/finestre/). Dipende da: dati/collezione.ts, stato/ (partita, preferenze), ui/ base (testi, pagina, dom,
// ridisegno: aggiornaInizio dopo il salvataggio della collezione), ui/componenti (dialoghi, sfondi). Usato da: schermate
// menu iniziale e Nuova partita, navigazione (ripresa).

import { LINGUA, T } from '../testi.ts';
import { collectionCatalog, collectionWaveEnabled, isMiniCode, productName, saveCollection, waveLabel,
  waveOfNemesis } from '../../dati/collezione.ts';
import { turnPairsOn } from '../../stato/partita.ts';
import { button, dialogShell, openModal, showToast, updateInert } from '../componenti/dialoghi.ts';
import type { CodiceProdotto, Nemesi } from '../../tipi/dati.ts';
import { LINGUE, preferenze, setLingua, setTurnPairs } from '../../stato/preferenze.ts';
import { startLayer } from '../pagina.ts';
import { backgroundChoiceButton, cardBackChoiceButton } from '../componenti/sfondi.ts';
import { el, icon, queryAll } from '../dom.ts';
import { aggiornaInizio } from '../ridisegno.ts';

// Il pulsante "La mia collezione" non è nella pagina "Nuova partita" (sta in Opzioni e nel Menu): si toglie anche da
// un index.html vecchio
export function ensureCollectionButton(): void {
  const row = document.getElementById('collection-row');
  if (row) row.remove();
}

export function collectionSummaryText(): string {
  const owned = preferenze.collection;
  if (!owned) throw new TypeError('collezione non ancora letta');
  const waves = new Set([...owned].map(id => id.split('|')[0]));
  return T.collectionSummary(waves.size, owned.size);
}

// Opzioni (dal menu iniziale): La mia collezione (con il riepilogo), Dorso delle carte, Sfondo, Carte turno 1/2 e 3/4
export function openOptions(trigger?: HTMLElement | null): void {
  const layer = el('div', 'collection-screen options-screen');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', T.options);
  const head = el('div', 'collection-head');
  const close = () => {
    layer.remove();
    startLayer.inert = false;
    updateInert();
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', T.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', T.options), x);
  const body = el('div', 'collection-body');
  const item = el('button', 'options-item');
  item.type = 'button';
  const summary = el('span', 'options-item-note', collectionSummaryText());
  item.append(el('span', 'options-item-label', T.myCollection), summary);
  item.addEventListener('click', () => openCollection(item, () => { summary.textContent = collectionSummaryText(); }));
  // Dorso delle carte: miniatura (piccola, a destra della scritta) e nome del dorso scelto; si tocca per la griglia di
  // tutti i dorsi. Chiusa la griglia, la pagina iniziale resta coperta dalle Opzioni
  const backItem = el('div', 'options-item options-item--row');
  backItem.append(el('span', 'options-item-label', T.cardBack),
    cardBackChoiceButton(() => { if (layer.isConnected) startLayer.inert = true; }, { compact: true }));
  // Sfondo: anteprima e nome dello sfondo scelto; si tocca per le anteprime di tutti gli sfondi
  const bgItem = el('div', 'options-item options-item--row');
  bgItem.append(el('span', 'options-item-label', T.background),
    backgroundChoiceButton(() => { if (layer.isConnected) startLayer.inert = true; }, { compact: true }));
  // Carte turno 1/2 e 3/4 (wave 4): interruttore, attivo di default
  const pairsItem = el('label', 'options-item options-item--row ae-switch-row options-switch');
  const pairsInput = document.createElement('input');
  pairsInput.type = 'checkbox';
  pairsInput.setAttribute('role', 'switch');
  pairsInput.checked = turnPairsOn();
  pairsInput.addEventListener('change', () => setTurnPairs(pairsInput.checked));
  const pairsSw = el('span', 'ae-switch');
  pairsSw.setAttribute('aria-hidden', 'true');
  const pairsText = el('span', 'options-switch-text');
  pairsText.append(el('span', 'options-item-label', T.turnPairsOption), el('span', 'options-item-note', T.turnPairsHint));
  pairsItem.append(pairsText, pairsInput, pairsSw);
  // Lingua: due scelte, la scritta della voce si legge in tutte e due le lingue. Sceglierne un'altra la salva e ricarica
  // l'app (i testi si scelgono all'avvio); la partita in corso e l'undo stanno nel salvataggio e restano
  const langItem = el('div', 'options-item options-item--row options-item--lang');
  langItem.appendChild(el('span', 'options-item-label', T.language));
  const langGroup = el('div', 'options-lang');
  langGroup.setAttribute('role', 'group');
  langGroup.setAttribute('aria-label', T.language);
  LINGUE.forEach(code => {
    const b = el('button', 'ae-button options-lang-btn ae-button--' + (code === LINGUA ? 'primary' : 'secondary'), T.languageNames[code]);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(code === LINGUA));
    b.addEventListener('click', () => {
      if (code === LINGUA) return;
      setLingua(code);
      location.reload();
    });
    langGroup.appendChild(b);
  });
  langItem.appendChild(langGroup);
  body.append(item, backItem, bgItem, pairsItem, langItem);
  layer.append(head, body);
  layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(layer);
  startLayer.inert = true;
  item.focus();
}

// Interruttore di una riga della collezione (ogni riga ne ha uno)
function inputOf(row: HTMLElement): HTMLInputElement {
  const input = row.querySelector('input');
  if (!input) throw new TypeError('riga della collezione senza interruttore');
  return input;
}

// Schermata "La mia collezione": per ogni wave un interruttore (la wave, cioè la sua scatola base) e sotto le sue
// mini espansioni. Togliendo una wave si tolgono anche le sue mini espansioni. Le scelte valgono solo con
// "Salva collezione"; la X torna indietro senza salvare.
export function openCollection(trigger?: HTMLElement | null, onSaved?: () => void): void {
  const draft = new Set<CodiceProdotto>(preferenze.collection);
  const layer = el('div', 'collection-screen');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', T.myCollection);
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
  x.setAttribute('aria-label', T.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', T.myCollection), x);
  const body = el('div', 'collection-body');
  body.appendChild(el('p', 'start-note', T.collectionHint));
  // Seleziona tutto / Deseleziona tutto: spuntano o tolgono tutte le wave (solo quelle che si possono scegliere) e le
  // mini espansioni (valgono con "Salva")
  const bulk = el('div', 'collection-bulk');
  const setAll = (on: boolean) => {
    collectionCatalog(T.baseBox).filter(({ wave }) => collectionWaveEnabled(wave))
      .forEach(({ products }) => products.forEach(p => { if (on) draft.add(p.id); else draft.delete(p.id); }));
    queryAll(body, '.collection-wave:not(.is-locked) .collection-item input', HTMLInputElement).forEach(input => {
      input.checked = on;
      if (input.closest('.is-mini')) input.disabled = !on;
    });
    body.querySelectorAll('.collection-wave:not(.is-locked) .collection-item.is-mini').forEach(r => r.classList.toggle('is-disabled', !on));
  };
  bulk.append(button(T.selectAll, 'secondary', () => setAll(true)), button(T.deselectAll, 'secondary', () => setAll(false)));
  body.appendChild(bulk);

  const toggle = (label: string, id: CodiceProdotto, extraClass: string) => {
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
  collectionCatalog(T.baseBox).forEach(({ wave, products }) => {
    const block = el('section', 'collection-wave');
    const base = products[0];
    const waveRow = toggle(waveLabel(wave), base.id, 'is-wave');
    const minis = products.slice(1).map(m => toggle(m.name, m.id, 'is-mini'));
    const sync = () => {
      const on = draft.has(base.id);
      minis.forEach(r => {
        const input = inputOf(r);
        input.disabled = !on;
        r.classList.toggle('is-disabled', !on);
      });
    };
    const waveInput = inputOf(waveRow);
    waveInput.addEventListener('change', () => {
      if (waveInput.checked) draft.add(base.id);
      else { draft.delete(base.id); products.slice(1).forEach(m => draft.delete(m.id)); minis.forEach(r => { inputOf(r).checked = false; }); }
      sync();
    });
    minis.forEach(r => {
      const input = inputOf(r);
      input.addEventListener('change', () => {
        const id = String(input.dataset.id);
        if (input.checked) draft.add(id); else draft.delete(id);
      });
    });
    block.append(waveRow, ...minis);
    sync();
    // Wave non ancora disponibili: visibili ma spente e non si toccano
    if (!collectionWaveEnabled(wave)) {
      block.classList.add('is-locked');
      [waveRow, ...minis].forEach(r => {
        const input = inputOf(r);
        input.checked = false;
        input.disabled = true;
        r.classList.add('is-disabled');
      });
      const label = waveRow.querySelector('span');
      if (label) label.append(el('span', 'collection-locked-note', T.collectionLocked));
    }
    body.appendChild(block);
  });
  const footer = el('div', 'collection-footer');
  const saveBtn = button(T.collectionSave, 'primary', () => {
    preferenze.collection = draft;
    saveCollection();
    close();
    aggiornaInizio();
    if (onSaved) onSaved();
    showToast(T.collectionSaved);
  });
  saveBtn.classList.add('ae-button--full');
  footer.appendChild(saveBtn);
  layer.append(head, body, footer);
  layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(layer);
  startLayer.inert = true;
  x.focus();
}

export function openMissingNemesis(info: Nemesi, onContinue: () => void): void {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(T.nemesisMissingTitle, '', cancel, { displayTitle: false });
  dialog.classList.add('ae-exit-confirm');
  const product = String(info.boxCode);
  dialog.appendChild(el('p', 'ae-modal-text', T.nemesisMissingText(info.name,
    isMiniCode(info.boxCode) ? productName(product) : waveLabel(waveOfNemesis(info)))));
  const footer = el('div', 'ae-modal-footer');
  const go = button(T.continueLabel, 'primary', () => { close(); onContinue(); });
  footer.append(button(T.cancel, 'secondary', cancel), go);
  dialog.appendChild(footer);
  close = openModal(dialog, { onCancel: cancel, initialFocus: go });
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
