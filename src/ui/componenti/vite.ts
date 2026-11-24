// ui/componenti/vite.ts: la riga delle vite di Gravehold e della nemesi sotto la fascia del turno attivo: box con il
// number scrubbing (trascinando in verticale la vita cambia), cifre che scorrono (renderLifeDigits, usate anche dalla
// finestra della vita) e sfondo del box di Gravehold scelto nel Menu. Un tocco sul box apre la finestra della vita
// (aggancio apriFinestraVita); a 0 la Vittoria o la Sconfitta (aggancio mostraFinePartita).
// Livello 3 (ui/componenti/). Dipende da: regole/vite.ts, stato/ (catalogo, preferenze, partita: lettura e azione
// cambiaVita), ui/ base (testi, pagina, dom, ridisegno), ui/componenti (animazioni, dialoghi, vite-scrub). Usato da:
// sfondi, finestra della vita, navigazione (render).
import * as Vite from '../../regole/vite.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { cambiaVita, GRAVEHOLD_LIFE, nemesisStartLife, partita } from '../../stato/partita.ts';
import { preferenze } from '../../stato/preferenze.ts';
import type { TipoVita } from '../../tipi/partita.ts';
import { animDone } from './animazioni.ts';
import { modals } from './dialoghi.ts';
import { scrubDelta, scrubStart, scrubValue } from './vite-scrub.ts';
import { el, need, query, queryAll } from '../dom.ts';
import { cssUrl, reducedMotion, ui } from '../pagina.ts';
import type { Sfondo } from '../pagina.ts';
import { apriFinestraVita, mostraFinePartita, richiediRidisegno } from '../ridisegno.ts';
import { I18N_IT } from '../testi.ts';

export let livesRow: HTMLDivElement | null = null;

export function ensureLivesRow(): HTMLDivElement {
  if (livesRow) return livesRow;
  const row = el('div', 'ae-lives');
  livesRow = row;
  const box = (kind: TipoVita) => {
    const b = el('button', 'ae-life-box ae-life-box--' + kind);
    b.type = 'button';
    b.dataset.kind = kind;
    // Solo il numero (niente nome né goccia; il nome resta nell'etichetta per i lettori di schermo) e, durante lo
    // scrubbing, il cambio "+x" / "−y" a destra in alto, come nella finestra
    const num = el('span', 'ae-life-num');
    const delta = el('span', 'ae-life-box-delta');
    delta.setAttribute('aria-hidden', 'true');
    num.append(el('span', 'ae-life-value'), delta);
    b.append(num);
    // Scritta piccolissima sopra il box (alta 7px, solo da vedere: il nome è già nell'etichetta del pulsante)
    const tag = el('span', 'ae-life-tag', kind === 'grave' ? 'Gravehold' : 'Nemesis');
    tag.setAttribute('aria-hidden', 'true');
    b.appendChild(tag);
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', () => {
      // Il click che chiude uno scrubbing non apre la finestra
      if (b.dataset.scrubbed) { delete b.dataset.scrubbed; return; }
      apriFinestraVita(kind);
    });
    lifeScrub(b, kind);
    return b;
  };
  row.append(box('grave'), box('nemesis'));
  return row;
}

// anchor: la fascia del turno attivo, dopo la quale sta la riga (la sceglie il coordinatore); senza, la riga resta dov'è
// (nuovo sfondo di Gravehold scelto nel Menu)
export function renderLives(anchor?: Element): void {
  const row = ensureLivesRow();
  if (anchor && row.previousElementSibling !== anchor) anchor.after(row);
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
  const art = preferenze.settings.nemesis ? catalogo.nemesisArt[preferenze.settings.nemesis] : undefined;
  setBg(lifeBox('nemesis'), art && art.portrait);
  const lives: [TipoVita, string, number][] = [['grave', I18N_IT.graveholdName, partita.graveLife], ['nemesis', preferenze.settings.nemesis || '', partita.nemesisLife]];
  lives.forEach(([kind, name, value]) => {
    const b = lifeBox(kind);
    // Il numero si riscrive solo se è cambiato: dopo uno scrubbing le cifre stanno ancora scorrendo
    const v = need(query(b, '.ae-life-value', HTMLElement), 'numero della vita');
    if (v.dataset.shown !== String(value) && !b.classList.contains('is-scrubbing')) {
      v.textContent = String(value);
      v.dataset.shown = String(value);
    }
    b.classList.toggle('is-zero', value <= 0);
    b.setAttribute('aria-label', I18N_IT.lifeAria(name, value));
  });
}

