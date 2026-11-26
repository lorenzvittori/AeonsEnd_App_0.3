// ui/finestre/statistiche.ts: Vittoria e Sconfitta (con "Menu iniziale", aggancio vaiAlMenuIniziale) e le statistiche
// della partita (carte, tempi, maghi).
// Livello 4 (ui/finestre/). Dipende da: stato/ (partita, preferenze, catalogo), ui/ base (testi, dom, ridisegno),
// ui/componenti (animazioni, componenti, dialoghi, scarti). Usato da: navigazione (Vittoria a mazzo vuoto, aggancio
// mostraFinePartita).

import { T } from '../testi.ts';
import { isVariableMinion, mageStatsOf, partita, playerKinds, segnaFinePartita } from '../../stato/partita.ts';
import { cardArt, typeName } from '../componenti/componenti.ts';
import { button, dialogShell, openModal } from '../componenti/dialoghi.ts';
import { openDiscardZoom } from '../componenti/scarti.ts';
import type { Carta } from '../../tipi/dati.ts';
import { preferenze } from '../../stato/preferenze.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { trackDrag } from '../componenti/animazioni.ts';
import { el, icon } from '../dom.ts';
import { reducedMotion } from '../pagina.ts';
import { vaiAlMenuIniziale } from '../ridisegno.ts';

// Schermata Vittoria: scritta "Vittoria" come il banner dei Tier, ma resta ferma sullo schermo; sotto Statistiche e
// Menu iniziale; un tocco su una parte vuota torna alla partita com'era. Si apre da sola (checkVictory) o dal Menu
// ("Nemesi uccisa"). Finché la scritta si anima un tocco sullo schermo finisce subito l'animazione.
export function showVictory(): void { showEndScreen(T.victoryTitle, false); }

// Sconfitta (vita di Gravehold a 0 o meno): stessa schermata della Vittoria, con la scritta "Sconfitta" e in più "Continua"
// (si torna alla partita)
export function showDefeat(): void { showEndScreen(T.defeatTitle, true); }

// Durata dell'animazione di entrata della schermata (la scritta, poi i pulsanti: statistiche.css)
export const END_SCREEN_ANIM_MS = 1800;

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
  const buttons = defeat ? [statsBtn, button(T.continueLabel, 'secondary', cancel), home] : [statsBtn, home];
  buttons.forEach(b => b.classList.add('ae-button--full'));
  actions.append(...buttons);
  screen.append(title, actions);
  // Animazione di entrata: un tocco sullo schermo la finisce subito (e non fa altro); passata, un tocco in una parte vuota
  // torna alla partita
  let animating = !reducedMotion.matches;
  let backdrop: HTMLElement | null = null;
  const settle = () => {
    animating = false;
    if (backdrop) backdrop.classList.add('is-settled');
  };
  const animTimer = setTimeout(settle, END_SCREEN_ANIM_MS);
  // Niente "Chiudi": un tocco in una parte vuota dello schermo torna alla partita
  const closeModalFn = openModal(screen, { onCancel: () => { if (animating) settle(); else close(); }, initialFocus: statsBtn });
  close = () => { clearTimeout(animTimer); closeModalFn(); };
  screen.addEventListener('click', e => { if (e.target === screen && !animating) cancel(); });
  backdrop = screen.parentElement;
  if (backdrop) {
    backdrop.classList.add('ae-victory-backdrop');
    // In fase di cattura: durante l'animazione il tocco non arriva né ai pulsanti né alla chiusura
    backdrop.addEventListener('click', e => {
      if (!animating) return;
      e.stopPropagation();
      e.preventDefault();
      settle();
    }, true);
  }
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
  // Turni in gioco di ogni minion: prima quelli uccisi, poi quelli ancora in gioco, in fila come le altre carte, ognuna con un
  // box in basso con i suoi turni e la clessidra. Ogni minion con la sua carta (le partite vecchie non hanno l'id: si cerca
  // per nome)
  const minionCard = (m: { id?: string; name: string }): Carta | null => (m.id && catalogo.cardsById.get(m.id)) || catalogo.allCards.find(c => c.type === 'Minion' && c.name === m.name) || null;
  const minions = [
    ...partita.stats.minions.map(m => ({ data: minionCard(m), turns: m.turns, alive: false })),
    ...partita.queue.filter(e => e.data.type === 'Minion').map(e => ({ data: e.data, turns: Math.max(0, partita.turn - (e.bornTurn || 0)), alive: true }))
  ].filter((m): m is { data: Carta; turns: number; alive: boolean } => !!m.data);
  const minionTitle = el('h3', 'ae-stats-subtitle', T.statsMinionsTitle);
  const minionList = minions.length
    ? statsCardStrip(minions.map(m => m.data), T.statsMinionsTitle, (_data, i) => ({ icon: 'turns', text: String(minions[i].turns),
      aria: T.minionTurns(minions[i].turns) + (minions[i].alive ? ', ' + T.stillInPlay : '') }))
    : el('p', 'ae-stats-empty', T.statsNoMinions);
  // Statistiche maghi: una riga per giocatore, con il suo token e "P1".."P4"; il costo pagato sono gli Æ dei poteri scartati
  // (removalCost), i punti vita a Gravehold e alla nemesi quelli cambiati nei suoi turni
  const magesTitle = el('h3', 'ae-stats-subtitle', T.statsMagesTitle);
  const magesTable = el('table', 'ae-stats-mages');
  const head = el('tr');
  T.statsMagesHead.forEach(h => head.appendChild(el('th', '', h)));
  magesTable.appendChild(el('thead')).appendChild(head);
  const body = magesTable.appendChild(el('tbody'));
  // Una riga per giocatore (il wild non ha una riga sua: i suoi turni contano per il giocatore che era wild)
  playerKinds().forEach(kind => {
    const m = mageStatsOf(kind);
    const tr = el('tr');
    const name = el('th', 'ae-stats-mage-name');
    name.scope = 'row';
    name.setAttribute('aria-label', T.trackPlayerName(Number(kind.slice(1))));
    const token = el('span', 'ae-stats-mage-token');
    token.dataset.kind = kind;
    token.setAttribute('aria-hidden', 'true');
    name.append(token, 'P' + kind.slice(1));
    tr.append(name, ...[m.damage, m.powers, m.aether, m.nemesisDamage, m.graveHeal].map(n => el('td', '', String(n))));
    body.appendChild(tr);
  });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(T.close, 'secondary', cancel));
  // In cima i tempi e la tabella dei giocatori, poi le righe con le carte, in fondo i minion
  dialog.append(timeTitle, timeList, magesTitle, magesTable, list, minionTitle, minionList, footer);  close = openModal(dialog, { onCancel: cancel });
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

