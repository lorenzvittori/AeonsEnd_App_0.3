// ui/schermate/turno-nemesi.ts: la schermata del turno nemesi (VistaRisoluzione): fascia, carosello delle carte grandi,
// carta pescata che si gira, pulsante principale (risolvi, pesca), carta da pescare che arriva dal mazzo. La fine del
// turno nemesi a schermo la chiede con l'aggancio passaAlTurnoGiocatori.
// Livello 5 (ui/schermate/). Dipende da: regole/turno-nemesi.ts, stato/partita.ts (lettura, pescaCarta, risolviCarta),
// ui/ base (testi, pagina, dom, ridisegno), ui/componenti (animazioni, barra-turni, componenti, dialoghi, misure,
// testata), ui/finestre/scheda-carta.ts. Usato da: navigazione (render, agganci, avvio).

import * as Nemesi from '../../regole/turno-nemesi.ts';
import { I18N_IT } from '../testi.ts';
import { awaitingTurnCard, entryByUid, hpUnset, partita, pescaCarta, risolviCarta,
  turnRoundOver } from '../../stato/partita.ts';
import { cardArt, hasHp, nextCardItem, nextSlotItem, placeholderArt, queueItem, statusText,
  tokenIcons } from '../componenti/componenti.ts';
import { announce, button, loadImage } from '../componenti/dialoghi.ts';
import { dockDeck, FLY_MS, flyToDiscard } from '../componenti/testata.ts';
import type { VoceInGioco } from '../../tipi/partita.ts';
import type { CartaPescata } from '../../regole/turno-nemesi.ts';
import { app, backBtn, CARD_BACK, CARD_RATIO, DRAW_MS, DRAW_UID, duration, focusEl, nemesisBtn, rail, reducedMotion,
  resolveBtn, resolveHint, resolveView, ui } from '../pagina.ts';
import type { CartaDaGirare } from '../pagina.ts';
import { BG_SLIDE_MS, buzz, cancelFastScroll, ENTER_MS, FAST_SCROLL_MS, fastScrollTo, lockFor, MORPH_MS, scrollItemInto,
  shakeApp, trackDrag } from '../componenti/animazioni.ts';
import { el, icon, need, query } from '../dom.ts';
import { beginTrackShuffle, playTurnShuffle, SHUFFLE_FADE_MS } from '../componenti/barra-turni.ts';
import { PEEK_GAP, PEEK_VISIBLE, sharedCardWidth, sizeColumn, STATUS_H } from '../componenti/misure.ts';
import { openCardDialog } from '../finestre/scheda-carta.ts';
import { passaAlTurnoGiocatori, richiediRidisegno } from '../ridisegno.ts';

// --- VistaRisoluzione (turno nemesi) ---

export function activeEntry(): VoceInGioco | null {
  return partita.queue[partita.currentIndex] || null;
}

export function isDrawStep(): boolean {
  return Nemesi.isDrawStep(partita);
}

export function canDraw(): boolean {
  return Nemesi.canDraw(partita);
}

// Testo del pulsante per la carta da risolvere. Anche sull'ultima carta si va solo avanti: la pesca è un passo a parte,
// con il pulsante "Pesca".
export function actionText(entry: VoceInGioco, isNew: boolean): string {
  const { data, tokens } = entry;
  // Minion con vita "?": non si mette in gioco finché non si imposta la vita; il pulsante apre la sua scheda
  if (hpUnset(entry)) return I18N_IT.ctaSetHp;
  // Ultima carta del giro dei turni: "Metti in gioco · Mischia mazzo"
  if (isNew) return data.type === 'Attack' ? I18N_IT.ctaResolved
    : turnRoundOver() ? I18N_IT.ctaPutInPlayShuffle : I18N_IT.ctaPutInPlayEnd;
  // Potere: il token se ne va da solo; il pulsante dice solo cosa succede dopo (Number: null vale 0)
  if (data.type === 'Power') return Number(tokens) > 1 ? I18N_IT.ctaPowerNext : I18N_IT.ctaPowerLast;
  // Minion (resta in gioco) e attacco (va negli scarti)
  return I18N_IT.ctaResolved;
}

// Fascia del turno nemesi dentro .ae-rail-row (creata qui una volta sola) e classi della fase di pesca
export function renderResolveInfo(drawStep: boolean): void {
  if (!need(rail.parentElement, 'contenitore della fascia').classList.contains('ae-rail-row')) {
    const row = el('div', 'ae-rail-row');
    rail.before(row);
    row.appendChild(rail);
  }
  resolveView.classList.toggle('is-draw-phase', drawStep);
  // Lo sfondo della vista è sull'app intera (anche dietro al pulsante principale)
  app.classList.toggle('is-draw-phase', drawStep);
}

