// ui/schermate/turno-nemesi-carosello.ts: il disegno del turno nemesi: fascia piccola (zona 3) con la carta da
// risolvere e la prossima da pescare, carosello delle carte grandi (zona 5: scroll-snap, firma per non ridisegnarlo,
// misure), carta pescata che si gira, carta da pescare che arriva dal mazzo, pulsante principale quando cambia la carta
// mostrata. File di supporto di turno-nemesi.ts.
// Livello 5 (ui/schermate/). Dipende da: regole/turno-nemesi.ts, stato/partita.ts (lettura), ui/ base (testi, pagina,
// dom, partita-variante), ui/componenti (animazioni, componenti, dialoghi, misure, pulsante-principale, testata).
// Usato da: turno-nemesi.ts, navigazione (misure al ridimensionamento), main.ts (app.isDrawStep, app.centredFocusUid...).
import { entryByUid, hpUnset, partita } from '../../stato/partita.ts';
import * as Nemesi from '../../regole/turno-nemesi.ts';
import type { VoceInGioco } from '../../tipi/partita.ts';
import { cancelFastScroll, FAST_SCROLL_MS, fastScrollTo, lockFor, scrollItemInto } from '../componenti/animazioni.ts';
import { cardArt, hasHp, nextCardItem, nextSlotItem, placeholderArt, queueItem, statusText,
  tokenIcons } from '../componenti/componenti.ts';
import { button, loadImage } from '../componenti/dialoghi.ts';
import { misura, rapportoCarta, sharedCardWidth, sizeColumn, spazioInterattivi, spazioVicine } from '../componenti/misure.ts';
import { disegnaPulsantePrincipale } from '../componenti/pulsante-principale.ts';
import { dockDeck } from '../componenti/testata.ts';
import { el, icon, query } from '../dom.ts';
import { CARD_BACK, DRAW_MS, DRAW_UID, focusEl, rail, reducedMotion, ui } from '../pagina.ts';
import type { CartaDaGirare } from '../pagina.ts';
import { variantePartita } from '../partita-variante.ts';
import { T } from '../testi.ts';

export function activeEntry(): VoceInGioco | null {
  return partita.queue[partita.currentIndex] || null;
}

export function isDrawStep(): boolean {
  return Nemesi.isDrawStep(partita);
}

export function canDraw(): boolean {
  return Nemesi.canDraw(partita);
}

// Disegno del turno nemesi: fascia piccola, carosello e pulsante principale (la carta mostrata decide se è "Torna alla
// carta da risolvere"). Il passo Pesca (fascia dorata, sfondo) lo dice il momento della partita (data-turno, partita.css)
export function renderResolve(): void {
  const drawStep = isDrawStep();
  const active = activeEntry();
  if (!active && !drawStep) return;
  const viewedUid = ui.holdUid || ui.viewedUid;
  // Nel passo da pescare la carta "da risolvere" è la carta coperta (DRAW_UID)
  const viewed = (viewedUid === DRAW_UID && drawStep) ? null : (entryByUid(viewedUid) || active);
  // (fuori dal passo Pesca c'è sempre una carta mostrata: la carta da risolvere esiste, vedi sopra)
  const viewingDraw = drawStep && !viewed;
  if (!ui.holdUid) ui.viewedUid = viewed && !viewingDraw ? viewed.uid : DRAW_UID;

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
  // (la fascia è la stessa del turno giocatori, che la nasconde quando la coda è vuota)
  rail.hidden = false;
  rail.scrollLeft = railScroll;
  rail.scrollTop = railScrollTop;
  const viewedItem = query(rail, `[data-uid="${ui.viewedUid}"]`, HTMLElement);
  if (viewedItem) scrollItemInto(rail, viewedItem, 'nearest');

  renderFocus(viewed && !viewingDraw ? viewed : { uid: DRAW_UID });

  // Zona 7: in anteprima al posto dell'azione c'è "Torna alla carta da risolvere" (variantePartita)
  disegnaPulsantePrincipale(variantePartita(partita, ui));
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
    const tag = el('span', 'ae-new-tag', T.newTag);
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
  stage.setAttribute('aria-label', T.ctaDraw);
  const art = el('div', 'ae-card-art ae-card-back');
  const img = document.createElement('img');
  img.alt = T.nextCard;
  img.src = CARD_BACK;
  art.appendChild(img);
  const tag = el('span', 'ae-new-tag', T.newTag);
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

// Dimensiona le carte del carosello: alte quanto lo spazio, ma più strette dell'area quanto basta per vedere un pezzo
// delle vicine. Il margine ai lati permette di centrare anche la prima e l'ultima carta.
export function sizeFocus(recentre = true): void {
  const track = focusTrack;
  if (focusEl.hidden || !track) return;
  const slide = track.querySelector('.ae-focus-slide');
  if (!slide) return;
  // Il turno nemesi non ha la zona 6: il carosello è più alto e lascia libero lo spazio dei comandi sotto la carta e,
  // per centrarla, sopra; nel turno giocatori uno dei due è la zona 6 (sizeQueue): le carte hanno la stessa misura
  const riserva = 2 * spazioInterattivi();
  sizeColumn(focusEl, riserva);
  const style = getComputedStyle(focusEl);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const peekRoom = partita.queue.length > 1 ? spazioVicine('nemesi') : 0;
  const width = Math.max(40, sharedCardWidth(focusEl.clientWidth, focusEl.clientHeight, padY, peekRoom, riserva));
  focusEl.style.setProperty('--ae-focus-w', width + 'px');
  focusEl.style.setProperty('--cw', width + 'px');
  track.style.paddingInline = Math.max(0, (focusEl.clientWidth - width) / 2) + 'px';
  // Carta da pescare e carta pescata: più grandi (fino a --carta-pescata-crescita), stessa misura per dorso e fronte.
  // Cresce solo la carta: la riga vita/token resta grande come nelle altre carte. Il blocco (riga + carta) è centrato in
  // verticale tra la fascia piccola e il pulsante (turno-nemesi.css .ae-focus-slide.is-big), con --carta-pescata-margine
  // in tutto sopra e sotto.
  const byHeight = (focusEl.clientHeight - misura('--carta-pescata-margine') - misura('--carte-grandi-riga-stato-altezza')
    - misura('--carte-grandi-riga-stato-distanza')) / rapportoCarta();
  // ... ridotta a --carta-pescata-scala (90%) della misura massima: a tutta grandezza è troppo grande
  const bigW = Math.floor(Math.max(width, Math.min(width * misura('--carta-pescata-crescita'), byHeight,
    focusEl.clientWidth - 2 * misura('--carte-grandi-margine-lato'))) * misura('--carta-pescata-scala'));
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
    const retry = button(T.retryImage, 'secondary', () => {
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
    flip.appendChild(el('p', 'ae-hint ae-flip-loading', T.loadingCard));
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
