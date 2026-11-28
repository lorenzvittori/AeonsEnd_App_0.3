// ui/schermate/mazzo-turni-pesca.ts: la pesca del turno dentro la schermata del mazzo dei turni (modalità pesca, vedi
// openDrawTurn in mazzo-turni.ts). La prima carta del mazzo si stacca dal suo posto e si ferma al centro, coperta, finché
// non la si tocca: solo allora si pesca (pescaCartaTurno), la carta si gira (flip di 180° sull'asse Y) e, se di chi è il
// turno si deve scegliere (carte 1/2 e 3/4), mostra sotto i token dei due giocatori; poi va in fondo agli scarti, dove
// nel frattempo c'è un segnaposto grigio. Fino al tocco non cambia niente nella partita: X e fase turni chiudono.
// File di supporto di mazzo-turni.ts.
// Livello 5 (ui/schermate/). Dipende da: stato/partita.ts, ui/ base (pagina, dom, testi, ridisegno), ui/componenti
// (animazioni, barra-turni, dialoghi), mazzo-turni-bozza.ts e mazzo-turni-disegno.ts. Usato da: mazzo-turni.ts.

import { currentTurnCard, isPairCard, pairOptions, partita, pescaCartaTurno, scegliGiocatoreCoppia,
  turnCardPlayer } from '../../stato/partita.ts';
import type { CartaTurno, Giocatore } from '../../tipi/partita.ts';
import { buzz } from '../componenti/animazioni.ts';
import { renderTurnTrack, turnTrack } from '../componenti/barra-turni.ts';
import { announce, loadImage } from '../componenti/dialoghi.ts';
import { el, need } from '../dom.ts';
import { reducedMotion } from '../pagina.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { T } from '../testi.ts';
import { turnDraftKey } from './mazzo-turni-bozza.ts';
import type { Finestra } from './mazzo-turni-bozza.ts';
import { draw } from './mazzo-turni-disegno.ts';

// Durate (ms): estrazione, flip, comparsa e feedback dei token, volo negli scarti, pausa
const T_EXTRACT = 540, T_FLIP = 620, T_PICKS = 320, T_FEEDBACK = 280, T_FLY = 560, T_PAUSE = 360;
// Carta al centro: al massimo 176 px di larghezza, proporzioni del dorso (252 x 352)
const CARD_W_MAX = 176;
const CARD_RATIO = 352 / 252;
// Sotto la carta: spazio, scritta "Chi gioca questo turno?", token alti 67 px (riservati sempre: prima del tocco non si sa)
const PICKS_BLOCK = 16 + 20 + 12 + 67;