export function renderResolve(): void {
  const drawStep = isDrawStep();
  renderResolveInfo(drawStep);
  const active = activeEntry();
  if (!active && !drawStep) return;
  const isNewStep = partita.newIndex >= 0;
  const viewedUid = ui.holdUid || ui.viewedUid;
  // Nel passo da pescare la carta "da risolvere" è la carta coperta (DRAW_UID)
  const viewed = (viewedUid === DRAW_UID && drawStep) ? null : (entryByUid(viewedUid) || active);
  // (fuori dal passo Pesca c'è sempre una carta mostrata: la carta da risolvere esiste, vedi sopra)
  const viewingDraw = drawStep && !viewed;
  if (!ui.holdUid) ui.viewedUid = viewed && !viewingDraw ? viewed.uid : DRAW_UID;
  const previewing = !ui.holdUid && (drawStep ? !viewingDraw : viewed !== active);

  // Fascia compatta: rosso = da risolvere, avorio = mostrata
  const railScroll = rail.scrollLeft;
  const railScrollTop = rail.scrollTop;
  const railItems: (HTMLButtonElement | HTMLDivElement)[] = partita.queue.map((entry, i) => queueItem(entry, {
    compact: true, index: i, total: partita.queue.length, current: entry === active, viewed: entry === viewed
  }));
  // Potere da risolvere: anche nella fascia il token lampeggia e diventa grigio insieme a quello della carta grande.
  // La fascia si ridisegna spesso: l'animazione riparte dal punto giusto (ritardo negativo) o il token resta nascosto.
  if (partita.newIndex < 0 && active && active.data.type === 'Power') {
    const key = partita.turn + ':' + partita.currentIndex + ':' + active.uid + ':' + active.tokens;
    // Prima carta del turno: l'animazione parte quando lo sfondo ha finito di scorrere (ui.bgSlideUntil)
    if (ui.autoTokenKey !== key) { ui.autoTokenKey = key; ui.autoTokenAt = Math.max(performance.now(), ui.bgSlideUntil || 0); }
    const badge = railItems[partita.currentIndex] && query(railItems[partita.currentIndex], '.ae-status-badge', HTMLElement);
    if (badge) {
      badge.classList.add('is-auto-token');
      badge.style.setProperty('--ae-token-delay', (ui.autoTokenAt - performance.now()) + 'ms');
    }
  }
  // In fondo alla fascia, al passo Pesca: la prossima carta del mazzo, coperta (retro) con NUOVA
  if (drawStep && canDraw()) railItems.push(nextCardItem({ current: drawStep, viewed: viewingDraw }));
  // Fase di risoluzione: al posto della carta da pescare solo una cornice tratteggiata grigia (come mazzo e scarti vuoti)
  else if (!drawStep && partita.newIndex < 0 && canDraw()) railItems.push(nextSlotItem());
  rail.replaceChildren(...railItems);
  rail.scrollLeft = railScroll;
  rail.scrollTop = railScrollTop;
  const viewedItem = query(rail, `[data-uid="${ui.viewedUid}"]`, HTMLElement);
  if (viewedItem) scrollItemInto(rail, viewedItem, 'nearest');

  renderFocus(viewed && !viewingDraw ? viewed : { uid: DRAW_UID });

  // Dock: in anteprima al posto dell'azione c'è "Torna alla carta da risolvere"
  const text = drawStep || !active ? I18N_IT.ctaDraw : actionText(active, isNewStep);
  backBtn.textContent = drawStep ? I18N_IT.backToDraw : I18N_IT.backToActive;
  resolveBtn.hidden = previewing;
  backBtn.hidden = !previewing;
  resolveBtn.textContent = text;
  // Fase di pesca: pulsante dorato, diverso da quelli della risoluzione
  resolveBtn.classList.toggle('is-draw', drawStep);
  // Durante l'animazione il pulsante resta focalizzabile ma non accetta tocchi (aria-disabled, controllato in onResolveClick)
  resolveBtn.setAttribute('aria-disabled', String(ui.isTransitioning));
  // Niente suggerimento sopra il pulsante: lo spazio resta alla carta
  resolveHint.hidden = true;
  // Ridimensiona di nuovo ora che il pulsante in basso è visibile: alla prima carta del turno nemesi il pulsante compare
  // solo dopo il primo calcolo, e la carta sarebbe misurata su uno spazio più alto (uscirebbe in basso)
  sizeFocus(!ui.fromScroll);
}

