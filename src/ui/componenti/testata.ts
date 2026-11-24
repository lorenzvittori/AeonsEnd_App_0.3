// ui/componenti/testata.ts: testata (mazzo nemesi e pila degli scarti in alto), voli delle carte verso gli scarti,
// passaggio animato dal turno nemesi al turno giocatori, Vittoria a mazzo vuoto.
// Dipende da: stato/partita.ts (lettura), ui/ (testi, pagina), ui/componenti (componenti, dialoghi, scarti,
// pesca-undo), ui/schermate (turno-giocatori, turno-nemesi, mazzo-turni, statistiche). Usato da: turno nemesi, turno
// giocatori, mazzo dei turni, crea mazzo, pesca-undo, test (resetVictoryKey).

import { I18N_IT } from '../testi.ts';
import { isVictory, partita } from '../../stato/partita.ts';
import { el, query, queryAll } from './componenti.ts';
import { modals } from './dialoghi.ts';
import { queueRail } from '../schermate/turno-giocatori.ts';
import { openDiscard } from './scarti.ts';
import { render } from '../schermate/turno-nemesi.ts';
import { needsPairChoice } from '../schermate/mazzo-turni.ts';
import { showVictory } from '../schermate/statistiche.ts';
import { openDeckPopover } from './pesca-undo.ts';
import { CARD_BACK, queueList, queueView, rail, reducedMotion, startLayer, ui, undoBtn } from '../pagina.ts';

// In alto a sinistra, uno accanto all'altro e uguali nei due turni: il mazzo nemesi (dorso con il numero di carte
// rimaste) e la pila degli scarti (ultima carta scartata con il numero; toccandola si apre). Creati qui (avvio).
export let headerPiles: HTMLDivElement;
export let dockDeck: HTMLDivElement;
export let dockDiscard: HTMLButtonElement;

export function pileContent(node: HTMLElement, imgSrc: string | null, count: number): void {
  node.classList.toggle('is-empty', !imgSrc);
  const img = node.querySelector('img');
  if (imgSrc) {
    const image = img || document.createElement('img');
    image.alt = '';
    if (image.getAttribute('src') !== imgSrc) image.src = imgSrc;
    if (!img) node.prepend(image);
  } else if (img) {
    img.remove();
  }
  let n: Element | null = node.querySelector('.ae-pile-count');
  if (!n) {
    n = el('span', 'ae-pile-count');
    n.setAttribute('aria-hidden', 'true');
    node.appendChild(n);
  }
  n.textContent = String(count);
}

// Le carte ancora in volo verso gli scarti non si contano finché non atterrano (ui.flyingDiscards)
export function renderDockPiles(): void {
  // Durante la creazione del mazzo il numero sale man mano che le carte arrivano (ui.deckShown)
  const deckCount = ui.deckShown !== null && ui.deckShown !== undefined ? ui.deckShown : partita.deck.length;
  pileContent(dockDeck, deckCount ? CARD_BACK : null, deckCount);
  dockDeck.setAttribute('aria-label', I18N_IT.deckLabel(partita.deck.length));
  dockDeck.setAttribute('aria-haspopup', 'true');
  const shown = Math.max(0, partita.discard.length - ui.flyingDiscards);
  const last = partita.discard[shown - 1];
  pileContent(dockDiscard, last ? encodeURI(last.thumb || last.image) : null, shown);
  dockDiscard.setAttribute('aria-label', I18N_IT.discardButtonLabel(partita.discard.length));
}

// Animazione dello scarto: una copia della carta si stacca (si alza e si inclina), vola in arco verso la pila degli
// scarti in alto rimpicciolendosi, e atterra; la pila fa un piccolo rimbalzo con un lampo dorato e il numero sale.
// Più carte partono una dopo l'altra. Va chiamata prima di ridisegnare (le carte devono essere ancora nella pagina).
export const FLY_MS = 720;

export const FLY_STAGGER = 120;

