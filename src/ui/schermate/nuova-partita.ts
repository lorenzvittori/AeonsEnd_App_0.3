// ui/schermate/nuova-partita.ts: la schermata Nuova partita, nella pagina iniziale (#start): giocatori, wave (menu a
// tendina), elenco delle nemesi e dado, opzioni del mazzo, "Inizia partita" e la X che torna al menu iniziale
// (aggancio vaiA). Disegnata dal coordinatore (disegnaNuovaPartita, da setStartMode); buildStartPage all'avvio.
// L'anteprima della nemesi è in nuova-partita-anteprima.ts.
// Livello 5 (ui/schermate/). Dipende da: dati/ (collezione, dati), stato/ (catalogo, partita, preferenze), ui/ base
// (testi, pagina, dom, ridisegno), ui/componenti/dialoghi.ts, ui/finestre/opzioni.ts, nuova-partita-anteprima.ts
// (supporto). Usato da: navigazione, avvio.ts.
import { collectionCatalog, isMiniCode, isPlayable, loadCollection, ownsProduct, productName, productOfNemesis,
  waveLabel, waveOfCode, waveOfNemesis } from '../../dati/collezione.ts';
import { battleOf } from '../../dati/dati.ts';
import { catalogo, impostaSceltePagina } from '../../stato/catalogo.ts';
import { deckShortfall, mergeActive, mergeLockedWave } from '../../stato/partita.ts';
import { loadDeckOptions, preferenze, saveDeckOptions } from '../../stato/preferenze.ts';
import { showToast } from '../componenti/dialoghi.ts';
import { el, icon, need, pageEl, query } from '../dom.ts';
import { ensureCollectionButton } from '../finestre/opzioni.ts';
import { byId, reducedMotion, resumeBtn, startBtn } from '../pagina.ts';
import { vaiA } from '../ridisegno.ts';
import { T } from '../testi.ts';
import { CHEVRON_SVG, chevronButton, nemesisPreviewOpen, renderNemesisPreview, segnaAnteprimaChiusa,
  setNemesisPreview } from './nuova-partita-anteprima.ts';

// --- Pagina iniziale e nuova partita ---
export function renderPlayers(): void {
  const container = byId('choices-players', HTMLDivElement);
  const options = need(catalogo.startOptions, 'scelte della pagina iniziale');
  container.replaceChildren(...options.players.map(value => {
    const b = el('button', '', String(value));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(value === preferenze.settings.players));
    b.setAttribute('aria-label', T.players(value));
    b.addEventListener('click', () => {
      preferenze.settings.players = value;
      renderPlayers();
      // Le opzioni del mazzo dipendono anche dai giocatori (blocco di "Unisci" e riga di avviso)
      if (catalogo.startOptions && document.getElementById('deck-options')) renderDeckOptions();
      pageEl(container, '[aria-pressed="true"]', HTMLElement).focus();
    });
    return b;
  }));
}

// Wave scelte nella pagina Nuova partita (anche più di una): si vedono le nemesi di tutte
export let selectedWaves: string[] = [];