// Carta in primo piano: solo immagine (o retro durante la pesca) e stato numerico. Nessuna etichetta, nome o tipo
// (nemmeno in anteprima): tutto lo spazio va alla carta.
// Riga sopra la carta grande del turno nemesi: goccia + vita (minion) o un token per ogni token (potere); vuota per gli
// attacchi
export function focusStatus(entry: VoceInGioco): HTMLParagraphElement {
  const status = el('p', 'ae-focus-status');
  if (hasHp(entry)) {
    status.classList.add('is-hp');
    // Solo la vita attuale ("?" per un minion a vita variabile non ancora impostata): "x/X" si vede solo mentre si fa
    // danno (box del turno giocatori e finestra della vita)
    status.append(icon('heart'), el('span', '', hpUnset(entry) ? '?' : String(entry.hp)));
    // Il box "?" si tocca e apre la scheda della carta (unsetHpClick)
    if (hpUnset(entry)) { status.classList.add('is-unset'); status.dataset.uid = String(entry.uid); }
  } else if (entry.data.type === 'Power') {
    status.classList.add('is-token');
    status.appendChild(tokenIcons(Number(entry.tokens)));
  }
  status.setAttribute('aria-label', statusText(entry));
  return status;
}

// Carosello del turno nemesi: tutte le carte della coda in fila in un contenitore che scorre da solo (scroll-snap).
// La carta mostrata è quella al centro; ai lati si vede un pezzo della precedente e della successiva. Lo slide è lo
// scorrimento nativo del browser; quando si ferma su un'altra carta, quella diventa la carta mostrata.
// Le carte si ridisegnano solo quando cambia qualcosa (coda, vita, token, pesca); altrimenti il carosello scorre e basta.

// Il carosello (creato al primo disegno)
export let focusTrack: HTMLDivElement | null = null;

// fino a quando lo scorrimento è quello avviato dallo script (non dal dito)
export let focusProgrammaticUntil = 0;

export function focusSlide(entry: VoceInGioco): HTMLDivElement {
  const slide = el('div', 'ae-focus-slide');
  slide.dataset.uid = String(entry.uid);
  const reveal = ui.reveal && ui.reveal.uid === entry.uid ? ui.reveal : null;
  const stage = el('div', 'ae-focus-stage');
  if (reveal && reveal.status !== 'done') {
    stage.appendChild(flipCard(entry, reveal));
  } else {
    stage.appendChild(cardArt(entry.data, { sync: true }));
  }
  if (entry.isNew) {
    // Carta appena pescata: glow dorato attorno ed etichetta NUOVA
    stage.classList.add('is-new');
    const tag = el('span', 'ae-new-tag', I18N_IT.newTag);
    tag.setAttribute('aria-hidden', 'true');
    stage.appendChild(tag);
  }
  // Stato sopra la carta: la riga c'è sempre, anche vuota (attacchi), così ogni carta ha la stessa dimensione
  const status = focusStatus(entry);
  if (ui.holdUid === entry.uid) status.classList.add('is-dropping', 'is-bumped');
  // Potere da risolvere: dopo 1 secondo un token sfuma da solo (il pulsante poi va solo avanti o scarta)
  if (partita.newIndex < 0 && entry === partita.queue[partita.currentIndex] && entry.data.type === 'Power') {
    status.classList.add('is-auto-token');
    // stesso istante della fascia (dopo lo scorrimento dello sfondo, se è la prima carta del turno)
    status.style.setProperty('--ae-token-delay', ((ui.autoTokenAt || 0) - performance.now()) + 'ms');
  }
  // Carta appena pescata: durante il caricamento la riga è nascosta; mentre si gira, i token o la vita compaiono dopo
  // la rotazione. Un attacco pescato lampeggia di rosso.
  if (reveal && reveal.status === 'loading') slide.classList.add('is-draw-loading');
  if (reveal && (reveal.status === 'ready' || reveal.status === 'flipping')) slide.classList.add('is-drawing');
  if (entry.isNew && partita.newIndex >= 0 && entry.data.type === 'Attack' && !(reveal && reveal.status === 'loading')) stage.classList.add('is-attack-drawn');
  // Carta da risolvere: lampeggia di rosso come l'attacco pescato (non i poteri con più di un token)
  if (partita.newIndex < 0 && entry === partita.queue[partita.currentIndex] && !(entry.data.type === 'Power' && Number(entry.tokens) > 1)) {
    stage.classList.add('is-to-resolve');
  }
  slide.append(status, stage);
  return slide;
}

// Carta da pescare: il retro, con NUOVA; si gira dopo il tocco su "Pesca"
export function drawSlide(): HTMLDivElement {
  const slide = el('div', 'ae-focus-slide ae-focus-slide--draw');
  slide.dataset.uid = String(DRAW_UID);
  const stage = el('div', 'ae-focus-stage is-new');
  // Toccando il retro la carta si pesca (come il pulsante "Pesca")
  stage.setAttribute('role', 'button');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', I18N_IT.ctaDraw);
  const art = el('div', 'ae-card-art ae-card-back');
  const img = document.createElement('img');
  img.alt = I18N_IT.nextCard;
  img.src = CARD_BACK;
  art.appendChild(img);
  const tag = el('span', 'ae-new-tag', I18N_IT.newTag);
  tag.setAttribute('aria-hidden', 'true');
  stage.append(art, tag);
  slide.append(el('p', 'ae-focus-status'), stage);
  return slide;
}

