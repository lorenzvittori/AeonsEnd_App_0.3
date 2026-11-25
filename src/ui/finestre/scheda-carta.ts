// ui/finestre/scheda-carta.ts: la scheda della carta in gioco toccata (VistaCartaCoda): minion = punti vita in bozza
// (turno giocatori) o subito (turno nemesi, vita "?" da impostare); potere = token e rimozione pagando il costo.
// All'avvio il tocco sul box "?" di un minion a vita variabile, ovunque compaia, apre questa scheda.
// Livello 4 (ui/finestre/). Dipende da: stato/partita.ts (lettura, cambiaVitaMinion), ui/ base (testi, pagina, dom,
// ridisegno), ui/componenti (componenti, dialoghi, testata). Usato da: schermate turno giocatori e turno nemesi.
import { cambiaVitaMinion, entryByUid, hpCap, hpUnset, partita } from '../../stato/partita.ts';
import type { VoceInGioco } from '../../tipi/partita.ts';
import { cardArt, draftHp, draftOf, hasHp, needsPairChoice, setDraft, tokenIcons,
  typeName } from '../componenti/componenti.ts';
import { button, modals, openModal, showToast } from '../componenti/dialoghi.ts';
import { flyToDiscard } from '../componenti/testata.ts';
import { el, icon, query } from '../dom.ts';
import { focusEl, pulsantePrincipale, queueList, ui } from '../pagina.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { T } from '../testi.ts';

export function unsetHpClick(e: MouseEvent): void {
  const target = e.target;
  const box = target instanceof Element ? target.closest('.ae-status-badge.is-unset, .ae-focus-status.is-unset') : null;
  if (!(box instanceof HTMLElement) || ui.isTransitioning || modals.length) return;
  const entry = entryByUid(Number(box.dataset.uid));
  if (!entry || !hpUnset(entry)) return;
  if (ui.reveal && ui.reveal.uid === entry.uid && ui.reveal.status !== 'done') return;
  e.stopPropagation();
  e.preventDefault();
  openCardDialog(entry);
}

// Dopo un dialogo la coda è ridisegnata: il focus va sulla carta indicata (o sul pulsante principale se la coda è vuota)
export function focusQueueItem(uid: number | null): void {
  const item = uid !== null ? query(queueList, `[data-uid="${uid}"]`, HTMLElement) : null;
  (item || pulsantePrincipale).focus({ preventScroll: true });
}

// VistaCartaCoda: dialogo della carta toccata. Minion = punti vita in bozza; potere = rimozione esplicita.
// Niente intestazione (nome, tipo, X): si chiude con Chiudi/Annulla, Esc o tocco fuori; lo spazio va alla carta.
// Sotto la carta c'è sempre un pannello alto uguale per ogni tipo, così la carta ha la stessa dimensione per minion,
// poteri e attacchi.
export function openCardDialog(entry: VoceInGioco): void {
  // Nel turno nemesi si apre solo per i minion (−1 / +1 alla vita)
  if (ui.isTransitioning || (partita.resolving && entry.data.type !== 'Minion')) return;
  const { data } = entry;
  let close = () => {};
  const cancel = () => close();
  const dialog = el('div', 'ae-modal ae-modal--card');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', [data.name || T.cardInPlay, typeName(data)].join(', '));
  const art = cardArt(data);
  art.classList.add('ae-modal-art');
  const panel = el('div', 'ae-card-panel');
  dialog.append(art, panel);
  // Scelta del giocatore 1/2 o 3/4 in sospeso: la carta si guarda ma non si cambia (niente vita, niente rimuovi)
  const locked = needsPairChoice();

  if (hasHp(entry) && !locked) {
    buildHpPanel(dialog, panel, entry, () => close());
  } else if (data.type === 'Power' && !locked) {
    // Token rimasti come icone, un token per ogni token
    const tokens = el('p', 'ae-card-panel-tokens');
    tokens.setAttribute('aria-label', T.tokensLeft(entry.tokens));
    tokens.appendChild(tokenIcons(Number(entry.tokens)));
    panel.appendChild(tokens);
    // Costo pagato: la carta diventa grigia (modifica non salvata); con "Salva modifiche" va negli scarti
    const remove = button(T.removePower, 'danger', () => {
      close();
      setDraft(entry, { paid: true });
      richiediRidisegno();
      focusQueueItem(entry.uid);
    });
    const footer = el('div', 'ae-modal-footer');
    footer.append(button(T.close, 'secondary', cancel));
    // Solo i poteri con "TO DISCARD" si possono rimuovere pagando il costo (cards.json: removable)
    const d = draftOf(entry);
    if (data.removable !== false && !entry.paid && !(d && d.paid)) footer.appendChild(remove);
    dialog.appendChild(footer);
  } else {
    const footer = el('div', 'ae-modal-footer');
    footer.append(button(T.close, 'secondary', cancel));
    dialog.appendChild(footer);
  }
  close = openModal(dialog, { onCancel: cancel });
}

