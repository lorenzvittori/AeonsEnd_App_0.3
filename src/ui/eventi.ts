// ui/eventi.ts: eventi (tocchi, tastiera, scorrimento), pulsanti degli scarti e del menu, barra dei turni.
// Provvisorio: la barra dei turni andrà in ui/componenti/.
// Dipende da: stato/partita.ts (lettura e azione scegliGiocatoreCoppia), regole/mazzo-turni.ts (playerOf), ui/ (testi,
// pagina), ui/componenti (componenti, dialoghi, scarti, pesca-undo, menu-laterale), ui/schermate (turno-giocatori,
// turno-nemesi, mazzo-turni). Usato da: turno nemesi (render), mazzo dei turni (barra, chooseTurnPlayer).

import { I18N_IT } from './testi.ts';
import { awaitingTurnCard, currentTurn, currentTurnCard, entryByUid, historyPlayer, hpUnset, isPairCard, pairOptions, predictedPairPlayers, scegliGiocatoreCoppia, turnCardPlayer, partita } from '../stato/partita.ts';
import { playerOf } from '../regole/mazzo-turni.ts';
import { el, query } from './componenti/componenti.ts';
import { announce, focusables, modals, topLayer } from './componenti/dialoghi.ts';
import { centredQueueUid, markQueueRail, openCardDialog, scrollQueueTo } from './schermate/turno-giocatori.ts';
import { closeDiscard, openDiscard } from './componenti/scarti.ts';
import { DRAW_UID, isDrawStep, moveView, onResolveClick, render, viewCard } from './schermate/turno-nemesi.ts';
import { openTurnScreen, renderPairChoice } from './schermate/mazzo-turni.ts';
import { closeDeckPopover, closeUndoFloat, deckPopover, undoFloat } from './componenti/pesca-undo.ts';
import { openSideMenu } from './componenti/menu-laterale.ts';
import type { CartaTurno, Giocatore } from '../tipi/partita.ts';
import { DRAG_THRESHOLD, app, discardBtn, discardClose, discardLayer, focusEl, infoRow, mainEl, menuBtn, nemesisBtn, queueList, queueViewport, rail, ui } from './pagina.ts';

// Una casella della barra dei turni: carta, giocatore, turno passato / in corso / futuro noto
interface Casella {
  kind: CartaTurno | null;
  player?: string | null;
  past?: boolean;
  current?: boolean;
  known?: boolean;
}

// Un tocco che diventa scorrimento (oltre DRAG_THRESHOLD px) non apre la carta
export function trackDrag(container: HTMLElement): void {
  let start: { x: number; y: number } | null = null;
  container.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; container.dataset.dragged = ''; });
  container.addEventListener('pointermove', e => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD) container.dataset.dragged = '1';
  });
  container.addEventListener('pointerup', () => { start = null; });
  container.addEventListener('scroll', () => { if (start) container.dataset.dragged = '1'; }, { passive: true });
}

// Box della vita "?" di un minion a vita variabile, ovunque compaia (carta grande, fascia piccola, riga del turno
// nemesi): un tocco apre la scheda della carta per impostare la vita. In cattura, così la fascia o la coda non fanno
// anche il loro tocco (scorrere, portare la carta al centro)
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

// Barra della fase sotto la testata: una casella per turno del giro, nell'ordine (prima la storia, poi le carte del
// mazzo dei turni). La casella del turno in corso è accesa (8px, colore pieno e bagliore), quelle dei turni già giocati
// in questo giro sono linee sottili colorate e velate, quelle ancora da estrarre linee grigie.
// Colori: giocatori 1-4 verde, giallo, blu, viola; wild grigio chiaro; nemesi rosso scuro (style.css).
// Nel turno nemesi sotto la casella accesa c'è la scritta "Nemesi · Risolvi" o "Nemesi · Pesca"; nel turno di un
// giocatore il nome del giocatore (il turno è detto anche nell'aria-label). Elementi creati in avvio()
export let turnTrack: HTMLDivElement;
export let turnTrackBar: HTMLDivElement;
export let turnTrackLabels: HTMLDivElement;
export let turnTrackLabel: HTMLSpanElement;