export function focusStateSignature(): string {
  return (isDrawStep() || partita.newIndex >= 0 ? 'solo' + partita.newIndex + ':' + ui.viewedUid + '|' : '') + 'c' + partita.currentIndex + '|' + partita.queue.map(e => [e.uid, e.hp, e.tokens, e.isNew ? 1 : 0].join(':')).join('|')
    + '#' + (ui.reveal ? ui.reveal.uid + ':' + ui.reveal.status : '') + '#' + (ui.holdUid || '');
}

export function renderFocus(viewed: { uid: number }): void {
  let track = focusTrack;
  if (!track || !track.isConnected) {
    track = el('div', 'ae-focus-track');
    focusTrack = track;
    focusEl.replaceChildren(track);
    ui.focusSignature = '';
  }
  // Token e vita della carta pescata compaiono dopo il banner Tier (se c'è)
  focusEl.style.setProperty('--ae-tier-wait', Math.max(0, Math.round(ui.tierWaitUntil - performance.now())) + 'ms');
  const prevUid = focusEl.dataset.uid;
  const viewedChanged = prevUid !== String(viewed.uid);
  focusEl.dataset.uid = String(viewed.uid);
  if (focusStateSignature() !== ui.focusSignature || !track.children.length) {
    // Passo Pesca: si vede solo la carta da girare (le carte già risolte a sinistra spariscono); se si guarda un'altra
    // carta dalla fascia, c'è solo quella accanto
    let slides: HTMLDivElement[];
    // Anche dopo la pesca si vede solo la carta pescata. La carta da pescare e quella pescata sono un po' più grandi.
    if (isDrawStep() || partita.newIndex >= 0) {
      const drawn = partita.newIndex >= 0 ? partita.queue[partita.newIndex] : null;
      const mainUid = drawn ? drawn.uid : DRAW_UID;
      const other = viewed.uid !== mainUid ? entryByUid(viewed.uid) : null;
      const main = drawn ? focusSlide(drawn) : drawSlide();
      main.classList.add('is-big');
      slides = [...(other ? [focusSlide(other)] : []), main];
    } else {
      slides = partita.queue.map(focusSlide);
    }
    track.replaceChildren(...slides);
    // La firma si calcola dopo: disegnare la carta pescata può far avanzare il suo stato (pronta → si gira)
    ui.focusSignature = focusStateSignature();
    sizeFocus(false);
    const prevStill = prevUid && track.querySelector(`.ae-focus-slide[data-uid="${prevUid}"]`);
    if (prevUid && viewedChanged && prevStill) {
      // Si passa a una carta che c'era già (minion che resta, token tolto): il carosello scorre fino a lei
      scrollFocusTo(prevUid, false, true);
      scrollFocusTo(viewed.uid, true);
    } else {
      scrollFocusTo(viewed.uid, false, true);
      // La carta mostrata prima è sparita (risolta, negli scarti): la nuova entra con una breve animazione
      if (viewedChanged && prevUid) {
        const slide = track.querySelector(`.ae-focus-slide[data-uid="${viewed.uid}"]`);
        if (slide && !(ui.reveal && ui.reveal.uid === viewed.uid)) slide.classList.add('is-entering');
      }
    }
  } else if (!ui.fromScroll) {
    // Stesse carte: si porta al centro la carta mostrata (tocco sulla fascia, "Torna alla carta da risolvere", ...)
    scrollFocusTo(viewed.uid, viewedChanged);
  }
}

// smooth = scorrimento animato. Senza smooth la carta va al centro subito, tranne quando è in corso uno scorrimento
// animato avviato dallo script: allora si aggiorna solo la meta (altrimenti un ridisegno o un ridimensionamento
// interromperebbe l'animazione con un salto). jump = salto immediato comunque (carosello appena ridisegnato, misure).
// uid: numero o il valore di data-uid
export function scrollFocusTo(uid: number | string, smooth: boolean, jump = false): void {
  const slide = focusTrack && query(focusTrack, `.ae-focus-slide[data-uid="${uid}"]`, HTMLElement);
  if (!slide) return;
  const left = slide.offsetLeft + slide.offsetWidth / 2 - focusEl.clientWidth / 2;
  if (!smooth && !jump && performance.now() < focusProgrammaticUntil) smooth = true;
  if (Math.abs(focusEl.scrollLeft - left) < 1) return;
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (smooth && !reduce) {
    focusProgrammaticUntil = performance.now() + FAST_SCROLL_MS + 200;
    fastScrollTo(focusEl, left);
  } else {
    cancelFastScroll(focusEl);
    focusEl.scrollLeft = left;
  }
}

