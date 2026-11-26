// ui/finestre/biblioteca.ts: la Biblioteca, a tutto schermo dal menu iniziale. Testata con il titolo, tre schede (Nemesi,
// Mercato, Tesori; per ora solo il Mercato ha contenuto), nel Mercato i filtri (ricerca, set, ordinamento, costo) e le
// carte: caroselli per costo, o una griglia a due colonne con un costo scelto. Toccando una carta, lo zoom a tutto
// schermo (la scansione originale). La barra inferiore sceglie la categoria (Gemme, Reliquie, Incantesimi).
// Stato separato dalla partita: aprire la Biblioteca non tocca il mazzo, i turni o il salvataggio.
// Le carte si leggono solo quando la Biblioteca si apre la prima volta (cards_supply.json, con il controllo di dati/).
// Livello 6 (finestre). Dipende da: regole/biblioteca.ts (logica), dati/ (lettura e controllo), stato/catalogo.ts,
// ui/ base (testi, dom, pagina), ui/componenti/dialoghi.ts (updateInert), ui/finestre/biblioteca-icone.ts.
// Usato da: ui/schermate/menu.ts (pulsante Biblioteca). Stile: biblioteca.css.

import { T } from '../testi.ts';
import { el, icon } from '../dom.ts';
import { updateInert } from '../componenti/dialoghi.ts';
import { DATA_ROOT, startLayer } from '../pagina.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { loadJson } from '../../dati/dati.ts';
import { checkSupplyCards, reportProblems } from '../../dati/controllo.ts';
import type { CartaSupply, TipoSupply } from '../../tipi/dati.ts';
import { CATEGORIE_MERCATO, ORDINI, etichettaCosto, fasceCostoPresenti, filtra, leggiPreferenzeBiblioteca,
  raggruppaPerCosto, setPresenti } from '../../regole/biblioteca.ts';
import type { Ordine, PreferenzeBiblioteca } from '../../regole/biblioteca.ts';
import { iconaCategoria, iconaLente } from './biblioteca-icone.ts';

// Preferenze della Biblioteca nel browser (categoria e ordinamento)
const CHIAVE_PREFERENZE = 'aeonsend-app-0.2-library';

type Scheda = 'nemesi' | 'mercato' | 'tesori';
const SCHEDE: readonly Scheda[] = ['nemesi', 'mercato', 'tesori'];

// Le carte supply, lette la prima volta che si apre la Biblioteca (poi restano in memoria)
let cartePronte: CartaSupply[] | null = null;
let caricamento: Promise<CartaSupply[]> | null = null;
let erroreCaricamento = false;

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

function messaggio(testo: string): HTMLElement {
  return el('p', 'biblioteca-message', testo);
}

// Un pulsante di carta: solo l'immagine (miniatura), niente nome né badge
function bottoneCarta(carta: CartaSupply, apriZoom: (c: CartaSupply, origine: HTMLElement) => void): HTMLButtonElement {
  const bottone = el('button', 'biblioteca-card');
  bottone.type = 'button';
  bottone.setAttribute('aria-label', carta.name);
  const img = el('img');
  img.src = carta.thumb;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 264;
  img.height = 369;
  bottone.append(img);
  bottone.addEventListener('click', () => apriZoom(carta, bottone));
  return bottone;
}

