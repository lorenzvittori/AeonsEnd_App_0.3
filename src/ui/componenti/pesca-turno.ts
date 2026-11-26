// ui/componenti/pesca-turno.ts: la finestra "Pesca nuovo turno". Si apre a ogni fine turno (dei giocatori o della nemesi) e dal
// pulsante "Pesca carta turno": il dorso delle carte turno, che toccandolo si gira (stessa animazione della carta nemesi
// pescata) e fa pescare la carta del nuovo turno; sotto, di chi è il turno ("Turno del giocatore x", "Turno Nemesi") o, con
// le carte 1/2 e 3/4, "Chi gioca questo turno?" con i due token. Si esce toccando fuori dalla finestra. Lo sfondo
// dell'app segue la carta: al centro finché il turno non è deciso, poi a sinistra (giocatori) o a destra (nemesi).
// La carta si pesca nella partita (pescaCartaTurno, un passo di undo) quando la si tocca; se esce la nemesi il turno nemesi
// parte a schermo solo alla chiusura (passaAlTurnoNemesi), così le sue animazioni non si perdono dietro la finestra.
// Livello 3 (ui/componenti/). Dipende da: stato/partita.ts (lettura e azioni pescaCartaTurno, scegliGiocatoreCoppia), ui/
// base (testi, pagina, dom, ridisegno), ui/componenti (animazioni, barra-turni, dialoghi). Usato da: schermate dei turni.

import { awaitingTurnCard, currentTurnCard, isPairCard, pairOptions, partita, pescaCartaTurno, scegliGiocatoreCoppia,
  turnCardPlayer } from '../../stato/partita.ts';
import type { CartaTurno, Giocatore } from '../../tipi/partita.ts';
import { app, pulsantePrincipale, reducedMotion, ui } from '../pagina.ts';
import { el } from '../dom.ts';
import { passaAlTurnoNemesi, richiediRidisegno } from '../ridisegno.ts';
import { T } from '../testi.ts';
import { buzz } from './animazioni.ts';
import { pairChoiceKey, renderTurnTrack, turnTrack } from './barra-turni.ts';
import { announce, loadImage, modals, openModal } from './dialoghi.ts';

// Immagine di una carta turno (dorso: back)
function turnCardSrc(name: string): string {
  return `Assets/ui/turn-cards/${name}.webp`;
}

// Chi gioca il turno, in parole (nemesi, wild o giocatore)
function whoText(kind: CartaTurno | null): string {
  if (kind === 'nemesis') return T.drawnTurnNemesis;
  const player = turnCardPlayer(kind);
  if (kind === 'wild') return partita.turnOrder.wild ? T.trackWildOf(partita.turnOrder.wild) : T.trackWild;
  return player ? T.trackPlayer(Number(player.slice(1))) : '';
}

