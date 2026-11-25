// ui/componenti/barra-turni.ts: la barra dei turni sotto la testata (una casella per turno del giro, scritta sotto la
// casella accesa), l'animazione del mazzo dei turni mischiato a fine giro e la scelta del giocatore per la carta 1/2 o
// 3/4 (finestra al centro o ridotta nel pulsante in basso).
// Livello 3 (ui/componenti/). Dipende da: regole/ (mazzo-turni, turno-nemesi: letture), stato/partita.ts (lettura e
// azione scegliGiocatoreCoppia), ui/ base (testi, pagina, dom, ridisegno), ui/componenti (animazioni, componenti,
// dialoghi, testata). Usato da: finestra del mazzo dei turni, schermate dei turni, navigazione (creaBarraTurni, render).
import * as Nemesi from '../../regole/turno-nemesi.ts';
import { playerOf } from '../../regole/mazzo-turni.ts';
import { awaitingTurnCard, currentTurn, currentTurnCard, historyPlayer, isPairCard, pairOptions, partita,
  predictedPairPlayers, scegliGiocatoreCoppia, turnCardPlayer } from '../../stato/partita.ts';
import type { CartaTurno, Giocatore } from '../../tipi/partita.ts';
import { lockFor } from './animazioni.ts';
import { announce } from './dialoghi.ts';
import { headerPiles } from './testata.ts';
import { el, query } from '../dom.ts';
import { app, byId, mainEl, pulsantePrincipale, reducedMotion, ui } from '../pagina.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { T } from '../testi.ts';
import { needsPairChoice } from './componenti.ts';

export const SHUFFLE_FADE_MS = 320;

export const SHUFFLE_MERGE_MS = 760;

export function beginTrackShuffle(): void {
  ui.trackShuffle = true;
  turnTrack.classList.add('is-shuffling');
}

export function playTurnShuffle(fadeMs: number): void {
  beginTrackShuffle();
  const motion = !reducedMotion.matches && !!turnTrackBar.animate;
  const fade = motion ? fadeMs : 0;
  const merge = motion ? SHUFFLE_MERGE_MS : 0;
  lockFor(fade + merge + 40, () => {
    ui.trackShuffle = false;
    turnTrack.classList.remove('is-shuffling');
    pulsantePrincipale.focus({ preventScroll: true });
    announce(T.drawFirstTurnCard);
  });
  richiediRidisegno();
  if (!motion) return;
  setTimeout(() => {
    const bar = turnTrackBar.getBoundingClientRect();
    const cx = bar.left + bar.width / 2;
    [...turnTrackBar.children].forEach(seg => {
      const r = seg.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2);
      seg.animate([
        { transform: 'none' },
        { transform: `translateX(${dx}px)`, offset: 0.3 },
        { transform: `translateX(${dx}px)`, offset: 0.62 },
        { transform: 'none' }
      ], { duration: merge, easing: 'ease-in-out' });
    });
  }, fade);
}

// Una casella della barra dei turni: carta, giocatore, turno passato / in corso / futuro noto
interface Casella {
  kind: CartaTurno | null;
  player?: string | null;
  past?: boolean;
  current?: boolean;
  known?: boolean;
}