export function flyToDiscard(nodes: readonly (Element | null)[]): void {
  const target = dockDiscard.getBoundingClientRect();
  nodes.filter((n): n is HTMLElement => n instanceof HTMLElement).forEach((node, i) => {
    const r = node.getBoundingClientRect();
    if (!r.width || !target.width) return;
    const ghost = node.cloneNode(true);
    if (!(ghost instanceof HTMLElement)) return;
    ui.flyingDiscards++;
    ghost.classList.add('ae-fly-ghost');
    ghost.removeAttribute('id');
    Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(ghost);
    const dx = target.left + target.width / 2 - (r.left + r.width / 2);
    const dy = target.top + target.height / 2 - (r.top + r.height / 2);
    const s = target.width / r.width;
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      ghost.remove();
      ui.flyingDiscards = Math.max(0, ui.flyingDiscards - 1);
      renderDockPiles();
      dockDiscard.classList.remove('is-bump');
      void dockDiscard.offsetWidth;
      dockDiscard.classList.add('is-bump');
    };
    const delay = i * FLY_STAGGER;
    if (ghost.animate && !reducedMotion.matches) {
      const anim = ghost.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.04}px, ${-28}px) rotate(-5deg) scale(1.05)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.45 - 60}px) rotate(-16deg) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${s})`, opacity: 0.9, offset: 1 }
      ], { duration: FLY_MS, delay, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'both' });
      anim.onfinish = land;
      setTimeout(land, FLY_MS + delay + 200);
    } else {
      setTimeout(land, delay + 100);
    }
  });
}

// Dal turno nemesi al turno giocatori senza "sparisci e ricompari":
//   - la vista del turno giocatori non fa la dissolvenza (classe is-from-nemesis);
//   - la fascia piccola resta ferma (stesso scorrimento della fascia del turno nemesi);
//   - lo sfondo scorre di nuovo verso il lato sinistro (maga);
//   - la carta appena messa in gioco passa dalla sua misura grande a quella del turno giocatori (FLIP);
//   - le altre carte della coda entrano da sinistra (ENTER_MS); box vita/token e comandi compaiono con una dissolvenza.
// Va chiamata al posto di render(): misura prima e dopo il disegno.
export const MORPH_MS = 380;

// Entrata da sinistra delle altre carte della coda nel turno giocatori
export const ENTER_MS = 320;

// Durata dello scorrimento dello sfondo tra i due turni (uguale alla transizione di .ae-shell in base.css)
export const BG_SLIDE_MS = 800;

export function toPlayersTurn(morphUid: number | null, fromNode?: HTMLElement | null): void {
  const railScroll = rail.scrollLeft;
  const fromRect = fromNode && fromNode.getBoundingClientRect().width ? fromNode.getBoundingClientRect() : null;
  // Riga vita/token sopra la carta grande del turno nemesi: anche lei si sposta nel box del turno giocatori
  const fromSlide = fromNode && fromNode.closest('.ae-focus-slide');
  const fromStatusEl = fromSlide && fromSlide.querySelector('.ae-focus-status > *');
  const fromStatus = fromStatusEl && fromStatusEl.parentElement ? fromStatusEl.parentElement.getBoundingClientRect() : null;
  const motion = !reducedMotion.matches && !!document.body.animate;
  // Lo sfondo non sfuma: è un'immagine sola che scorre da destra a sinistra (base.css .ae-shell)
  queueView.classList.add('is-from-nemesis');
  render();
  if (queueRail) queueRail.scrollLeft = railScroll;
  if (!motion) return;
  const art = morphUid !== null ? query(queueList, `.queue-slot .ae-queue-item[data-uid="${morphUid}"] .ae-card-art`, HTMLElement) : null;
  const toRect = art && art.getBoundingClientRect();
  if (art && fromRect && toRect && toRect.width) {
    const dx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2);
    const dy = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2);
    const s = fromRect.width / toRect.width;
    art.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
      { transform: 'none' }
    ], { duration: MORPH_MS, easing: 'cubic-bezier(.3, 0, .2, 1)' });
  }
  // Box vita/token della stessa carta: scivola dalla posizione del turno nemesi a quella nuova (stessa misura)
  const badge = art && art.parentElement ? art.parentElement.querySelector('.ae-status-badge:not(.ae-status-badge--empty)') : null;
  const badgeRect = badge && badge.getBoundingClientRect();
  if (badge && fromStatus && badgeRect && badgeRect.width) {
    const bx = fromStatus.left + fromStatus.width / 2 - (badgeRect.left + badgeRect.width / 2);
    const by = fromStatus.top + fromStatus.height / 2 - (badgeRect.top + badgeRect.height / 2);
    badge.animate([{ transform: `translate(${bx}px, ${by}px)` }, { transform: 'none' }],
      { duration: MORPH_MS, easing: 'cubic-bezier(.3, 0, .2, 1)' });
  }
  // A metà della trasformazione: le altre carte della coda entrano da sinistra; comandi, NUOVA (e il box, se non
  // scivola) della carta che si trasforma compaiono con una breve dissolvenza
  const delay = art ? MORPH_MS / 2 : 0;
  queueAll(queueList, '.queue-slot').forEach(slot => {
    if (art && slot.contains(art)) {
      const parts = [...slot.querySelectorAll('.queue-controls, .ae-new-tag')]
        .concat(badge && fromStatus ? [] : [...slot.querySelectorAll('.ae-status-badge')]);
      parts.forEach(node => node.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: 220, delay, easing: 'ease-out', fill: 'backwards' }));
      return;
    }
    slot.animate([{ opacity: 0, transform: `translateX(${-slot.offsetWidth}px)` }, { opacity: 1, transform: 'none' }],
      { duration: ENTER_MS, delay, easing: 'cubic-bezier(.2, 0, .2, 1)', fill: 'backwards' });
  });
}

// Elementi HTML di un selettore (le carte della coda sono tutte elementi HTML)
function queueAll(root: ParentNode, selector: string): HTMLElement[] {
  return queryAll(root, selector, HTMLElement);
}

// Finestra "Vittoria" quando la condizione si avvera nel turno giocatori. Chiusa una volta, non si ripropone finché lo
// stato non cambia (per esempio con Undo si torna indietro e la condizione non vale più): victoryKey è la partita
// (turno, scarti, coda) per cui è già stata mostrata. Stato dell'interfaccia, non della partita
let victoryKey = '';

// Una partita nuova (scenario della Modalità test): la Vittoria si può mostrare di nuovo
export function resetVictoryKey(): void {
  victoryKey = '';
}

export function checkVictory(): void {
  if (partita.resolving || !isVictory()) { victoryKey = ''; return; }
  const key = partita.turn + ':' + partita.discard.length + ':' + partita.queue.length;
  if (victoryKey === key || modals.length || !startLayer.hidden) return;
  victoryKey = key;
  setTimeout(() => {
    if (partita.resolving || !isVictory() || modals.length) return;
    showVictory();
  }, reducedMotion.matches ? 0 : MORPH_MS + 100);
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  headerPiles = el('div', 'ae-header-piles');
  dockDeck = el('div', 'ae-pile ae-pile--deck');
  dockDiscard = el('button', 'ae-pile ae-pile--discard');
  dockDiscard.type = 'button';
  dockDiscard.addEventListener('click', () => { if (!ui.isTransitioning && !ui.deckBuilding) openDiscard(); });

  // Tocco sul mazzo: compare il pulsante "Pesca carta" (per gli effetti che fanno pescare o guardare la carta in cima);
  // non con la scelta del giocatore 1/2 o 3/4 in sospeso
  dockDeck.setAttribute('role', 'button');
  dockDeck.tabIndex = 0;
  dockDeck.addEventListener('click', () => {
    if (!ui.isTransitioning && !modals.length && !ui.deckBuilding && !needsPairChoice()) openDeckPopover();
  });
  dockDeck.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dockDeck.click(); } });

  headerPiles.append(dockDeck, dockDiscard);
  undoBtn.before(headerPiles);
  undoBtn.hidden = true;
}
