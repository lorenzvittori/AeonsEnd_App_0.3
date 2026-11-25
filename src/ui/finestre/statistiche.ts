// ui/finestre/statistiche.ts: Vittoria e Sconfitta (con "Menu iniziale", aggancio vaiAlMenuIniziale) e le statistiche
// della partita (carte, tempi, maghi).
// Livello 4 (ui/finestre/). Dipende da: stato/ (partita, preferenze, catalogo), ui/ base (testi, dom, ridisegno),
// ui/componenti (animazioni, componenti, dialoghi, scarti). Usato da: navigazione (Vittoria a mazzo vuoto, aggancio
// mostraFinePartita).

import { T } from '../testi.ts';
import { isVariableMinion, partita, playerKinds, segnaFinePartita } from '../../stato/partita.ts';
import { cardArt, typeName } from '../componenti/componenti.ts';
import { button, dialogShell, openModal } from '../componenti/dialoghi.ts';
import { openDiscardZoom } from '../componenti/scarti.ts';
import type { Carta } from '../../tipi/dati.ts';
import { preferenze } from '../../stato/preferenze.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { trackDrag } from '../componenti/animazioni.ts';
import { el, icon } from '../dom.ts';
import { vaiAlMenuIniziale } from '../ridisegno.ts';

// Schermata Vittoria: scritta "Vittoria" come il banner dei Tier, ma resta ferma sullo schermo; sotto Statistiche e
// Menu iniziale; un tocco su una parte vuota torna alla partita com'era. Si apre da sola (checkVictory) o dal Menu
// ("Nemesi uccisa").
export function showVictory(): void { showEndScreen(T.victoryTitle, false); }

// Sconfitta (vita di Gravehold a 0): stessa schermata della Vittoria, con la scritta "Sconfitta"
export function showDefeat(): void { showEndScreen(T.defeatTitle, true); }

export function showEndScreen(text: string, defeat: boolean): void {
  // Fine del tempo di partita (statistiche): l'ultima volta che si arriva alla Vittoria (o alla Sconfitta)
  segnaFinePartita();
  let close = () => {};
  const cancel = () => close();
  const screen = el('div', 'ae-victory-screen' + (defeat ? ' is-defeat' : ''));
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  const title = el('h2', 'ae-tier-banner-text' + (text.length > 8 ? ' is-long' : ''), text);
  title.id = 'victory-title';
  screen.setAttribute('aria-labelledby', title.id);
  const actions = el('div', 'ae-victory-actions');
  const statsBtn = button(T.statsTitle, 'primary', openStats);
  const home = button(T.mainMenu, 'secondary', () => { close(); vaiAlMenuIniziale(); });
  [statsBtn, home].forEach(b => b.classList.add('ae-button--full'));
  actions.append(statsBtn, home);
  screen.append(title, actions);
  // Niente "Chiudi": un tocco in una parte vuota dello schermo torna alla partita
  close = openModal(screen, { onCancel: cancel, initialFocus: statsBtn });
  screen.addEventListener('click', e => { if (e.target === screen) cancel(); });
  if (screen.parentElement) screen.parentElement.classList.add('ae-victory-backdrop');
}

// Una riga delle statistiche: etichetta, valore e (facoltativo) le carte con l'etichetta del loro elenco
type RigaStatistiche = [string, number, Carta[]?, string?];

