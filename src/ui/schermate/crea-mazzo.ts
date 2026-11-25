// ui/schermate/crea-mazzo.ts: la schermata "Crea mazzo" (prima del primo turno giocatori): i 9 mazzi da cui nasce il
// mazzo nemesi, le carte Specifiche in grande, la finestra con nemesi e giocatori (dal nome in testata), Ricomincia.
// Il cursore che porta le carte nel mazzo e la fine con "Partita iniziata" sono in crea-mazzo-cursore.ts.
// Livello 5 (ui/schermate/). Dipende da: dati/ (dati, rete), stato/ (partita, catalogo, preferenze), ui/ base (testi,
// pagina, dom, ridisegno), ui/componenti (animazioni, componenti, dialoghi, testata), crea-mazzo-cursore.ts (supporto).
// Usato da: navigazione.

import { T } from '../testi.ts';
import { battleOf } from '../../dati/dati.ts';
import { deckPlan, nuovaPartita } from '../../stato/partita.ts';
import { cardArt } from '../componenti/componenti.ts';
import { button, closeAllModals, dialogShell, openModal } from '../componenti/dialoghi.ts';
import { prefetchDeckImages } from '../../dati/rete.ts';
import type { Carta } from '../../tipi/dati.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { preferenze } from '../../stato/preferenze.ts';
import { CARD_BACK, mainEl, reducedMotion, ui } from '../pagina.ts';
import { clearTransition } from '../componenti/animazioni.ts';
import { el, query } from '../dom.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { azzeraCursore, azzeraVolo, deckSlider, KINDS } from './crea-mazzo-cursore.ts';

// --- Creazione del mazzo nemesi (dopo "Inizia partita") ---
// Si vedono i 9 mazzi da cui nasce il mazzo nemesi: righe Tier 1-3, colonne Base / Potenziate / Specifiche. Base e
// Potenziate sono mazzi coperti con il numero di carte che ne verranno prese; le Specifiche (sempre tutte) sono a faccia
// in su, aperte a ventaglio; toccandole si vedono grandi, scorrendo a destra e sinistra.
// "Crea mazzo" fa volare le carte una alla volta nel mazzo nemesi in alto a sinistra: prima il Tier 3 (in fondo al
// mazzo), poi il 2, poi l'1 (in cima), senza pause tra un Tier e l'altro; dentro ogni Tier le carte partono in ordine
// casuale dai tre mazzi. Il numero del mazzo sale a ogni carta. Alla fine la schermata sparisce e si è nel turno
// giocatori. Il mazzo vero è già fatto (nuovaPartita): l'animazione lo mostra soltanto.

// Carte Specifiche della nemesi della partita per un Tier (come in buildDeck)
export function specificCardsOf(tier: number): Carta[] {
  return catalogo.allCards.filter(c => c.category === 'Specific' && c.nemesis === preferenze.settings.nemesis && c.inNemesisDeck === true && c.tier === tier);
}

