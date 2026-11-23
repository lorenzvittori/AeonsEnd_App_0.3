// ui/schermate/statistiche.js: Vittoria, Sconfitta e Statistiche.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../../stato/condivise.js';
import { I18N_IT } from '../testi.js';
import { playerKinds } from '../../regole/mazzo.js';
import { isVariableMinion } from '../../regole/turno-nemesi.js';
import { cardArt, el, icon, typeName } from '../componenti/componenti.js';
import { button, dialogShell, openModal } from '../componenti/dialoghi.js';
import { openDiscardZoom } from '../componenti/scarti.js';
import { openStart } from './opzioni.js';
import { save } from '../../stato/salvataggio.js';
import { trackDrag } from '../eventi.js';

// Schermata Vittoria: scritta "Vittoria" come il banner dei Tier, ma resta ferma sullo schermo; sotto Statistiche e
// Menu iniziale; un tocco su una parte vuota torna alla partita com'era. Si apre da sola (checkVictory) o dal Menu ("Nemesi uccisa").
export function showVictory() { showEndScreen(I18N_IT.victoryTitle, false); }

// v254: Sconfitta (vita di Gravehold a 0): stessa schermata della Vittoria, con la scritta "Sconfitta"
export function showDefeat() { showEndScreen(I18N_IT.defeatTitle, true); }

export function showEndScreen(text, defeat) {
  // Fine del tempo di partita (statistiche): l'ultima volta che si arriva alla Vittoria (o alla Sconfitta)
  G.stats.endedAt = Date.now();
  save();
  let close = () => {};
  const cancel = () => close();
  const screen = el('div', 'ae-victory-screen' + (defeat ? ' is-defeat' : ''));
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  const title = el('h2', 'ae-tier-banner-text' + (text.length > 8 ? ' is-long' : ''), text);
  title.id = 'victory-title';
  screen.setAttribute('aria-labelledby', title.id);
  const actions = el('div', 'ae-victory-actions');
  const statsBtn = button(I18N_IT.statsTitle, 'primary', openStats);
  const home = button(I18N_IT.mainMenu, 'secondary', () => { close(); openStart(); });
  [statsBtn, home].forEach(b => b.classList.add('ae-button--full'));
  actions.append(statsBtn, home);
  screen.append(title, actions);
  // Niente "Chiudi": un tocco in una parte vuota dello schermo torna alla partita
  close = openModal(screen, { onCancel: cancel, initialFocus: statsBtn });
  screen.addEventListener('click', e => { if (e.target === screen) cancel(); });
  screen.parentElement.classList.add('ae-victory-backdrop');
}

// Statistiche della partita, in sola lettura. Sotto alcune righe (carte giocate, carte rimanenti, minion uccisi, poteri
// scartati, poteri risolti, attacchi risolti) un box con le carte, in fila da scorrere; i minion hanno la loro vita.
// Toccando una carta la si vede grande.
export function openStats() {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(I18N_IT.statsTitle, G.settings.nemesis || '', cancel, { displayTitle: false });
  dialog.classList.add('ae-stats');
  const rows = I18N_IT.statsRows;
  const lists = I18N_IT.statsLists;
  const ids = (G.stats && G.stats.cards) || {};
  const byId = list => (Array.isArray(list) ? list : []).map(id => G.cardsById.get(id)).filter(Boolean);
  // Carte giocate: tutte quelle uscite dal mazzo (scarti, dalla più vecchia, e carte ancora in gioco)
  const played = G.discard.concat(G.queue.map(e => e.data));
  // Carte rimanenti: per Tier e nome (l'ordine del mazzo non si mostra)
  const left = G.deck.slice().sort((x, y) => (x.tier || 0) - (y.tier || 0) || x.name.localeCompare(y.name));
  const list = el('div', 'ae-stats-list');
  [
    [rows.turns, G.turn],
    [rows.played, Math.max(0, G.stats.deckSize - G.deck.length), played, lists.played],
    [rows.left, G.deck.length, left, lists.left],
    [rows.minionsKilled, G.stats.minionsKilled, byId(ids.minionsKilled), lists.minionsKilled],
    [rows.powersPaid, G.stats.powersPaid, byId(ids.powersPaid), lists.powersPaid],
    [rows.powersResolved, G.stats.powersResolved, byId(ids.powersResolved), lists.powersResolved],
    [rows.aetherSpent, G.stats.aetherSpent],
    [rows.attacksResolved, G.stats.attacksResolved, byId(ids.attacksResolved), lists.attacksResolved]
  ].forEach(([label, value, cards, listLabel]) => {
    const row = el('dl', 'ae-side-stats ae-stats-row');
    row.append(el('dt', '', label), el('dd', '', String(value)));
    list.appendChild(row);
    if (cards) list.appendChild(statsCardStrip(cards, listLabel));
  });
  // Tempi: partita intera e ogni Tier (dalla sua prima carta pescata alla prima del Tier dopo, o alla Vittoria)
  const timeTitle = el('h3', 'ae-stats-subtitle', I18N_IT.statsTimeTitle);
  const timeList = el('dl', 'ae-side-stats ae-stats-times');
  statsTimes().forEach(([label, ms]) => timeList.append(el('dt', '', label),
    el('dd', '', ms === null ? I18N_IT.statsTimeUnknown : formatDuration(ms))));
  // Turni in gioco di ogni minion: prima quelli uccisi, poi quelli ancora in gioco
  // Ogni minion con la sua carta (le partite vecchie non hanno l'id: si cerca per nome)
  const minionCard = m => (m.id && G.cardsById.get(m.id)) || G.allCards.find(c => c.type === 'Minion' && c.name === m.name) || null;
  const minions = [
    ...G.stats.minions.map(m => ({ name: m.name, data: minionCard(m), turns: m.turns, alive: false })),
    ...G.queue.filter(e => e.data.type === 'Minion').map(e => ({ name: e.data.name, data: e.data, turns: Math.max(0, G.turn - (e.bornTurn || 0)), alive: true }))
  ];
  const minionTitle = el('h3', 'ae-stats-subtitle', I18N_IT.statsMinionsTitle);
  let minionList;
  if (minions.length) {
    // Una riga per minion: miniatura (toccandola la carta si vede grande), nome e turni in gioco
    minionList = el('div', 'ae-stats-minions');
    minions.forEach(m => {
      const row = el('div', 'ae-stats-minion');
      if (m.data) {
        const pic = el('button', 'ae-stats-minion-pic');
        pic.type = 'button';
        pic.setAttribute('aria-label', m.name);
        pic.appendChild(cardArt(m.data, { thumb: true, lazy: true }));
        pic.addEventListener('click', () => openDiscardZoom(m.data));
        row.appendChild(pic);
      }
      const text = el('div', 'ae-stats-minion-text');
      text.append(el('span', 'ae-stats-minion-name', m.name),
        el('span', 'ae-stats-minion-note', m.alive ? I18N_IT.stillInPlay : ''));
      row.append(text, el('span', 'ae-stats-minion-turns', I18N_IT.minionTurns(m.turns)));
      minionList.appendChild(row);
    });
  } else {
    minionList = el('p', 'ae-stats-empty', I18N_IT.statsNoMinions);
  }
  // Statistiche maghi (v175): una riga per giocatore.
  // "Æ spesi" per ora è vuoto.
  const magesTitle = el('h3', 'ae-stats-subtitle', I18N_IT.statsMagesTitle);
  const magesTable = el('table', 'ae-stats-mages');
  const head = el('tr');
  I18N_IT.statsMagesHead.forEach(h => head.appendChild(el('th', '', h)));
  magesTable.appendChild(el('thead')).appendChild(head);
  const body = magesTable.appendChild(el('tbody'));
  // Una riga per giocatore (il jolly non ha una riga sua: i suoi turni contano per il giocatore che era jolly)
  playerKinds().forEach(kind => {
    const m = (G.stats.mages && G.stats.mages[kind]) || { damage: 0, powers: 0, kills: 0 };
    const tr = el('tr');
    const name = el('th', '');
    name.scope = 'row';
    const dot = el('span', 'ae-stats-mage-dot');
    dot.dataset.kind = kind;
    name.append(dot, kind === 'wild' ? I18N_IT.trackWildName : I18N_IT.trackPlayerName(Number(kind.slice(1))));
    tr.append(name, el('td', '', String(m.damage)), el('td', '', String(m.kills)), el('td', '', String(m.powers)),
      el('td', '', '—'));
    body.appendChild(tr);
  });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(I18N_IT.close, 'secondary', cancel));
  dialog.append(timeTitle, timeList, list, magesTitle, magesTable, minionTitle, minionList, footer);
  close = openModal(dialog, { onCancel: cancel });
}