// Barra della fase sotto la testata: una casella per turno del giro, nell'ordine (prima la storia, poi le carte del
// mazzo dei turni). La casella del turno in corso è accesa (8px, colore pieno e bagliore), quelle dei turni già giocati
// in questo giro sono linee sottili colorate e velate, quelle ancora da estrarre linee grigie.
// Colori: giocatori 1-4 verde, giallo, blu, viola; wild grigio chiaro; nemesi rosso scuro (eventi.css).
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
  // come turno futuro, quindi le caselle possono essere più di 6 (si stringono: eventi.css --ae-seg-n)
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
    // Carta 1/2 o 3/4: sfumatura dai due colori (eventi.css ::after), che svanisce quando si sceglie il giocatore
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
    turnTrack.setAttribute('aria-label', T.trackWaiting);
    renderPairChoice();
    return;
  }
  // Scritta sotto la casella accesa, centrata sotto di lei (anche alle due estremità)
  const drawStep = partita.resolving && (Nemesi.isDrawStep(partita) || partita.newIndex >= 0);
  const curKind = currentTurnCard();
  // Carta 1/2 o 3/4 senza giocatore: la scelta è nella finestra al centro (renderPairChoice); sotto la casella "x / y"
  const choosing = !partita.resolving && isPairCard(curKind) && !turnCardPlayer(curKind);
  turnTrackLabel.classList.toggle('is-choice', choosing);
  if (choosing) {
    turnTrackLabel.replaceChildren(pairOptions(curKind).map(p => p.slice(1)).join(' / '));
  } else if (partita.resolving) {
    turnTrackLabel.replaceChildren(T.trackNemesisName, el('span', 'ae-turn-label-dot'),
      drawStep ? T.trackDraw : T.trackResolve);
  } else {
    // Turno di un giocatore: "Giocatore N" nel colore del giocatore; wild: "Wild · N" ("Wild" bianco e il numero del
    // giocatore nel suo colore)
    const kind = currentTurnCard();
    const owner = turnCardPlayer(kind);
    if (kind === 'wild' && owner) {
      turnTrackLabel.replaceChildren(el('span', 'ae-turn-label-wild', T.trackWildName), el('span', 'ae-turn-label-dot'),
        owner.slice(1));
    } else {
      turnTrackLabel.replaceChildren(kind === 'wild' ? T.trackWildName
        : owner ? T.trackPlayerName(Number(owner.slice(1))) : '');
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
  // Centro della casella accesa (eventi.css .ae-turn-seg.is-current): accesa = 122px
  turnTrackLabel.style.left = cur >= 0 ? `calc(${cur} * (${narrow} + 6px) + 61px)` : '0%';
  turnTrack.setAttribute('aria-label', [trackName(drawStep), cur >= 0 ? T.trackPosition(cur + 1, total) : '', T.turnDeckHint]
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
  richiediRidisegno();
  announce(turnTrack.getAttribute('aria-label'));
  pulsantePrincipale.focus({ preventScroll: true });
  turnTrack.classList.remove('is-changed');
  void turnTrack.offsetWidth;
  turnTrack.classList.add('is-changed');
}

// Nome del turno in corso per i lettori di schermo
function trackName(drawStep: boolean): string {
  const card = currentTurnCard();
  if (awaitingTurnCard()) return T.trackWaiting;
  if (partita.resolving) return drawStep ? T.trackNemesisDraw : T.trackNemesisResolve;
  if (card === 'wild') return partita.turnOrder.wild ? T.trackWildOf(partita.turnOrder.wild) : T.trackWild;
  if (isPairCard(card)) {
    const player = turnCardPlayer(card);
    if (player) return T.trackPlayer(Number(player.slice(1)));
    const [a, b] = pairOptions(card);
    return T.trackPairChoose(Number(a.slice(1)), Number(b.slice(1)));
  }
  return card && card !== 'nemesis' ? T.trackPlayer(Number(card.slice(1))) : '';
}

// Finestra "Chi gioca questo turno?": esce una carta 1/2 o 3/4 senza giocatore. Al centro due carte grandi come quelle
// della fascia piccola (bordo nero, colore del giocatore scurito, numero nero al centro). Finché non si sceglie è tutto
// disattivato (inert) tranne la scelta e il pulsante Menu; la testata resta sopra l'oscuramento. Elementi creati in
// avvio()
export let pairChoice: HTMLDivElement;

export let pairChoicePanel: HTMLDivElement;

export let pairChoiceTitle: HTMLHeadingElement;

export let pairChoiceCards: HTMLDivElement;

// La finestra scende e si trasforma nel pulsante diviso in due. Una copia della finestra parte dalla sua posizione e si
// stringe/allunga fino al pulsante, sfumando; il pulsante compare mentre lei arriva
export const PAIR_DOCK_MS = 420;

export function animatePairToDock(from: DOMRect): void {
  const to = pairDock.getBoundingClientRect();
  if (reducedMotion.matches || !document.body.animate || !from.width || !to.width) return;
  const ghost = pairChoicePanel.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) return;
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('ae-pair-ghost');
  Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const anim = ghost.animate([
    { transform: 'none', opacity: 1 },
    { transform: `translate(${dx * .7}px, ${dy * .7}px) scale(${1 + (sx - 1) * .7}, ${1 + (sy - 1) * .7})`, opacity: .9, offset: .7 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 }
  ], { duration: PAIR_DOCK_MS, easing: 'cubic-bezier(.4, 0, .2, 1)' });
  anim.onfinish = () => ghost.remove();
  setTimeout(() => ghost.remove(), PAIR_DOCK_MS + 200);
  pairDock.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 0, transform: 'scale(.96)', offset: .55 },
    { opacity: 1, transform: 'none' }], { duration: PAIR_DOCK_MS, easing: 'ease-out' });
}

// Pulsante diviso in due ("Giocatore x | Giocatore y") con la scelta ridotta, creato in avvio()
export let pairDock: HTMLDivElement;

// Carta 1/2 o 3/4 in attesa di scelta (giro e posizione): la finestra ridotta vale solo per questa carta
export function pairChoiceKey(): string {
  return partita.turnOrder.round + ':' + ((partita.turnOrder.history || []).length - 1);
}

export function pairButtons(kind: CartaTurno | null, cls: string, label: (p: Giocatore) => string): HTMLButtonElement[] {
  return pairOptions(kind).map(p => {
    const b = el('button', cls, label(p));
    b.type = 'button';
    b.dataset.kind = p;
    b.setAttribute('aria-label', T.pairChoiceLabel(Number(p.slice(1))));
    b.addEventListener('click', () => chooseTurnPlayer(p));
    return b;
  });
}