// Number scrubbing sui box delle vite: tenendo premuto e trascinando in verticale (in su sale, in giù scende) la vita
// cambia di 1 ogni LIFE_SCRUB_PX, mai sopra il massimo né sotto 0, come nella finestra (vite-scrub.ts), con le cifre
// che scorrono (renderLifeDigits) e il cambio "+x" / "−y" accanto. Parte dopo LIFE_SCRUB_START in verticale (più in
// verticale che di lato; di lato il gesto si annulla). Al rilascio la vita si applica una volta sola (azione cambiaVita:
// un passo di undo, si salva); a 0 → Vittoria o Sconfitta. Un tocco senza trascinare apre ancora la finestra; il click
// che segue uno scrubbing no (data-scrubbed). Sul box la pagina non scorre (vite.css, touch-action: none)
export function lifeScrub(b: HTMLElement, kind: TipoVita): void {
  // Trascinamento in corso: punto di partenza, vita all'inizio, vita mostrata, partito o no, tetto
  let s: { x: number; y: number; id: number; start: number; value: number; on: boolean; cap: number } | null = null;
  const grave = kind === 'grave';
  const cur = () => grave ? partita.graveLife : partita.nemesisLife;
  const value = () => need(query(b, '.ae-life-value', HTMLElement), 'numero della vita');
  const delta = () => need(query(b, '.ae-life-box-delta', HTMLElement), 'cambio della vita');
  b.addEventListener('pointerdown', e => {
    if (e.button > 0 || ui.isTransitioning || modals.length) return;
    s = { x: e.clientX, y: e.clientY, id: e.pointerId, start: cur(), value: cur(), on: false,
      cap: Vite.lifeCap(cur(), grave ? GRAVEHOLD_LIFE : nemesisStartLife()) };
  });
  b.addEventListener('pointermove', e => {
    if (!s || e.pointerId !== s.id) return;
    const up = s.y - e.clientY;
    if (!s.on) {
      const go = scrubStart(up, e.clientX - s.x);
      if (go === 'cancel') { s = null; return; }
      if (go === 'wait') return;
      s.on = true;
      s.y = e.clientY;
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* niente cattura */ }
      b.classList.add('is-scrubbing');
      return;
    }
    e.preventDefault();
    const next = scrubValue(s.start, up, s.cap);
    if (next === s.value) return;
    const v = value();
    renderLifeDigits(v, String(next), String(s.value), next < s.value ? -1 : 1);
    v.dataset.shown = String(next);
    s.value = next;
    b.classList.toggle('is-loss', next < s.start);
    b.classList.toggle('is-gain', next > s.start);
    delta().textContent = scrubDelta(next - s.start);
    // Una vibrazione brevissima per punto, solo se la pagina ha già avuto un tocco (altrimenti il browser la blocca)
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
      try { navigator.vibrate(5); } catch (err) { /* niente vibrazione */ }
    }
  });
  const end = (apply: boolean) => (e: PointerEvent) => {
    if (!s || e.pointerId !== s.id) return;
    const { on, value: shown, start } = s;
    s = null;
    if (!on) return;
    b.classList.remove('is-scrubbing', 'is-loss', 'is-gain');
    delta().textContent = '';
    b.dataset.scrubbed = '1';
    setTimeout(() => { delete b.dataset.scrubbed; }, 0);
    if (!apply || shown === start) {
      // Annullato: le cifre tornano al valore di prima
      if (shown !== start) {
        const v = value();
        renderLifeDigits(v, String(start), String(shown), start < shown ? -1 : 1);
        v.dataset.shown = String(start);
      }
      return;
    }
    cambiaVita(kind, shown);
    richiediRidisegno();
    const outcome = Vite.lifeOutcome(kind, shown, true);
    if (outcome) mostraFinePartita(outcome);
  };
  b.addEventListener('pointerup', end(true));
  b.addEventListener('pointercancel', end(false));
}

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

// Sfondo del box della vita di Gravehold (Assets/ui/gravehold/), scelto nel Menu della partita e salvato nel browser
// (non fa parte della partita, niente undo). Il box della nemesi ha il ritratto della nemesi (renderLives).
export const GRAVEHOLD_BG_KEY = 'aeonsend-app-0.2-gravehold-bg';

export const GRAVEHOLD_BGS: Sfondo[] = [
  { id: 'city', src: 'Assets/ui/gravehold/gravehold-city.webp' },
  { id: 'tower', src: 'Assets/ui/gravehold/gravehold-tower.webp' }
];

export function currentGraveholdBg(): Sfondo {
  let id: string | null = null;
  try { id = localStorage.getItem(GRAVEHOLD_BG_KEY); } catch (err) { /* si usa quello predefinito */ }
  return GRAVEHOLD_BGS.find(b => b.id === id) || GRAVEHOLD_BGS[0];
}

export function setGraveholdBg(id: string): void {
  try { localStorage.setItem(GRAVEHOLD_BG_KEY, id); } catch (err) { console.warn(err); }
  renderLives();
}
