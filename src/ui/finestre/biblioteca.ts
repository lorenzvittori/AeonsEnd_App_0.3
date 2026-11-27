// ui/finestre/biblioteca.ts: la Biblioteca, a tutto schermo dal menu iniziale. Testata con il titolo, tre schede (Nemesi,
// Mercato, Tesori; per ora solo il Mercato ha contenuto), nel Mercato i filtri (ricerca per nome, ID o effetto; set e
// meccaniche in due pannelli a selezione multipla; costo) e le carte: caroselli per costo, o una griglia a due colonne con
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
import { CATEGORIE_MERCATO, etichettaBox, etichettaCosto, fasceCostoPresenti, filtra, leggiPreferenzeBiblioteca,
  meccanicheCarta, meccanicheDiCategoria, raggruppaPerCosto, setPresenti } from '../../regole/biblioteca.ts';
import type { PreferenzeBiblioteca } from '../../regole/biblioteca.ts';
import { iconaCategoria, iconaLente } from './biblioteca-icone.ts';
import { coloreMeccanica } from '../colori-meccaniche.ts';

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

// Il pannello sotto la carta: il box ("x", o "x - y" con la mini espansione y) e le meccaniche come tag, ciascuna nel suo
// colore (ui/colori-meccaniche.ts). Null se non c'è nulla da mostrare
function pannelloCarta(carta: CartaSupply): HTMLElement | null {
  const box = etichettaBox(carta);
  const tag = meccanicheCarta(carta);
  if (box === '' && tag.length === 0) return null;
  const pannello = el('div', 'biblioteca-info');
  if (box !== '') pannello.append(el('p', 'biblioteca-info-box', box));
  if (tag.length > 0) {
    const elenco = el('div', 'biblioteca-tags');
    for (const nome of tag) {
      const etichetta = el('span', 'biblioteca-tag', nome);
      const colore = coloreMeccanica(nome);
      if (colore !== null) etichetta.style.setProperty('--tag', colore);
      elenco.append(etichetta);
    }
    pannello.append(elenco);
  }
  return pannello;
}

// Una voce del carosello o della griglia: la carta e, sotto, il suo pannello (stessa larghezza, scorrono insieme)
function voceCarta(carta: CartaSupply, apriZoom: (c: CartaSupply, origine: HTMLElement) => void): HTMLElement {
  const voce = el('div', 'biblioteca-item');
  voce.append(bottoneCarta(carta, apriZoom));
  const info = pannelloCarta(carta);
  if (info) voce.append(info);
  return voce;
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

  // Riga 1: ricerca per nome, ID o effetto, con la lente
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
  const setRiga = el('div', 'biblioteca-row');
  setRiga.append(pannelloSet.wrap, pannelloMeccaniche.wrap);

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
      const aether = el('span', 'biblioteca-aether');
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
  }

  function disegnaTutto(): void {
    // Filtri e barra inferiore esistono solo nel Mercato
    const mercato = stato.scheda === 'mercato';
    filtri.hidden = !mercato;
    categorie.hidden = !mercato;
    aggiornaPannelloMeccaniche();
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
    if (pannelloAperto) apriPannello(null);
    else chiudiBiblioteca();
  });
  // Un tocco fuori dal pannello aperto (set o meccaniche) lo chiude
  layer.addEventListener('click', e => {
    const bersaglio = e.target instanceof Node ? e.target : null;
    if (pannelloAperto && !pannelloAperto.wrap.contains(bersaglio)) apriPannello(null);
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
