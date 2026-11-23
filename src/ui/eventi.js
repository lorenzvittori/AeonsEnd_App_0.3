// ui/eventi.js: Eventi (tocchi, tastiera, scorrimento), pulsanti degli scarti, barra dei turni. Provvisorio: la barra dei turni andrà in ui/componenti/.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../stato/condivise.js';
import { I18N_IT } from './testi.js';
import { DRAG_THRESHOLD, app, discardBtn, discardClose, discardLayer, focusEl, infoRow, mainEl, menuBtn, queueList, queueViewport, rail, ui } from '../stato/stato.js';
import { awaitingTurnCard, currentTurn, currentTurnCard, entryByUid, historyPlayer, hpUnset, isPairCard, pairOptions, predictedPairPlayers, turnCardPlayer } from '../stato/partita.js';
import { el } from './componenti/componenti.js';
import { focusables, modals, topLayer } from './componenti/dialoghi.js';
import { centredQueueUid, markQueueRail, openCardDialog, scrollQueueTo } from './schermate/turno-giocatori.js';
import { closeDiscard, openDiscard } from './componenti/scarti.js';
import { DRAW_UID, isDrawStep, moveView, onResolveClick, viewCard } from './schermate/turno-nemesi.js';
import { openTurnScreen, renderPairChoice } from './schermate/mazzo-turni.js';
import { closeDeckPopover, closeUndoFloat, deckPopover, undoFloat } from './componenti/pesca-undo.js';
import { openSideMenu } from './componenti/menu-laterale.js';

// --- 9. Eventi e avvio ---------------------------------------------------------------------------------------------

// Un tocco che diventa scorrimento (oltre DRAG_THRESHOLD px) non apre la carta
export function trackDrag(container) {
  let start = null;
  container.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; container.dataset.dragged = ''; });
  container.addEventListener('pointermove', e => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD) container.dataset.dragged = '1';
  });
  container.addEventListener('pointerup', () => { start = null; });
  container.addEventListener('scroll', () => { if (start) container.dataset.dragged = '1'; }, { passive: true });
}

// Box della vita "?" di un minion a vita variabile (v218), ovunque compaia (carta grande, fascia piccola, riga del
// turno nemesi): un tocco apre la scheda della carta per impostare la vita. In cattura, così la fascia o la coda non
// fanno anche il loro tocco (scorrere, portare la carta al centro)
export function unsetHpClick(e) {
  const box = e.target.closest && e.target.closest('.ae-status-badge.is-unset, .ae-focus-status.is-unset');
  if (!box || ui.isTransitioning || modals.length) return;
  const entry = entryByUid(Number(box.dataset.uid));
  if (!entry || !hpUnset(entry)) return;
  if (ui.reveal && ui.reveal.uid === entry.uid && ui.reveal.status !== 'done') return;
  e.stopPropagation();
  e.preventDefault();
  openCardDialog(entry);
}

// Barra della fase sotto la testata (v168): 6 caselle, una per carta del mazzo dei turni (turnOrder), nell'ordine in
// cui sono state estratte. La casella del turno in corso è accesa (8px, colore pieno e bagliore), quelle dei turni già
// giocati in questo giro sono linee sottili colorate e velate, quelle ancora da estrarre linee grigie.
// Colori: giocatori 1-4 verde, giallo, blu, viola; jolly grigio chiaro; nemesi rosso scuro (style.css).
// Nel turno nemesi sotto la casella accesa c'è la scritta "Nemesi · Risolvi" o "Nemesi · Pesca"; nel turno di un
// giocatore niente scritta (basta il colore; il turno è detto nell'aria-label).
export let turnTrack; // costante assegnata in avvio()

export let turnTrackBar; // costante assegnata in avvio()

export let turnTrackLabels; // costante assegnata in avvio()

export let turnTrackLabel; // costante assegnata in avvio()

