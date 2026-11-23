// ui/schermate/turno-nemesi.ts: turno nemesi (VistaRisoluzione: carosello, fascia, pulsante principale, pesca), vite
// di Gravehold e della nemesi, banner al centro, e render() di tutta l'app. Provvisorio: render() andrà in ui/.
// Dipende da: regole/ (vite, turno-nemesi), stato/ (condivise, stato, partita, salvataggio), dati/dati.ts, ui/testi.ts,
// ui/componenti (componenti, dialoghi, testata, pesca-undo, menu-laterale), ui/eventi.ts, ui/schermate
// (turno-giocatori, mazzo-turni, statistiche, crea-mazzo). Usato da: quasi tutta l'interfaccia (render), eventi,
// stato/partita.ts, stato/salvataggio.ts.

import * as Vite from '../../regole/vite.ts';
import * as Nemesi from '../../regole/turno-nemesi.ts';
import type { Effetto } from '../../regole/turno-nemesi.ts';
import { G } from '../../stato/condivise.ts';
import { I18N_IT } from '../testi.ts';
import { app, backBtn, byId, CARD_BACK, CARD_RATIO, cssUrl, DRAW_MS, duration, focusEl, GRAVEHOLD_LIFE, nemesisBtn, nemesisStartLife, phaseLabel, queueView, rail, reducedMotion, resolveBtn, resolveHint, resolveView, ui } from '../../stato/stato.ts';
import type { CartaDaGirare } from '../../stato/stato.ts';
import { battleOf } from '../../dati/dati.ts';
import { awaitingTurnCard, currentTurnCard, drawFirstTurn, entryByUid, hpUnset, isPairCard, nextTurnCard, turnCardPlayer, turnRoundOver } from '../../stato/partita.ts';
import { cardArt, el, hasHp, icon, need, nextCardItem, nextSlotItem, placeholderArt, query, queryAll, queueItem, statusText, tokenIcons } from '../componenti/componenti.ts';
import { announce, button, loadImage, modals, openModal } from '../componenti/dialoghi.ts';
import { FAST_SCROLL_MS, cancelFastScroll, centredQueueUid, ensureQueueRail, fastScrollTo, openCardDialog, queueRail, renderQueue, saveAllDrafts, scrollItemInto, updateInfo } from './turno-giocatori.ts';
import { act, lockFor, updateUndoBtn } from '../../stato/salvataggio.ts';
import { renderTurnTrack, turnTrack, turnTrackBar } from '../eventi.ts';
import { animDone, needsPairChoice } from './mazzo-turni.ts';
import { BG_SLIDE_MS, ENTER_MS, FLY_MS, MORPH_MS, checkVictory, flyToDiscard, renderDockPiles, toPlayersTurn } from '../componenti/testata.ts';
import { showDefeat, showVictory } from './statistiche.ts';
import { openGameSetup } from './crea-mazzo.ts';
import { animateDrawIn } from '../componenti/pesca-undo.ts';
import { currentGraveholdBg } from '../componenti/menu-laterale.ts';
import type { TipoVita, VoceInGioco } from '../../tipi/partita.ts';

// --- VistaRisoluzione (turno nemesi) ---

// Scritta al centro ("Tier 2", "Tier 3", "Partita iniziata"), marcata: entra ingrandendosi con un bagliore dorato,
// resta, poi svanisce (1,76 s). App oscurata e non si può toccare; dopo si continua normalmente.
// Un testo lungo ha un carattere più piccolo (is-long), così sta nello schermo del telefono.
export const TIER_BANNER_MS = 1760;

// Perché l'animazione non vada a scatti: il carattere Cinzel a 64px si carica all'avvio (preloadBannerFont); la
// scritta entra ferma e invisibile (is-preparing), si aspetta che il carattere sia pronto (al massimo 300 ms) e due
// fotogrammi, poi parte l'animazione (non nello stesso fotogramma del ridisegno dell'app).
export function showBanner(text: string): void {
  const banner = el('div', 'ae-tier-banner is-preparing');
  banner.setAttribute('role', 'status');
  banner.appendChild(el('span', 'ae-tier-banner-text' + (text.length > 8 ? ' is-long' : ''), text));
  document.body.appendChild(banner);
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    void banner.offsetWidth;
    banner.classList.remove('is-preparing');
    buzz([40, 60, 120]);
    setTimeout(() => banner.remove(), TIER_BANNER_MS);
  };
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load(BANNER_FONT, text).catch(() => {}) : Promise.resolve();
  Promise.race([fontReady, new Promise(r => setTimeout(r, 300))]).then(() => {
    if (typeof window.requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go));
    // il browser di prova non esegue requestAnimationFrame
    setTimeout(go, 60);
  });
}

export const BANNER_FONT = '600 64px Cinzel';

export function preloadBannerFont(): void {
  if (document.fonts && document.fonts.load) document.fonts.load(BANNER_FONT, 'Tier 123 Partita iniziata Vittoria!').catch(() => {});
}

// Vibrazione breve (solo dove il telefono la supporta: Android; iOS la ignora)
export function buzz(pattern: number | number[]): void {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (err) { /* niente vibrazione */ }
}

