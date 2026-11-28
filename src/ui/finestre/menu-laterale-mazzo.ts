// ui/finestre/menu-laterale-mazzo.ts: indicatore del mazzo Nemesi nel menu laterale. Una tacca per ogni carta del mazzo iniziale, in
// ordine di pesca, divise in Tier da due separatori. La geometria si calcola una volta sola (con le tacche alla dimensione
// massima, quella dorata): la posizione di ogni tacca è fissa in percentuale della larghezza, così una pesca cambia solo
// colore e dimensione della tacca, mai la posizione di altri elementi. Le carte pescate sono le prime della sequenza
// (si pesca dal Tier 1 al Tier 3), quindi lo stato viene dal mazzo reale della partita (deck), non da un contatore a parte.
// Livello 4 (ui/finestre/). Dipende da: stato/partita.ts (lettura), ui/dom.ts. Usato da: menu-laterale.ts.

import { partita } from '../../stato/partita.ts';
import { el } from '../dom.ts';

// Geometria di riferimento (unità; distanze misurate bordo a bordo)
const LARG_DORATA = 5;     // tacca pescata
const LARG_GRIGIA = 3;     // tacca nel mazzo (scala 0,6 × 0,5 della dorata)
const LARG_SEPARATORE = 1;
const GAP_TACCHE = 5;      // tra due tacche
const GAP_SEPARATORE = 3.75; // tra una tacca e un separatore (75% di GAP_TACCHE)

type Tipo = 'carta' | 'separatore';
interface Voce { tipo: Tipo; tier: number; centro: number; larg: number; sinistra: number; destra: number; carta: number }

export interface Composizione {
  totale: number;           // carte del mazzo iniziale (con Tier 1-3)
  rimaste: number;          // carte ancora nel mazzo
  tot: [number, number, number];      // carte iniziali per Tier
  pescate: [number, number, number];  // carte già pescate per Tier
  corrente: number;         // Tier in corso (o l'ultimo, a mazzo finito)
}

// Quante carte ci sono per Tier e quante sono già uscite dal mazzo (mazzo + in gioco + scarti = mazzo iniziale)
export function composizioneMazzo(): Composizione {
  const tierOf = (c: { tier?: unknown }) => Number(c.tier);
  const tot: [number, number, number] = [0, 0, 0];
  const nelMazzo: [number, number, number] = [0, 0, 0];
  const conta = (lista: readonly { tier?: unknown }[], dove: [number, number, number]) => {
    for (const c of lista) {
      const t = tierOf(c);
      if (t >= 1 && t <= 3) dove[t - 1]++;
    }
  };
  conta(partita.deck, nelMazzo);
  conta(partita.deck, tot);
  conta(partita.queue.map(v => v.data), tot);
  conta(partita.discard, tot);
  const pescate: [number, number, number] = [tot[0] - nelMazzo[0], tot[1] - nelMazzo[1], tot[2] - nelMazzo[2]];
  let corrente = 3;
  for (let t = 0; t < 3; t++) if (pescate[t] < tot[t]) { corrente = t + 1; break; }
  return { totale: tot[0] + tot[1] + tot[2], rimaste: partita.deck.length, tot, pescate, corrente };
}

// Sequenza fissa delle voci con le posizioni in unità (dimensione massima), poi in percentuale della larghezza
function disponi(comp: Composizione): { voci: Voce[]; larghezza: number; gruppi: { centro: number; sinistra: number; destra: number }[] } {
  const voci: Voce[] = [];
  let x = 0;
  let prima = true;
  let ultimaCarta = false;
  const gruppi: { centro: number; sinistra: number; destra: number }[] = [];
  let numero = 0;
  for (let t = 1; t <= 3; t++) {
    const n = comp.tot[t - 1];
    for (let i = 0; i < n; i++) {
      if (!prima) x += ultimaCarta ? GAP_TACCHE : GAP_SEPARATORE;
      prima = false;
      const larg = LARG_DORATA;
      voci.push({ tipo: 'carta', tier: t, centro: x + larg / 2, larg, sinistra: x, destra: x + larg, carta: numero++ });
      x += larg;
      ultimaCarta = true;
    }
    // Separatore dopo il Tier 1 e il Tier 2 (solo se il Tier ha delle carte)
    if (t < 3 && n > 0) {
      x += GAP_SEPARATORE;
      voci.push({ tipo: 'separatore', tier: t, centro: x + LARG_SEPARATORE / 2, larg: LARG_SEPARATORE, sinistra: x, destra: x + LARG_SEPARATORE, carta: -1 });
      x += LARG_SEPARATORE;
      ultimaCarta = false;
      prima = false;
    }
  }
  // Un gruppo per Tier (indice 0 = Tier 1), dal primo al-ultimo bordo delle sue tacche
  for (let t = 1; t <= 3; t++) {
    const mie = voci.filter(v => v.tipo === 'carta' && v.tier === t);
    const sinistra = mie.length ? Math.min(...mie.map(v => v.sinistra)) : x;
    const destra = mie.length ? Math.max(...mie.map(v => v.destra)) : x;
    gruppi.push({ centro: (sinistra + destra) / 2, sinistra, destra });
  }
  return { voci, larghezza: x || 1, gruppi };
}