// Nemesi delle wave scelte: prima le disponibili (pulsanti), le altre in un elenco chiuso e non interattivo
export function renderBosses(): void {
  const list = byId('nemesis-list', HTMLDivElement);
  // Per wave (nell'ordine delle wave); in ogni wave prima le nemesi della scatola base, poi quelle delle mini espansioni,
  // in ognuno dei due gruppi per battaglia
  const byBattle = (n: { battle: number | null }) => (n.battle === null || n.battle === undefined ? 99 : n.battle);
  const inSelectedWaves = (wave: string | null) => wave !== null && selectedWaves.includes(wave);
  const ofWave = catalogo.nemeses.filter(n => n.boxCode && inSelectedWaves(waveOfNemesis(n)))
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (Number(waveOfNemesis(a.n)) - Number(waveOfNemesis(b.n))) || (Number(isMiniCode(a.n.boxCode)) - Number(isMiniCode(b.n.boxCode)))
      || (byBattle(a.n) - byBattle(b.n)) || (a.i - b.i))
    .map(x => x.n);
  const playable = ofWave.filter(isPlayable);
  const others = ofWave.filter(n => !isPlayable(n));

  if (!playable.some(n => n.name === preferenze.settings.nemesis)) preferenze.settings.nemesis = playable.length ? playable[0].name : null;

  list.replaceChildren(...playable.map(info => {
    const b = el('button', 'nemesis-option');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(info.name === preferenze.settings.nemesis));
    const tags = el('span', 'nemesis-tags');
    tags.appendChild(el('span', '', info.battle ? T.battle(info.battle) : T.battleMissing));
    const art = catalogo.nemesisArt[info.name];
    if (art) {
      // Parte dell'illustrazione a destra del pulsante (come nella wiki)
      b.classList.add('has-art');
      const portrait = el('span', 'nemesis-art');
      portrait.setAttribute('aria-hidden', 'true');
      portrait.style.backgroundImage = `url("${encodeURI(String(art.portrait))}")`;
      b.appendChild(portrait);
    }
    b.append(el('span', 'nemesis-name', info.name), tags);
    // Mini espansione: etichetta dorata piccola in basso a destra
    if (isMiniCode(info.boxCode)) b.appendChild(el('span', 'nemesis-expansion', productName(String(info.boxCode))));
    b.addEventListener('click', () => {
      // Toccare di nuovo la nemesi già scelta apre o chiude la sua carta (come le frecce)
      if (preferenze.settings.nemesis === info.name) {
        if (art) {
          setNemesisPreview(!nemesisPreviewOpen);
          b.focus({ preventScroll: true });
        }
        return;
      }
      preferenze.settings.nemesis = info.name;
      segnaAnteprimaChiusa();
      renderBosses();
      const selected = query(list, '.nemesis-item.is-selected .nemesis-option', HTMLElement);
      if (selected) selected.focus({ preventScroll: true });
    });
    const item = el('div', 'nemesis-item');
    item.appendChild(b);
    if (info.name === preferenze.settings.nemesis) {
      item.classList.add('is-selected');
      // Freccia verso il basso al centro del pulsante scelto: apre la carta della nemesi
      if (art) item.appendChild(chevronButton('nemesis-expand', T.showNemesisCard(info.name), () => setNemesisPreview(true)));
    }
    return item;
  }));
  renderNemesisPreview();
  need(document.getElementById('nemesis-empty'), '#nemesis-empty').hidden = playable.length > 0;

  // Nemesi non disponibili: box piccoli con solo il nome, barrati da una X rossa sottile, non cliccabili.
  // Stanno subito sotto i pulsanti delle disponibili (il vecchio elenco a scomparsa non si usa più).
  const oldOther = document.getElementById('nemesis-other');
  if (oldOther) oldOther.hidden = true;
  let unavailable = document.getElementById('nemesis-unavailable');
  if (!unavailable) {
    unavailable = el('ul', 'nemesis-unavailable');
    unavailable.id = 'nemesis-unavailable';
    unavailable.setAttribute('aria-label', T.unavailableNemeses);
    list.after(unavailable);
  }
  unavailable.hidden = others.length === 0;
  unavailable.replaceChildren(...others.map(info => {
    // Nemesi che l'app ha (battaglia e carte) ma il cui prodotto non è nella collezione: niente "!", la scritta
    // "Non in collezione" a destra. Le altre (senza battaglia o senza carte) restano con il "!" rosso.
    // (String: una nemesi senza prodotto si cerca come "null", che non è nella collezione)
    const notOwned = info.battle !== null && !ownsProduct(String(productOfNemesis(info)))
      && catalogo.allCards.some(c => c.category === 'Specific' && c.nemesis === info.name);
    const li = el('li', 'nemesis-locked' + (notOwned ? ' is-not-owned' : ''));
    li.setAttribute('aria-label', notOwned ? T.notInCollectionNemesis(info.name) : T.unavailableNemesis(info.name));
    li.appendChild(el('span', '', info.name));
    if (notOwned) li.appendChild(el('span', 'nemesis-locked-note', T.notInCollection));
    return li;
  }));
  updateStartActions();
}