// Box in basso a una carta delle statistiche: icona (nome della classe .ae-icon--...), testo e descrizione per i lettori di
// schermo
export interface BadgeCarta {
  icon: string;
  text: string;
  aria: string;
}

// Box delle statistiche: miniature in fila (scorrono in orizzontale); i minion con la vita stampata sulla carta. badgeOf
// (facoltativo) dice il box in basso di ogni carta al posto della vita (per esempio i turni in gioco di un minion)
export function statsCardStrip(cards: readonly Carta[], label: string,
  badgeOf?: (data: Carta, index: number) => BadgeCarta | null): HTMLDivElement {
  const box = el('div', 'ae-stats-cards');
  box.setAttribute('role', 'list');
  box.setAttribute('aria-label', label);
  if (!cards.length) {
    box.classList.add('is-empty');
    box.appendChild(el('p', 'ae-stats-empty', T.statsListEmpty));
    return box;
  }
  cards.forEach((data, i) => {
    const item = el('button', 'ae-stats-card');
    item.type = 'button';
    item.setAttribute('role', 'listitem');
    // Minion a vita variabile: "*", come sulla carta
    const hp = isVariableMinion(data) ? '*' : data.type === 'Minion' && typeof data.hp === 'number' ? data.hp : null;
    const badgeInfo: BadgeCarta | null = badgeOf ? badgeOf(data, i) : hp !== null ? { icon: 'heart', text: String(hp), aria: T.statsHp(hp) } : null;
    item.setAttribute('aria-label', [data.name, typeName(data), badgeInfo ? badgeInfo.aria : ''].filter(Boolean).join(', '));
    item.appendChild(cardArt(data, { thumb: true, lazy: true }));
    if (badgeInfo) {
      const badge = el('span', 'ae-stats-hp');
      badge.append(icon(badgeInfo.icon), el('span', '', badgeInfo.text));
      item.appendChild(badge);
    }
    item.addEventListener('click', () => openDiscardZoom(data));
    box.appendChild(item);
  });  trackDrag(box);
  box.addEventListener('click', e => { if (box.dataset.dragged === '1') { e.stopPropagation(); e.preventDefault(); } }, true);
  return box;
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