export function centredFocusUid(): number | null {
  if (!focusTrack) return null;
  const middle = focusEl.scrollLeft + focusEl.clientWidth / 2;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const slide of focusTrack.children) {
    if (!(slide instanceof HTMLElement)) continue;
    const d = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
    if (d < bestDist) { bestDist = d; best = Number(slide.dataset.uid); }
  }
  return best;
}

// Il dito ha portato al centro un'altra carta: diventa la carta mostrata (fascia e pulsante si aggiornano)
export let focusScrollFrame: ReturnType<typeof setTimeout> | 0 = 0;

// Dimensiona le carte del carosello: alte quanto lo spazio, ma più strette dell'area quanto basta per vedere un pezzo
// delle vicine. Il margine ai lati permette di centrare anche la prima e l'ultima carta.
export const BIG_CARD_SCALE = 0.9;

export function sizeFocus(recentre = true): void {
  const track = focusTrack;
  if (resolveView.hidden || !track) return;
  const slide = track.querySelector('.ae-focus-slide');
  if (!slide) return;
  sizeColumn(focusEl);
  const style = getComputedStyle(focusEl);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const peekRoom = partita.queue.length > 1 ? 2 * (PEEK_VISIBLE + PEEK_GAP) : 0;
  const width = Math.max(40, sharedCardWidth(focusEl.clientWidth, focusEl.clientHeight, padY, peekRoom));
  focusEl.style.setProperty('--ae-focus-w', width + 'px');
  focusEl.style.setProperty('--cw', width + 'px');
  track.style.paddingInline = Math.max(0, (focusEl.clientWidth - width) / 2) + 'px';
  // Carta da pescare e carta pescata: più grandi (fino al 30%), stessa misura per dorso e fronte. Cresce solo la carta:
  // la riga vita/token resta grande come nelle altre carte. Il blocco (riga + carta) è centrato in verticale tra la
  // fascia piccola e il pulsante (turno-nemesi.css .ae-focus-slide.is-big), con 4px di margine sopra e sotto.
  const byHeight = (focusEl.clientHeight - 8 - STATUS_H - 8) / CARD_RATIO;
  // ... ridotta al 90% (BIG_CARD_SCALE) della misura massima: a tutta grandezza è troppo grande
  const bigW = Math.floor(Math.max(width, Math.min(width * 1.3, byHeight, focusEl.clientWidth - 16)) * BIG_CARD_SCALE);
  focusEl.style.setProperty('--ae-big-w', bigW + 'px');
  if (recentre && focusEl.dataset.uid) scrollFocusTo(focusEl.dataset.uid, false);
}

// Carta pescata: retro (con "Caricamento carta…") finché l'immagine non è pronta, poi si gira in 350ms.
// Se l'immagine non arriva: segnaposto con nome e tipo e "Riprova immagine"; il gioco può proseguire comunque.
export function flipCard(entry: VoceInGioco, reveal: CartaDaGirare): HTMLDivElement {
  const flip = el('div', 'ae-flip');
  const inner = el('div', 'ae-flip-inner');
  const back = el('div', 'ae-flip-face ae-flip-face--back');
  const backImg = document.createElement('img');
  backImg.alt = '';
  backImg.src = CARD_BACK;
  back.appendChild(backImg);
  const front = el('div', 'ae-flip-face ae-flip-face--front');
  inner.append(back, front);
  flip.appendChild(inner);

  if (reveal.status === 'error') {
    flip.classList.add('is-flipped');
    const holder = el('div', 'ae-flip-error');
    holder.appendChild(placeholderArt(entry.data));
    const placeholder = holder.firstChild;
    if (placeholder) front.appendChild(placeholder);
    const retry = button(I18N_IT.retryImage, 'secondary', () => {
      reveal.status = 'loading';
      startReveal(entry);
    });
    retry.classList.add('ae-flip-loading');
    retry.style.minHeight = '44px';
    flip.appendChild(retry);
    return flip;
  }

  front.appendChild(cardArt(entry.data, { sync: true }));
  if (reveal.status === 'loading') {
    flip.appendChild(el('p', 'ae-hint ae-flip-loading', I18N_IT.loadingCard));
  } else if (reveal.status === 'ready') {
    // Immagine pronta: si gira subito dopo essere stata disegnata; finita la rotazione resta la carta normale
    setTimeout(() => flip.classList.add('is-flipped'), 30);
    reveal.status = 'flipping';
    setTimeout(() => { if (reveal.status === 'flipping') reveal.status = 'done'; }, DRAW_MS + 50);
  } else if (reveal.status === 'flipping') {
    // Ridisegnata durante la rotazione: già girata, senza ripartire
    flip.classList.add('is-flipped');
  }
  return flip;
}