export function renderStartChoices(): void {
  segnaAnteprimaChiusa();
  const options = need(catalogo.startOptions, 'scelte della pagina iniziale');
  options.waves = ownedWaves();
  ensureCollectionButton();
  renderPlayers();
  const current = catalogo.nemeses.find(n => n.name === preferenze.settings.nemesis);
  // Wave scelte: quelle di prima ancora nella collezione; se nessuna, la wave della nemesi scelta (o la prima)
  selectedWaves = selectedWaves.filter(w => options.waves.includes(w));
  if (!selectedWaves.length) {
    const currentWave = current ? waveOfNemesis(current) : null;
    selectedWaves = [currentWave !== null && options.waves.includes(currentWave) ? currentWave : options.waves[0]]
      .filter((w): w is string => !!w);
  }
  ensureWaveGroup();
  renderWavePills();
  renderBosses();
}

// Testata della pagina "Nuova partita": titolo e X (torna al menu iniziale). Resta ferma in alto mentre la pagina scorre
// sotto, e sotto di lei il contenuto sfuma nel nero (menu.css .start-setup-head)
export function startSetupHead(): HTMLElement {
  const existing = document.getElementById('start-setup-head');
  if (existing) return existing;
  const head = el('div', 'start-setup-head');
  head.id = 'start-setup-head';
  const x = el('button', 'ae-icon-button start-setup-close');
  x.type = 'button';
  x.setAttribute('aria-label', T.backToMenu);
  x.appendChild(icon('close'));
  x.addEventListener('click', () => vaiA('menu'));
  head.append(el('h1', 'start-setup-title', T.newGameTitle), x);
  pageEl(document, '.start-box', HTMLElement).prepend(head);
  return head;
}

// In 'setup' il pulsante principale è "Inizia partita"
export function updateStartActions(): void {
  resumeBtn.hidden = true;
  resumeBtn.className = 'ae-button ae-button--full ae-button--secondary start-resume-alt';
  startBtn.textContent = T.startNew;
  startBtn.className = 'ae-button ae-button--full ae-button--primary';
  startBtn.disabled = !preferenze.settings.nemesis || !battleOf(preferenze.settings.nemesis);
  startBtn.title = startBtn.disabled ? T.chooseNemesis : '';
  renderDeckOptions();
}

// Opzioni del mazzo: due interruttori sopra la wave ("Modalità battaglia", "Unisci le carte della collezione"), con il
// blocco di "Unisci" (mergeLockedWave) e, prima di "Inizia partita", una riga se il mazzo esce più corto
export function deckOptionsGroup(): HTMLElement {
  const existing = document.getElementById('deck-options');
  if (existing) return existing;
  const group = el('section', 'start-group start-deck-options');
  group.id = 'deck-options';
  group.setAttribute('aria-labelledby', 'deck-options-label');
  const label = el('h2', 'start-label', T.deckOptions);
  label.id = 'deck-options-label';
  const row = (key: 'battleMode' | 'mergeCollection', text: string, note: string) => {
    const r = el('label', 'ae-switch-row deck-option');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.dataset.option = key;
    const sw = el('span', 'ae-switch');
    sw.setAttribute('aria-hidden', 'true');
    const texts = el('span', 'deck-option-text');
    texts.append(el('span', 'deck-option-label', text), el('span', 'deck-option-note', note));
    r.append(texts, input, sw);
    input.addEventListener('change', () => {
      if (input.disabled) return;
      preferenze.settings[key] = input.checked;
      saveDeckOptions();
      renderDeckOptions();
    });
    return r;
  };
  const lockNote = el('p', 'start-note deck-option-lock');
  lockNote.id = 'deck-option-lock';
  group.append(label, row('battleMode', T.battleMode, T.battleModeNote),
    row('mergeCollection', T.mergeCollection, T.mergeCollectionNote), lockNote);
  ensureWaveGroup().before(group);
  return group;
}