// Statistiche della partita, in sola lettura. Sotto alcune righe (carte giocate, carte rimanenti, minion uccisi, poteri
// scartati, poteri risolti, attacchi risolti) un box con le carte, in fila da scorrere; i minion hanno la loro vita.
// Toccando una carta la si vede grande.
export function openStats(): void {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(T.statsTitle, preferenze.settings.nemesis || '', cancel, { displayTitle: false });
  dialog.classList.add('ae-stats');
  const rows = T.statsRows;
  const lists = T.statsLists;
  const ids: Partial<Record<string, string[]>> = (partita.stats && partita.stats.cards) || {};
  const byId = (list: string[] | undefined): Carta[] => (Array.isArray(list) ? list : []).map(id => catalogo.cardsById.get(id))
    .filter((c): c is Carta => !!c);
  // Carte giocate: tutte quelle uscite dal mazzo (scarti, dalla più vecchia, e carte ancora in gioco)
  const played = partita.discard.concat(partita.queue.map(e => e.data));
  // Carte rimanenti: per Tier e nome (l'ordine del mazzo non si mostra). Number: il Tier come nei confronti di JavaScript
  const left = partita.deck.slice().sort((x, y) => Number(x.tier || 0) - Number(y.tier || 0) || x.name.localeCompare(y.name));
  const list = el('div', 'ae-stats-list');
  const lines: RigaStatistiche[] = [
    [rows.turns, partita.turn],
    [rows.played, Math.max(0, partita.stats.deckSize - partita.deck.length), played, lists.played],
    [rows.left, partita.deck.length, left, lists.left],
    [rows.minionsKilled, partita.stats.minionsKilled, byId(ids.minionsKilled), lists.minionsKilled],
    [rows.powersPaid, partita.stats.powersPaid, byId(ids.powersPaid), lists.powersPaid],
    [rows.powersResolved, partita.stats.powersResolved, byId(ids.powersResolved), lists.powersResolved],
    [rows.aetherSpent, partita.stats.aetherSpent],
    [rows.attacksResolved, partita.stats.attacksResolved, byId(ids.attacksResolved), lists.attacksResolved]
  ];
  lines.forEach(([label, value, cards, listLabel]) => {
    const row = el('dl', 'ae-side-stats ae-stats-row');
    row.append(el('dt', '', label), el('dd', '', String(value)));
    list.appendChild(row);
    if (cards) list.appendChild(statsCardStrip(cards, listLabel || ''));
  });
  // Tempi: partita intera e ogni Tier (dalla sua prima carta pescata alla prima del Tier dopo, o alla Vittoria)
  const timeTitle = el('h3', 'ae-stats-subtitle', T.statsTimeTitle);
  const timeList = el('dl', 'ae-side-stats ae-stats-times');
  statsTimes().forEach(([label, ms]) => timeList.append(el('dt', '', label),
    el('dd', '', ms === null ? T.statsTimeUnknown : formatDuration(ms))));
  // Turni in gioco di ogni minion: prima quelli uccisi, poi quelli ancora in gioco. Ogni minion con la sua carta (le
  // partite vecchie non hanno l'id: si cerca per nome)
  const minionCard = (m: { id?: string; name: string }): Carta | null => (m.id && catalogo.cardsById.get(m.id)) || catalogo.allCards.find(c => c.type === 'Minion' && c.name === m.name) || null;
  const minions = [
    ...partita.stats.minions.map(m => ({ name: m.name, data: minionCard(m), turns: m.turns, alive: false })),
    ...partita.queue.filter(e => e.data.type === 'Minion').map(e => ({ name: e.data.name, data: e.data, turns: Math.max(0, partita.turn - (e.bornTurn || 0)), alive: true }))
  ];
  const minionTitle = el('h3', 'ae-stats-subtitle', T.statsMinionsTitle);
  let minionList: HTMLElement;
  if (minions.length) {
    // Una riga per minion: miniatura (toccandola la carta si vede grande), nome e turni in gioco
    const box = el('div', 'ae-stats-minions');
    minions.forEach(m => {
      const row = el('div', 'ae-stats-minion');
      const data = m.data;
      if (data) {
        const pic = el('button', 'ae-stats-minion-pic');
        pic.type = 'button';
        pic.setAttribute('aria-label', m.name);
        pic.appendChild(cardArt(data, { thumb: true, lazy: true }));
        pic.addEventListener('click', () => openDiscardZoom(data));
        row.appendChild(pic);
      }
      const text = el('div', 'ae-stats-minion-text');
      text.append(el('span', 'ae-stats-minion-name', m.name),
        el('span', 'ae-stats-minion-note', m.alive ? T.stillInPlay : ''));
      row.append(text, el('span', 'ae-stats-minion-turns', T.minionTurns(m.turns)));
      box.appendChild(row);
    });
    minionList = box;
  } else {
    minionList = el('p', 'ae-stats-empty', T.statsNoMinions);
  }
  // Statistiche maghi: una riga per giocatore ("Æ spesi" per ora è vuoto)
  const magesTitle = el('h3', 'ae-stats-subtitle', T.statsMagesTitle);
  const magesTable = el('table', 'ae-stats-mages');
  const head = el('tr');
  T.statsMagesHead.forEach(h => head.appendChild(el('th', '', h)));
  magesTable.appendChild(el('thead')).appendChild(head);
  const body = magesTable.appendChild(el('tbody'));
  // Una riga per giocatore (il wild non ha una riga sua: i suoi turni contano per il giocatore che era wild)
  playerKinds().forEach(kind => {
    const m = (partita.stats.mages && partita.stats.mages[kind]) || { damage: 0, powers: 0, kills: 0 };
    const tr = el('tr');
    const name = el('th', '');
    name.scope = 'row';
    const dot = el('span', 'ae-stats-mage-dot');
    dot.dataset.kind = kind;
    name.append(dot, T.trackPlayerName(Number(kind.slice(1))));
    tr.append(name, el('td', '', String(m.damage)), el('td', '', String(m.kills)), el('td', '', String(m.powers)),
      el('td', '', '—'));
    body.appendChild(tr);
  });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(T.close, 'secondary', cancel));
  dialog.append(timeTitle, timeList, list, magesTitle, magesTable, minionTitle, minionList, footer);
  close = openModal(dialog, { onCancel: cancel });
}

