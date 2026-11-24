// ui/componenti/testata.ts: la testata della partita (zona 1 della schermata "partita"): nome della nemesi con
// battaglia, giocatori e turno (disegnaTestata, fitPhaseName), il mazzo nemesi e la pila degli scarti in alto
// (renderDockPiles), il pulsante Menu e il volo delle carte verso gli scarti (flyToDiscard).
// Livello 3 (ui/componenti/). Dipende da: stato/ (partita, preferenze: lettura), dati/dati.ts, ui/ base (testi, pagina,
// dom), ui/componenti/scarti.ts. Usato da: barra dei turni, pesca-undo, finestre (mazzo dei turni, scheda della carta),
// schermate (crea mazzo, turni), navigazione (render).

import { I18N_IT } from '../testi.ts';
import { partita } from '../../stato/partita.ts';
import { openDiscard } from './scarti.ts';
import { byId, CARD_BACK, cssUrl, menuBtn, phaseLabel, reducedMotion, ui } from '../pagina.ts';
import { el, query } from '../dom.ts';
import { battleOf } from '../../dati/dati.ts';
import { preferenze } from '../../stato/preferenze.ts';

// In testata, uno accanto all'altro e uguali nei due turni: il mazzo nemesi (dorso con il numero di carte rimaste) e la
// pila degli scarti (ultima carta scartata con il numero; toccandola si apre). In index.html, letti in avvio.
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

// Nome della nemesi in testata: il blocco è largo al massimo quanto la sua colonna (testata.css .ae-phase max-width) e,
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

// Testata della partita, tra Undo e Menu, nei due turni: il nome della nemesi della partita e sotto la riga con la
// battaglia (numero nella fiamma, Assets/ui/icons/flame.png), l'icona del numero di giocatori
// (Assets/ui/icons/players-1..4.png, usata come maschera) e "Turno N" (giri del mazzo dei turni, nascosto prima del primo
// turno nemesi); separati da |. Durante "Crea mazzo" il nome si tocca e apre la finestra con nemesi e giocatori
// (onNameClick, della schermata "Crea mazzo"). La misura del nome (fitPhaseName) la chiede il coordinatore dopo le
// classi dell'app
export function disegnaTestata(onNameClick: () => void): void {
  const turnLine = el('span', 'ae-phase-turn');
  const players = Math.max(1, Math.min(4, Number(preferenze.settings.players) || 1));
  const playersIcon = el('span', 'ae-players-icon');
  playersIcon.style.setProperty('--ae-players-icon', cssUrl(`Assets/ui/icons/players-${players}.png`));
  playersIcon.setAttribute('role', 'img');
  playersIcon.setAttribute('aria-label', I18N_IT.players(players));
  const turnText = el('span', '', I18N_IT.turnN(partita.turnOrder.round));
  turnText.hidden = !(partita.turnOrder.round >= 1);
  const battleNo = battleOf(preferenze.settings.nemesis);
  const battle = el('span', 'ae-battle-flame', battleNo ? String(battleNo) : '?');
  battle.setAttribute('role', 'img');
  battle.setAttribute('aria-label', battleNo ? I18N_IT.battle(battleNo) : I18N_IT.battleMissing);
  const sep = () => { const s = el('span', 'ae-info-sep', '|'); s.setAttribute('aria-hidden', 'true'); return s; };
  const sep2 = sep();
  sep2.hidden = partita.turn < 1;
  turnLine.append(battle, sep(), playersIcon, sep2, turnText);
  phaseLabel.replaceChildren(el('span', 'ae-phase-name', preferenze.settings.nemesis || ''), turnLine);
  // Modalità test: "TEST · <scenario>" sempre visibile, sotto il nome della nemesi (non copre i comandi)
  if (partita.testRun) phaseLabel.appendChild(el('span', 'ae-phase-test', I18N_IT.testLabel(String(partita.testRun.name))));
  // Nome della nemesi: durante "Crea mazzo" si tocca e apre la finestra con nemesi e giocatori
  const phaseName = phaseLabel.querySelector('.ae-phase-name');
  if (ui.deckBuilding && phaseName) {
    const nameBtn = el('button', 'ae-phase-name ae-phase-name--button', preferenze.settings.nemesis || '');
    nameBtn.type = 'button';
    nameBtn.setAttribute('aria-haspopup', 'dialog');
    nameBtn.addEventListener('click', onNameClick);
    phaseName.replaceWith(nameBtn);
  }
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  // Pile e Menu sono nella testata già in index.html (zona 1 della schermata "partita"); Undo resta nascosto (è nel Menu)
  headerPiles = byId('pile-testata', HTMLDivElement);
  dockDeck = byId('pila-mazzo', HTMLDivElement);
  dockDiscard = byId('pila-scarti', HTMLButtonElement);
  dockDiscard.addEventListener('click', () => { if (!ui.isTransitioning && !ui.deckBuilding) openDiscard(); });

  // Tocco sul mazzo: compare il pulsante "Pesca carta" (ui/componenti/pesca-undo.ts, che registra il tocco)
  dockDeck.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dockDeck.click(); } });

  // Menu in alto a destra: apre un pannello laterale largo il 70% dello schermo, il resto dell'app resta visibile ma
  // oscurato
  menuBtn.setAttribute('aria-label', I18N_IT.menu);

  // Nome della nemesi: si adatta di nuovo quando cambia la larghezza della testata
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
}
