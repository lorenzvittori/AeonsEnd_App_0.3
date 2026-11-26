// ui/schermate/turno-giocatori.ts: il turno giocatori nella schermata "partita": carte grandi della coda in fila (zona 5)
// ognuna con i suoi comandi sotto (nello spazio riservato della zona 6), fascia piccola nel turno giocatori (zona 3), "Annulla modifiche" e
// l'azione del pulsante principale (onPulsanteTurnoGiocatori: "Fine turno", "Pesca carta turno", "Salva modifiche"), passaggio
// animato dal turno nemesi (toPlayersTurn). Il pulsante lo disegna ui/componenti/pulsante-principale.ts. L'inizio del
// turno nemesi a schermo lo chiede la finestra Pesca nuovo turno (ui/componenti/pesca-turno.ts) alla chiusura.
// Livello 5 (ui/schermate/). Dipende da: stato/ (partita, catalogo), ui/ base (testi, pagina, dom, ridisegno),
// ui/componenti (animazioni, barra-turni, componenti, dialoghi, misure, testata), ui/finestre/scheda-carta.ts.
// Usato da: navigazione (render, agganci, avvio).

import { T } from '../testi.ts';
import { awaitingTurnCard, entryByUid, fineTurnoGiocatore, hpCap, hpUnset, partita, salvaModifiche,
  turnRoundOver } from '../../stato/partita.ts';
import { displayEntry, draftHp, draftOf, hasHp, needsPairChoice, queueItem,
  setDraft } from '../componenti/componenti.ts';
import { button } from '../componenti/dialoghi.ts';
import { flyToDiscard } from '../componenti/testata.ts';
import type { VoceInGioco } from '../../tipi/partita.ts';
import { annullaModificheBtn, mainEl, pulsantePrincipale, queueEmpty, queueList, queueViewport, rail, reducedMotion,
  ui } from '../pagina.ts';
import type { AncoraCoda } from '../pagina.ts';
import { ENTER_MS, fastScrollTo, MORPH_MS, scrollItemInto, scrollJobs, trackDrag } from '../componenti/animazioni.ts';
import { el, query, queryAll } from '../dom.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { playTurnShuffle, SHUFFLE_FADE_MS } from '../componenti/barra-turni.ts';
import { openDrawTurn } from '../componenti/pesca-turno.ts';
import { altezzaArea, sharedCardWidth, sizeColumn, spazioVicine } from '../componenti/misure.ts';
import { openCardDialog } from '../finestre/scheda-carta.ts';

// Turno giocatori: in alto la fascia piccola con tutta la coda (#rail, la stessa del turno nemesi), sotto le carte
// grandi, una e mezza alla volta. Toccare una carta della fascia porta lì le carte grandi; la carta più al centro è
// quella evidenziata.
export let queueRailFrame = 0;

// Carta scelta con un tocco (fascia piccola o carta grande non al centro): finché le carte grandi scorrono fino a lei,
// l'evidenziazione resta su di lei (come il carosello del turno nemesi); con il dito segue lo scorrimento
let queueTargetUid: number | null = null;

export function scrollQueueTo(item: HTMLElement, uid: number): void {
  queueTargetUid = uid;
  const cRect = queueViewport.getBoundingClientRect();
  const iRect = item.getBoundingClientRect();
  const left = iRect.left - cRect.left + queueViewport.scrollLeft + iRect.width / 2 - queueViewport.clientWidth / 2;
  fastScrollTo(queueViewport, left);
}

export function centredQueueUid(): number | null {
  const cRect = queueViewport.getBoundingClientRect();
  const middle = cRect.left + cRect.width / 2;
  let best: number | null = null;
  let bestDist = Infinity;
  queryAll(queueList, '.ae-queue-item', HTMLElement).forEach(item => {
    const r = item.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - middle);
    if (d < bestDist) { bestDist = d; best = Number(item.dataset.uid); }
  });
  return best;
}