// Nome della nemesi in testata: il blocco è largo al massimo quanto la sua colonna (style.css .ae-phase max-width) e,
// se a 18px il nome non ci sta, il carattere scende in proporzione finché ci sta tutto, senza limite inferiore.
// L'altezza della riga resta 24px (line-height in px) e il letter-spacing in em segue la dimensione.
// root: la testata della partita o la sua copia (finestra del mazzo dei turni). Vale anche per il nome toccabile di
// "Crea mazzo" (.ae-phase-name--button). Si ricalcola a ogni render, al ridimensionamento e dopo il caricamento dei
// caratteri (document.fonts.ready), così non si misura con il carattere di riserva.
export function fitPhaseName(root: ParentNode | null = phaseLabel): void {
  const name = root && query(root, '.ae-phase-name', HTMLElement);
  if (!name || !name.isConnected) return;
  name.style.fontSize = '';
  const style = getComputedStyle(name);
  const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const room = name.clientWidth - pad;
  const text = name.scrollWidth - pad;
  // Nome nascosto (pagina iniziale sopra, testata non disegnata) o che ci sta già: carattere di base
  if (room <= 0 || text <= room + 0.5) return;
  const base = parseFloat(style.fontSize) || 18;
  let size = Math.floor(base * room / text * 100) / 100;
  name.style.fontSize = size + 'px';
  // Arrotondamenti del testo: si scende ancora di poco finché non c'è più niente di nascosto
  for (let i = 0; i < 12 && name.scrollWidth > name.clientWidth; i++) {
    size = Math.floor(size * 98) / 100;
    name.style.fontSize = size + 'px';
  }
}

// Disegna tutto in base allo stato
export function render(): void {
  // Tra Undo e Menu, nei due turni: il nome della nemesi della partita e sotto la riga con la battaglia (numero nella
  // fiamma, Assets/ui/icons/flame.png), l'icona del numero di giocatori (Assets/ui/icons/players-1..4.png, usata come
  // maschera) e "Turno N" (giri del mazzo dei turni, nascosto prima del primo turno nemesi); separati da |
  const turnLine = el('span', 'ae-phase-turn');
  const players = Math.max(1, Math.min(4, Number(G.settings.players) || 1));
  const playersIcon = el('span', 'ae-players-icon');
  playersIcon.style.setProperty('--ae-players-icon', cssUrl(`Assets/ui/icons/players-${players}.png`));
  playersIcon.setAttribute('role', 'img');
  playersIcon.setAttribute('aria-label', I18N_IT.players(players));
  const turnText = el('span', '', I18N_IT.turnN(G.turnOrder.round));
  turnText.hidden = !(G.turnOrder.round >= 1);
  const battleNo = battleOf(G.settings.nemesis);
  const battle = el('span', 'ae-battle-flame', battleNo ? String(battleNo) : '?');
  battle.setAttribute('role', 'img');
  battle.setAttribute('aria-label', battleNo ? I18N_IT.battle(battleNo) : I18N_IT.battleMissing);
  const sep = () => { const s = el('span', 'ae-info-sep', '|'); s.setAttribute('aria-hidden', 'true'); return s; };
  const sep2 = sep();
  sep2.hidden = G.turn < 1;
  turnLine.append(battle, sep(), playersIcon, sep2, turnText);
  phaseLabel.replaceChildren(el('span', 'ae-phase-name', G.settings.nemesis || ''), turnLine);
  // Modalità test: "TEST · <scenario>" sempre visibile, sotto il nome della nemesi (non copre i comandi)
  if (G.testRun) phaseLabel.appendChild(el('span', 'ae-phase-test', I18N_IT.testLabel(String(G.testRun.name))));
  queueView.hidden = G.resolving;
  // la classe si toglie solo a vista nascosta (toglierla a vista visibile farebbe ripartire la dissolvenza)
  if (G.resolving) queueView.classList.remove('is-from-nemesis');
  resolveView.hidden = !G.resolving;
  app.classList.toggle('is-nemesis-turn', G.resolving);
  if (!G.resolving) app.classList.remove('is-draw-phase');
  nemesisBtn.hidden = G.resolving;
  nemesisBtn.disabled = !G.deckSetup;
  // "Turno Nemesi" con l'illustrazione della nemesi della partita (come nel menu iniziale), velata per leggere la
  // scritta. Turno di un giocatore: niente illustrazione, fondo tenue del colore del giocatore (wild: il colore del
  // giocatore che è wild nel giro; carta 1/2 o 3/4 non ancora scelta: metà e metà dei due colori; attesa di "Pesca carta
  // turno": fondo grigio chiaro tenue, come il wild)
  const turnCard = currentTurnCard();
  const playerKind = turnCardPlayer(turnCard) || (turnCard === 'wild' || isPairCard(turnCard) ? turnCard : null)
    || (awaitingTurnCard() ? 'wild' : null);
  nemesisBtn.classList.toggle('has-player-color', !!playerKind);
  if (playerKind) nemesisBtn.dataset.kind = playerKind;
  else delete nemesisBtn.dataset.kind;
  const nemesisArtNow = !playerKind && G.settings.nemesis ? G.nemesisArt[G.settings.nemesis] : undefined;
  nemesisBtn.classList.toggle('has-nemesis-art', !!nemesisArtNow);
  if (nemesisArtNow) nemesisBtn.style.setProperty('--ae-nemesis-art', cssUrl(encodeURI(String(nemesisArtNow.portrait))));
  else nemesisBtn.style.removeProperty('--ae-nemesis-art');
  nemesisBtn.setAttribute('aria-disabled', String(ui.isTransitioning));
  // Turno giocatori con modifiche non salvate: il pulsante principale le salva
  const saving = !G.resolving && ui.drafts.size > 0;
  // A inizio giro (dopo il primo) "Pesca la prima carta turno"; all'ultimo turno del giro "Fine turno · Mischia mazzo"
  // (anche durante l'animazione del mazzo mischiato)
  nemesisBtn.textContent = saving ? I18N_IT.saveChanges
    : ui.trackShuffle ? I18N_IT.endTurnShuffle
    : awaitingTurnCard() ? (G.turnOrder.round >= 1 && !(G.turnOrder.history || []).length ? I18N_IT.drawFirstTurnCard : I18N_IT.drawTurnCard)
    : turnRoundOver() ? I18N_IT.endTurnShuffle : I18N_IT.endTurn;
  nemesisBtn.classList.toggle('is-save', saving);
  // "Crea mazzo": al posto del pulsante il cursore; sfondo nero fino alla fine del banner "Partita iniziata"
  if (ui.deckBuilding) nemesisBtn.hidden = true;
  if (G.deckSlider) G.deckSlider.box.hidden = !ui.deckBuilding;
  app.classList.toggle('is-deck-dark', ui.deckDark);
  app.classList.toggle('is-deck-building', ui.deckBuilding);
  // Nome della nemesi: durante "Crea mazzo" si tocca e apre la finestra con nemesi e giocatori
  const phaseName = phaseLabel.querySelector('.ae-phase-name');
  if (ui.deckBuilding && phaseName) {
    const nameBtn = el('button', 'ae-phase-name ae-phase-name--button', G.settings.nemesis || '');
    nameBtn.type = 'button';
    nameBtn.setAttribute('aria-haspopup', 'dialog');
    nameBtn.addEventListener('click', openGameSetup);
    phaseName.replaceWith(nameBtn);
  }
  fitPhaseName();
  if (G.cancelDraftsBtn) {
    G.cancelDraftsBtn.hidden = !saving || ui.deckBuilding;
    need(G.cancelDraftsBtn.parentElement, 'riga del pulsante principale').hidden = G.resolving;
  }
  updateInfo();
  renderDockPiles();
  renderTurnTrack();
  updateUndoBtn();
  if (ui.tierBanner) {
    ui.tierWaitUntil = performance.now() + TIER_BANNER_MS;
    showBanner(I18N_IT.tierN(ui.tierBanner));
    ui.tierBanner = null;
  }
  renderLives();
  if (G.resolving) renderResolve();
  else {
    resolveBtn.hidden = true;
    backBtn.hidden = true;
    resolveHint.hidden = true;
    renderQueue();
  }
  checkVictory();
}

