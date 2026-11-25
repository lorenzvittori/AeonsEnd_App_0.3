// ui/finestre/vita.ts: la finestra della vita di Gravehold o della nemesi (numero grande, −5 −1 +1 +5), che esce dal box
// e ci torna; alla chiusura la vita si applica in un passo di undo, a 0 la Vittoria o la Sconfitta.
// Livello 4 (ui/finestre/). Dipende da: regole/vite.ts, stato/ (partita: lettura e cambiaVita, preferenze), ui/ base
// (testi, pagina, dom, ridisegno), ui/componenti (animazioni, dialoghi, vite). Usato da: navigazione (aggancio
// apriFinestraVita).
import * as Vite from '../../regole/vite.ts';
import { cambiaVita, GRAVEHOLD_LIFE, nemesisStartLife, partita } from '../../stato/partita.ts';
import { preferenze } from '../../stato/preferenze.ts';
import type { TipoVita } from '../../tipi/partita.ts';
import { animDone } from '../componenti/animazioni.ts';
import { modals, openModal } from '../componenti/dialoghi.ts';
import { livesRow, renderLifeDigits } from '../componenti/vite.ts';
import { el, need, query } from '../dom.ts';
import { reducedMotion, ui } from '../pagina.ts';
import { mostraFinePartita, richiediRidisegno } from '../ridisegno.ts';
import { T } from '../testi.ts';

export function openLifeDialog(kind: TipoVita): void {
  if (ui.isTransitioning || modals.length) return;
  const grave = kind === 'grave';
  const name = grave ? T.graveholdName : (preferenze.settings.nemesis || '');
  const original = grave ? partita.graveLife : partita.nemesisLife;
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
  dialog.setAttribute('aria-label', `${name}, ${T.lifeKind}`);
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
    b.setAttribute('aria-label', T.lifeStepAria(step));
    steps.push([step, b]);
    if (step === 1) controls.appendChild(el('span', 'ae-life-step-gap'));
    controls.appendChild(b);
  });
  // Sopra la pillola, in Cinzel, "Gravehold" o "Nemesi" (fa parte della finestra: si ingrandisce con lei)
  const title = el('h2', 'ae-life-modal-title', grave ? T.graveholdName : T.nemesisWord);
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
      cambiaVita(kind, value);
      richiediRidisegno();
    }
    const done = () => {
      close();
      if (box) box.style.visibility = '';
      // A 0: nemesi = Vittoria, Gravehold = Sconfitta (regole/vite.ts)
      const outcome = Vite.lifeOutcome(kind, value, changed);
      if (outcome) mostraFinePartita(outcome);
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