// La carta al centro: la sua carta grande è quella con i comandi visibili (is-centred) e la sua carta piccola nella fascia
// è quella evidenziata
export function markQueueRail(uid: number | null): void {
  queueList.querySelectorAll('.queue-slot').forEach(slot => {
    const item = query(slot, '.ae-queue-item', HTMLElement);
    slot.classList.toggle('is-centred', !!item && Number(item.dataset.uid) === uid);
  });
  queryAll(rail, '.ae-queue-item', HTMLElement).forEach(item => {
    const on = Number(item.dataset.uid) === uid;
    if (on) item.dataset.viewed = 'true'; else delete item.dataset.viewed;
    if (on) scrollItemInto(rail, item, 'nearest');
  });
}

// Comandi di una carta grande, sotto di lei (nello spazio riservato della zona 6, a --interattivi-distanza dalla carta):
//   minion: −5 −1 +1 (ogni tocco cambia la vita in bozza); a 0 il minion è ucciso con "Salva modifiche"
//   potere rimovibile (TO DISCARD): "Rimuovi · costo pagato"; gli altri poteri non hanno comandi
// Ogni carta ha i suoi, che scorrono con lei; si vedono solo quelli della carta al centro (.queue-slot.is-centred, CSS).
export function cardControls(entry: VoceInGioco): HTMLDivElement {
  const box = el('div', 'queue-controls');
  // Per i lettori di schermo: di quale carta sono i comandi
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', T.comandiCarta(entry.data.name, hasHp(entry)));
  const uid = entry.uid;
  const ctl = (label: string, variant: string, key: string, aria: string | null, handler: () => void) => {
    const b = button(label, variant, e => {
      e.stopPropagation();
      // Anche con la scelta del giocatore 1/2 o 3/4 in sospeso non si toccano le carte
      if (partita.resolving || ui.isTransitioning || queueViewport.dataset.dragged === '1' || needsPairChoice()) return;
      handler();
    });
    b.dataset.uid = String(uid);
    b.dataset.ctl = key;
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  };
  const refocus = (key: string) => {
    const target = query(queueList, `.queue-controls [data-uid="${uid}"][data-ctl="${key}"]`, HTMLElement)
      || query(queueList, `.queue-controls [data-uid="${uid}"]`, HTMLElement);
    if (target) target.focus({ preventScroll: true });
  };
  // (Number: vita e tetto come nei confronti di JavaScript, null vale 0)
  if (hasHp(entry) && Number(entry.hp) <= 0 && !hpUnset(entry)) {
    // Minion ucciso (vita 0 salvata): grigio, va negli scarti al prossimo turno nemesi; si torna indietro con Undo
    box.appendChild(el('p', 'queue-note is-paid', T.killedNote));
  } else if (hasHp(entry) && hpUnset(entry)) {
    // Minion con vita "?": al posto di −5 / −1 / +1 un pulsante che apre la scheda della carta (vita da impostare)
    box.appendChild(ctl(T.ctaSetHp, 'primary', 'sethp', T.setHpOf(entry.data.name), () => openCardDialog(entry)));
  } else if (hasHp(entry)) {
    // I tocchi cambiano una bozza, "Salva" la conferma (un passo di undo); a 0 con Salva il minion è ucciso.
    // +1 si può usare solo per rimettere vita tolta in questo turno (fino alla vita di inizio turno): altrimenti è oscurato
    const shown = Number(draftHp(entry));
    const cap = Number(hpCap(entry, false));
    [-5, -1, 1].forEach(step => {
      const key = String(step);
      // −5 con il contorno rosso, diverso da −1 e +1: è il tocco sbagliato più costoso
      const b = ctl(step > 0 ? '+' + step : '−' + Math.abs(step), step === -5 ? 'danger' : 'secondary', key,
        T.lifeStepAriaOf(step, entry.data.name), () => {
          const value = Math.min(cap, Math.max(0, Number(draftHp(entry)) + step));
          if (value === draftHp(entry)) return;
          setDraft(entry, { hp: value });
          richiediRidisegno();
          refocus(key);
        });
      if ((step > 0 && shown >= cap) || (step < 0 && shown <= 0)) { b.disabled = true; b.classList.add('is-dimmed'); }
      box.appendChild(b);
    });
  } else if (entry.data.type === 'Power' && entry.paid) {
    box.appendChild(el('p', 'queue-note is-paid', T.paidNote));
  } else if (entry.data.type === 'Power' && entry.data.removable !== false) {
    const d = draftOf(entry);
    if (d && d.paid) {
      box.appendChild(ctl(T.cancelPay, 'secondary', 'cancel', null, () => { setDraft(entry, { paid: false }); richiediRidisegno(); refocus('remove'); }));
    } else {
      box.appendChild(ctl(T.removePowerShort, 'danger', 'remove', T.removePower + ': ' + entry.data.name,
        () => { setDraft(entry, { paid: true }); richiediRidisegno(); refocus('cancel'); }));
    }
  } else if (entry.data.type === 'Power') {
    // Potere senza "TO DISCARD": nota piccola (con il simbolo di divieto) al posto del pulsante
    box.appendChild(el('p', 'queue-note is-locked', T.notRemovable));
  }
  return box;
}

