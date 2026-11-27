// ui/finestre/biblioteca.ts: la Biblioteca, a tutto schermo dal menu iniziale. Testata con il titolo, tre schede (Nemesi,
// Mercato, Tesori; per ora solo il Mercato ha contenuto, scelta da una tendina nella testata), nel Mercato i filtri (set e
// meccaniche in due pannelli a selezione multipla, la lente per la ricerca per nome, ID o effetto; costo) e le carte: caroselli per costo, o una griglia a due colonne con
// un costo scelto. L'ordine è fisso (costo crescente, nome). Toccando una carta, lo zoom a tutto schermo (la scansione
// originale). La barra inferiore sceglie la categoria (Gemme, Reliquie, Incantesimi).
// Stato separato dalla partita: aprire la Biblioteca non tocca il mazzo, i turni o il salvataggio.
// Le carte (cards_supply.json) e le meccaniche (mechanics.json) si leggono solo quando la Biblioteca si apre la prima
// volta. Se mechanics.json manca o è rotto il filtro meccaniche non si mostra e il Mercato funziona lo stesso (solo console).
// Livello 6 (finestre). Dipende da: regole/biblioteca.ts (logica), dati/ (lettura e controllo), stato/catalogo.ts,
// ui/ base (testi, dom, pagina), ui/componenti/dialoghi.ts (updateInert), ui/finestre/biblioteca-icone.ts.
// Usato da: ui/schermate/menu.ts (pulsante Biblioteca). Stile: biblioteca.css.

import { T } from '../testi.ts';
import { el, icon } from '../dom.ts';
import { updateInert } from '../componenti/dialoghi.ts';
import { DATA_ROOT, startLayer } from '../pagina.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { loadJson } from '../../dati/dati.ts';
import { checkMechanics, checkSupplyCards, reportProblems } from '../../dati/controllo.ts';
import type { CartaSupply, Meccanica, TipoSupply } from '../../tipi/dati.ts';
import { CATEGORIE_MERCATO, etichettaCosto, fasceCostoPresenti, filtra, leggiPreferenzeBiblioteca,
  meccanicheDiCategoria, raggruppaPerCosto, setPresenti } from '../../regole/biblioteca.ts';
import type { PreferenzeBiblioteca } from '../../regole/biblioteca.ts';
import { iconaCategoria, iconaLente } from './biblioteca-icone.ts';
import { adattaEtichetteIn, disconnettiEtichette, messaggio, voceCarta } from './biblioteca-carte.ts';
import { apriZoomCarta } from './biblioteca-zoom.ts';

// Preferenze della Biblioteca nel browser (la categoria; il vecchio campo dell'ordinamento si ignora)
const CHIAVE_PREFERENZE = 'aeonsend-app-0.2-library';

type Scheda = 'nemesi' | 'mercato' | 'tesori';
const SCHEDE: readonly Scheda[] = ['nemesi', 'mercato', 'tesori'];

// Il pannello a selezione multipla (set, meccaniche): il pulsante lo apre e chiude, l'elenco contiene le caselle
interface Pannello {
  wrap: HTMLElement;
  btn: HTMLButtonElement;
  elenco: HTMLElement;
}

// Le carte supply, lette la prima volta che si apre la Biblioteca (poi restano in memoria)
let cartePronte: CartaSupply[] | null = null;
let caricamento: Promise<CartaSupply[]> | null = null;
let erroreCaricamento = false;

// Le meccaniche (mechanics.json), lette insieme alle carte. Se mancano o sono rotte, il filtro non si mostra
let meccanichePronte: Meccanica[] | null = null;
let caricamentoMeccaniche: Promise<Meccanica[]> | null = null;

// Il percorso di immagine e miniatura è relativo alla radice del sito (come per le nemesi, avvio.ts)
function caricaCarte(): Promise<CartaSupply[]> {
  if (cartePronte) return Promise.resolve(cartePronte);
  if (!caricamento) {
    caricamento = loadJson(DATA_ROOT + 'cards_supply.json').then(dati => {
      const controllate = checkSupplyCards(dati);
      reportProblems(controllate.problems);
      cartePronte = controllate.value.map(c => ({ ...c, image: DATA_ROOT + c.image, thumb: DATA_ROOT + c.thumb }));
      return cartePronte;
    }).catch((err: unknown) => {
      caricamento = null;
      throw err;
    });
  }
  return caricamento;
}