// Tempi delle statistiche: [etichetta, millisecondi o null]. La fine è la Vittoria (stats.endedAt) o adesso.
// Il tempo è quello dell'orologio: comprende anche le pause con l'app chiusa.
export function statsTimes() {
  const start = G.stats.startedAt;
  const at = G.stats.tierAt || {};
  const end = G.stats.endedAt || Date.now();
  if (!start) return [[I18N_IT.statsTime, null], [I18N_IT.statsTierTime(1), null], [I18N_IT.statsTierTime(2), null], [I18N_IT.statsTierTime(3), null]];
  const t2 = at[2] || null;
  const t3 = at[3] || null;
  const span = (from, to) => (from ? Math.max(0, (to || end) - from) : null);
  return [
    [I18N_IT.statsTime, Math.max(0, end - start)],
    [I18N_IT.statsTierTime(1), span(start, t2 || t3)],
    [I18N_IT.statsTierTime(2), span(t2, t3)],
    [I18N_IT.statsTierTime(3), span(t3, null)]
  ];
}

// Durata leggibile: "45 s", "12 min 05 s", "1 h 07 min"
export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  const pad = n => String(n).padStart(2, '0');
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))} min`;
}

// Box delle statistiche: miniature in fila (scorrono in orizzontale); i minion con la vita stampata sulla carta
export function statsCardStrip(cards, label) {
  const box = el('div', 'ae-stats-cards');
  box.setAttribute('role', 'list');
  box.setAttribute('aria-label', label);
  if (!cards.length) {
    box.classList.add('is-empty');
    box.appendChild(el('p', 'ae-stats-empty', I18N_IT.statsListEmpty));
    return box;
  }
  cards.forEach(data => {
    const item = el('button', 'ae-stats-card');
    item.type = 'button';
    item.setAttribute('role', 'listitem');
    // (v214: minion a vita variabile: "*", come sulla carta)
    const hp = isVariableMinion(data) ? '*' : data.type === 'Minion' && typeof data.hp === 'number' ? data.hp : null;
    item.setAttribute('aria-label', [data.name, typeName(data), hp !== null ? I18N_IT.statsHp(hp) : ''].filter(Boolean).join(', '));
    item.appendChild(cardArt(data, { thumb: true, lazy: true }));
    if (hp !== null) {
      const badge = el('span', 'ae-stats-hp');
      badge.append(icon('heart'), el('span', '', String(hp)));
      item.appendChild(badge);
    }
    item.addEventListener('click', () => openDiscardZoom(data));
    box.appendChild(item);
  });
  trackDrag(box);
  box.addEventListener('click', e => { if (box.dataset.dragged === '1') { e.stopPropagation(); e.preventDefault(); } }, true);
  return box;
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