export function activeEntry(): VoceInGioco | null {
  return G.queue[G.currentIndex] || null;
}

// Passo "da pescare": tutte le carte in gioco sono state risolte; si vede la prossima carta del mazzo coperta e il
// pulsante "Pesca". Si pesca solo quando il giocatore lo tocca (la carta poi si gira).
export const DRAW_UID = -1;

export function isDrawStep(): boolean {
  return Nemesi.isDrawStep(G);
}

export function canDraw(): boolean {
  return Nemesi.canDraw(G);
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

// Riga delle vite SOTTO la fascia delle carte piccole, nei due turni: Gravehold a sinistra, nemesi a destra.
// Un solo elemento, spostato dopo la fascia del turno attivo (le carte grandi prendono lo spazio che resta: flex).
// Non c'è durante "Crea mazzo". Toccando un box si apre la finestra della vita (openLifeDialog).
export let livesRow: HTMLDivElement | null = null;

export function ensureLivesRow(): HTMLDivElement {
  if (livesRow) return livesRow;
  const row = el('div', 'ae-lives');
  livesRow = row;
  const box = (kind: TipoVita) => {
    const b = el('button', 'ae-life-box ae-life-box--' + kind);
    b.type = 'button';
    b.dataset.kind = kind;
    // Solo il numero (niente nome né goccia); il nome resta nell'etichetta per i lettori di schermo
    b.append(el('span', 'ae-life-value'));
    // Scritta piccolissima sopra il box (alta 7px, solo da vedere: il nome è già nell'etichetta del pulsante)
    const tag = el('span', 'ae-life-tag', kind === 'grave' ? 'Gravehold' : 'Nemesis');
    tag.setAttribute('aria-hidden', 'true');
    b.appendChild(tag);
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', () => openLifeDialog(kind));
    return b;
  };
  row.append(box('grave'), box('nemesis'));
  return row;
}

export function renderLives(): void {
  const row = ensureLivesRow();
  const railParent = need(rail.parentElement, 'contenitore della fascia');
  const anchor = G.resolving ? (railParent.classList.contains('ae-rail-row') ? railParent : rail) : ensureQueueRail();
  if (row.previousElementSibling !== anchor) anchor.after(row);
  row.hidden = !!ui.deckBuilding;
  // Sfondi dei box: Gravehold = immagine scelta nel Menu; nemesi = ritratto della nemesi della partita
  const setBg = (b: HTMLElement, src: string | null | undefined) => {
    if (src) b.style.setProperty('--ae-life-bg', cssUrl(encodeURI(src)));
    else b.style.removeProperty('--ae-life-bg');
    b.classList.toggle('has-bg', !!src);
  };
  const lifeBox = (kind: TipoVita) => need(query(row, `[data-kind="${kind}"]`, HTMLElement), 'box della vita ' + kind);
  // Il box resta nascosto solo mentre la sua finestra è aperta
  if (!document.querySelector('.ae-life-modal')) queryAll(row, '.ae-life-box', HTMLElement).forEach(b => { b.style.visibility = ''; });
  setBg(lifeBox('grave'), currentGraveholdBg().src);
  const art = G.settings.nemesis ? G.nemesisArt[G.settings.nemesis] : undefined;
  setBg(lifeBox('nemesis'), art && art.portrait);
  const lives: [TipoVita, string, number][] = [['grave', I18N_IT.graveholdName, G.graveLife], ['nemesis', G.settings.nemesis || '', G.nemesisLife]];
  lives.forEach(([kind, name, value]) => {
    const b = lifeBox(kind);
    need(b.querySelector('.ae-life-value'), 'numero della vita').textContent = String(value);
    b.classList.toggle('is-zero', value <= 0);
    b.setAttribute('aria-label', I18N_IT.lifeAria(name, value));
  });
}

// Finestra della vita di Gravehold o della nemesi, come quella del minion: numero, −5 −1 +1 +5 (mai sopra la vita
// iniziale né sotto 0). Chiudendo, un passo di undo e salvataggio. A 0: nemesi → Vittoria, Gravehold → Sconfitta.
export function openLifeDialog(kind: TipoVita): void {
  if (ui.isTransitioning || modals.length) return;
  const grave = kind === 'grave';
  const name = grave ? I18N_IT.graveholdName : (G.settings.nemesis || '');
  const original = grave ? G.graveLife : G.nemesisLife;
  // Tetto: il valore iniziale, o la vita attuale se è più alta (regole/vite.ts)
  const cap = Vite.lifeCap(original, grave ? GRAVEHOLD_LIFE : nemesisStartLife());
  let draft = original;
  let close = () => {};
  // Finestra a pillola al centro, come il box (stesso sfondo): in alto il numero grande, sotto −5 −1 · +1 +5.
  // Niente Conferma: i tocchi cambiano il numero, chiudendo (tocco fuori, Esc, Indietro) la vita si applica una volta
  // sola (un passo di undo, si salva); a 0 → Vittoria o Sconfitta.
  const dialog = el('div', 'ae-life-modal ae-life-modal--' + kind);
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', `${name}, ${I18N_IT.lifeKind}`);
  const box = livesRow && query(livesRow, `[data-kind="${kind}"]`, HTMLElement);
  const bg = box && box.style.getPropertyValue('--ae-life-bg');
  if (bg) { dialog.style.setProperty('--ae-life-bg', bg); dialog.classList.add('has-bg'); }
  const number = el('p', 'ae-life-modal-number');
  number.setAttribute('aria-live', 'polite');
  // In basso a destra del numero il cambio rispetto a prima ("+x" / "−y"), solo se c'è
  const value = el('span', 'ae-life-modal-value');
  const delta = el('span', 'ae-life-modal-delta');
  number.append(value, delta);
  const controls = el('div', 'ae-life-modal-controls');
  const steps: [number, HTMLButtonElement][] = [];
  [-5, -1, 1, 5].forEach(step => {
    const b = el('button', 'ae-life-step', step > 0 ? '+' + step : '−' + Math.abs(step));
    b.type = 'button';
    b.addEventListener('click', () => { draft = Vite.stepLife(draft, step, cap); update(); });
    b.setAttribute('aria-label', (step > 0 ? 'Aggiungi ' : 'Togli ') + Math.abs(step) + ' punti vita');
    steps.push([step, b]);
    if (step === 1) controls.appendChild(el('span', 'ae-life-step-gap'));
    controls.appendChild(b);
  });
  // Sopra la pillola, in Cinzel, "Gravehold" o "Nemesi" (fa parte della finestra: si ingrandisce con lei)
  const title = el('h2', 'ae-life-modal-title', grave ? I18N_IT.graveholdName : I18N_IT.nemesisWord);
  dialog.append(title, number, controls);
  let shown: number | null = null;
  function update() {
    // (Number: al primo disegno shown è null e vale 0, come nel confronto di JavaScript)
    renderLifeDigits(value, String(draft), shown === null ? null : String(shown), draft < Number(shown) ? -1 : 1);
    shown = draft;
    const change = draft - original;
    delta.textContent = change > 0 ? '+' + change : change < 0 ? '−' + Math.abs(change) : '';
    delta.hidden = change === 0;
    number.classList.toggle('is-loss', change < 0);
    number.classList.toggle('is-gain', change > 0);
    steps.forEach(([step, b]) => { b.disabled = step > 0 ? draft >= cap : draft <= 0; });
  }
  // La finestra esce dal box e si ingrandisce al centro; chiudendo torna nel box (il box intanto è nascosto)
  const zoomFrom = () => {
    const b = box && box.getBoundingClientRect(), d = dialog.getBoundingClientRect();
    if (!b || !b.width || !d.width) return null;
    return `translate(${(b.left + b.width / 2) - (d.left + d.width / 2)}px, ${(b.top + b.height / 2) - (d.top + d.height / 2)}px) scale(${b.width / d.width}, ${b.height / d.height})`;
  };
  const animated = () => !reducedMotion.matches && !!dialog.animate;
  let closing = false;
  function commit() {
    if (closing) return;
    closing = true;
    const changed = draft !== original;
    const value = draft;
    if (changed) {
      act(() => { Vite.setLife(G, kind, value); });
      render();
    }
    const done = () => {
      close();
      if (box) box.style.visibility = '';
      // A 0: nemesi = Vittoria, Gravehold = Sconfitta (regole/vite.ts)
      const outcome = Vite.lifeOutcome(kind, value, changed);
      if (outcome === 'defeat') showDefeat(); else if (outcome === 'victory') showVictory();
    };
    const to = animated() && zoomFrom();
    if (!to) { done(); return; }
    const back = need(dialog.parentElement, 'sfondo della finestra della vita');
    back.style.pointerEvents = 'none';
    const out = dialog.animate([{ transform: 'none', opacity: 1 }, { transform: to, opacity: .9 }],
      { duration: LIFE_ZOOM_MS, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
    back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LIFE_ZOOM_MS, easing: 'ease-in', fill: 'forwards' });
    animDone([out], LIFE_ZOOM_MS).then(done);
  }
  update();
  dialog.classList.add('is-zooming');
  close = openModal(dialog, { onCancel: commit, initialFocus: steps[1][1] });
  need(dialog.parentElement, 'sfondo della finestra della vita').classList.add('ae-life-backdrop');
  const from = animated() && zoomFrom();
  if (box) box.style.visibility = 'hidden';
  if (from) {
    dialog.animate([{ transform: from, opacity: .9 }, { transform: 'none', opacity: 1 }],
      { duration: LIFE_ZOOM_MS, easing: 'cubic-bezier(.2, 0, 0, 1)' });
  }
}

export const LIFE_ZOOM_MS = 280;

// Cifre della vita che scorrono. Ogni cifra ha il suo posto; sopra e sotto il numero c'è una maschera (il bordo della
// riga, clip-path su .ae-life-modal-value). Quando una cifra cambia, scendendo (−) la vecchia sale e sparisce sotto la
// linea in alto mentre la nuova arriva da sotto la linea in basso; salendo (+) il contrario. La vecchia diventa via
// via trasparente, la nuova il contrario. Cifre allineate da destra (unità con unità, decine con decine).
export const LIFE_DIGIT_MS = 260;

export function renderLifeDigits(holder: HTMLElement, text: string, before: string | null, dir: number): void {
  holder.replaceChildren();
  const animate = before !== null && before !== text && !reducedMotion.matches && !!holder.animate;
  const len = Math.max(text.length, before ? before.length : 0);
  // dir −1 (scende): la vecchia va su (−100%), la nuova arriva da giù (+100%); dir +1 il contrario (% dell'altezza)
  const out = dir * 100, inFrom = -dir * 100;
  const opts = { duration: LIFE_DIGIT_MS, easing: 'cubic-bezier(.3, 0, .2, 1)' };
  for (let i = len - 1; i >= 0; i--) {
    const now = text[text.length - len + i] || '';
    const old = before ? before[before.length - len + i] || '' : '';
    const slot = el('span', 'ae-life-digit-slot');
    if (now) slot.appendChild(el('span', 'ae-life-digit', now));
    holder.prepend(slot);
    if (!animate || now === old) continue;
    const digit = slot.querySelector('.ae-life-digit');
    if (digit) digit.animate([{ transform: `translateY(${inFrom}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], opts);
    if (old) {
      const ghost = el('span', 'ae-life-digit ae-life-digit--old' + (now ? '' : ' is-alone'), old);
      ghost.setAttribute('aria-hidden', 'true');
      slot.appendChild(ghost);
      const a = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${out}%)`, opacity: 0 }], { ...opts, fill: 'forwards' });
      // la cifra che se ne va senza una nuova al suo posto (per esempio 10 → 9) tiene il posto finché scorre
      animDone([a], LIFE_DIGIT_MS).then(() => { if (now) ghost.remove(); else slot.remove(); });
    }
  }
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
  const isNewStep = G.newIndex >= 0;
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
  const railItems: (HTMLButtonElement | HTMLDivElement)[] = G.queue.map((entry, i) => queueItem(entry, {
    compact: true, index: i, total: G.queue.length, current: entry === active, viewed: entry === viewed
  }));
  // Potere da risolvere: anche nella fascia il token lampeggia e diventa grigio insieme a quello della carta grande.
  // La fascia si ridisegna spesso: l'animazione riparte dal punto giusto (ritardo negativo) o il token resta nascosto.
  if (G.newIndex < 0 && active && active.data.type === 'Power') {
    const key = G.turn + ':' + G.currentIndex + ':' + active.uid + ':' + active.tokens;
    // Prima carta del turno: l'animazione parte quando lo sfondo ha finito di scorrere (ui.bgSlideUntil)
    if (ui.autoTokenKey !== key) { ui.autoTokenKey = key; ui.autoTokenAt = Math.max(performance.now(), ui.bgSlideUntil || 0); }
    const badge = railItems[G.currentIndex] && query(railItems[G.currentIndex], '.ae-status-badge', HTMLElement);
    if (badge) {
      badge.classList.add('is-auto-token');
      badge.style.setProperty('--ae-token-delay', (ui.autoTokenAt - performance.now()) + 'ms');
    }
  }
  // In fondo alla fascia, al passo Pesca: la prossima carta del mazzo, coperta (retro) con NUOVA
  if (drawStep && canDraw()) railItems.push(nextCardItem({ current: drawStep, viewed: viewingDraw }));
  // Fase di risoluzione: al posto della carta da pescare solo una cornice tratteggiata grigia (come mazzo e scarti vuoti)
  else if (!drawStep && G.newIndex < 0 && canDraw()) railItems.push(nextSlotItem());
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

// px visibili di ogni carta vicina
export const PEEK_VISIBLE = 14;

// spazio tra le carte
export const PEEK_GAP = 12;

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
  if (G.newIndex < 0 && entry === G.queue[G.currentIndex] && entry.data.type === 'Power') {
    status.classList.add('is-auto-token');
    // stesso istante della fascia (dopo lo scorrimento dello sfondo, se è la prima carta del turno)
    status.style.setProperty('--ae-token-delay', ((ui.autoTokenAt || 0) - performance.now()) + 'ms');
  }
  // Carta appena pescata: durante il caricamento la riga è nascosta; mentre si gira, i token o la vita compaiono dopo
  // la rotazione. Un attacco pescato lampeggia di rosso.
  if (reveal && reveal.status === 'loading') slide.classList.add('is-draw-loading');
  if (reveal && (reveal.status === 'ready' || reveal.status === 'flipping')) slide.classList.add('is-drawing');
  if (entry.isNew && G.newIndex >= 0 && entry.data.type === 'Attack' && !(reveal && reveal.status === 'loading')) stage.classList.add('is-attack-drawn');
  // Carta da risolvere: lampeggia di rosso come l'attacco pescato (non i poteri con più di un token)
  if (G.newIndex < 0 && entry === G.queue[G.currentIndex] && !(entry.data.type === 'Power' && Number(entry.tokens) > 1)) {
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
  return (isDrawStep() || G.newIndex >= 0 ? 'solo' + G.newIndex + ':' + ui.viewedUid + '|' : '') + 'c' + G.currentIndex + '|' + G.queue.map(e => [e.uid, e.hp, e.tokens, e.isNew ? 1 : 0].join(':')).join('|')
    + '#' + (ui.reveal ? ui.reveal.uid + ':' + ui.reveal.status : '') + '#' + (ui.holdUid || '');
}

export function renderFocus(viewed: { uid: number }): void {
  let track = focusTrack;
  if (!track || !track.isConnected) {
    track = el('div', 'ae-focus-track');
    focusTrack = track;
    focusEl.replaceChildren(track);
    G.focusSignature = '';
  }
  // Token e vita della carta pescata compaiono dopo il banner Tier (se c'è)
  focusEl.style.setProperty('--ae-tier-wait', Math.max(0, Math.round(ui.tierWaitUntil - performance.now())) + 'ms');
  const prevUid = focusEl.dataset.uid;
  const viewedChanged = prevUid !== String(viewed.uid);
  focusEl.dataset.uid = String(viewed.uid);
  if (focusStateSignature() !== G.focusSignature || !track.children.length) {
    // Passo Pesca: si vede solo la carta da girare (le carte già risolte a sinistra spariscono); se si guarda un'altra
    // carta dalla fascia, c'è solo quella accanto
    let slides: HTMLDivElement[];
    // Anche dopo la pesca si vede solo la carta pescata. La carta da pescare e quella pescata sono un po' più grandi.
    if (isDrawStep() || G.newIndex >= 0) {
      const drawn = G.newIndex >= 0 ? G.queue[G.newIndex] : null;
      const mainUid = drawn ? drawn.uid : DRAW_UID;
      const other = viewed.uid !== mainUid ? entryByUid(viewed.uid) : null;
      const main = drawn ? focusSlide(drawn) : drawSlide();
      main.classList.add('is-big');
      slides = [...(other ? [focusSlide(other)] : []), main];
    } else {
      slides = G.queue.map(focusSlide);
    }
    track.replaceChildren(...slides);
    // La firma si calcola dopo: disegnare la carta pescata può far avanzare il suo stato (pronta → si gira)
    G.focusSignature = focusStateSignature();
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

// Larghezza della carta grande: UNA sola regola per turno giocatori e turno nemesi, così sono sempre uguali.
// Sopra la carta il box vita/token (STATUS_H + 8 di spazio); i comandi del turno giocatori (52px) stanno sotto, quindi
// si riserva lo spazio anche nel turno nemesi; il blocco è centrato in verticale.
// Altezza della riga vita/token sopra la carta: deve restare uguale a style.css .ae-focus-status e .queue-slot
export const STATUS_H = 37;

export function sharedCardWidth(boxW: number, boxH: number, padY: number, peekRoom: number): number {
  const byWidth = boxW - 16 - peekRoom; // 8px di margine per lato
  const byHeight = (boxH - padY - STATUS_H - 8) / CARD_RATIO;
  const byControls = (boxH - 2 * 52 - STATUS_H - 8) / CARD_RATIO;
  return Math.floor(Math.min(byWidth, byHeight, byControls));
}

// Tablet e desktop (da 768px): la partita sta in una colonna al centro (--ae-col su .ae-shell, style.css). La colonna
// è larga quanto la carta grande (misurata solo dall'altezza: in larghezza c'è spazio) più un pezzo delle vicine
// (COLUMN_PEEK per lato), mai meno di COLUMN_MIN né più dello schermo. Sotto i 768px la colonna è lo schermo intero.
export const COLUMN_MIN = 440;

export const COLUMN_PEEK = 42;

export function sizeColumn(box: HTMLElement): void {
  if (window.innerWidth < 768) { app.style.removeProperty('--ae-col'); return; }
  const style = getComputedStyle(box);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const card = sharedCardWidth(Infinity, box.clientHeight, padY, 0);
  if (!isFinite(card) || card <= 0) return;
  const col = Math.min(window.innerWidth, Math.max(COLUMN_MIN, card + 2 * (COLUMN_PEEK + PEEK_GAP) + 16));
  const current = parseFloat(app.style.getPropertyValue('--ae-col')) || 0;
  if (Math.abs(current - col) >= 1) app.style.setProperty('--ae-col', col + 'px');
}

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
  const peekRoom = G.queue.length > 1 ? 2 * (PEEK_VISIBLE + PEEK_GAP) : 0;
  const width = Math.max(40, sharedCardWidth(focusEl.clientWidth, focusEl.clientHeight, padY, peekRoom));
  focusEl.style.setProperty('--ae-focus-w', width + 'px');
  focusEl.style.setProperty('--cw', width + 'px');
  track.style.paddingInline = Math.max(0, (focusEl.clientWidth - width) / 2) + 'px';
  // Carta da pescare e carta pescata: più grandi (fino al 30%), stessa misura per dorso e fronte. Cresce solo la carta:
  // la riga vita/token resta grande come nelle altre carte. Il blocco (riga + carta) è centrato in verticale tra la
  // fascia piccola e il pulsante (style.css .ae-focus-slide.is-big), con 4px di margine sopra e sotto.
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
    if (G.resolving) renderResolve();
  });
}