// Avvia il caricamento dell'immagine della carta pescata; alla fine la carta si gira (se è ancora quella mostrata)
export function startReveal(entry: VoceInGioco): void {
  const reveal: CartaDaGirare = { uid: entry.uid, status: 'loading' };
  ui.reveal = reveal;
  loadImage(encodeURI(entry.data.image)).then(ok => {
    if (ui.reveal !== reveal) return;
    reveal.status = ok ? 'ready' : 'error';
    if (partita.resolving) renderResolve();
  });
}

// Scarica in anticipo le immagini che serviranno: prossima carta del mazzo e carta dopo quella da risolvere
export function preloadNext(): void {
  const next = partita.deck[partita.deck.length - 1];
  if (next) loadImage(encodeURI(next.image));
  const after = partita.queue[partita.currentIndex + 1];
  if (after) loadImage(encodeURI(after.data.image));
}

// Carta appena pescata (azione pescaCarta): la si mostra come nuova (NUOVA, entra girandosi dal retro)
export function showDrawnCard(drawn: CartaPescata | null): void {
  if (!drawn) return;
  const { data } = drawn.entry;
  ui.lastDrawnUid = drawn.entry.uid;
  // Carta pescata: vibrazione breve, doppia e più forte per un attacco (la scritta Tier, se c'è, ha la sua)
  buzz(data.type === 'Attack' ? [80, 60, 80] : 30);
  // Prima carta del Tier 2 o del Tier 3: scritta "Tier N" al centro (mostrata da render)
  if (drawn.newTier) ui.tierBanner = drawn.newTier;
}

// Tocco sul pulsante principale: prima la partita cambia (un passo di undo, salvataggio), poi l'animazione.
// Fino alla fine dell'animazione il pulsante non accetta altri tocchi (un tocco = un solo evento di gioco).
export function onResolveClick(): void {
  if (!partita.resolving || ui.isTransitioning) return;
  if (isDrawStep()) {
    // "Pesca": la carta coperta diventa la carta pescata, che si gira
    if (ui.viewedUid !== DRAW_UID) return;
    const roundAtDraw = partita.turnOrder.round;
    // Mazzo vuoto: il turno nemesi finisce e si estrae il turno dopo (stato/partita.ts, pescaCarta)
    showDrawnCard(pescaCarta());
    if (partita.resolving) {
      showActive(activeEntry());
      lockFor(duration('focus'));
    }
    richiediRidisegno();
    // Mazzo vuoto all'ultimo turno del giro: mazzo dei turni mischiato
    if (!partita.resolving && awaitingTurnCard() && partita.turnOrder.round !== roundAtDraw) playTurnShuffle(SHUFFLE_FADE_MS);
    return;
  }
  const active = activeEntry();
  if (!active || ui.viewedUid !== active.uid) return;
  // Minion con vita "?": "Imposta la vita" apre la scheda della carta; si va avanti solo dopo averla impostata
  if (hpUnset(active)) {
    if (ui.reveal && ui.reveal.uid === active.uid && ui.reveal.status !== 'done') return;
    openCardDialog(active);
    return;
  }
  const ghostSource = query(focusEl, `.ae-focus-slide[data-uid="${active.uid}"] .ae-focus-stage`, HTMLElement);
  const wasNewStep = partita.newIndex >= 0;
  const turnBefore = partita.turn;
  const roundBefore = partita.turnOrder.round;
  // Fine del turno nemesi: si estrae il turno dopo dal mazzo dei turni (stato/partita.ts, risolviCarta)
  const effect = risolviCarta();
  // Dal mazzo dei turni è uscita di nuovo la nemesi: il turno nemesi riparte (scossa e annuncio)
  if (partita.resolving && partita.turn !== turnBefore) {
    shakeApp();
    announce(I18N_IT.trackNemesisResolve);
  }

  // Fine dell'ultimo turno del giro: mazzo dei turni mischiato; scritte e colori della barra svaniscono durante il
  // passaggio al turno giocatori, poi le caselle si uniscono e si separano
  const roundShuffled = !partita.resolving && awaitingTurnCard() && partita.turnOrder.round !== roundBefore;
  const shuffleAfter = roundShuffled ? () => playTurnShuffle(0) : undefined;
  if (roundShuffled) beginTrackShuffle();
  if (!partita.resolving) {
    // Fine del turno nemesi: si torna alla VistaCoda con la carta pescata in vista
    // Carta appena pescata e messa in gioco (si prende dalla carta risolta, non da ui.lastDrawnUid: dopo un undo gli uid cambiano)
    const kept = (wasNewStep && entryByUid(active.uid)) || entryByUid(ui.lastDrawnUid);
    const anchorUid = kept ? kept.uid : (partita.queue.length ? partita.queue[partita.queue.length - 1].uid : null);
    ui.queueAnchor = anchorUid ? { uid: anchorUid, align: partita.queue.length === 1 ? 'center' : 'anchor' } : null;
    ui.reveal = null;
    ui.viewedUid = null;
    if (effect === 'discard' && ghostSource) {
      // Attacco appena pescato: vola negli scarti restando nel turno nemesi; quando atterra si passa al turno giocatori
      flyToDiscard([ghostSource]);
      ghostSource.style.visibility = 'hidden';
      // Il blocco dura anche per l'entrata delle carte da sinistra: lockFor alla fine ridisegna, e farlo prima
      // interromperebbe l'animazione
      const flyMs = reducedMotion.matches ? 150 : FLY_MS + 80;
      lockFor(flyMs + (reducedMotion.matches ? 0 : ENTER_MS + 40), shuffleAfter);
      setTimeout(() => { passaAlTurnoGiocatori(null); nemesisBtn.focus(); }, flyMs);
      return;
    }
    // Carta messa in gioco: passaggio morbido, la carta grande si trasforma nella carta del turno giocatori e le altre
    // entrano da sinistra (vedi toPlayersTurn)
    lockFor(reducedMotion.matches ? duration('phase') : Math.max(MORPH_MS, MORPH_MS / 2 + ENTER_MS) + 40, shuffleAfter);
    passaAlTurnoGiocatori(kept && ghostSource ? kept.uid : null, ghostSource);
    if (wasNewStep) nemesisBtn.focus();
    return;
  }

  const next = activeEntry();
  // Carta risolta e scartata: vola verso la pila degli scarti in alto
  if (effect === 'discard' && ghostSource) flyToDiscard([ghostSource]);
  showActive(next);
  lockFor(duration(effect === 'discard' ? 'discard' : 'focus'));
  richiediRidisegno();
  // Risolta l'ultima carta: la carta da pescare arriva volando dal mazzo, dopo che la carta scartata è atterrata
  if (isDrawStep()) animateDrawIn(effect === 'discard' && ghostSource ? FLY_MS + 60 : 0);
}