// Carte grandi: alte quanto lo spazio disponibile, ma mai così larghe da nascondere del tutto la carta successiva
export function sizeQueue(): void {
  if (queueViewport.hidden) return;
  // I comandi stanno sotto ogni carta, nello spazio riservato della zona 6 (c'è sempre, anche nel turno nemesi): la zona 5
  // è alta uguale nei due turni e la carta ha la stessa misura e posizione (sharedCardWidth). L'area delle carte sporge
  // sulla zona 6 (padding-bottom, come il carosello): altezzaArea() la toglie
  sizeColumn(queueViewport);
  // Stessa regola del carosello del turno nemesi (sizeFocus): la carta riempie l'altezza, ai lati si vede un pezzo delle
  // vicine (stessa larghezza della carta)
  const peekRoom = partita.queue.length > 1 ? spazioVicine() : 0;
  const width = Math.max(100, sharedCardWidth(queueViewport.clientWidth, altezzaArea(queueViewport), peekRoom));
  queueViewport.style.setProperty('--ae-queue-card', width + 'px');
  // Margini ai lati: la prima e l'ultima carta si centrano come le altre
  const side = Math.max(0, (queueViewport.clientWidth - width) / 2) + 'px';
  queueViewport.style.paddingLeft = side;
  queueViewport.style.paddingRight = side;
  queueViewport.style.scrollPaddingInline = side;
}

// Etichetta "HP: −x" della vita in bozza su una carta (sulla sua immagine)
function addHpTag(card: HTMLElement, className: string, change: number): void {
  const tag = el('span', className + ' ' + (change < 0 ? 'is-loss' : 'is-gain'), T.hpTurnTag(change));
  tag.setAttribute('aria-hidden', 'true');
  const art = card.querySelector('.ae-card-art');
  if (art) art.appendChild(tag);
}

