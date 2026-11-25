// ui/componenti/token-volo.ts: le animazioni dei token (il token del potere che pulsa e diventa grigio, i token che
// compaiono sulla carta pescata) su una copia del token messa sopra tutta la pagina (position fixed sul body, come la carta
// che vola negli scarti): il carosello e la fascia piccola scorrono di lato e tagliano tutto ciò che sborda, la copia no.
// La copia sta nella stessa posizione e misura del token vero, che resta invisibile mentre lei si muove; a fine animazione
// la copia sparisce e sul token vero resta lo stato finale. I fotogrammi sono nel CSS (componenti.css, .ae-token-volo).
// Un volo ha una chiave: il disegno della partita rifà spesso i token, il volo non riparte e il token nuovo, nello stesso
// punto, prende il posto del vecchio (riallineaVoli). Con la riduzione del movimento non c'è nessuna copia: il chiamante
// lascia al CSS il comportamento di sempre (avviaVolo risponde false).
// Livello 3 (ui/componenti/). Dipende da: ui/pagina.ts (reducedMotion). Usato da: ui/schermate/turno-nemesi-carosello.ts.
import { reducedMotion } from '../pagina.ts';

export interface VoloToken {
  chiave: string;                        // un volo per chiave (una chiave nuova per ogni evento)
  trova: () => HTMLElement | null;       // il token vero, ritrovato nella pagina a ogni ridisegno
  animazione: 'is-spend' | 'is-pop';     // quale animazione CSS fa la copia
  durata: number;                        // ms (come nel CSS)
  inizio: number;                        // istante di partenza (performance.now()); se è già passato il volo riprende da lì
  nascostoPrima: boolean;                // il token vero resta invisibile fino alla partenza (i token che compaiono)
  finale: (token: HTMLElement) => void;  // stato finale, messo sul token vero
}

interface VoloInCorso {
  volo: VoloToken;
  copia: HTMLElement | null;             // c'è solo mentre il volo è in corso
  timer: ReturnType<typeof setTimeout> | 0;
  finito: boolean;
}

const voli = new Map<string, VoloInCorso>();
const MAX_VOLI = 60;

// Mette la copia dove sta il token vero, nascondendo quest'ultimo
function posiziona(corso: VoloInCorso, reale: HTMLElement): void {
  const r = reale.getBoundingClientRect();
  reale.classList.add('is-in-volo');
  if (!corso.copia) return;
  Object.assign(corso.copia.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}

function concludi(corso: VoloInCorso): void {
  if (corso.finito) return;
  corso.finito = true;
  if (corso.timer) clearTimeout(corso.timer);
  if (corso.copia) corso.copia.remove();
  corso.copia = null;
  const reale = corso.volo.trova();
  if (reale) {
    reale.classList.remove('is-in-volo');
    corso.volo.finale(reale);
  }
}

// La copia parte adesso: si misura il token vero in questo momento (la pagina può essere scorsa nell'attesa)
function parti(corso: VoloInCorso): void {
  corso.timer = 0;
  const { volo } = corso;
  const reale = volo.trova();
  if (!reale || !reale.getBoundingClientRect().width) { concludi(corso); return; }
  const trascorso = Math.max(0, performance.now() - volo.inizio);
  const copia = document.createElement('span');
  copia.className = 'ae-token ae-token-volo ' + volo.animazione;
  copia.setAttribute('aria-hidden', 'true');
  // Se il volo parte in ritardo (pagina ridisegnata a metà) riprende dal punto giusto
  copia.style.animationDelay = -trascorso + 'ms';
  corso.copia = copia;
  posiziona(corso, reale);
  document.body.appendChild(copia);
  corso.timer = setTimeout(() => concludi(corso), Math.max(0, volo.durata - trascorso) + 150);
  copia.addEventListener('animationend', () => concludi(corso), { once: true });
  // Il token vero può muoversi mentre la copia vola (il carosello scorre fino alla carta, la pagina si ridisegna): la copia lo segue
  const segui = (): void => {
    if (corso.finito || !corso.copia) return;
    const vero = volo.trova();
    if (vero) posiziona(corso, vero);
    requestAnimationFrame(segui);
  };
  requestAnimationFrame(segui);
}

// Avvia un volo (o, se c'è già, lo lascia correre: il token vero appena ridisegnato si rimette al suo posto). Risponde
// false se non c'è movimento da fare (riduzione del movimento): il chiamante lascia l'animazione al CSS
export function avviaVolo(volo: VoloToken): boolean {
  if (reducedMotion.matches) return false;
  const reale = volo.trova();
  if (!reale) return true;
  const presente = voli.get(volo.chiave);
  if (presente) {
    // Finito: lo stato finale va rimesso sul token nuovo. In corso: il token nuovo resta nascosto sotto la copia
    if (presente.finito) volo.finale(reale);
    else if (presente.copia || volo.nascostoPrima) posiziona(presente, reale);
    return true;
  }
  const corso: VoloInCorso = { volo, copia: null, timer: 0, finito: false };
  voli.set(volo.chiave, corso);
  if (voli.size > MAX_VOLI) voli.delete(voli.keys().next().value ?? '');
  if (volo.nascostoPrima) reale.classList.add('is-in-volo');
  const adesso = performance.now();
  if (adesso >= volo.inizio + volo.durata) concludi(corso);
  else if (adesso >= volo.inizio) parti(corso);
  else corso.timer = setTimeout(() => parti(corso), volo.inizio - adesso);
  return true;
}

// Dopo ogni ridisegno: i token veri dei voli in corso si nascondono e le copie si rimettono sopra di loro
export function riallineaVoli(): void {
  voli.forEach(corso => {
    if (corso.finito) return;
    const reale = corso.volo.trova();
    if (reale && (corso.copia || corso.volo.nascostoPrima)) posiziona(corso, reale);
  });
}