export interface IndicatoreMazzo {
  radice: HTMLElement;
  aggiorna: () => void;
}

// Costruisce il blocco del mazzo (intestazione, titoli dei Tier, barra, contatori). Il DOM si crea qui una volta: gli
// aggiornamenti (aggiorna) cambiano solo classi e testi.
export function indicatoreMazzo(titoloMazzo: string, titoloTier: (n: number) => string): IndicatoreMazzo {
  const comp0 = composizioneMazzo();
  const { voci, larghezza, gruppi } = disponi(comp0);
  const pct = (v: number) => (v / larghezza * 100).toFixed(4) + '%';

  const radice = el('div', 'ae-deck-meter');
  const testa = el('div', 'ae-deck-head');
  const etichetta = el('span', 'ae-deck-title', titoloMazzo);
  const contatore = el('span', 'ae-deck-count');
  testa.append(etichetta, contatore);

  // Titoli e contatori dei Tier: posizioni fisse (centrati sul loro gruppo)
  const righeTier = el('div', 'ae-deck-tiers-top');
  const righeConta = el('div', 'ae-deck-tiers-bottom');
  const titoli: HTMLElement[] = [];
  const conte: HTMLElement[] = [];
  const barra = el('div', 'ae-deck-bar');
  const tacche: { voce: Voce; nodo: HTMLElement; dentro: HTMLElement }[] = [];

  voci.forEach(v => {
    const nodo = el('div', v.tipo === 'carta' ? 'ae-deck-tick' : 'ae-deck-sep');
    nodo.style.left = pct(v.centro);
    nodo.style.width = pct(v.larg);
    let dentro: HTMLElement = nodo;
    if (v.tipo === 'carta') {
      dentro = el('span', 'ae-deck-tick-in');
      nodo.appendChild(dentro);
      tacche.push({ voce: v, nodo, dentro });
    }
    barra.appendChild(nodo);
  });

  gruppi.forEach((g, i) => {
    const c = g.centro;
    const titolo = el('span', 'ae-deck-tier-title', titoloTier(i + 1));
    titolo.style.left = pct(c);
    const conto = el('span', 'ae-deck-tier-count');
    conto.style.left = pct(c);
    titoli.push(titolo);
    conte.push(conto);
    righeTier.appendChild(titolo);
    righeConta.appendChild(conto);
  });

  const corpo = el('div', 'ae-deck-body');
  corpo.append(righeTier, barra, righeConta);
  radice.append(testa, corpo);

  const aggiorna = () => {
    const comp = composizioneMazzo();
    contatore.textContent = `${comp.rimaste} / ${comp.totale}`;
    // Le prime carte della sequenza sono quelle pescate (Tier 1, poi 2, poi 3)
    const usciteTotali = comp.pescate[0] + comp.pescate[1] + comp.pescate[2];
    tacche.forEach(({ voce, nodo }) => {
      nodo.classList.toggle('is-drawn', voce.carta < usciteTotali);
    });
    // Tier completati o in corso: dorati. Quelli non ancora raggiunti: grigi
    gruppi.forEach((g, i) => {
      const dorato = i + 1 <= comp.corrente;
      titoli[i].classList.toggle('is-active', dorato);
      conte[i].classList.toggle('is-active', dorato);
      conte[i].textContent = `${comp.pescate[i]}/${comp.tot[i]}`;
    });
  };
  aggiorna();
  return { radice, aggiorna };
}