// Mai rifiuta: un errore si scrive in console e il filtro meccaniche resta senza voci (la prossima apertura riprova)
function caricaMeccaniche(): Promise<Meccanica[]> {
  if (meccanichePronte) return Promise.resolve(meccanichePronte);
  if (!caricamentoMeccaniche) {
    caricamentoMeccaniche = loadJson(DATA_ROOT + 'mechanics.json').then(dati => {
      const controllate = checkMechanics(dati);
      reportProblems(controllate.problems);
      meccanichePronte = controllate.value;
      return meccanichePronte;
    }).catch((err: unknown) => {
      caricamentoMeccaniche = null;
      console.error('Meccaniche non caricate, il filtro non si mostra:', err);
      return [];
    });
  }
  return caricamentoMeccaniche;
}

function leggiPreferenze(): PreferenzeBiblioteca {
  let testo: string | null = null;
  try {
    testo = localStorage.getItem(CHIAVE_PREFERENZE);
  } catch {
    // Il browser può negare lo storage: si usano le predefinite
  }
  return leggiPreferenzeBiblioteca(testo);
}

function salvaPreferenze(preferenze: PreferenzeBiblioteca): void {
  try {
    localStorage.setItem(CHIAVE_PREFERENZE, JSON.stringify(preferenze));
  } catch {
    // Senza storage la scelta vale per questa apertura soltanto
  }
}