export function renderQueue(): void {
  const previous = queueViewport.scrollLeft;
  const previousTop = queueViewport.scrollTop;
  const railEl = rail;
  const railScroll = railEl.scrollLeft;
  railEl.replaceChildren(...partita.queue.map((entry, i) => {
    const item = queueItem(displayEntry(entry), { compact: true, index: i, total: partita.queue.length });
    // Vita del minion in modifica: "HP: −x" anche sulla carta piccola, al centro
    const d = draftOf(entry);
    if (d && d.hp !== undefined) addHpTag(item, 'queue-hp-tag rail-hp-tag', d.hp - Number(entry.hp));
    return item;
  }));
  railEl.scrollLeft = railScroll;
  railEl.classList.remove('is-bloccata');
  // Senza carte la fascia resta al suo posto, vuota e invisibile (partita.css): le vite sotto non si spostano
  railEl.classList.toggle('is-vuota', partita.queue.length === 0);
  queueList.replaceChildren(...partita.queue.map((entry, i) => {
    // Ogni carta grande, con i suoi comandi sotto (si vedono solo per la carta al centro)
    const slot = el('div', 'queue-slot');
    slot.setAttribute('role', 'listitem');
    const card = queueItem(displayEntry(entry), { full: true, index: i, total: partita.queue.length, lazy: i > 3 });
    card.removeAttribute('role');
    const d = draftOf(entry);
    // Danno in bozza (non ancora salvato), in alto a destra sulla carta: sparisce con "Salva"
    if (d && d.hp !== undefined) addHpTag(card, 'queue-hp-tag', d.hp - Number(entry.hp));
    slot.append(card);
    const controls = cardControls(entry);
    if (controls.childElementCount) slot.append(controls);
    // Le modifiche si salvano tutte insieme con "Salva modifiche" (il pulsante principale)
    return slot;
  }));
  queueEmpty.hidden = partita.queue.length > 0;
  // Suggerimento solo prima del primo turno nemesi
  const emptyHint = queueEmpty.querySelector('p');
  if (emptyHint) {
    emptyHint.hidden = partita.turn > 0;
    emptyHint.textContent = awaitingTurnCard() ? T.emptyHintStart : T.emptyHintWait;
  }
  sizeQueue();

  const anchor = ui.queueAnchor;
  ui.queueAnchor = null;
  if (partita.queue.length === 0) {
    queueViewport.scrollLeft = 0;
    queueViewport.scrollTop = 0;
  } else if (anchor) {
    scrollToCard(anchor.uid, anchor.align);
  } else {
    queueViewport.scrollLeft = previous;
    queueViewport.scrollTop = previousTop;
  }
  markQueueRail(centredQueueUid());
}

// Allinea la coda su una carta: 'anchor' (ANCHOR_RATIO), 'center', 'nearest'
export function scrollToCard(uid: number, align: AncoraCoda['align'] = 'nearest'): void {
  const item = query(queueList, `[data-uid="${uid}"]`, HTMLElement);
  if (!item) return;
  scrollItemInto(queueViewport, item, align);
}

// "Salva modifiche" (pulsante principale del turno giocatori): tutte le bozze diventano definitive in un solo passo di
// undo; le carte grigie (potere con costo pagato, minion a 0) vanno negli scarti volando verso la pila in alto
export function saveAllDrafts(): void {
  if (partita.resolving || ui.isTransitioning || !ui.drafts.size) return;
  const drafts = new Map(ui.drafts);
  ui.drafts.clear();
  // Statistiche maghi: tutto va al giocatore del turno in corso; la prima impostazione della vita di un minion a vita
  // variabile non è danno (stato/partita.ts, salvaModifiche)
  const gone = salvaModifiche(drafts);
  // Le carte sono ancora nella pagina (non ridisegnata): partono da lì
  flyToDiscard(gone.map(e => queueList.querySelector(`.ae-queue-item[data-uid="${e.uid}"] .ae-card-art`)));
  richiediRidisegno();
  pulsantePrincipale.focus({ preventScroll: true });
}

// Tocco sul pulsante principale nel turno giocatori ("Fine turno", "Pesca carta turno", "Salva modifiche")
export function onPulsanteTurnoGiocatori(): void {
  if (partita.resolving || ui.isTransitioning || !catalogo.deckSetup) return;
  // Durante "Crea mazzo" al posto del pulsante c'è il cursore (deckSlider)
  if (ui.deckBuilding) return;
  // Con modifiche non salvate il pulsante è "Salva modifiche"
  if (ui.drafts.size) {
    saveAllDrafts();
    return;
  }
  // Carta 1/2 o 3/4 senza giocatore: si sceglie nella finestra
  if (needsPairChoice()) return;
  // "Pesca carta turno" (turno da pescare, per esempio a inizio partita o dopo aver chiuso la finestra): la riapre
  if (awaitingTurnCard()) {
    openDrawTurn();
    return;
  }
  // "Fine turno": il turno finisce (a fine giro il mazzo dei turni si mescola) e lo sfondo va al centro; si pesca il turno
  // dopo nella finestra "Pesca nuovo turno"
  const roundEnding = turnRoundOver();
  fineTurnoGiocatore();
  richiediRidisegno();
  if (roundEnding) playTurnShuffle(SHUFFLE_FADE_MS);
  openDrawTurn();
}