export function renderTurnTrack(): void {
  turnTrack.hidden = !!ui.deckBuilding;
  if (ui.deckBuilding) return;
  // Barra dei TURNI del giro, non delle carte: prima la storia (turni giocati e turno in corso, history), poi le carte
  // del mazzo dei turni (turni futuri, dalla cima). Una carta rimessa nel mazzo resta come turno passato e compare anche
  // come turno futuro, quindi le caselle possono essere più di 6 (si stringono: style.css --ae-seg-n)
  const history = partita.turnOrder.history || [];
  const left = partita.turnOrder.left || [];
  const total = Math.max(1, history.length + left.length);
  while (turnTrackBar.children.length < total) turnTrackBar.appendChild(el('span', 'ae-turn-seg'));
  while (turnTrackBar.children.length > total) {
    const last = turnTrackBar.lastChild;
    if (!last) break;
    last.remove();
  }
  turnTrackBar.style.setProperty('--ae-seg-n', String(Math.max(2, total)));
  // Turno in corso: l'ultimo della storia (salvataggi vecchi con un turno annullato: nessuna casella accesa)
  const cur = currentTurn() ? history.length - 1 : -1;
  const pastCount = cur >= 0 ? cur : history.length;
  // Carte del mazzo note (turnOrder.known): colore tenue (is-known); per le 1/2 e 3/4 il giocatore dedotto dalla
  // memoria delle coppie (predictedPairPlayers)
  const known = partita.turnOrder.known || [];
  const predicted = predictedPairPlayers(partita.turnOrder);
  const segInfo = (i: number): Casella => {
    if (i < history.length) {
      const e = history[i];
      return { kind: e.kind, player: historyPlayer(e), past: i < pastCount, current: i === cur, known: false };
    }
    const j = i - history.length;
    if (!known[j]) return { kind: null };
    const kind = left[j];
    const player = kind === 'wild' ? playerOf(partita.turnOrder.wild)
      : isPairCard(kind) ? predicted[j] : (kind !== 'nemesis' ? kind : null);
    return { kind, player, past: false, current: false, known: true };
  };
  Array.from(turnTrackBar.children).forEach((seg, i) => {
    if (!(seg instanceof HTMLElement)) return;
    const info = segInfo(i);
    const kind = info.kind;
    // Carta 1/2 o 3/4: con il giocatore deciso prende il suo colore, prima metà e metà dei due colori
    if (kind) seg.dataset.kind = isPairCard(kind) ? (info.player || kind) : kind;
    else delete seg.dataset.kind;
    // Wild: strisce bianche e del colore del giocatore che è wild in questo giro
    const owner = kind === 'wild' ? info.player : null;
    if (owner) seg.dataset.owner = owner;
    else delete seg.dataset.owner;
    // Carta 1/2 o 3/4: sfumatura dai due colori (style.css ::after), che svanisce quando si sceglie il giocatore
    if (kind && isPairCard(kind)) seg.dataset.pair = kind;
    else delete seg.dataset.pair;
    seg.classList.toggle('is-current', !!info.current);
    seg.classList.toggle('is-past', !!info.past);
    seg.classList.toggle('is-known', !!info.known);
  });
  turnTrack.classList.toggle('is-nemesis', partita.resolving);
  // Nessun turno in corso (attesa della carta turno): caselle tutte uguali
  turnTrackBar.classList.toggle('is-idle', cur < 0);
  // Mazzo dei turni appena mischiato (playTurnShuffle): le scritte di prima restano e svaniscono (is-shuffling)
  if (ui.trackShuffle) {
    turnTrack.setAttribute('aria-label', I18N_IT.trackWaiting);
    renderPairChoice();
    return;
  }
  // Scritta sotto la casella accesa, centrata sotto di lei (anche alle due estremità)
  const drawStep = partita.resolving && (isDrawStep() || partita.newIndex >= 0);
  const curKind = currentTurnCard();
  // Carta 1/2 o 3/4 senza giocatore: la scelta è nella finestra al centro (renderPairChoice); sotto la casella "x / y"
  const choosing = !partita.resolving && isPairCard(curKind) && !turnCardPlayer(curKind);
  turnTrackLabel.classList.toggle('is-choice', choosing);
  if (choosing) {
    turnTrackLabel.replaceChildren(pairOptions(curKind).map(p => p.slice(1)).join(' / '));
  } else if (partita.resolving) {
    turnTrackLabel.replaceChildren(I18N_IT.trackNemesisName, el('span', 'ae-turn-label-dot'),
      drawStep ? I18N_IT.trackDraw : I18N_IT.trackResolve);
  } else {
    // Turno di un giocatore: "Giocatore N" nel colore del giocatore; wild: "Wild · N" ("Wild" bianco e il numero del
    // giocatore nel suo colore)
    const kind = currentTurnCard();
    const owner = turnCardPlayer(kind);
    if (kind === 'wild' && owner) {
      turnTrackLabel.replaceChildren(el('span', 'ae-turn-label-wild', I18N_IT.trackWildName), el('span', 'ae-turn-label-dot'),
        owner.slice(1));
    } else {
      turnTrackLabel.replaceChildren(kind === 'wild' ? I18N_IT.trackWildName
        : owner ? I18N_IT.trackPlayerName(Number(owner.slice(1))) : '');
    }
  }
  const labelKind = partita.resolving ? 'nemesis' : (turnCardPlayer(currentTurnCard()) || currentTurnCard());
  if (labelKind && !choosing) turnTrackLabel.dataset.kind = labelKind;
  else delete turnTrackLabel.dataset.kind;
  // Sotto le caselle dei turni già passati nel giro e delle carte note del mazzo (più chiare): N = nemesi, 1-4 =
  // giocatore, W = wild, nel loro colore
  turnTrackLabels.querySelectorAll('.ae-turn-mark').forEach(m => m.remove());
  // Misure delle caselle (n caselle): accesa 122px, le altre (100% - 122px - (n-1) × 6px) / (n-1); senza casella accesa
  // tutte (100% - (n-1) × 6px) / n
  const n = Math.max(2, total);
  const narrow = `((100% - 122px - ${(n - 1) * 6}px) / ${n - 1})`;
  const even = `((100% - ${(n - 1) * 6}px) / ${n})`;
  for (let i = 0; i < total; i++) {
    const info = segInfo(i);
    const kind = info.kind;
    if (!kind || !(info.past || info.known)) continue;
    // Carta 1/2 o 3/4: il numero del giocatore che l'ha giocata (o "1/2" se non è stato scelto)
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
  // Sempre centrata sotto la sua casella, anche alle due estremità
  turnTrackLabel.classList.remove('is-start', 'is-end');
  // Centro della casella accesa (style.css .ae-turn-seg.is-current): accesa = 122px
  turnTrackLabel.style.left = cur >= 0 ? `calc(${cur} * (${narrow} + 6px) + 61px)` : '0%';
  turnTrack.setAttribute('aria-label', [trackName(drawStep), cur >= 0 ? I18N_IT.trackPosition(cur + 1, total) : '', I18N_IT.turnDeckHint]
    .filter(Boolean).join(', '));
  // Niente scelta 1/2 o 3/4 né riquadro mentre la finestra del mazzo dei turni disegna la sua copia della barra
  if (ui.trackPreview) return;
  renderPairChoice();
}

// Scelta del giocatore per la carta 1/2 o 3/4 del turno in corso (un passo di undo: stato/partita.ts,
// scegliGiocatoreCoppia), poi la barra dei turni con l'annuncio e il lampo della casella
export function chooseTurnPlayer(player: Giocatore): void {
  const cur = currentTurn();
  if (partita.resolving || ui.isTransitioning || !cur || !isPairCard(cur.kind) || cur.player) return;
  scegliGiocatoreCoppia(player);
  render();
  announce(turnTrack.getAttribute('aria-label'));
  nemesisBtn.focus({ preventScroll: true });
  turnTrack.classList.remove('is-changed');
  void turnTrack.offsetWidth;
  turnTrack.classList.add('is-changed');
}

// Nome del turno in corso per i lettori di schermo
function trackName(drawStep: boolean): string {
  const card = currentTurnCard();
  if (awaitingTurnCard()) return I18N_IT.trackWaiting;
  if (partita.resolving) return drawStep ? I18N_IT.trackNemesisDraw : I18N_IT.trackNemesisResolve;
  if (card === 'wild') return partita.turnOrder.wild ? I18N_IT.trackWildOf(partita.turnOrder.wild) : I18N_IT.trackWild;
  if (isPairCard(card)) {
    const player = turnCardPlayer(card);
    if (player) return I18N_IT.trackPlayer(Number(player.slice(1)));
    const [a, b] = pairOptions(card);
    return I18N_IT.trackPairChoose(Number(a.slice(1)), Number(b.slice(1)));
  }
  return card && card !== 'nemesis' ? I18N_IT.trackPlayer(Number(card.slice(1))) : '';
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  trackDrag(queueViewport);
  trackDrag(rail);

  // Carte grandi del turno giocatori: una carta non al centro si porta al centro; si apre solo quella al centro
  queueList.addEventListener('click', e => {
    const target = e.target;
    const item = target instanceof Element ? target.closest('.ae-queue-item') : null;
    if (!(item instanceof HTMLElement) || queueViewport.dataset.dragged === '1') return;
    const uid = Number(item.dataset.uid);
    if (uid !== centredQueueUid()) {
      const slot = item.closest('.queue-slot');
      scrollQueueTo(slot instanceof HTMLElement ? slot : item);
      markQueueRail(uid);
      return;
    }
    const entry = entryByUid(uid);
    if (entry) openCardDialog(entry);
  });

  rail.addEventListener('click', e => {
    const target = e.target;
    const item = target instanceof Element ? target.closest('.ae-queue-item') : null;
    if (!(item instanceof HTMLElement) || rail.dataset.dragged === '1') return;
    viewCard(Number(item.dataset.uid));
  });

  document.addEventListener('click', unsetHpClick, true);

  // Carosello del turno nemesi: toccando il retro della carta da pescare si pesca; toccando un minion (quello al centro)
  // si apre la stessa finestra del turno giocatori, con −1 e +1 alla vita
  focusEl.addEventListener('click', e => {
    if (!partita.resolving || ui.isTransitioning) return;
    const target = e.target;
    const stage = target instanceof Element ? target.closest('.ae-focus-stage') : null;
    const slide = stage && stage.closest('.ae-focus-slide');
    if (!(slide instanceof HTMLElement)) return;
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
    const target = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && target instanceof HTMLElement && target.matches('.ae-focus-slide--draw .ae-focus-stage')) {
      e.preventDefault();
      target.click();
    }
  });

  // Frecce sinistra/destra sulla fascia: cambiano solo la carta mostrata
  rail.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    moveView(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
    const item = query(rail, `[data-uid="${ui.viewedUid}"]`, HTMLElement);
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
  // (il menu non riceve l'evento del tocco: openSideMenu accetta solo una funzione da chiamare prima di uscire)
  menuBtn.addEventListener('click', () => openSideMenu());

  // Menu in alto a destra (opposto all'undo): apre un pannello laterale largo il 70% dello schermo, il resto dell'app
  // resta visibile ma oscurato. La riga Turno/Mazzo/Scarti/Menu in basso non c'è: tutto è creato qui, così vale anche
  // con un index.html vecchio.
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

  // Toccando la barra si apre il mazzo dei turni (rivela, rimescola dagli scarti, ordina)
  turnTrack = el('div', 'ae-turn-track');
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