export function showDeckBuild(): void {
  closeDeckBuild();
  const layer = el('div', 'deck-build');
  layer.id = 'deck-build';
  const grid = el('div', 'deck-build-grid');
  grid.appendChild(el('span', 'deck-build-corner'));
  KINDS.forEach(kind => grid.appendChild(el('span', 'deck-build-head', T.deckBuildKinds[kind])));
  [1, 2, 3].forEach(tier => {
    grid.appendChild(el('span', 'deck-build-tier', T.tierN(tier)));
    KINDS.forEach(kind => {
      const plan = deckPlan.find(p => p.tier === tier && p.kind === kind) || { count: 0 };
      const pile = el('div', 'deck-build-pile' + (plan.count ? '' : ' is-empty'));
      pile.dataset.tier = String(tier);
      pile.dataset.kind = kind;
      pile.dataset.left = String(plan.count);
      pile.dataset.count = String(plan.count);
      pile.setAttribute('aria-label', T.deckBuildPile(plan.count, T.deckBuildKinds[kind].toLowerCase(), tier));
      if (kind === 'specific') {
        // A faccia in su, a ventaglio (come le carte in mano); si toccano per vederle grandi
        pile.classList.add('is-fan');
        pile.setAttribute('role', 'button');
        pile.tabIndex = 0;
        const cards = specificCardsOf(tier);
        const mid = (cards.length - 1) / 2;
        cards.forEach((data, i) => {
          const card = el('span', 'deck-build-fan-card');
          card.style.setProperty('--fan', String(i - mid));
          // Due facce: fronte (la carta) e dorso; con "Crea mazzo" la carta si gira
          const inner = el('span', 'deck-build-fan-inner');
          const img = document.createElement('img');
          img.alt = '';
          img.className = 'deck-build-fan-front';
          img.src = String(data.thumb);
          img.addEventListener('error', () => { img.src = encodeURI(data.image); }, { once: true });
          const back = document.createElement('img');
          back.alt = '';
          back.className = 'deck-build-fan-back';
          back.src = CARD_BACK;
          inner.append(img, back);
          card.appendChild(inner);
          pile.appendChild(card);
        });
        pile.addEventListener('click', () => { if (!ui.isTransitioning) openSpecificViewer(tier); });
        pile.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pile.click(); } });
      } else {
        pile.setAttribute('role', 'img');
        const img = document.createElement('img');
        img.alt = '';
        img.src = CARD_BACK;
        pile.appendChild(img);
      }
      const count = el('span', 'ae-pile-count', String(plan.count));
      count.setAttribute('aria-hidden', 'true');
      pile.appendChild(count);
      grid.appendChild(pile);
    });
  });
  layer.append(el('h2', 'deck-build-title', T.deckBuildTitle), grid);
  mainEl.appendChild(layer);
}

// Carte Specifiche in grande: tutte quelle della nemesi (Tier 1, 2, 3), si scorrono a destra e sinistra; si parte dalla
// prima del Tier toccato. Sopra: "Tier 1 | Tier 2 | Tier 3" e sotto ogni Tier un pallino per carta (come i caroselli):
// il pallino acceso è la carta mostrata. Toccando un Tier si va alla sua prima carta.
export function openSpecificViewer(tier: number): void {
  const cards = [1, 2, 3].flatMap(t => specificCardsOf(t).map(data => ({ data, t })));
  if (!cards.length) return;
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(T.specificTitle, preferenze.settings.nemesis, cancel, { displayTitle: false });
  dialog.classList.add('ae-spec-viewer');
  const nav = el('div', 'ae-spec-tiers');
  const dots: { d: HTMLSpanElement; group: HTMLButtonElement }[] = [];
  [1, 2, 3].forEach(t => {
    const ofTier = cards.filter(c => c.t === t);
    if (!ofTier.length) return;
    if (nav.children.length) {
      const sep = el('span', 'ae-spec-sep', '|');
      sep.setAttribute('aria-hidden', 'true');
      nav.appendChild(sep);
    }
    const group = el('button', 'ae-spec-tier');
    group.type = 'button';
    group.dataset.tier = String(t);
    const row = el('span', 'ae-spec-dots');
    row.setAttribute('aria-hidden', 'true');
    ofTier.forEach(() => { const d = el('span'); row.appendChild(d); dots.push({ d, group }); });
    group.append(el('span', 'ae-spec-tier-name', T.tierN(t)), row);
    group.addEventListener('click', () => goTo(cards.findIndex(c => c.t === t), true));
    nav.appendChild(group);
  });
  const track = el('div', 'ae-spec-track');
  cards.forEach(({ data, t }) => {
    const slide = el('div', 'ae-spec-slide');
    slide.dataset.tier = String(t);
    slide.appendChild(cardArt(data));
    track.appendChild(slide);
  });
  let current = -1;
  const mark = (i: number) => {
    if (i === current || i < 0 || i >= cards.length) return;
    current = i;
    dots.forEach(({ d, group }, k) => {
      d.classList.toggle('is-on', k === i);
      if (k === i) [...nav.querySelectorAll('.ae-spec-tier')].forEach(g => {
        g.classList.toggle('is-current', g === group);
        g.setAttribute('aria-current', String(g === group));
      });
    });
  };
  const indexNow = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth + 12));
  const goTo = (i: number, smooth: boolean) => {
    const slide = track.children[i];
    if (!(slide instanceof HTMLElement)) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto' });
    mark(i);
  };
  track.addEventListener('scroll', () => mark(indexNow()), { passive: true });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(T.close, 'secondary', cancel));
  dialog.append(nav, track, footer);
  close = openModal(dialog, { onCancel: cancel });
  goTo(Math.max(0, cards.findIndex(c => c.t === tier)), false);
}