// Apre la Biblioteca a tutto schermo. `trigger` riceve il fuoco alla chiusura.
export function openLibrary(trigger?: HTMLElement | null): void {
  const stato = {
    scheda: 'mercato' as Scheda,
    preferenze: leggiPreferenze(),
    ricerca: '',
    set: new Set<string>(),
    costo: null as number | null
  };

  const layer = el('div', 'collection-screen biblioteca');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', T.library);

  // Testata: titolo e X (la X chiude; Indietro chiude per prima la carta ingrandita, poi la Biblioteca)
  const head = el('div', 'collection-head biblioteca-head');
  const chiudi = el('button', 'ae-icon-button');
  chiudi.type = 'button';
  chiudi.setAttribute('aria-label', T.close);
  chiudi.appendChild(icon('close'));
  head.append(el('h2', 'collection-title', T.library), chiudi);

  // Schede principali
  const testoScheda: Record<Scheda, string> = { nemesi: T.libraryNemesis, mercato: T.libraryMarket, tesori: T.libraryTreasures };
  const schede = el('div', 'biblioteca-tabs');
  schede.setAttribute('role', 'group');
  schede.setAttribute('aria-label', T.libraryTabs);
  const bottoniScheda = new Map<Scheda, HTMLButtonElement>();
  SCHEDE.forEach(s => {
    const b = el('button', 'biblioteca-tab', testoScheda[s]);
    b.type = 'button';
    b.addEventListener('click', () => { stato.scheda = s; disegnaTutto(); });
    bottoniScheda.set(s, b);
    schede.append(b);
  });

  // Filtri del Mercato, in tre righe compatte
  const filtri = el('div', 'biblioteca-filters');

  // Riga 1: ricerca per nome, con la lente
  const cercaRiga = el('div', 'biblioteca-row');
  const campo = el('label', 'biblioteca-search');
  const lente = el('span', 'biblioteca-search-icon');
  lente.setAttribute('aria-hidden', 'true');
  lente.appendChild(iconaLente());
  const cerca = el('input');
  cerca.type = 'search';
  cerca.placeholder = T.librarySearch;
  cerca.setAttribute('aria-label', T.librarySearch);
  cerca.autocomplete = 'off';
  cerca.addEventListener('input', () => { stato.ricerca = cerca.value; disegnaCorpo(); });
  campo.append(lente, cerca);
  cercaRiga.append(campo);

  // Riga 2: set (selezione multipla, in un pannello) e ordinamento
  const setRiga = el('div', 'biblioteca-row');
  const setWrap = el('div', 'biblioteca-sets-wrap');
  const setBtn = el('button', 'biblioteca-chip biblioteca-sets-btn');
  setBtn.type = 'button';
  setBtn.setAttribute('aria-expanded', 'false');
  const setPannello = el('div', 'biblioteca-sets-panel');
  setPannello.setAttribute('role', 'group');
  setPannello.setAttribute('aria-label', T.librarySets);
  setPannello.hidden = true;
  setWrap.append(setBtn, setPannello);
  let pannelloAperto = false;
  const apriPannello = (aperto: boolean) => {
    pannelloAperto = aperto;
    setPannello.hidden = !aperto;
    setBtn.setAttribute('aria-expanded', String(aperto));
  };
  setBtn.addEventListener('click', () => apriPannello(!pannelloAperto));

  const ordine = el('select', 'biblioteca-select');
  ordine.setAttribute('aria-label', T.libraryOrder);
  const testoOrdine: Record<Ordine, string> = { 'costo-asc': T.libraryOrderCostAsc, 'costo-desc': T.libraryOrderCostDesc, nome: T.libraryOrderName };
  ORDINI.forEach(o => {
    const opzione = el('option', '', testoOrdine[o]);
    opzione.value = o;
    ordine.append(opzione);
  });
  ordine.addEventListener('change', () => {
    stato.preferenze = { ...stato.preferenze, ordine: ORDINI.find(o => o === ordine.value) ?? stato.preferenze.ordine };
    salvaPreferenze(stato.preferenze);
    disegnaCorpo();
  });
  setRiga.append(setWrap, ordine);

  // Riga 3: costo, con i pulsanti delle fasce presenti nel catalogo
  const costoRiga = el('div', 'biblioteca-row biblioteca-cost');
  const costoEtichetta = el('span', 'biblioteca-cost-label', T.libraryCost);
  const fasce = el('div', 'biblioteca-cost-chips');
  fasce.setAttribute('role', 'group');
  fasce.setAttribute('aria-label', T.libraryCost);
  costoRiga.append(costoEtichetta, fasce);

  filtri.append(cercaRiga, setRiga, costoRiga);

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

  layer.append(head, schede, filtri, corpo, categorie);

  // --- Disegno ---

  // Pannello dei set: un interruttore per espansione, costruito quando le carte sono lette
  function costruisciPannelloSet(): void {
    if (!cartePronte) return;
    const elenco = setPresenti(cartePronte, catalogo.products).map(s => {
      const riga = el('label', 'biblioteca-set-row');
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
    setPannello.replaceChildren(...elenco);
  }

  function disegnaFiltri(): void {
    const n = stato.set.size;
    setBtn.textContent = n === 0 ? T.librarySetsAll : T.librarySetsCount(n);
    setBtn.classList.toggle('is-active', n > 0);
    ordine.value = stato.preferenze.ordine;

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
    if (stato.scheda !== 'mercato') {
      corpo.replaceChildren(messaggio(T.libraryComingSoon));
      return;
    }
    if (erroreCaricamento) { corpo.replaceChildren(messaggio(T.libraryLoadError)); return; }
    if (!cartePronte) { corpo.replaceChildren(messaggio(T.libraryLoading)); return; }
    const visibili = filtra(cartePronte, stato.preferenze.categoria,
      { ricerca: stato.ricerca, set: stato.set, costo: stato.costo });
    if (visibili.length === 0) { corpo.replaceChildren(messaggio(T.libraryEmpty)); return; }
    // Con un costo scelto: griglia a due colonne; altrimenti caroselli orizzontali per costo
    const griglia = stato.costo !== null;
    const gruppi = raggruppaPerCosto(visibili, stato.preferenze.ordine).map(g => {
      const sezione = el('section', 'biblioteca-group');
      const testata = el('div', 'biblioteca-group-head');
      testata.append(el('h3', 'biblioteca-group-title', T.libraryCostGroup(etichettaCosto(g.fascia))),
        el('span', 'biblioteca-group-count', T.libraryCount(g.carte.length)));
      const contenitore = el('div', griglia ? 'biblioteca-grid' : 'biblioteca-track');
      contenitore.append(...g.carte.map(c => bottoneCarta(c, apriZoom)));
      sezione.append(testata, contenitore);
      return sezione;
    });
    corpo.replaceChildren(...gruppi);
  }

  function disegnaTutto(): void {
    // Filtri e barra inferiore esistono solo nel Mercato
    const mercato = stato.scheda === 'mercato';
    filtri.hidden = !mercato;
    categorie.hidden = !mercato;
    disegnaFiltri();
    disegnaCorpo();
  }

  // --- Zoom: la scansione a tutto schermo, con le proporzioni originali ---
  function apriZoom(carta: CartaSupply, origine: HTMLElement): void {
    const zoom = el('div', 'collection-screen biblioteca-zoom');
    zoom.setAttribute('role', 'dialog');
    zoom.setAttribute('aria-modal', 'true');
    zoom.setAttribute('aria-label', carta.name);
    const testata = el('div', 'collection-head biblioteca-zoom-head');
    const chiudiZoom = el('button', 'ae-icon-button');
    chiudiZoom.type = 'button';
    chiudiZoom.setAttribute('aria-label', T.close);
    chiudiZoom.appendChild(icon('close'));
    testata.append(chiudiZoom);
    const scena = el('div', 'biblioteca-zoom-stage');
    const img = el('img');
    img.src = carta.image;
    img.alt = carta.name;
    scena.append(img);
    zoom.append(testata, scena);
    const chiudiIngrandimento = () => {
      zoom.remove();
      layer.inert = false;
      // La Biblioteca non si ridisegna: la posizione di scorrimento resta com'era
      if (origine.isConnected) origine.focus({ preventScroll: true });
    };
    chiudiZoom.addEventListener('click', chiudiIngrandimento);
    scena.addEventListener('click', chiudiIngrandimento);
    zoom.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); chiudiIngrandimento(); } });
    document.body.appendChild(zoom);
    layer.inert = true;
    chiudiZoom.focus();
  }

  // --- Chiusura ---
  const chiudiBiblioteca = () => {
    layer.remove();
    updateInert();
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  chiudi.addEventListener('click', chiudiBiblioteca);
  layer.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (pannelloAperto) apriPannello(false);
    else chiudiBiblioteca();
  });
  // Un tocco fuori dal pannello dei set lo chiude
  layer.addEventListener('click', e => {
    if (pannelloAperto && !setWrap.contains(e.target instanceof Node ? e.target : null)) apriPannello(false);
  });

  document.body.appendChild(layer);
  startLayer.inert = true;

  // Le carte si leggono alla prima apertura: nel frattempo "Caricamento…"
  disegnaTutto();
  caricaCarte().then(() => {
    erroreCaricamento = false;
    costruisciPannelloSet();
    disegnaTutto();
  }, (err: unknown) => {
    console.error(err);
    erroreCaricamento = true;
    disegnaTutto();
  });
  // Il fuoco sulla X (non sulla ricerca: sul telefono aprirebbe la tastiera)
  chiudi.focus({ preventScroll: true });
}