export function renderDeckOptions(): void {
  if (!catalogo.deckSetup || !catalogo.nemeses.length) return;
  const group = deckOptionsGroup();
  const battle = pageEl(group, '[data-option="battleMode"]', HTMLInputElement);
  const merge = pageEl(group, '[data-option="mergeCollection"]', HTMLInputElement);
  const lockNote = pageEl(group, '.deck-option-lock', HTMLElement);
  battle.checked = preferenze.settings.battleMode !== false;
  const locked = mergeLockedWave();
  merge.checked = mergeActive();
  merge.disabled = !!locked;
  need(merge.closest('.ae-switch-row'), 'riga di "Unisci"').classList.toggle('is-locked', !!locked);
  merge.setAttribute('aria-describedby', locked ? lockNote.id : '');
  lockNote.hidden = !locked;
  lockNote.textContent = locked ? T.mergeLocked(waveLabel(locked).split(' - ')[0]) : '';
  // Riga di avviso prima di "Inizia partita": il mazzo esce più corto di deck-setup.json
  let warn = document.getElementById('deck-short');
  if (!warn) {
    warn = el('p', 'start-note deck-short');
    warn.id = 'deck-short';
    warn.setAttribute('role', 'status');
    startBtn.before(warn);
  }
  const short = preferenze.settings.nemesis ? deckShortfall() : null;
  warn.hidden = !short;
  warn.textContent = short ? T.deckShort(short.have, short.want) : '';
}

// Wave nella scelta della nemesi: solo quelle della collezione (se nessuna, tutte)
export function ownedWaves(): string[] {
  const all = collectionCatalog(T.baseBox).map(w => w.wave);
  const owned = all.filter(w => [...need(preferenze.collection, 'collezione')].some(id => waveOfCode(id) === w));
  return owned.length ? owned : all;
}

export function buildStartPage(): void {
  loadCollection();
  const setup = need(catalogo.deckSetup, 'deck-setup.json');
  const options = { players: Object.keys(setup.battles[0].players).map(Number), waves: ownedWaves() };
  impostaSceltePagina(options);
  const firstPlayable = catalogo.nemeses.find(isPlayable);
  preferenze.settings = Object.assign({ players: options.players[0], nemesis: firstPlayable ? firstPlayable.name : null }, loadDeckOptions());
  renderStartChoices();
}

// Wave: gruppo a sé ("Wave"), sopra la Nemesi, con un menu a tendina in cui si spuntano una o più wave (in cifre
// romane). Accanto al titolo "Nemesi" il dado sceglie una nemesi a caso. Creati qui, così valgono anche con un
// index.html vecchio (il vecchio <select> della wave resta nascosto e non si usa più).
export function ensureWaveGroup(): HTMLElement {
  const existing = document.getElementById('wave-group');
  if (existing) return existing;
  const select = document.getElementById('wave-select');
  const group = el('section', 'start-group start-wave');
  group.id = 'wave-group';
  group.setAttribute('aria-labelledby', 'wave-label');
  const label = el('h2', 'start-label', T.wave);
  label.id = 'wave-label';
  const dropdown = el('div', 'wave-dropdown');
  dropdown.id = 'wave-pills';
  const toggle = el('button', 'wave-dropdown-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'wave-menu');
  toggle.append(el('span', 'wave-dropdown-text'));
  toggle.insertAdjacentHTML('beforeend', CHEVRON_SVG);
  const menu = el('div', 'wave-menu');
  menu.id = 'wave-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', T.wavesLabel);
  menu.hidden = true;
  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    dropdown.classList.toggle('is-open', open);
  };
  // (hidden nei tipi del DOM può essere anche 'until-found'; qui è sempre true o false)
  toggle.addEventListener('click', () => setOpen(Boolean(menu.hidden)));
  // Un tocco fuori dal menu (o Esc) lo chiude
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !dropdown.contains(e.target instanceof Node ? e.target : null)) setOpen(false); });
  dropdown.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); setOpen(false); toggle.focus(); } });
  dropdown.append(toggle, menu);
  group.append(label, dropdown);
  const nemesisGroup = need(byId('nemesis-list', HTMLDivElement).closest('.start-group'), 'gruppo della nemesi');
  nemesisGroup.before(group);
  nemesisGroup.classList.add('start-nemesis');
  // Titolo "Nemesi" con a destra il dado (nemesi a caso tra tutte quelle della collezione)
  const nemesisLabel = document.getElementById('nemesis-label');
  if (nemesisLabel && !document.getElementById('nemesis-random')) {
    const row = el('div', 'start-label-row');
    nemesisLabel.before(row);
    row.appendChild(nemesisLabel);
    const dice = el('button', 'ae-icon-button nemesis-random');
    dice.id = 'nemesis-random';
    dice.type = 'button';
    dice.setAttribute('aria-label', T.randomNemesis);
    dice.title = T.randomNemesis;
    dice.innerHTML = DICE_SVG;
    dice.addEventListener('click', pickRandomNemesis);
    row.appendChild(dice);
  }
  if (select) {
    select.hidden = true;
    group.appendChild(select);
    const oldLabel = document.querySelector('label[for="wave-select"]');
    if (oldLabel) oldLabel.remove();
  }
  return group;
}