export function renderTurnTrack() {
  turnTrack.hidden = !!ui.deckBuilding;
  if (ui.deckBuilding) return;
  // v222: barra dei TURNI del giro, non delle carte: prima la storia (turni giocati e turno in corso, history), poi le
  // carte del mazzo dei turni (turni futuri, dalla cima). Una carta rimessa nel mazzo resta come turno passato e compare
  // anche come turno futuro, quindi le caselle possono essere più di 6 (si stringono: style.css --ae-seg-n)
  const history = G.turnOrder.history || [];
  const left = G.turnOrder.left || [];
  const total = Math.max(1, history.length + left.length);
  while (turnTrackBar.children.length < total) turnTrackBar.appendChild(el('span', 'ae-turn-seg'));
  while (turnTrackBar.children.length > total) turnTrackBar.lastChild.remove();
  turnTrackBar.style.setProperty('--ae-seg-n', String(Math.max(2, total)));
  // Turno in corso: l'ultimo della storia (salvataggi v211-v221 con un turno annullato: nessuna casella accesa)
  const cur = currentTurn() ? history.length - 1 : -1;
  const pastCount = cur >= 0 ? cur : history.length;
  // Carte del mazzo note (v212, turnOrder.known): colore tenue (is-known); per le 1/2 e 3/4 il giocatore dedotto dalla
  // memoria delle coppie (v222, predictedPairPlayers)
  const known = G.turnOrder.known || [];
  const predicted = predictedPairPlayers(G.turnOrder);
  const segInfo = i => {
    if (i < history.length) {
      const e = history[i];
      return { kind: e.kind, player: historyPlayer(e), past: i < pastCount, current: i === cur, known: false };
    }
    const j = i - history.length;
    if (!known[j]) return { kind: null };
    const kind = left[j];
    const player = kind === 'wild' ? (G.turnOrder.wild ? 'p' + G.turnOrder.wild : null)
      : isPairCard(kind) ? predicted[j] : (kind !== 'nemesis' ? kind : null);
    return { kind, player, past: false, current: false, known: true };
  };
  [...turnTrackBar.children].forEach((seg, i) => {
    const info = segInfo(i);
    const kind = info.kind;
    // Carta 1/2 o 3/4 (v192): con il giocatore deciso prende il suo colore, prima metà e metà dei due colori
    if (kind) seg.dataset.kind = isPairCard(kind) ? (info.player || kind) : kind;
    else delete seg.dataset.kind;
    // Jolly (v179): strisce bianche e del colore del giocatore che è jolly in questo giro
    const owner = kind === 'wild' ? info.player : null;
    if (owner) seg.dataset.owner = owner;
    else delete seg.dataset.owner;
    // Carta x/y (v194): sfumatura dai due colori (style.css ::after), che svanisce quando si sceglie il giocatore
    if (kind && isPairCard(kind)) seg.dataset.pair = kind;
    else delete seg.dataset.pair;
    seg.classList.toggle('is-current', !!info.current);
    seg.classList.toggle('is-past', !!info.past);
    seg.classList.toggle('is-known', !!info.known);
  });
  turnTrack.classList.toggle('is-nemesis', G.resolving);
  // Nessun turno in corso (attesa della carta turno): caselle tutte uguali (v194)
  turnTrackBar.classList.toggle('is-idle', cur < 0);
  // Mazzo dei turni appena mischiato (v194, playTurnShuffle): le scritte di prima restano e svaniscono (is-shuffling)
  if (ui.trackShuffle) {
    turnTrack.setAttribute('aria-label', I18N_IT.trackWaiting);
    renderPairChoice();
    return;
  }
  // Scritta sotto la casella accesa, centrata sotto di lei (v196, anche alle due estremità)
  const drawStep = G.resolving && (isDrawStep() || G.newIndex >= 0);
  const curKind = currentTurnCard();
  // Carta x/y senza giocatore: la scelta è nella finestra al centro (v193, renderPairChoice); sotto la casella "x / y"
  const choosing = !G.resolving && isPairCard(curKind) && !turnCardPlayer(curKind);
  turnTrackLabel.classList.toggle('is-choice', choosing);
  if (choosing) {
    turnTrackLabel.replaceChildren(pairOptions(curKind).map(p => p.slice(1)).join(' / '));
  } else if (G.resolving) {
    turnTrackLabel.replaceChildren(I18N_IT.trackNemesisName, el('span', 'ae-turn-label-dot'),
      drawStep ? I18N_IT.trackDraw : I18N_IT.trackResolve);
  } else {
    // Turno di un giocatore: "Giocatore N" nel colore del giocatore (v169); jolly: "Jolly · Giocatore N" (v179)
    const kind = currentTurnCard();
    const owner = turnCardPlayer(kind);
    if (kind === 'wild' && owner) {
      // "Jolly" bianco (v181) e solo il numero del giocatore, nel suo colore (v183: "Jolly · 2")
      turnTrackLabel.replaceChildren(el('span', 'ae-turn-label-wild', I18N_IT.trackWildName), el('span', 'ae-turn-label-dot'),
        owner.slice(1));
    } else {
      turnTrackLabel.replaceChildren(kind === 'wild' ? I18N_IT.trackWildName
        : owner ? I18N_IT.trackPlayerName(Number(owner.slice(1))) : '');
    }
  }
  const labelKind = G.resolving ? 'nemesis' : (turnCardPlayer(currentTurnCard()) || currentTurnCard());
  if (labelKind && !choosing) turnTrackLabel.dataset.kind = labelKind;
  else delete turnTrackLabel.dataset.kind;
  // Sotto le caselle dei turni già passati nel giro (v182): N = nemesi, 1-4 = giocatore, W = wild (v218, prima J =
  // jolly), nel loro colore
  turnTrackLabels.querySelectorAll('.ae-turn-mark').forEach(m => m.remove());
  // (v212: anche sotto le caselle future delle carte note del mazzo, più chiare)
  // Misure delle caselle (v222, n caselle): accesa 122px, le altre (100% - 122px - (n-1) × 6px) / (n-1); senza casella
  // accesa tutte (100% - (n-1) × 6px) / n
  const n = Math.max(2, total);
  const narrow = `((100% - 122px - ${(n - 1) * 6}px) / ${n - 1})`;
  const even = `((100% - ${(n - 1) * 6}px) / ${n})`;
  for (let i = 0; i < total; i++) {
    const info = segInfo(i);
    if (!info.kind || !(info.past || info.known)) continue;
    const kind = info.kind;
    // Carta x/y: il numero del giocatore che l'ha giocata (o "1/2" se non è stato scelto)
    const who = info.player;
    const mark = el('span', 'ae-turn-mark', kind === 'nemesis' ? 'N' : kind === 'wild' ? 'W'
      : isPairCard(kind) ? (who ? who.slice(1) : kind.slice(1).split('').join('/')) : kind.slice(1));
    mark.setAttribute('aria-hidden', 'true');
    mark.dataset.kind = who || kind;
    if (kind === 'wild') mark.classList.add('is-wild');
    if (info.known) mark.classList.add('is-known');
    // Centro della casella i: prima di quella accesa tutte strette; dopo, c'è davanti la casella accesa (122px)
    mark.style.left = cur < 0 ? `calc(${i} * (${even} + 6px) + ${even} / 2)`
      : i > cur ? `calc(${i - 1} * (${narrow} + 6px) + 128px + ${narrow} / 2)`
      : `calc(${i} * (${narrow} + 6px) + ${narrow} / 2)`;
    turnTrackLabels.appendChild(mark);
  }
  // v196: sempre centrata sotto la sua casella, anche alle due estremità (prima lì era allineata al bordo)
  turnTrackLabel.classList.remove('is-start', 'is-end');
  // Centro della casella accesa (v184, style.css .ae-turn-seg.is-current): accesa = 122px
  turnTrackLabel.style.left = cur >= 0 ? `calc(${cur} * (${narrow} + 6px) + 61px)` : '0%';
  const card = currentTurnCard();
  const name = awaitingTurnCard() ? I18N_IT.trackWaiting
    : G.resolving ? (drawStep ? I18N_IT.trackNemesisDraw : I18N_IT.trackNemesisResolve)
    : card === 'wild' ? (G.turnOrder.wild ? I18N_IT.trackWildOf(G.turnOrder.wild) : I18N_IT.trackWild)
    : isPairCard(card) ? (turnCardPlayer(card) ? I18N_IT.trackPlayer(Number(turnCardPlayer(card).slice(1)))
      : I18N_IT.trackPairChoose(...pairOptions(card).map(p => Number(p.slice(1)))))
    : card && card !== 'nemesis' ? I18N_IT.trackPlayer(Number(card.slice(1))) : '';
  turnTrack.setAttribute('aria-label', [name, cur >= 0 ? I18N_IT.trackPosition(cur + 1, total) : '', I18N_IT.turnDeckHint]
    .filter(Boolean).join(', '));
  // (v212: niente scelta x/y né riquadro mentre la finestra del mazzo dei turni disegna la sua copia della barra)
  if (ui.trackPreview) return;
  renderPairChoice();
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
  trackDrag(queueViewport);

  trackDrag(rail);

  // Carte grandi del turno giocatori: una carta non al centro si porta al centro; si apre solo quella al centro
  queueList.addEventListener('click', e => {
    const item = e.target.closest('.ae-queue-item');
    if (!item || queueViewport.dataset.dragged === '1') return;
    const uid = Number(item.dataset.uid);
    if (uid !== centredQueueUid()) {
      scrollQueueTo(item.closest('.queue-slot') || item);
      markQueueRail(uid);
      return;
    }
    const entry = entryByUid(uid);
    if (entry) openCardDialog(entry);
  });

  rail.addEventListener('click', e => {
    const item = e.target.closest('.ae-queue-item');
    if (!item || rail.dataset.dragged === '1') return;
    viewCard(Number(item.dataset.uid));
  });

  document.addEventListener('click', unsetHpClick, true);

  // Carosello del turno nemesi: toccando il retro della carta da pescare si pesca; toccando un minion (quello al centro)
  // si apre la stessa finestra del turno giocatori, con −1 e +1 alla vita
  focusEl.addEventListener('click', e => {
    if (!G.resolving || ui.isTransitioning) return;
    const stage = e.target.closest('.ae-focus-stage');
    const slide = stage && stage.closest('.ae-focus-slide');
    if (!slide) return;
    const uid = Number(slide.dataset.uid);
    // Carta non al centro: si porta al centro (come un tocco sulla fascia), non si apre
    if (uid !== ui.viewedUid) { viewCard(uid); return; }
    if (uid === DRAW_UID) {
      onResolveClick();
      return;
    }
    const entry = entryByUid(uid);
    if (!entry || entry.data.type !== 'Minion') return;
    if (ui.reveal && ui.reveal.uid === uid && ui.reveal.status !== 'done') return;
    openCardDialog(entry);
  });

  focusEl.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.ae-focus-slide--draw .ae-focus-stage')) {
      e.preventDefault();
      e.target.click();
    }
  });

  // Frecce sinistra/destra sulla fascia: cambiano solo la carta mostrata
  rail.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    moveView(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
    const item = rail.querySelector(`[data-uid="${ui.viewedUid}"]`);
    if (item) item.focus();
  });

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

  discardLayer.addEventListener('click', e => { if (e.target === discardLayer) closeDiscard(); });

  discardBtn.addEventListener('click', openDiscard);

  discardClose.addEventListener('click', closeDiscard);

  menuBtn.addEventListener('click', openSideMenu);

  // Menu in alto a destra (opposto all'undo): apre un pannello laterale largo il 70% dello schermo, il resto dell'app
  // resta visibile ma oscurato. Contiene: Esci dalla partita, turno, carte nel mazzo, Scarti.
  // La riga Turno/Mazzo/Scarti/Menu in basso non c'è più. Tutto è creato qui, così vale anche con un index.html vecchio.
  (function setupMenuButton() {
    const spacer = document.querySelector('.ae-header .ae-header-spacer');
    menuBtn.className = 'ae-icon-button ae-menu-button';
    menuBtn.textContent = '';
    menuBtn.setAttribute('aria-label', I18N_IT.menu);
    menuBtn.setAttribute('aria-haspopup', 'dialog');
    menuBtn.append(el('span', 'ae-menu-lines'));
    if (spacer) spacer.replaceWith(menuBtn);
    infoRow.remove();
  })();

  turnTrack = el('div', 'ae-turn-track');

  // v206: toccando la barra si apre il mazzo dei turni (rivela, rimescola dagli scarti, ordina)
  turnTrack.setAttribute('role', 'button');

  turnTrack.tabIndex = 0;

  turnTrack.addEventListener('click', () => openTurnScreen());

  turnTrack.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTurnScreen(); } });

  turnTrackBar = el('div', 'ae-turn-track-bar');

  turnTrackLabels = el('div', 'ae-turn-labels');

  turnTrackLabel = el('span', 'ae-turn-label');

  turnTrackLabels.appendChild(turnTrackLabel);

  turnTrack.append(turnTrackBar, turnTrackLabels);

  mainEl.prepend(turnTrack);
}