// Scarica in anticipo le immagini che serviranno: prossima carta del mazzo e carta dopo quella da risolvere
export function preloadNext(): void {
  const next = G.deck[G.deck.length - 1];
  if (next) loadImage(encodeURI(next.image));
  const after = G.queue[G.currentIndex + 1];
  if (after) loadImage(encodeURI(after.data.image));
}

export function startResolution(): void {
  // Un nuovo turno: la carta pescata nel turno precedente non è più "nuova"; coda vuota: si va subito alla carta da
  // pescare (o, se non c'è niente da pescare, il turno finisce) (regole/turno-nemesi.ts)
  Nemesi.startResolution(G);
}

// Pesca una carta in fondo alla coda e la mostra come nuova (NUOVA, entra girandosi dal retro)
export function drawNewCard(): void {
  // La carta in cima entra in gioco come nuova (regole/turno-nemesi.ts: anche il tempo del Tier nelle statistiche);
  // mazzo vuoto (non si rimescola): si torna alla VistaCoda
  const drawn = Nemesi.drawNewCard(G, () => G.nextUid++, () => Date.now());
  if (!drawn) return;
  const { data } = drawn.entry;
  ui.lastDrawnUid = drawn.entry.uid;
  // Carta pescata: vibrazione breve, doppia e più forte per un attacco (la scritta Tier, se c'è, ha la sua)
  buzz(data.type === 'Attack' ? [80, 60, 80] : 30);
  // Prima carta del Tier 2 o del Tier 3: scritta "Tier N" al centro (mostrata da render)
  if (drawn.newTier) ui.tierBanner = drawn.newTier;
}