export const DICE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">'
  + '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/>'
  + '<circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/>'
  + '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/>'
  + '<circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/></svg>';

// Menu a tendina delle wave: testo con le wave scelte e, aperto, una casella per wave. Resta sempre almeno una wave.
export function renderWavePills(): void {
  const dropdown = byId('wave-pills', HTMLDivElement);
  const text = pageEl(dropdown, '.wave-dropdown-text', HTMLElement);
  const menu = pageEl(dropdown, '.wave-menu', HTMLElement);
  const options = need(catalogo.startOptions, 'scelte della pagina iniziale');
  const chosen = options.waves.filter(w => selectedWaves.includes(w));
  text.textContent = !chosen.length ? T.wavesNone
    : chosen.length === 1 ? waveLabel(chosen[0]) : T.wavesMore(waveLabel(chosen[0]), chosen.length - 1);
  menu.replaceChildren(...options.waves.map(wave => {
    const row = el('label', 'wave-option');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selectedWaves.includes(wave);
    input.addEventListener('change', () => {
      if (input.checked) selectedWaves.push(wave);
      else if (selectedWaves.length > 1) selectedWaves = selectedWaves.filter(w => w !== wave);
      else input.checked = true;
      segnaAnteprimaChiusa();
      renderWavePills();
      renderBosses();
    });
    row.append(input, el('span', 'wave-option-box'), el('span', 'wave-option-name', waveLabel(wave)));
    return row;
  }));
}

// Dado: una nemesi a caso tra tutte quelle giocabili della collezione (se possibile diversa da quella scelta); la sua
// wave si aggiunge alle wave scelte e la pagina scorre fino a lei
export function pickRandomNemesis(): void {
  const all = catalogo.nemeses.filter(isPlayable);
  if (!all.length) return;
  const pool = all.length > 1 ? all.filter(n => n.name !== preferenze.settings.nemesis) : all;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  // (una nemesi giocabile ha sempre un prodotto, quindi una wave)
  const wave = waveOfNemesis(pick);
  if (wave !== null && !selectedWaves.includes(wave)) selectedWaves.push(wave);
  preferenze.settings.nemesis = pick.name;
  segnaAnteprimaChiusa();
  renderWavePills();
  renderBosses();
  const selected = document.querySelector('.nemesis-item.is-selected');
  if (selected) selected.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  showToast(pick.name);
}

export function showStartSkeleton(): void {
  byId('nemesis-list', HTMLDivElement).replaceChildren(...[0, 1, 2, 3].map(() => el('div', 'nemesis-skeleton')));
}

// Disegno della pagina Nuova partita (o sua chiusura, isHome: si è nel menu iniziale): testata con la X, opzioni del
// mazzo e "Inizia partita". Restituisce dove va il fuoco: il primo pulsante dei giocatori
export function disegnaNuovaPartita(isHome: boolean): HTMLElement | null {
  startSetupHead().hidden = isHome;
  // Il vecchio Menu della pagina Nuova partita (sostituito dalla X) si toglie anche da una pagina già aperta
  const oldMenu = document.getElementById('start-menu-btn');
  if (oldMenu) oldMenu.remove();
  updateStartActions();
  return query(document, '#choices-players button', HTMLElement);
}
