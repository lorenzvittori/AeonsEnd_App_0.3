// ui/schermate/turno-nemesi.ts: il turno nemesi (e il passo Pesca) nella schermata "partita": l'azione del pulsante
// principale (risolvi, pesca: onResolveClick) con le animazioni dopo l'azione, la carta mostrata (anteprima di un'altra
// carta, ritorno alla carta da risolvere), l'inizio del turno nemesi a schermo; all'avvio i tocchi su fascia (zona 3) e
// carosello (zona 5). Il disegno (fascia, carosello, carta pescata) è in turno-nemesi-carosello.ts, il pulsante in
// ui/componenti/pulsante-principale.ts. La fine del turno nemesi a schermo la chiede con l'aggancio
// passaAlTurnoGiocatori.
// Livello 5 (ui/schermate/). Dipende da: stato/partita.ts (lettura, pescaCarta, risolviCarta), ui/ base (testi, pagina,
// dom, ridisegno), ui/componenti (animazioni, barra-turni, dialoghi, testata), ui/finestre/scheda-carta.ts,
// turno-nemesi-carosello.ts (supporto). Usato da: navigazione (render, agganci, avvio).

import * as Nemesi from '../../regole/turno-nemesi.ts';
import { T } from '../testi.ts';
import { awaitingTurnCard, entryByUid, hpUnset, partita, pescaCarta, risolviCarta } from '../../stato/partita.ts';
import { announce } from '../componenti/dialoghi.ts';
import { FLY_MS, flyToDiscard } from '../componenti/testata.ts';
import type { VoceInGioco } from '../../tipi/partita.ts';
import type { CartaPescata } from '../../regole/turno-nemesi.ts';
import { DRAW_UID, duration, focusEl, pulsantePrincipale, rail, reducedMotion, ui } from '../pagina.ts';
import { BG_SLIDE_MS, buzz, ENTER_MS, lockFor, MORPH_MS, scrollItemInto, shakeApp,
  trackDrag } from '../componenti/animazioni.ts';
import { query } from '../dom.ts';
import { beginTrackShuffle, playTurnShuffle, SHUFFLE_FADE_MS } from '../componenti/barra-turni.ts';
import { openCardDialog } from '../finestre/scheda-carta.ts';
import { passaAlTurnoGiocatori, richiediRidisegno } from '../ridisegno.ts';
import type { DopoAzioneNemesi } from '../ridisegno.ts';
import { activeEntry, animateDrawIn, centredFocusUid, focusProgrammaticUntil, isDrawStep, preloadNext, renderResolve,
  startReveal } from './turno-nemesi-carosello.ts';

// --- VistaRisoluzione (turno nemesi) ---

// Carosello del turno nemesi: tutte le carte della coda in fila in un contenitore che scorre da solo (scroll-snap).
// La carta mostrata è quella al centro; ai lati si vede un pezzo della precedente e della successiva. Lo slide è lo
// scorrimento nativo del browser; quando si ferma su un'altra carta, quella diventa la carta mostrata.
// Le carte si ridisegnano solo quando cambia qualcosa (coda, vita, token, pesca); altrimenti il carosello scorre e basta.

// Il dito ha portato al centro un'altra carta: diventa la carta mostrata (fascia e pulsante si aggiornano)
export let focusScrollFrame: ReturnType<typeof setTimeout> | 0 = 0;

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
  mostraDopoAzione({ scartata: effect === 'discard', ghostSource, wasNewStep, uid: active.uid, turnBefore, roundBefore });
}