export function renderPairChoice(): void {
  const pending = needsPairChoice();
  const minimized = pending && ui.pairMinimized === pairChoiceKey();
  const show = pending && !minimized;
  const wasShown = !pairChoice.hidden;
  pairChoice.hidden = !show;
  app.classList.toggle('is-pair-choice', show);
  // Scelta ridotta nel pulsante in basso: niente carte e niente pesca dal mazzo (cardControls, openCardDialog, mazzo)
  app.classList.toggle('is-pair-pending', minimized);
  mainEl.inert = show;
  const dock = query(document, '.ae-dock', HTMLElement);
  if (dock) dock.inert = show;
  headerPiles.inert = show;
  // Pulsante grande: sparisce con la finestra aperta; con la finestra ridotta lo sostituiscono i due giocatori
  // (con la finestra aperta resta il suo spazio, invisibile, così le carte sotto non cambiano misura)
  pulsantePrincipale.style.visibility = show ? 'hidden' : '';
  if (minimized) pulsantePrincipale.hidden = true;
  pairDock.hidden = !minimized;
  // (con la scelta in sospeso la carta in corso è una carta 1/2 o 3/4: String la scrive come prima nel dataset)
  const curCard = currentTurnCard();
  if (minimized && pairDock.dataset.kind !== curCard) {
    pairDock.dataset.kind = String(curCard);
    pairDock.replaceChildren(...pairButtons(curCard, 'ae-button ae-pair-half',
      p => T.trackPlayerName(Number(p.slice(1)))));
  }
  if (!minimized) delete pairDock.dataset.kind;
  if (!show) return;
  // Misura delle carte della fascia piccola (52px sul telefono)
  const small = document.querySelector('.ae-compact-rail .ae-queue-item');
  const w = small && small.getBoundingClientRect().width ? small.getBoundingClientRect().width : 52;
  pairChoice.style.setProperty('--ae-pick-w', w + 'px');
  const kind = currentTurnCard();
  if (pairChoiceCards.dataset.kind !== kind) {
    pairChoiceCards.dataset.kind = String(kind);
    pairChoiceCards.replaceChildren(...pairButtons(kind, 'ae-pair-pick', p => p.slice(1)));
  }
  if (!wasShown) {
    announce(T.pairChoiceTitle);
    const first = pairChoiceCards.firstChild;
    if (first instanceof HTMLElement) first.focus({ preventScroll: true });
    else throw new TypeError('scelta del giocatore senza pulsanti');
  }
}

// Prepara la barra dei turni sotto la testata (zona 2 della schermata "partita", #fascia-turno in index.html);
// toccandola si apre la finestra del mazzo dei turni (apri: la funzione che la apre, passata dal coordinatore, perché la
// finestra sta sopra la barra)
export function creaBarraTurni(apri: () => void): void {
  // Toccando la barra si apre il mazzo dei turni (rivela, rimescola dagli scarti, ordina)
  turnTrack = byId('fascia-turno', HTMLDivElement);
  turnTrack.addEventListener('click', () => apri());
  turnTrack.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(); } });
  turnTrackBar = el('div', 'ae-turn-track-bar');
  turnTrackLabels = el('div', 'ae-turn-labels');
  turnTrackLabel = el('span', 'ae-turn-label');
  turnTrackLabels.appendChild(turnTrackLabel);
  turnTrack.append(turnTrackBar, turnTrackLabels);
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  pairChoice = el('div', 'ae-pair-choice');
  pairChoice.hidden = true;
  pairChoicePanel = el('div', 'ae-pair-choice-panel');
  pairChoicePanel.setAttribute('role', 'dialog');
  pairChoicePanel.setAttribute('aria-labelledby', 'ae-pair-choice-title');
  pairChoiceTitle = el('h2', 'ae-pair-choice-title', T.pairChoiceTitle);
  pairChoiceTitle.id = 'ae-pair-choice-title';
  pairChoiceCards = el('div', 'ae-pair-choice-cards');
  pairChoicePanel.append(pairChoiceTitle, pairChoiceCards);
  pairChoice.appendChild(pairChoicePanel);
  app.appendChild(pairChoice);

  // Toccando fuori dalla finestra la scelta scende nel pulsante grande in basso, diviso in due
  // ("Giocatore x | Giocatore y"); l'app si può usare, ma non si toccano le carte e non si pesca dal mazzo
  pairChoice.addEventListener('click', e => {
    if (e.target !== pairChoice || !needsPairChoice() || ui.isTransitioning) return;
    const from = pairChoicePanel.getBoundingClientRect();
    ui.pairMinimized = pairChoiceKey();
    richiediRidisegno();
    animatePairToDock(from);
    const first = pairDock.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  });

  // Nella zona 7, sotto la riga del pulsante principale (index.html)
  pairDock = byId('scelta-coppia', HTMLDivElement);
  pairDock.setAttribute('aria-label', T.pairChoiceTitle);
}