// Apre la Biblioteca a tutto schermo. `trigger` riceve il fuoco alla chiusura.
export function openLibrary(trigger?: HTMLElement | null): void {
  const stato = {
    scheda: 'mercato' as Scheda,
    preferenze: leggiPreferenze(),
    ricerca: '',
    set: new Set<string>(),
    meccaniche: new Set<string>(),
    costo: null as number | null
  };

  const layer = el('div', 'collection-screen biblioteca');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', T.library);

  // Testata (44 px): "BIBLIOTECA · Mercato ⌄", con la sezione in una tendina senza box, e la X a destra (la X chiude;
  // Indietro chiude per prima la carta ingrandita, poi la Biblioteca)
  const head = el('div', 'collection-head biblioteca-head');
  const chiudi = el('button', 'ae-icon-button');
  chiudi.type = 'button';
  chiudi.setAttribute('aria-label', T.close);
  chiudi.appendChild(icon('close'));
  const testoScheda: Record<Scheda, string> = { nemesi: T.libraryNemesis, mercato: T.libraryMarket, tesori: T.libraryTreasures };
  const titoloGruppo = el('div', 'biblioteca-title');
  const sezioneBtn = el('button', 'biblioteca-section-btn');
  sezioneBtn.type = 'button';
  sezioneBtn.setAttribute('aria-haspopup', 'true');
  sezioneBtn.setAttribute('aria-expanded', 'false');
  const sezioneNome = el('span', 'biblioteca-section-name');
  const freccia = el('span', 'biblioteca-chevron');
  freccia.setAttribute('aria-hidden', 'true');
  sezioneBtn.append(sezioneNome, freccia);
  const menuSezione = el('div', 'biblioteca-section-menu');
  menuSezione.setAttribute('role', 'group');
  menuSezione.setAttribute('aria-label', T.libraryTabs);
  menuSezione.hidden = true;
  const bottoniScheda = new Map<Scheda, HTMLButtonElement>();
  SCHEDE.forEach(s => {
    const b = el('button', 'biblioteca-section-option', testoScheda[s]);
    b.type = 'button';
    b.addEventListener('click', () => { stato.scheda = s; apriMenuSezione(false); disegnaTutto(); });
    bottoniScheda.set(s, b);
    menuSezione.append(b);
  });
  const punto = el('span', 'biblioteca-title-dot');
  punto.setAttribute('aria-hidden', 'true');
  titoloGruppo.append(el('h2', 'collection-title', T.library), punto, sezioneBtn, menuSezione);
  head.append(titoloGruppo, chiudi);
  let menuSezioneAperto = false;
  function apriMenuSezione(aperto: boolean): void {
    menuSezioneAperto = aperto;
    menuSezione.hidden = !aperto;
    sezioneBtn.setAttribute('aria-expanded', String(aperto));
  }
  sezioneBtn.addEventListener('click', () => apriMenuSezione(!menuSezioneAperto));

  // Filtri del Mercato: la riga 1 (set, meccaniche, lente), la riga 2 (costo)
  const filtri = el('div', 'biblioteca-filters');

  // La lente (senza box; oro se la ricerca è attiva) apre un campo di ricerca sovrapposto alle carte, con il fuoco
  let ricercaAperta = false;
  const lenteBtn = el('button', 'biblioteca-search-btn');
  lenteBtn.type = 'button';
  lenteBtn.setAttribute('aria-label', T.librarySearch);
  lenteBtn.setAttribute('aria-expanded', 'false');
  lenteBtn.appendChild(iconaLente());
  const ricercaPop = el('div', 'biblioteca-search-pop');
  ricercaPop.hidden = true;
  const cerca = el('input');
  cerca.type = 'search';
  cerca.placeholder = T.librarySearch;
  cerca.setAttribute('aria-label', T.librarySearch);
  cerca.autocomplete = 'off';
  const cancella = el('button', 'biblioteca-search-clear');
  cancella.type = 'button';
  cancella.setAttribute('aria-label', T.librarySearchClear);
  cancella.appendChild(icon('close'));
  ricercaPop.append(cerca, cancella);
  function apriRicerca(aperta: boolean): void {
    ricercaAperta = aperta;
    ricercaPop.hidden = !aperta;
    lenteBtn.setAttribute('aria-expanded', String(aperta));
    if (aperta) cerca.focus();
  }
  lenteBtn.addEventListener('click', () => apriRicerca(!ricercaAperta));
  cerca.addEventListener('input', () => { stato.ricerca = cerca.value; disegnaRicerca(); disegnaCorpo(); });
  cancella.addEventListener('click', () => {
    cerca.value = '';
    stato.ricerca = '';
    disegnaRicerca();
    disegnaCorpo();
    cerca.focus();
  });
  function disegnaRicerca(): void {
    const attiva = stato.ricerca !== '';
    lenteBtn.classList.toggle('is-active', attiva);
    cancella.hidden = !attiva;
  }

  // Riga 2: set e meccaniche (selezione multipla, ciascuna in un pannello; un pannello aperto alla volta)
  let pannelloAperto: Pannello | null = null;
  const apriPannello = (p: Pannello | null): void => {
    pannelloAperto = p;
    for (const q of [pannelloSet, pannelloMeccaniche]) {
      q.elenco.hidden = q !== p;
      q.btn.setAttribute('aria-expanded', String(q === p));
    }
  };
  const creaPannello = (etichetta: string): Pannello => {
    const wrap = el('div', 'biblioteca-pick-wrap');
    const btn = el('button', 'biblioteca-chip biblioteca-pick-btn');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    const elenco = el('div', 'biblioteca-pick-panel');
    elenco.setAttribute('role', 'group');
    elenco.setAttribute('aria-label', etichetta);
    elenco.hidden = true;
    wrap.append(btn, elenco);
    const p: Pannello = { wrap, btn, elenco };
    btn.addEventListener('click', () => apriPannello(pannelloAperto === p ? null : p));
    return p;
  };
  const pannelloSet = creaPannello(T.librarySets);
  const pannelloMeccaniche = creaPannello(T.libraryMechanics);
  const setRiga = el('div', 'biblioteca-row biblioteca-row-top');
  setRiga.append(pannelloSet.wrap, pannelloMeccaniche.wrap, lenteBtn, ricercaPop);

  // Riga 3: costo, con i pulsanti delle fasce presenti nel catalogo
  const costoRiga = el('div', 'biblioteca-row biblioteca-cost');
  const costoEtichetta = el('span', 'biblioteca-cost-label', T.libraryCost);
  const fasce = el('div', 'biblioteca-cost-chips');
  fasce.setAttribute('role', 'group');
  fasce.setAttribute('aria-label', T.libraryCost);
  costoRiga.append(costoEtichetta, fasce);

  filtri.append(setRiga, costoRiga);

  // Area centrale scorrevole: i gruppi di costo (o la griglia del costo scelto)
  const corpo = el('div', 'biblioteca-body');

  // Barra inferiore: le tre categorie del Mercato
  const categorie = el('nav', 'biblioteca-categories');
  categorie.setAttribute('aria-label', T.libraryCategories);
  const testoCategoria: Record<TipoSupply, string> = { Gem: T.libraryGems, Relic: T.libraryRelics, Spell: T.librarySpells };
  const bottoniCategoria = new Map<TipoSupply, HTMLButtonElement>();
  CATEGORIE_MERCATO.forEach(c => {
    const b = el('button', 'biblioteca-category');
    b.type = 'button';
    b.append(iconaCategoria(c), el('span', 'biblioteca-category-label', testoCategoria[c]));
    b.addEventListener('click', () => {
      stato.preferenze = { ...stato.preferenze, categoria: c };
      salvaPreferenze(stato.preferenze);
      disegnaTutto();
    });
    bottoniCategoria.set(c, b);
    categorie.append(b);
  });

  layer.append(head, filtri, corpo, categorie);

  // --- Disegno ---

  // Pannello dei set: un interruttore per espansione, costruito quando le carte sono lette
  function costruisciPannelloSet(): void {
    if (!cartePronte) return;
    const elenco = setPresenti(cartePronte, catalogo.products).map(s => {
      const riga = el('label', 'biblioteca-pick-row');
      const casella = el('input');
      casella.type = 'checkbox';
      casella.value = s.codice;
      casella.checked = stato.set.has(s.codice);
      casella.addEventListener('change', () => {
        if (casella.checked) stato.set.add(s.codice);
        else stato.set.delete(s.codice);
        disegnaTutto();
      });
      riga.append(casella, el('span', '', `${s.codice} · ${s.nome}`));
      return riga;
    });
    pannelloSet.elenco.replaceChildren(...elenco);
  }

  // Le meccaniche di mechanics.json (caricate alla prima apertura), da cui il pannello prende le voci della categoria
  let listaMeccaniche: Meccanica[] = [];
  // Pannello delle meccaniche: segue la categoria attiva (nelle Gemme solo le meccaniche delle Gemme). Si ricostruisce
  // solo quando cambia la categoria; le meccaniche scelte che non ci sono più si tolgono, così nessun filtro resta nascosto
  let categoriaElenco: TipoSupply | null = null;
  function aggiornaPannelloMeccaniche(): void {
    if (!cartePronte || categoriaElenco === stato.preferenze.categoria) return;
    categoriaElenco = stato.preferenze.categoria;
    const voci = meccanicheDiCategoria(cartePronte, listaMeccaniche, categoriaElenco);
    pannelloMeccaniche.wrap.hidden = voci.length === 0;
    const presenti = new Set(voci.map(v => v.name));
    for (const nome of [...stato.meccaniche]) if (!presenti.has(nome)) stato.meccaniche.delete(nome);
    const elenco = voci.map(v => {
      const riga = el('label', 'biblioteca-pick-row');
      const casella = el('input');
      casella.type = 'checkbox';
      casella.value = v.name;
      casella.checked = stato.meccaniche.has(v.name);
      casella.addEventListener('change', () => {
        if (casella.checked) stato.meccaniche.add(v.name);
        else stato.meccaniche.delete(v.name);
        disegnaTutto();
      });
      riga.append(casella, el('span', '', v.name), el('span', 'biblioteca-pick-count', String(v.carte)));
      return riga;
    });
    pannelloMeccaniche.elenco.replaceChildren(...elenco);
  }

  function disegnaFiltri(): void {
    sezioneNome.textContent = testoScheda[stato.scheda];
    const n = stato.set.size;
    pannelloSet.btn.textContent = n === 0 ? T.librarySetsAll : T.librarySetsCount(n);
    pannelloSet.btn.classList.toggle('is-active', n > 0);
    const m = stato.meccaniche.size;
    pannelloMeccaniche.btn.textContent = m === 0 ? T.libraryMechanicsAll : T.libraryMechanicsCount(m);
    pannelloMeccaniche.btn.classList.toggle('is-active', m > 0);

    // Fasce di costo presenti nel catalogo supply (tutte le categorie, così la riga non cambia passando da una
    // categoria all'altra), più "Tutti"
    const tutte = cartePronte ?? [];
    const fasceCatalogo = [...new Set(CATEGORIE_MERCATO.flatMap(c => fasceCostoPresenti(tutte, c)))].sort((a, b) => a - b);
    const pulsanti: HTMLButtonElement[] = [];
    const tuttiBtn = el('button', 'biblioteca-chip', T.libraryAll);
    tuttiBtn.type = 'button';
    tuttiBtn.classList.toggle('is-active', stato.costo === null);
    tuttiBtn.addEventListener('click', () => { stato.costo = null; disegnaTutto(); });
    pulsanti.push(tuttiBtn);
    fasceCatalogo.forEach(fascia => {
      const b = el('button', 'biblioteca-chip', etichettaCosto(fascia));
      b.type = 'button';
      b.classList.toggle('is-active', stato.costo === fascia);
      b.addEventListener('click', () => { stato.costo = fascia; disegnaTutto(); });
      pulsanti.push(b);
    });
    fasce.replaceChildren(...pulsanti);

    bottoniCategoria.forEach((b, c) => {
      const attiva = c === stato.preferenze.categoria;
      b.classList.toggle('is-active', attiva);
      b.setAttribute('aria-pressed', String(attiva));
    });
    bottoniScheda.forEach((b, s) => {
      const attiva = s === stato.scheda;
      b.classList.toggle('is-active', attiva);
      b.setAttribute('aria-pressed', String(attiva));
    });
  }

  function disegnaCorpo(): void {
    disconnettiEtichette();
    if (stato.scheda !== 'mercato') {
      corpo.replaceChildren(messaggio(T.libraryComingSoon));
      return;
    }
    if (erroreCaricamento) { corpo.replaceChildren(messaggio(T.libraryLoadError)); return; }
    if (!cartePronte) { corpo.replaceChildren(messaggio(T.libraryLoading)); return; }
    const visibili = filtra(cartePronte, stato.preferenze.categoria,
      { ricerca: stato.ricerca, set: stato.set, meccaniche: stato.meccaniche, costo: stato.costo });
    if (visibili.length === 0) { corpo.replaceChildren(messaggio(T.libraryEmpty)); return; }
    // Con un costo scelto: griglia a due colonne; altrimenti caroselli orizzontali per costo
    const griglia = stato.costo !== null;
    const gruppi = raggruppaPerCosto(visibili).map(g => {
      const sezione = el('section', 'biblioteca-group');
      // Intestazione: segmento, "COSTO N" centrato con il simbolo Aether dopo il numero, segmento, numero di carte
      const testata = el('div', 'biblioteca-group-head');
      const titolo = el('h3', 'biblioteca-group-title', T.libraryCostGroup(etichettaCosto(g.fascia)));
      const aether = el('span', 'aether-icon');
      aether.setAttribute('aria-hidden', 'true');
      titolo.append(aether);
      testata.append(el('span', 'biblioteca-group-rule'), titolo, el('span', 'biblioteca-group-rule'),
        el('span', 'biblioteca-group-count', T.libraryCount(g.carte.length)));
      const contenitore = el('div', griglia ? 'biblioteca-grid' : 'biblioteca-track');
      contenitore.append(...g.carte.map(c => voceCarta(c, apriZoom)));
      sezione.append(testata, contenitore);
      return sezione;
    });
    corpo.replaceChildren(...gruppi);
    adattaEtichetteIn(corpo);
  }

  function disegnaTutto(): void {
    // Filtri e barra inferiore esistono solo nel Mercato
    const mercato = stato.scheda === 'mercato';
    filtri.hidden = !mercato;
    categorie.hidden = !mercato;
    aggiornaPannelloMeccaniche();
    disegnaRicerca();
    disegnaFiltri();
    disegnaCorpo();
  }

  // Zoom: la scansione a tutto schermo (biblioteca-zoom.ts); la Biblioteca resta inerte finché è aperto
  const apriZoom = (carta: CartaSupply, origine: HTMLElement): void => apriZoomCarta(carta, origine, layer);

  // --- Chiusura ---
  const chiudiBiblioteca = () => {
    layer.remove();
    updateInert();
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  chiudi.addEventListener('click', chiudiBiblioteca);
  // Esc chiude il livello più in alto: campo di ricerca, tendina della sezione, pannello set/meccaniche, poi la Biblioteca
  layer.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (ricercaAperta) apriRicerca(false);
    else if (menuSezioneAperto) apriMenuSezione(false);
    else if (pannelloAperto) apriPannello(null);
    else chiudiBiblioteca();
  });
  // Un tocco fuori dal livello aperto lo chiude (il tocco sulla lente o sulla sezione lo gestiscono i loro pulsanti)
  layer.addEventListener('click', e => {
    const bersaglio = e.target instanceof Node ? e.target : null;
    if (pannelloAperto && !pannelloAperto.wrap.contains(bersaglio)) apriPannello(null);
    if (ricercaAperta && !ricercaPop.contains(bersaglio) && !lenteBtn.contains(bersaglio)) apriRicerca(false);
    if (menuSezioneAperto && !titoloGruppo.contains(bersaglio)) apriMenuSezione(false);
  });

  document.body.appendChild(layer);
  startLayer.inert = true;

  // Le carte e le meccaniche si leggono alla prima apertura: nel frattempo "Caricamento…"
  disegnaTutto();
  Promise.all([caricaCarte(), caricaMeccaniche()]).then(([, meccaniche]) => {
    erroreCaricamento = false;
    costruisciPannelloSet();
    listaMeccaniche = meccaniche;
    categoriaElenco = null;
    disegnaTutto();
  }, (err: unknown) => {
    console.error(err);
    erroreCaricamento = true;
    disegnaTutto();
  });
  // Il fuoco sulla X (non sulla ricerca: sul telefono aprirebbe la tastiera)
  chiudi.focus({ preventScroll: true });
}