// Tempi delle statistiche: [etichetta, millisecondi o null]. La fine è la Vittoria (stats.endedAt) o adesso.
// Il tempo è quello dell'orologio: comprende anche le pause con l'app chiusa.
export function statsTimes(): [string, number | null][] {
  const start = partita.stats.startedAt;
  const at = partita.stats.tierAt || {};
  const end = partita.stats.endedAt || Date.now();
  if (!start) return [[T.statsTime, null], [T.statsTierTime(1), null], [T.statsTierTime(2), null], [T.statsTierTime(3), null]];
  const t2 = at[2] || null;
  const t3 = at[3] || null;
  const span = (from: number | null, to: number | null) => (from ? Math.max(0, (to || end) - from) : null);
  return [
    [T.statsTime, Math.max(0, end - start)],
    [T.statsTierTime(1), span(start, t2 || t3)],
    [T.statsTierTime(2), span(t2, t3)],
    [T.statsTierTime(3), span(t3, null)]
  ];
}

// Durata leggibile: "45 s", "12 min 05 s", "1 h 07 min"
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))} min`;
}

// Box delle statistiche: miniature in fila (scorrono in orizzontale); i minion con la vita stampata sulla carta
export function statsCardStrip(cards: readonly Carta[], label: string): HTMLDivElement {
  const box = el('div', 'ae-stats-cards');
  box.setAttribute('role', 'list');
  box.setAttribute('aria-label', label);
  if (!cards.length) {
    box.classList.add('is-empty');
    box.appendChild(el('p', 'ae-stats-empty', T.statsListEmpty));
    return box;
  }
  cards.forEach(data => {
    const item = el('button', 'ae-stats-card');
    item.type = 'button';
    item.setAttribute('role', 'listitem');
    // Minion a vita variabile: "*", come sulla carta
    const hp = isVariableMinion(data) ? '*' : data.type === 'Minion' && typeof data.hp === 'number' ? data.hp : null;
    item.setAttribute('aria-label', [data.name, typeName(data), hp !== null ? T.statsHp(hp) : ''].filter(Boolean).join(', '));
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

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