// Ritorno alla VistaCoda
export function endResolution(): void {
  Nemesi.endResolution(G);
}

export function nemesisTurn(): void {
  Nemesi.nemesisTurn(G);
}

// "Fine turno" nel turno di un giocatore: finisce il turno e si estrae il turno dopo dal mazzo dei turni.
// Nemesi: parte il turno nemesi; giocatore o wild: resta il turno giocatori, con il colore nuovo nella barra.
export function endPlayerTurn(): void {
  // Le modifiche non salvate si perdono; danno e cura del turno si azzerano (la vita attuale diventa il riferimento) e
  // le carte grigie (poteri pagati, minion a 0) vanno negli scarti (regole/turno-nemesi.ts)
  ui.drafts.clear();
  Nemesi.endPlayerTurnCards(G);
  if (nextTurnCard() === 'nemesis') nemesisTurn();
}

// Fine del turno nemesi ("Metti in gioco · Fine turno nemesi"): si estrae il turno dopo; se è di nuovo la nemesi, il
// turno nemesi riparte subito. Ultima carta del giro: mazzo dei turni mischiato e attesa
export function afterNemesisTurn(): void {
  if (nextTurnCard() === 'nemesis') nemesisTurn();
}

// Animazione "mazzo mischiato" della barra della fase, a fine giro. Le scritte sotto la barra svaniscono e le caselle
// diventano grigie e tutte uguali (render con ui.trackShuffle, transizioni di style.css); poi, veloci, le caselle si
// uniscono in una sola al centro, si fermano un attimo e tornano al loro posto. fadeMs: attesa della dissolvenza (0 se
// è già avvenuta, per esempio durante il passaggio dal turno nemesi)
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
    nemesisBtn.focus({ preventScroll: true });
    announce(I18N_IT.drawFirstTurnCard);
  });
  render();
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