export function openDrawTurn(): void {
  if (ui.pescaTurnoAperta || modals.length || ui.deckBuilding || partita.resolving || !awaitingTurnCard()) return;
  ui.pescaTurnoAperta = true;
  app.classList.add('is-draw-turn');
  let drawn = false;
  let closed = false;

  const dialog = el('div', 'ae-draw-turn');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const title = el('h2', 'ae-draw-turn-title', T.drawTurnTitle);
  title.id = 'ae-draw-turn-title';
  dialog.setAttribute('aria-labelledby', title.id);

  // Il dorso delle carte turno: toccandolo si gira
  const stage = el('button', 'ae-draw-turn-stage');
  stage.type = 'button';
  stage.setAttribute('aria-label', T.drawTurnCardLabel);
  const flip = el('div', 'ae-flip');
  const inner = el('div', 'ae-flip-inner');
  const back = el('div', 'ae-flip-face ae-flip-face--back');
  const backImg = document.createElement('img');
  backImg.alt = '';
  backImg.src = turnCardSrc('back');
  back.appendChild(backImg);
  const front = el('div', 'ae-flip-face ae-flip-face--front');
  inner.append(back, front);
  flip.appendChild(inner);
  stage.appendChild(flip);

  const info = el('div', 'ae-draw-turn-info');
  info.setAttribute('aria-live', 'polite');
  dialog.append(title, stage, info);

  // Di chi è il turno, sotto la carta; carta 1/2 o 3/4 senza giocatore: "Chi gioca questo turno?" e i due token
  // Deciso il turno (token o scritta mostrati), un tocco sulla finestra la chiude
  let decided = false;
  function renderInfo(): void {
    const heightBefore = dialog.offsetHeight;
    fillInfo();
    // La finestra cambia altezza in modo morbido
    const heightAfter = dialog.offsetHeight;
    if (heightBefore && heightAfter !== heightBefore && !reducedMotion.matches && dialog.animate) {
      dialog.style.overflow = 'hidden';
      const a = dialog.animate([{ height: heightBefore + 'px' }, { height: heightAfter + 'px' }], { duration: 260, easing: 'cubic-bezier(.4, 0, .2, 1)' });
      a.onfinish = a.oncancel = () => { dialog.style.overflow = ''; };
    }
  }
  function fillInfo(): void {
    const kind = currentTurnCard();
    info.replaceChildren();
    decided = !(isPairCard(kind) && !turnCardPlayer(kind));
    if (isPairCard(kind) && !turnCardPlayer(kind)) {
      const picks = el('div', 'ae-draw-turn-picks');
      pairOptions(kind).forEach(p => {
        const b = el('button', 'ae-pair-pick', p.slice(1));
        b.type = 'button';
        b.dataset.kind = p;
        b.setAttribute('aria-label', T.pairChoiceLabel(Number(p.slice(1))));
        b.addEventListener('click', () => choose(p));
        picks.appendChild(b);
      });
      info.append(el('p', 'ae-draw-turn-who', T.pairChoiceTitle), picks);
      return;
    }
    // Turno già deciso: la scritta in bianco e, se gioca un giocatore, il suo token (sempre, anche senza scelta)
    info.appendChild(el('p', 'ae-draw-turn-who', whoText(kind)));
    // (turno nemesi: il token della nemesi, Assets/ui/turn-tokens/N.webp)
    const player = kind === 'nemesis' ? 'nemesis' : turnCardPlayer(kind);
    if (player) {
      const token = el('span', 'ae-draw-turn-token');
      token.dataset.kind = player;
      token.setAttribute('aria-hidden', 'true');
      info.appendChild(token);
    }
  }

  // Un tocco sul token: gioca quel giocatore (un passo di undo); la finestra resta aperta
  function choose(player: Giocatore): void {
    if (!drawn || !isPairCard(currentTurnCard()) || turnCardPlayer(currentTurnCard())) return;
    scegliGiocatoreCoppia(player);
    announce(T.trackPlayer(Number(player.slice(1))));
    // Scelto il giocatore la finestra si chiude subito (e lo sfondo va a sinistra)
    finish();
  }

  // Un tocco sul dorso: la carta si pesca e si gira
  function draw(): void {
    if (drawn || closed) return;
    drawn = true;
    pescaCartaTurno();
    const kind = currentTurnCard();
    stage.classList.add('is-drawn');
    const faceImg = document.createElement('img');
    faceImg.alt = '';
    const src = turnCardSrc(String(kind));
    faceImg.src = src;
    front.appendChild(faceImg);
    // La carta si gira quando la sua immagine è pronta (poco più di un attimo); al massimo si aspetta 300 ms
    Promise.race([loadImage(src), new Promise(r => setTimeout(r, 300))]).then(() => {
      flip.classList.add('is-flipped');
      buzz(30);
      setTimeout(renderInfo, 120);
    });
    if (kind === 'nemesis') {
      // Il turno nemesi si disegna alla chiusura: ora solo la barra dei turni
      renderTurnTrack();
      announce(T.trackNemesisResolve);
    } else {
      richiediRidisegno();
      announce(turnTrack.getAttribute('aria-label'));
    }
    turnTrack.classList.remove('is-changed');
    void turnTrack.offsetWidth;
    turnTrack.classList.add('is-changed');
  }
  stage.addEventListener('click', draw);
  dialog.addEventListener('click', () => { if (decided) finish(); });

  // Un tocco fuori dalla finestra (o Esc, Indietro) la chiude
  let closeModalFn = () => {};
  function finish(): void {
    if (closed) return;
    closed = true;
    closeModalFn();
    if (drawn && partita.resolving) {
      passaAlTurnoNemesi();
      return;
    }
    // Carta 1/2 o 3/4 non ancora scelta: la scelta scende nel pulsante in basso (come toccando fuori dalla sua finestra)
    if (drawn && isPairCard(currentTurnCard()) && !turnCardPlayer(currentTurnCard())) ui.pairMinimized = pairChoiceKey();
    richiediRidisegno();
    pulsantePrincipale.focus({ preventScroll: true });
  }
  // (chiusa da un'altra strada, per esempio closeAllModals a una partita nuova: niente seguito, solo il segno "aperta" si spegne)
  closeModalFn = openModal(dialog, { onCancel: finish, initialFocus: stage, closeOnScrim: false, onClosed: () => { closed = true; ui.pescaTurnoAperta = false; app.classList.remove('is-draw-turn'); } });
  const backdrop = dialog.parentElement;
  if (backdrop) {
    backdrop.classList.add('ae-draw-turn-backdrop');
    // Si chiude solo con un tocco che comincia e finisce fuori dalla finestra (mai per un tocco sulla finestra, anche se cambia
    // misura mentre lo si fa)
    let downOutside = true;
    dialog.addEventListener('pointerdown', () => { downOutside = false; });
    backdrop.addEventListener('pointerdown', e => { downOutside = e.target === backdrop; });
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop && downOutside) finish();
      downOutside = true;
    });
  }
  loadImage(turnCardSrc('back'));
}