export function closeDeckBuild(): void {
  const old = document.getElementById('deck-build');
  if (old) old.remove();
  azzeraVolo();
  if (deckSlider) { deckSlider.lock(false); deckSlider.setProgress(0, true); }
}

// Ricomincia (Menu, durante "Crea mazzo") o cambio dei giocatori: mazzo nuovo con le scelte correnti, di nuovo i 9 mazzi
export function rebuildDeck(): void {
  clearTransition();
  closeAllModals();
  nuovaPartita();
  ui.deckBuilding = true;
  ui.deckShown = 0;
  ui.deckDark = true;
  showDeckBuild();
  richiediRidisegno();
  prefetchDeckImages();
}

// Finestra della nemesi (tocco sul nome in alto, solo durante "Crea mazzo"): nome e illustrazione come nel menu, e il
// numero di giocatori, che si può cambiare (il mazzo si rifà subito)
export function openGameSetup(): void {
  if (!ui.deckBuilding || ui.isTransitioning) return;
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(T.gameSetupTitle, '', cancel, { displayTitle: false });
  dialog.classList.add('ae-game-setup');
  const head = el('div', 'start-choice-head ae-game-setup-head');
  head.appendChild(el('p', 'start-choice-info', preferenze.settings.nemesis || ''));
  const battleNo = battleOf(preferenze.settings.nemesis);
  head.appendChild(el('p', 'ae-game-setup-battle', battleNo ? T.battle(battleNo) : T.battleMissing));
  const art = preferenze.settings.nemesis !== null ? catalogo.nemesisArt[preferenze.settings.nemesis] : undefined;
  head.classList.toggle('has-art', !!art);
  if (art) {
    const portrait = el('span', 'nemesis-art');
    portrait.setAttribute('aria-hidden', 'true');
    // (String: senza ritratto l'indirizzo è "undefined", come prima)
    portrait.style.backgroundImage = `url("${encodeURI(String(art.portrait))}")`;
    head.prepend(portrait);
  }
  const label = el('h3', 'start-label', 'Giocatori');
  label.id = 'game-setup-players';
  const choices = el('div', 'choices');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-labelledby', label.id);
  const renderChoices = () => {
    const options = catalogo.startOptions;
    if (!options) throw new TypeError('scelte della pagina iniziale non ancora pronte');
    choices.replaceChildren(...options.players.map(value => {
      const b = el('button', '', String(value));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(value === preferenze.settings.players));
      b.setAttribute('aria-label', T.players(value));
      b.addEventListener('click', () => {
        if (preferenze.settings.players === value) return;
        preferenze.settings.players = value;
        // Il mazzo dipende dai giocatori: si rifà, con la finestra ancora aperta
        nuovaPartita();
        ui.deckShown = 0;
        showDeckBuild();
        richiediRidisegno();
        renderChoices();
        const pressed = query(choices, '[aria-pressed="true"]', HTMLElement);
        if (pressed) pressed.focus();
      });
      return b;
    }));
  };
  renderChoices();
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(T.close, 'secondary', cancel));
  dialog.append(head, label, choices, footer);
  close = openModal(dialog, { onCancel: cancel });
}

// Codice eseguito all'avvio, nell'ordine di sempre (il cursore lo crea il coordinatore)
export function avvio(): void {
  azzeraCursore();
}