// Logica del pulsante principale: agisce sulla carta da risolvere in base al suo tipo.
// Restituisce cosa è successo, per l'animazione: 'token', 'discard', 'next', 'play'.
export function resolveCurrent(): Effetto {
  return Nemesi.resolveCurrent(G);
}

// Tocco sul pulsante principale: prima la partita cambia (un passo di undo, salvataggio), poi l'animazione.
// Fino alla fine dell'animazione il pulsante non accetta altri tocchi (un tocco = un solo evento di gioco).
export function onResolveClick(): void {
  if (!G.resolving || ui.isTransitioning) return;
  if (isDrawStep()) {
    // "Pesca": la carta coperta diventa la carta pescata, che si gira
    if (ui.viewedUid !== DRAW_UID) return;
    const roundAtDraw = G.turnOrder.round;
    act(() => {
      drawNewCard();
      // Mazzo vuoto: il turno nemesi finisce e si estrae il turno dopo
      if (!G.resolving) afterNemesisTurn();
    });
    if (G.resolving) {
      showActive(activeEntry());
      lockFor(duration('focus'));
    }
    render();
    // Mazzo vuoto all'ultimo turno del giro: mazzo dei turni mischiato
    if (!G.resolving && awaitingTurnCard() && G.turnOrder.round !== roundAtDraw) playTurnShuffle(SHUFFLE_FADE_MS);
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
  const wasNewStep = G.newIndex >= 0;
  const turnBefore = G.turn;
  const roundBefore = G.turnOrder.round;
  const effect = act(() => {
    const result = resolveCurrent();
    // Fine del turno nemesi: si estrae il turno dopo dal mazzo dei turni
    if (!G.resolving) afterNemesisTurn();
    return result;
  });
  // Dal mazzo dei turni è uscita di nuovo la nemesi: il turno nemesi riparte (scossa e annuncio)
  if (G.resolving && G.turn !== turnBefore) {
    shakeApp();
    announce(I18N_IT.trackNemesisResolve);
  }

  // Fine dell'ultimo turno del giro: mazzo dei turni mischiato; scritte e colori della barra svaniscono durante il
  // passaggio al turno giocatori, poi le caselle si uniscono e si separano
  const roundShuffled = !G.resolving && awaitingTurnCard() && G.turnOrder.round !== roundBefore;
  const shuffleAfter = roundShuffled ? () => playTurnShuffle(0) : undefined;
  if (roundShuffled) beginTrackShuffle();
  if (!G.resolving) {
    // Fine del turno nemesi: si torna alla VistaCoda con la carta pescata in vista
    // Carta appena pescata e messa in gioco (si prende dalla carta risolta, non da ui.lastDrawnUid: dopo un undo gli uid cambiano)
    const kept = (wasNewStep && entryByUid(active.uid)) || entryByUid(ui.lastDrawnUid);
    const anchorUid = kept ? kept.uid : (G.queue.length ? G.queue[G.queue.length - 1].uid : null);
    ui.queueAnchor = anchorUid ? { uid: anchorUid, align: G.queue.length === 1 ? 'center' : 'anchor' } : null;
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
      setTimeout(() => { toPlayersTurn(null); nemesisBtn.focus(); }, flyMs);
      return;
    }
    // Carta messa in gioco: passaggio morbido, la carta grande si trasforma nella carta del turno giocatori e le altre
    // entrano da sinistra (vedi toPlayersTurn)
    lockFor(reducedMotion.matches ? duration('phase') : Math.max(MORPH_MS, MORPH_MS / 2 + ENTER_MS) + 40, shuffleAfter);
    toPlayersTurn(kept && ghostSource ? kept.uid : null, ghostSource);
    if (wasNewStep) nemesisBtn.focus();
    return;
  }

  const next = activeEntry();
  // Carta risolta e scartata: vola verso la pila degli scarti in alto
  if (effect === 'discard' && ghostSource) flyToDiscard([ghostSource]);
  showActive(next);
  lockFor(duration(effect === 'discard' ? 'discard' : 'focus'));
  render();
  // Risolta l'ultima carta: la carta da pescare arriva volando dal mazzo, dopo che la carta scartata è atterrata
  if (isDrawStep()) animateDrawIn(effect === 'discard' && ghostSource ? FLY_MS + 60 : 0);
}