// Punti vita in bozza: i pulsanti cambiano solo la bozza; Conferma applica una volta sola (un passo di undo);
// Annulla, X, Esc o tocco fuori lasciano la vita com'era.
// Riga: "HP x / y" a sinistra, danno o cura della bozza a destra; sotto i pulsanti −5 −1 +1.
export function buildHpPanel(dialog: HTMLElement, panel: HTMLElement, entry: VoceInGioco, close: () => void): void {
  // Minion a vita variabile non ancora impostata: si parte da 0, niente "/X", a 0 non muore
  const unset = hpUnset(entry);
  // Turno giocatori: si parte dalla vita in bozza e la conferma scrive una bozza (si salva con "Salva modifiche").
  // (Number: la vita di un minion c'è sempre; null varrebbe 0, come nei conti di JavaScript)
  const original = Number(partita.resolving ? entry.hp : draftHp(entry));
  let draft = original;
  let committing = false;

  const row = el('div', 'ae-hp-row');
  const number = el('p', 'ae-hp-number');
  number.setAttribute('aria-live', 'polite');
  const delta = el('p', 'ae-hp-delta');
  row.append(number, delta);
  const controls = el('div', 'ae-hp-controls');
  // Turno giocatori: −5, −1 e +1 (solo fino alla vita di inizio turno); turno nemesi: −1 e +1; vita "?" da impostare:
  // −5, −1, +1 e +5 nei due turni
  const cap = Number(hpCap(entry, partita.resolving));
  const stepButtons: [number, HTMLButtonElement][] = [];
  (unset ? [-5, -1, 1, 5] : partita.resolving ? [-1, 1] : [-5, -1, 1]).forEach(step => {
    const b = button(step > 0 ? '+' + step : '−' + Math.abs(step), 'secondary', () => {
      draft = Math.min(cap, Math.max(0, draft + step));
      update();
    });
    stepButtons.push([step, b]);
    b.setAttribute('aria-label', T.lifeStepAria(step));
    controls.appendChild(b);
  });
  const footer = el('div', 'ae-modal-footer');
  const confirm = button(T.confirmHp, 'primary', commit);
  footer.append(button(T.cancel, 'secondary', close), confirm);
  panel.append(row, controls);
  dialog.appendChild(footer);

  // "HP x / X": X è la vita prima del danno (la vita salvata), non la vita massima della carta
  const before = entry.hp;
  function update() {
    // Vita di riferimento non ancora impostata: solo "HP x"
    number.textContent = unset ? `HP ${draft}` : `HP ${draft} / ${before}`;
    const change = draft - original;
    const dies = draft === 0 && !unset;
    delta.className = 'ae-hp-delta' + (change < 0 ? ' is-loss' : change > 0 ? ' is-gain' : '');
    delta.replaceChildren();
    if (dies) delta.append(icon('heart'), el('span', '', T.willBeDeleted));
    else if (change !== 0 && !unset) delta.append(icon('heart'), el('span', '', T.hpDelta(change)));
    stepButtons.forEach(([step, b]) => {
      if (step > 0 && !partita.resolving) { b.disabled = draft >= cap; b.classList.toggle('is-dimmed', draft >= cap); }
    });
    confirm.textContent = dies ? T.deleteMinion : T.confirmHp;
    confirm.className = 'ae-button ' + (dies ? 'ae-button--danger' : 'ae-button--primary');
  }

  function commit() {
    if (committing) return;
    committing = true;
    const index = partita.queue.indexOf(entry);
    const name = entry.data.name;
    const value = draft;
    close();
    // Vita invariata: si chiude senza aggiungere un passo di undo
    if (value === original || index < 0) return;
    if (!partita.resolving) {
      setDraft(entry, { hp: value });
      ui.queueAnchor = { uid: entry.uid, align: 'nearest' };
      richiediRidisegno();
      focusQueueItem(entry.uid);
      return;
    }
    ui.drafts.delete(entry.uid);
    // Minion ucciso nel turno nemesi: vola negli scarti
    const killedArt = value <= 0 ? query(focusEl, `.ae-focus-slide[data-uid="${entry.uid}"] .ae-focus-stage`, HTMLElement) : null;
    const wasResolving = partita.resolving;
    // Prima impostazione della vita di un minion a vita variabile: da qui valgono le regole normali (è anche la sua vita
    // massima); a 0 il minion esce subito (stato/partita.ts, cambiaVitaMinion)
    cambiaVitaMinion(entry, value, unset);
    if (wasResolving) {
      ui.viewedUid = null;
      if (killedArt) flyToDiscard([killedArt]);
      richiediRidisegno();
      pulsantePrincipale.focus();
      showToast(value <= 0 ? T.minionDeleted(name) : T.hpLeftToast(name, value));
      return;
    }
    ui.queueAnchor = { uid: entry.uid, align: 'nearest' };
    richiediRidisegno();
    focusQueueItem(entry.uid);
    showToast(value <= 0 ? T.minionKilled(name) : T.hpLeftToast(name, value));
  }

  update();
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  // Box della vita "?" di un minion a vita variabile, ovunque compaia: apre questa finestra
  document.addEventListener('click', unsetHpClick, true);
}