// Dopo un'azione del turno nemesi già fatta nello stato (carta risolta, minion eliminato dalla scheda): se il turno è
// finito si torna al turno giocatori (animazione, sfondo, pulsante), se è ripartito subito si annuncia, altrimenti si
// mostra la carta dopo. Lo chiede anche la scheda della carta, con l'aggancio dopoAzioneNemesi
export function mostraDopoAzione(a: DopoAzioneNemesi): void {
  const { ghostSource, wasNewStep, turnBefore, roundBefore, scartata } = a;
  // Dal mazzo dei turni è uscita di nuovo la nemesi: il turno nemesi riparte (scossa e annuncio)
  if (partita.resolving && partita.turn !== turnBefore) {
    shakeApp();
    announce(T.trackNemesisResolve);
  }

  // Fine dell'ultimo turno del giro: mazzo dei turni mischiato; scritte e colori della barra svaniscono durante il
  // passaggio al turno giocatori, poi le caselle si uniscono e si separano
  const roundShuffled = !partita.resolving && awaitingTurnCard() && partita.turnOrder.round !== roundBefore;
  const shuffleAfter = roundShuffled ? () => playTurnShuffle(0) : undefined;
  if (roundShuffled) beginTrackShuffle();
  if (!partita.resolving) {
    // Fine del turno nemesi: si torna alla VistaCoda con la carta pescata in vista
    // Carta appena pescata e messa in gioco (si prende dalla carta risolta, non da ui.lastDrawnUid: dopo un undo gli uid cambiano)
    const kept = (wasNewStep && entryByUid(a.uid)) || entryByUid(ui.lastDrawnUid);
    const anchorUid = kept ? kept.uid : (partita.queue.length ? partita.queue[partita.queue.length - 1].uid : null);
    ui.queueAnchor = anchorUid ? { uid: anchorUid, align: partita.queue.length === 1 ? 'center' : 'anchor' } : null;
    ui.reveal = null;
    ui.viewedUid = null;
    if (scartata && ghostSource) {
      // Attacco appena pescato: vola negli scarti restando nel turno nemesi; quando atterra si passa al turno giocatori
      flyToDiscard([ghostSource]);
      ghostSource.style.visibility = 'hidden';
      // Il blocco dura anche per l'entrata delle carte da sinistra: lockFor alla fine ridisegna, e farlo prima
      // interromperebbe l'animazione
      const flyMs = reducedMotion.matches ? 150 : FLY_MS + 80;
      lockFor(flyMs + (reducedMotion.matches ? 0 : ENTER_MS + 40), shuffleAfter);
      setTimeout(() => { passaAlTurnoGiocatori(null); pulsantePrincipale.focus(); }, flyMs);
      return;
    }
    // Carta messa in gioco: passaggio morbido, la carta grande si trasforma nella carta del turno giocatori e le altre
    // entrano da sinistra (vedi toPlayersTurn)
    lockFor(reducedMotion.matches ? duration('phase') : Math.max(MORPH_MS, MORPH_MS / 2 + ENTER_MS) + 40, shuffleAfter);
    passaAlTurnoGiocatori(kept && ghostSource ? kept.uid : null, ghostSource);
    if (wasNewStep) pulsantePrincipale.focus();
    return;
  }

  const next = activeEntry();
  // Carta risolta e scartata: vola verso la pila degli scarti in alto
  if (scartata && ghostSource) flyToDiscard([ghostSource]);
  showActive(next);
  lockFor(duration(scartata ? 'discard' : 'focus'));
  richiediRidisegno();
  // Risolta l'ultima carta: la carta da pescare arriva volando dal mazzo, dopo che la carta scartata è atterrata
  if (isDrawStep()) animateDrawIn(scartata && ghostSource ? FLY_MS + 60 : 0);
}

// Dopo un'azione si mostra la nuova carta da risolvere (o la carta appena pescata, che si gira). (Il parametro non si
// usa: la carta si rilegge dallo stato)
export function showActive(entry?: VoceInGioco | null): void {
  void entry;
  const current = activeEntry();
  ui.viewedUid = current ? current.uid : (isDrawStep() ? DRAW_UID : null);
  if (current && partita.newIndex >= 0 && current.isNew && (!ui.reveal || ui.reveal.uid !== current.uid)) {
    startReveal(current);
    announce(T.cardDrawn(current.data.name));
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
    lockFor(duration('phase'));
  }
  richiediRidisegno();
  if (partita.resolving) {
    rail.scrollLeft = railScroll;
    const current = query(rail, '[aria-current="true"]', HTMLElement);
    if (current) scrollItemInto(rail, current, 'nearest');
  }
  if (partita.resolving) pulsantePrincipale.focus();
  // Coda vuota: si va subito alla carta da pescare, che arriva dal mazzo
  if (isDrawStep()) animateDrawIn();
}

// Mostra un'altra carta senza risolvere nulla (anteprima): non cambia mazzo, vita, token, scarti, turno, undo
export function viewCard(uid: number): void {
  // Dal passo Pesca alla carta pescata messa in gioco le carte piccole non si toccano (tocco, frecce, carte grandi)
  if (!partita.resolving || isDrawStep() || partita.newIndex >= 0) return;
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
  pulsantePrincipale.focus();
}

// Disegno del turno nemesi (fascia, carosello, pulsante principale)
export function disegnaTurnoNemesi(): void {
  renderResolve();
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  ui.focusSignature = '';

  focusEl.addEventListener('scroll', () => {
    if (focusScrollFrame) return;
    // circa un controllo per fotogramma (setTimeout invece di requestAnimationFrame: funziona anche a pagina in background)
    focusScrollFrame = setTimeout(() => {
      focusScrollFrame = 0;
      if (!partita.resolving || ui.isTransitioning || performance.now() < focusProgrammaticUntil) return;
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
    if (!partita.resolving) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    moveView(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
    const item = query(rail, `[data-uid="${ui.viewedUid}"]`, HTMLElement);
    if (item) item.focus();
  });
}