function turnCardSrc(name: string): string { return `Assets/ui/turn-cards/${name}.webp`; }
function faccia(src: string): HTMLImageElement {
  const img = document.createElement('img');
  img.alt = '';
  img.src = src;
  return img;
}
// Con "riduci movimento" le animazioni non durano
function ms(n: number): number { return reducedMotion.matches ? 0 : n; }
// Un'animazione WAAPI che finisce davvero (senza WAAPI o con riduci movimento, subito)
function run(node: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Promise<unknown> {
  if (reducedMotion.matches || !node.animate) return Promise.resolve();
  return node.animate(frames, opts).finished.catch(() => undefined);
}

// Avvia la sequenza di pesca nella schermata già aperta. chiudi: chiude la schermata (tryClose) a fine sequenza.
export function avviaPesca(f: Finestra, chiudi: () => void): void {
  const stato = need(f.pesca, 'modalità pesca della schermata');
  let layer: HTMLDivElement | null = null;
  let cartaPrima: HTMLElement | undefined;
  const sequenza = async (): Promise<void> => {
    // Il foglio scende prima: le misure (e il punto di partenza) si prendono a foglio fermo
    await Promise.all(f.sheet.getAnimations().map(a => a.finished.catch(() => undefined)));
    f.sheet.inert = true; // niente tocchi sul mazzo durante la pesca
    // Il punto di partenza: la prima carta del mazzo (o il posto vuoto, se il mazzo era vuoto e si rimescola)
    cartaPrima = f.d.left.length ? f.fanEls[0] : undefined;
    const origine: Element = cartaPrima ?? f.lane.querySelector('.ae-turn-fan-empty') ?? f.lane;
    const partenza = origine.getBoundingClientRect();
    if (cartaPrima) cartaPrima.style.visibility = 'hidden'; // la copia che si muove è l'unica carta visibile

    // Area libera al centro: tra la linea del tempo e il fondo del foglio
    const foglio = f.sheet.getBoundingClientRect();
    const alto = f.time.getBoundingClientRect().bottom + 12;
    const basso = foglio.bottom - 12;
    const area = Math.max(0, basso - alto);
    const W = Math.min(CARD_W_MAX, foglio.width * 0.62, (area - PICKS_BLOCK) / CARD_RATIO);
    const H = W * CARD_RATIO;
    const cx = foglio.left + foglio.width / 2;
    const topCarta = alto + Math.max(0, (area - H - PICKS_BLOCK) / 2);

    layer = el('div', 'ae-draw-layer');
    need(f.dialog.parentElement, 'sfondo della finestra').appendChild(layer);
    // La carta che si muove: un solo oggetto dal mazzo al centro (niente duplicati)
    const ghost = el('div', 'ae-draw-ghost');
    Object.assign(ghost.style, { left: (cx - W / 2) + 'px', top: topCarta + 'px', width: W + 'px', height: H + 'px' });
    const flip = el('div', 'ae-flip');
    const inner = el('div', 'ae-flip-inner');
    const back = el('div', 'ae-flip-face ae-flip-face--back');
    back.appendChild(faccia(turnCardSrc('back')));
    const front = el('div', 'ae-flip-face ae-flip-face--front');
    inner.append(back, front);
    flip.appendChild(inner);
    ghost.appendChild(flip);
    layer.appendChild(ghost);

    // Fase A: dal posto del mazzo al centro, ingrandendosi (il dorso resta visibile)
    const dx = partenza.left + partenza.width / 2 - cx;
    const dy = partenza.top + partenza.height / 2 - (topCarta + H / 2);
    ghost.classList.add('is-lifted');
    await run(ghost, [{ transform: `translate(${dx}px, ${dy}px) scale(${partenza.width / W})` }, { transform: 'none' }],
      { duration: ms(T_EXTRACT), easing: 'cubic-bezier(.25, .1, .25, 1)' });

    // Fase A2: la carta resta coperta al centro, pronta; un tocco la gira e pesca il turno. Chiudendo la schermata
    // (X, fase turni) prima del tocco non si pesca nulla: il pulsante torna "Pesca carta turno"
    ghost.classList.add('is-ready');
    ghost.style.pointerEvents = 'auto';
    const tocco = await new Promise<boolean>(resolve => {
      f.pesca!.lascia = () => resolve(false);
      ghost.addEventListener('click', () => resolve(true), { once: true });
    });
    f.pesca!.lascia = undefined;
    if (!tocco) return;
    ghost.classList.remove('is-ready');
    ghost.style.pointerEvents = '';

    // Pesca vera, una sola volta, al tocco (un passo di undo, come le altre azioni della partita)
    pescaCartaTurno();
    const kind: CartaTurno | null = currentTurnCard();
    if (!kind) return;
    // La bozza segue la partita, che ha già la pesca: va ridisegnata senza scriverla di nuovo (saveTurnDraft
    // ridisegnerebbe la partita, e una nemesi partirebbe prima della fine della pesca)
    const coperte = f.d.known.slice();
    const riciclato = f.d.left.length === 0;
    f.d = f.fresh(partita.turnOrder);
    f.d.old = riciclato ? [] : coperte.slice(1);
    f.initial = f.fresh(partita.turnOrder);
    f.initial.old = f.d.old.slice();
    f.savedKey = turnDraftKey(f.d);
    // Senza transizioni: la carta negli scarti è subito nel suo posto finale, e lì c'è il segnaposto grigio (come
    // quando si trascina una carta) finché la carta non ci arriva
    draw(f, true);
    const segnaposto = need(f.pileEls[f.pileEls.length - 1], 'posto della carta negli scarti');
    segnaposto.classList.add('is-dragging');
    const arrivo = need(segnaposto.parentElement, 'posto della carta negli scarti');
    const bersaglio = arrivo.getBoundingClientRect();

    // Fase B: il fronte è pronto (al massimo si aspetta 300 ms), poi il flip di 180° sull'asse Y
    const src = turnCardSrc(String(kind));
    front.appendChild(faccia(src));
    await Promise.race([loadImage(src), new Promise(r => setTimeout(r, ms(300)))]);
    await run(inner, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
      { duration: ms(T_FLIP), easing: 'ease-in-out', fill: 'forwards' });
    // Stato finale con la classe di turno-nemesi.css (vale anche con riduci movimento, dove non c'è animazione)
    flip.classList.add('is-flipped');
    buzz(30);
    if (kind === 'nemesis') {
      renderTurnTrack();
      announce(T.trackNemesisResolve);
    } else {
      richiediRidisegno();
      announce(turnTrack.getAttribute('aria-label') ?? '');
    }

    // Fase C: carta 1/2 o 3/4 senza giocatore: si attende la scelta dai token (e si può chiudere la schermata: la scelta
    // resta da fare dai pulsanti in basso); altrimenti (nemesi, singolo giocatore) la carta resta un attimo
    if (isPairCard(kind) && !turnCardPlayer(kind)) {
      const picks = el('div', 'ae-draw-picks');
      Object.assign(picks.style, { top: (topCarta + H + 16) + 'px' });
      picks.appendChild(el('p', 'ae-draw-picks-title', T.pairChoiceTitle));
      const riga = el('div', 'ae-draw-picks-row');
      const opzioni = pairOptions(kind);
      const bottoni: HTMLButtonElement[] = opzioni.map((p: Giocatore) => {
        const b = el('button', 'ae-pair-pick', p.slice(1));
        b.type = 'button';
        b.dataset.kind = p;
        b.setAttribute('aria-label', T.pairChoiceLabel(Number(p.slice(1))));
        return b;
      });
      riga.append(...bottoni);
      picks.appendChild(riga);
      layer.appendChild(picks);
      // Comparsa dei token: dissolvenza e scala da 0.90 a 1
      void run(picks, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: ms(T_PICKS), easing: 'ease-out' });
      // Il tocco sul token è la scelta; chiudendo la schermata (lascia) la scelta passa ai pulsanti in basso
      const esito = await new Promise<Giocatore | null>(resolve => {
        f.pesca!.lascia = () => resolve(null);
        bottoni.forEach((b, i) => b.addEventListener('click', () => {
          if (bottoni.some(x => x.disabled)) return;
          bottoni.forEach(x => { x.disabled = true; });
          resolve(opzioni[i]);
        }));
      });
      f.pesca!.lascia = undefined;
      if (!esito) return; // schermata chiusa prima della scelta: la carta è già negli scarti, la scelta è in basso
      const scelto = esito;
      scegliGiocatoreCoppia(scelto);
      announce(T.trackPlayer(Number(scelto.slice(1))));
      // Feedback: il token scelto cresce con un alone del suo colore, gli altri si attenuano
      const pick = bottoni.find(b => b.dataset.kind === scelto);
      await Promise.all(bottoni.map(b => b === pick
        ? run(b, [{ transform: 'scale(1)', filter: 'drop-shadow(0 0 0 transparent)' },
            { transform: 'scale(1.1)', filter: 'drop-shadow(0 0 12px var(--ae-player))' }], { duration: ms(T_FEEDBACK), fill: 'forwards' })
        : run(b, [{ opacity: 1 }, { opacity: 0.35 }], { duration: ms(T_FEEDBACK), fill: 'forwards' })));
      // Fase D1: i token svaniscono
      await run(picks, [{ opacity: 1 }, { opacity: 0 }], { duration: ms(T_PICKS), fill: 'forwards' });
      picks.remove();
    } else {
      await new Promise(r => setTimeout(r, ms(1000)));
    }

    // Fase D: la carta va in fondo agli scarti, riducendosi alla misura delle miniature
    const g = ghost.getBoundingClientRect();
    const ddx = bersaglio.left + bersaglio.width / 2 - (g.left + g.width / 2);
    const ddy = bersaglio.top + bersaglio.height / 2 - (g.top + g.height / 2);
    await run(ghost, [{ transform: 'none' }, { transform: `translate(${ddx}px, ${ddy}px) scale(${bersaglio.width / g.width})` }],
      { duration: ms(T_FLY), easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
    // La carta è arrivata: il segnaposto diventa la carta nello stesso istante in cui la copia sparisce
    layer.remove();
    layer = null;
    segnaposto.classList.remove('is-dragging');
    await new Promise(r => setTimeout(r, ms(T_PAUSE)));
  };

  sequenza().catch(() => undefined).finally(() => {
    // Anche con un errore o una chiusura la schermata si chiude e la partita resta com'è: se la carta non è stata
    // pescata (chiusa prima del tocco) il mazzo torna com'era
    layer?.remove();
    if (cartaPrima) cartaPrima.style.visibility = '';
    f.sheet.inert = false;
    stato.busy = false;
    chiudi();
  });
}