// Dopo un'azione si mostra la nuova carta da risolvere (o la carta appena pescata, che si gira). (Il parametro non si
// usa: la carta si rilegge dallo stato)
export function showActive(entry?: VoceInGioco | null): void {
  void entry;
  const current = activeEntry();
  ui.viewedUid = current ? current.uid : (isDrawStep() ? DRAW_UID : null);
  if (current && G.newIndex >= 0 && current.isNew && (!ui.reveal || ui.reveal.uid !== current.uid)) {
    startReveal(current);
    announce(I18N_IT.cardDrawn(current.data.name));
  }
  preloadNext();
}

export function onNemesisClick(): void {
  if (G.resolving || ui.isTransitioning || !G.deckSetup) return;
  // Durante "Crea mazzo" al posto del pulsante c'è il cursore (deckSlider)
  if (ui.deckBuilding) return;
  // Con modifiche non salvate il pulsante è "Salva modifiche"
  if (ui.drafts.size) {
    saveAllDrafts();
    return;
  }
  // Carta 1/2 o 3/4 senza giocatore: si sceglie nella finestra
  if (needsPairChoice()) return;
  // Fine dell'ultimo turno del giro: mazzo dei turni mischiato, animazione, poi "Pesca la prima carta turno"
  const roundEnding = !awaitingTurnCard() && turnRoundOver();
  act(awaitingTurnCard() ? drawFirstTurn : endPlayerTurn);
  if (roundEnding) {
    playTurnShuffle(SHUFFLE_FADE_MS);
    return;
  }
  if (!G.resolving) {
    // Dal mazzo dei turni è uscito un giocatore (o il wild): si resta nel turno giocatori, cambia il colore della barra
    render();
    announce(turnTrack.getAttribute('aria-label'));
    turnTrack.classList.remove('is-changed');
    void turnTrack.offsetWidth;
    turnTrack.classList.add('is-changed');
    return;
  }
  enterNemesisTurnView();
}