// Dopo un'azione si mostra la nuova carta da risolvere (o la carta appena pescata, che si gira). (Il parametro non si
// usa: la carta si rilegge dallo stato)
export function showActive(entry?: VoceInGioco | null): void {
  void entry;
  const current = activeEntry();
  ui.viewedUid = current ? current.uid : (isDrawStep() ? DRAW_UID : null);
  if (current && partita.newIndex >= 0 && current.isNew && (!ui.reveal || ui.reveal.uid !== current.uid)) {
    startReveal(current);
    announce(I18N_IT.cardDrawn(current.data.name));
  }
  preloadNext();
}

// Inizio del turno nemesi a schermo (dopo che lo stato è già passato al turno nemesi). Le carte grandi partono dalla carta
// che si stava guardando nel turno giocatori: railScroll e centred leggono, quando servono, lo scorrimento della sua
// fascia e la carta al centro (le passa il coordinatore)
export function enterNemesisTurnView(railScrollOf: () => number, centred: () => number | null): void {
  // Urgenza: una breve scossa dello schermo e una vibrazione
  shakeApp();
  // Lo sfondo scorre verso il lato della nemesi (0,8 s, base.css .ae-shell): il token della prima carta aspetta
  ui.bgSlideUntil = reducedMotion.matches ? 0 : performance.now() + BG_SLIDE_MS;
  ui.viewedUid = null;
  // Le carte non spariscono e non ricompaiono: niente dissolvenza della vista, la fascia piccola resta dove era
  // (stesso scorrimento); cambiano solo lo sfondo e i pulsanti
  const railScroll = railScrollOf();
  // Le carte grandi partono dalla carta che si stava guardando e scorrono fino alla prima da risolvere (renderFocus)
  const shownUid = partita.queue.length ? centred() : null;
  if (shownUid !== null && entryByUid(shownUid)) focusEl.dataset.uid = String(shownUid);
  else delete focusEl.dataset.uid;
  if (partita.resolving) {
    showActive(activeEntry());
    resolveView.classList.remove('is-entering');
    lockFor(duration('phase'));
  }
  richiediRidisegno();
  if (partita.resolving) {
    rail.scrollLeft = railScroll;
    const current = query(rail, '[aria-current="true"]', HTMLElement);
    if (current) scrollItemInto(rail, current, 'nearest');
  }
  if (partita.resolving) resolveBtn.focus();
  // Coda vuota: si va subito alla carta da pescare, che arriva dal mazzo
  if (isDrawStep()) animateDrawIn();
}