// Dal turno nemesi al turno giocatori: la carta grande del turno nemesi si trasforma in quella della coda, le altre
// entrano da sinistra; la fascia piccola resta dov'era
export function toPlayersTurn(morphUid: number | null, fromNode?: HTMLElement | null): void {
  const railScroll = rail.scrollLeft;
  const fromRect = fromNode && fromNode.getBoundingClientRect().width ? fromNode.getBoundingClientRect() : null;
  // Riga vita/token sopra la carta grande del turno nemesi: anche lei si sposta nel box del turno giocatori
  const fromSlide = fromNode && fromNode.closest('.ae-focus-slide');
  const fromStatusEl = fromSlide && fromSlide.querySelector('.ae-focus-status > *');
  const fromStatus = fromStatusEl && fromStatusEl.parentElement ? fromStatusEl.parentElement.getBoundingClientRect() : null;
  const motion = !reducedMotion.matches && !!document.body.animate;
  // Lo sfondo non sfuma: è un'immagine sola che scorre da destra a sinistra (base.css .ae-shell); le zone non fanno la
  // dissolvenza (partita.css, is-from-nemesis: la toglie il coordinatore entrando nel turno nemesi)
  mainEl.classList.add('is-from-nemesis');
  richiediRidisegno();
  rail.scrollLeft = railScroll;
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
      const parts = [...slot.querySelectorAll('.ae-new-tag, .queue-controls')]
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

// Disegno del turno giocatori (la coda delle carte in gioco)
export function disegnaTurnoGiocatori(): void {
  renderQueue();
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  trackDrag(queueViewport);

  // Fascia piccola (zona 3, la stessa del turno nemesi): nel turno giocatori un tocco porta lì le carte grandi
  rail.addEventListener('click', e => {
    if (partita.resolving) return;
    const target = e.target;
    const item = target instanceof Element ? target.closest('.ae-queue-item') : null;
    if (!(item instanceof HTMLElement) || rail.dataset.dragged === '1') return;
    const big = query(queueList, `[data-uid="${item.dataset.uid}"]`, HTMLElement);
    if (big) scrollQueueTo(big, Number(item.dataset.uid));
    markQueueRail(Number(item.dataset.uid));
  });
  queueViewport.addEventListener('scroll', () => {
    if (queueRailFrame) return;
    queueRailFrame = requestAnimationFrame(() => {
      queueRailFrame = 0;
      if (partita.resolving) return;
      // Scorrimento avviato dall'app ancora in corso (il dito lo interrompe): la carta scelta resta quella evidenziata
      markQueueRail(scrollJobs.has(queueViewport) && queueTargetUid !== null ? queueTargetUid : centredQueueUid());
    });
  }, { passive: true });

  // Turno giocatori con modifiche non salvate: "Annulla modifiche" accanto a "Salva modifiche" (stessa riga, zona 7)
  // toglie tutte le bozze (vita dei minion, costi pagati); non è un passo di undo, perché le bozze non sono ancora nella
  // partita
  annullaModificheBtn.textContent = T.cancelChanges;
  annullaModificheBtn.addEventListener('click', () => {
    if (partita.resolving || ui.isTransitioning || !ui.drafts.size) return;
    ui.drafts.clear();
    richiediRidisegno();
    pulsantePrincipale.focus({ preventScroll: true });
  });

  // Carte grandi del turno giocatori: una carta non al centro si porta al centro; si apre solo quella al centro
  queueList.addEventListener('click', e => {
    const target = e.target;
    const item = target instanceof Element ? target.closest('.ae-queue-item') : null;
    if (!(item instanceof HTMLElement) || queueViewport.dataset.dragged === '1') return;
    const uid = Number(item.dataset.uid);
    if (uid !== centredQueueUid()) {
      const slot = item.closest('.queue-slot');
      scrollQueueTo(slot instanceof HTMLElement ? slot : item, uid);
      markQueueRail(uid);
      return;
    }
    const entry = entryByUid(uid);
    if (entry) openCardDialog(entry);
  });
}