// Inizio del turno nemesi a schermo (dopo che lo stato è già passato al turno nemesi)
export function enterNemesisTurnView(): void {
  // Urgenza: una breve scossa dello schermo e una vibrazione
  shakeApp();
  // Lo sfondo scorre verso il lato della nemesi (0,8 s, style.css .ae-shell): il token della prima carta aspetta
  ui.bgSlideUntil = reducedMotion.matches ? 0 : performance.now() + BG_SLIDE_MS;
  ui.viewedUid = null;
  // Le carte non spariscono e non ricompaiono: niente dissolvenza della vista, la fascia piccola resta dove era
  // (stesso scorrimento); cambiano solo lo sfondo e i pulsanti
  const railScroll = queueRail ? queueRail.scrollLeft : 0;
  // Le carte grandi partono dalla carta che si stava guardando e scorrono fino alla prima da risolvere (renderFocus)
  const shownUid = G.queue.length ? centredQueueUid() : null;
  if (shownUid !== null && entryByUid(shownUid)) focusEl.dataset.uid = String(shownUid);
  else delete focusEl.dataset.uid;
  if (G.resolving) {
    showActive(activeEntry());
    resolveView.classList.remove('is-entering');
    lockFor(duration('phase'));
  }
  render();
  if (G.resolving) {
    rail.scrollLeft = railScroll;
    const current = query(rail, '[aria-current="true"]', HTMLElement);
    if (current) scrollItemInto(rail, current, 'nearest');
  }
  if (G.resolving) resolveBtn.focus();
  // Coda vuota: si va subito alla carta da pescare, che arriva dal mazzo
  if (isDrawStep()) animateDrawIn();
}

// Scossa breve dell'app all'inizio del turno nemesi (niente con riduzione del movimento)
export function shakeApp(): void {
  buzz([60, 40, 60]);
  if (reducedMotion.matches) return;
  app.classList.remove('is-shaking');
  void app.offsetWidth;
  app.classList.add('is-shaking');
  setTimeout(() => app.classList.remove('is-shaking'), 520);
}

// Mostra un'altra carta senza risolvere nulla (anteprima): non cambia mazzo, vita, token, scarti, turno, undo
export function viewCard(uid: number): void {
  if (!G.resolving || ui.holdUid) return;
  if ((uid === DRAW_UID ? !isDrawStep() : !entryByUid(uid)) || ui.viewedUid === uid) return;
  ui.viewedUid = uid;
  renderResolve();
}

export function moveView(step: number): void {
  const i = G.queue.findIndex(e => e.uid === ui.viewedUid);
  const next = G.queue[i + step];
  if (next) viewCard(next.uid);
}

export function backToActive(): void {
  const active = activeEntry();
  if (active) viewCard(active.uid);
  else if (isDrawStep()) viewCard(DRAW_UID);
  resolveBtn.focus();
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  window.addEventListener('resize', () => fitPhaseName());

  // La larghezza della testata cambia anche senza l'evento resize: rotazione, colonna del desktop, barra di scorrimento
  if ('ResizeObserver' in window) {
    let lastHeaderWidth = 0;
    new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width === lastHeaderWidth) return;
      lastHeaderWidth = width;
      fitPhaseName();
    }).observe(byId('topbar', HTMLElement));
  }

  if ('fonts' in document) document.fonts.ready.then(() => fitPhaseName());

  G.focusSignature = '';

  focusEl.addEventListener('scroll', () => {
    if (focusScrollFrame) return;
    // circa un controllo per fotogramma (setTimeout invece di requestAnimationFrame: funziona anche a pagina in background)
    focusScrollFrame = setTimeout(() => {
      focusScrollFrame = 0;
      if (!G.resolving || ui.holdUid || ui.isTransitioning || performance.now() < focusProgrammaticUntil) return;
      const uid = centredFocusUid();
      if (uid === null || uid === ui.viewedUid) return;
      ui.viewedUid = uid;
      ui.fromScroll = true;
      renderResolve();
      ui.fromScroll = false;
    }, 16);
  }, { passive: true });
}