// Mostra un'altra carta senza risolvere nulla (anteprima): non cambia mazzo, vita, token, scarti, turno, undo
export function viewCard(uid: number): void {
  if (!partita.resolving || ui.holdUid) return;
  if ((uid === DRAW_UID ? !isDrawStep() : !entryByUid(uid)) || ui.viewedUid === uid) return;
  ui.viewedUid = uid;
  renderResolve();
}

export function moveView(step: number): void {
  const i = partita.queue.findIndex(e => e.uid === ui.viewedUid);
  const next = partita.queue[i + step];
  if (next) viewCard(next.uid);
}

export function backToActive(): void {
  const active = activeEntry();
  if (active) viewCard(active.uid);
  else if (isDrawStep()) viewCard(DRAW_UID);
  resolveBtn.focus();
}

// Passo Pesca: una carta coperta parte dal mazzo in alto a sinistra e vola al centro, dove diventa la carta da pescare
// (che resta nascosta finché la copia non arriva). Poi tutto funziona come prima (tocco sul dorso o "Pesca").
export const DRAW_IN_MS = 650;

// delay: attesa (ms) prima della partenza, per esempio finché la carta appena scartata non è atterrata
export function animateDrawIn(delay = 0): void {
  const stage = query(focusEl, '.ae-focus-slide--draw .ae-focus-stage', HTMLElement);
  const from = dockDeck.getBoundingClientRect();
  if (!stage || !from.width || reducedMotion.matches || !document.body.animate) return;
  // La carta da pescare non deve avere l'animazione di entrata (la sposterebbe): si misura dove starà davvero
  const slide = stage.closest('.ae-focus-slide');
  if (slide) slide.classList.remove('is-entering');
  scrollFocusTo(DRAW_UID, false, true);
  const to = stage.getBoundingClientRect();
  if (!to.width) return;
  stage.style.visibility = 'hidden';
  const ghost = el('div', 'ae-fly-ghost ae-draw-ghost');
  const img = document.createElement('img');
  img.alt = '';
  img.src = CARD_BACK;
  ghost.appendChild(img);
  Object.assign(ghost.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  document.body.appendChild(ghost);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = from.width / to.width;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ghost.remove();
    stage.style.visibility = '';
  };
  const anim = ghost.animate([
    { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${s})`, offset: 0 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.55 - 40}px) rotate(10deg) scale(${(1 + s) / 2})`, offset: 0.45 },
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', offset: 1 }
  ], { duration: DRAW_IN_MS, delay, easing: 'cubic-bezier(.3, 0, .2, 1)', fill: 'forwards' });
  // Durante l'attesa la copia resta nascosta (il mazzo in alto è già lì)
  ghost.style.visibility = 'hidden';
  setTimeout(() => { if (!done) ghost.style.visibility = ''; }, delay);
  anim.onfinish = finish;
  setTimeout(finish, delay + DRAW_IN_MS + 200);
  lockFor(delay + DRAW_IN_MS);
}

// Disegno del turno nemesi (fascia, carosello, pulsante principale)
export function disegnaTurnoNemesi(): void {
  renderResolve();
}

// Fascia del turno nemesi, dopo la quale sta la riga delle vite (dentro .ae-rail-row, quando c'è)
export function fasciaTurnoNemesi(): HTMLElement {
  const railParent = need(rail.parentElement, 'contenitore della fascia');
  return railParent.classList.contains('ae-rail-row') ? railParent : rail;
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  ui.focusSignature = '';

  focusEl.addEventListener('scroll', () => {
    if (focusScrollFrame) return;
    // circa un controllo per fotogramma (setTimeout invece di requestAnimationFrame: funziona anche a pagina in background)
    focusScrollFrame = setTimeout(() => {
      focusScrollFrame = 0;
      if (!partita.resolving || ui.holdUid || ui.isTransitioning || performance.now() < focusProgrammaticUntil) return;
      const uid = centredFocusUid();
      if (uid === null || uid === ui.viewedUid) return;
      ui.viewedUid = uid;
      ui.fromScroll = true;
      renderResolve();
      ui.fromScroll = false;
    }, 16);
  }, { passive: true });

  trackDrag(rail);

  rail.addEventListener('click', e => {
    const target = e.target;
    const item = target instanceof Element ? target.closest('.ae-queue-item') : null;
    if (!(item instanceof HTMLElement) || rail.dataset.dragged === '1') return;
    viewCard(Number(item.dataset.uid));
  });

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
}
