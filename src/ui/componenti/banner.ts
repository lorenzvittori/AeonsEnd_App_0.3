// ui/componenti/banner.ts: la scritta al centro ("Tier 2", "Tier 3", "Partita iniziata"), con il carattere caricato
// all'avvio perché l'animazione non vada a scatti.
// Livello 3 (ui/componenti/). Dipende da: ui/dom.ts, ui/testi.ts, ui/componenti/animazioni.ts (buzz). Usato da: navigazione (render:
// Tier), crea mazzo (Partita iniziata), avvio.ts (carattere).
import { buzz } from './animazioni.ts';
import { el } from '../dom.ts';
import { T } from '../testi.ts';

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
  if (document.fonts && document.fonts.load) document.fonts.load(BANNER_FONT, 'Tier 123 ' + T.gameStarted + ' ' + T.victoryTitle + '!').catch(() => {});
}
