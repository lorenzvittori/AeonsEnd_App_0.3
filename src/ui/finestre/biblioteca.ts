// ui/finestre/biblioteca.ts: la Biblioteca, a tutto schermo dal menu iniziale. Testata con il titolo e la sezione in una
// tendina (Nemesi, Mercato, Tesori, Preferiti). Mercato: una riga di filtri (ricerca, set, meccaniche, costo, preferite),
// i chip dei filtri attivi, le carte (caroselli per costo, o una griglia con un costo solo) e la barra con le categorie.
// Preferiti: le carte contrassegnate con la stella, in griglia. Toccando una carta, lo zoom a tutto schermo.
// Stato separato dalla partita: aprire la Biblioteca non tocca il mazzo, i turni o il salvataggio.
// I dati (carte, meccaniche, categoria) sono in biblioteca-dati.ts; le preferite in biblioteca-preferiti.ts.
// Livello 6 (finestre). Dipende da: regole/biblioteca.ts (logica), dati/ (lettura e controllo), stato/catalogo.ts,
// ui/ base (testi, dom, pagina, colori-meccaniche), ui/componenti/dialoghi.ts (updateInert), ui/finestre/biblioteca-*.ts.
// Usato da: ui/schermate/menu.ts (pulsante Biblioteca). Stile: biblioteca.css.

import { T } from '../testi.ts';
import { el, icon } from '../dom.ts';
import { updateInert } from '../componenti/dialoghi.ts';
import { startLayer } from '../pagina.ts';
import { catalogo } from '../../stato/catalogo.ts';
import type { CartaSupply, TipoSupply } from '../../tipi/dati.ts';
import { CATEGORIE_MERCATO, chiaveCarta, etichettaCosto, fasciaCosto, filtra, meccanicheDi, meccanicheDiCategoria,
  raggruppaPerCosto, setPresenti } from '../../regole/biblioteca.ts';
import { coloreMeccanica } from '../colori-meccaniche.ts';
import { iconaCategoria, iconaLente, iconaMeccaniche, iconaSet, iconaSezione, iconaStella } from './biblioteca-icone.ts';
import { adattaEtichetteIn, disconnettiEtichette, messaggio, voceCarta } from './biblioteca-carte.ts';
import { apriZoomCarta } from './biblioteca-zoom.ts';
import { aggiornaStelle } from './biblioteca-stella.ts';
import { ascoltaPreferite, preferite } from './biblioteca-preferiti.ts';
import { creaChip, creaMenuFiltro } from './biblioteca-filtri.ts';
import type { MenuFiltro, VoceFiltro } from './biblioteca-filtri.ts';
import { caricaCarte, caricaMeccaniche, carteLette, leggiPreferenze, meccanicheLette, salvaPreferenze } from './biblioteca-dati.ts';

// Le sezioni della tendina. Nemesi e Tesori sono in arrivo (nessuna carta ancora)
type Scheda = 'nemesi' | 'mercato' | 'tesori' | 'preferiti';
const SCHEDE: readonly Scheda[] = ['nemesi', 'mercato', 'tesori', 'preferiti'];
// Le sezioni in cui sta una carta preferita (il filtro della sezione Preferiti)
const SEZIONI_CARTE: readonly Scheda[] = ['nemesi', 'mercato', 'tesori'];
// Chiave delle preferite: le carte del Mercato (le altre sezioni non hanno ancora carte)
const SEZIONE_MERCATO = 'mercato';

export function openLibrary(trigger?: HTMLElement | null): void {
  const stato = {
    scheda: 'mercato' as Scheda,
    preferenze: leggiPreferenze(),
    ricerca: '',
    set: new Set<string>(),
    meccaniche: new Set<string>(),
    costi: new Set<number>(),
    soloPreferite: false,
    // Vuoto = tutte le sezioni (come per gli altri filtri: vuoto non filtra)
    sezioni: new Set<string>()
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
  const testoScheda: Record<Scheda, string> = {
    nemesi: T.libraryNemesis, mercato: T.libraryMarket, tesori: T.libraryTreasures, preferiti: T.libraryFavorites
  };
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

  // --- Barra dei filtri: una riga. [Cerca...] [Sezione] [Set] [Meccaniche] [Costo] [Stella]
  // (Sezione solo nei Preferiti, Stella solo nel Mercato)
  const filtri = el('div', 'biblioteca-filters');
  const riga = el('div', 'biblioteca-row');

  // Il box della ricerca mostra la lente e "Cerca..." (o la ricerca attiva); toccandolo si apre il campo sovrapposto
  let ricercaAperta = false;
  const cercaBtn = el('button', 'biblioteca-search-btn');
  cercaBtn.type = 'button';
  cercaBtn.setAttribute('aria-label', T.librarySearch);
  cercaBtn.setAttribute('aria-expanded', 'false');
  const cercaTesto = el('span', 'biblioteca-search-text', T.librarySearchPlaceholder);
  cercaBtn.append(iconaLente(), cercaTesto);
  // Il campo di ricerca si sovrappone alle carte (sotto la barra dei filtri), con il fuoco
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
    cercaBtn.setAttribute('aria-expanded', String(aperta));
    if (aperta) cerca.focus();
  }
  cercaBtn.addEventListener('click', () => apriRicerca(!ricercaAperta));
  cerca.addEventListener('input', () => { stato.ricerca = cerca.value; disegnaTutto(); });
  cancella.addEventListener('click', () => {
    cerca.value = '';
    stato.ricerca = '';
    disegnaTutto();
    cerca.focus();
  });

  // Le carte su cui si calcolano le voci dei menu: nel Mercato la categoria scelta, nei Preferiti le carte preferite
  const carteAttive = (): CartaSupply[] => {
    const base = carteLette() ?? [];
    if (stato.scheda === 'preferiti') return base.filter(c => preferite().has(chiaveCarta(SEZIONE_MERCATO, c)));
    return base.filter(c => c.type === stato.preferenze.categoria);
  };

  // Il box del filtro Sezione (solo nei Preferiti)
  const menuSezioni = creaMenuFiltro({
    titolo: T.librarySectionFilter,
    icona: iconaSezione(),
    voci: () => SEZIONI_CARTE.map(s => ({ valore: s, testo: testoScheda[s] })),
    scelti: () => stato.sezioni,
    applica: scelti => { stato.sezioni = scelti; disegnaTutto(); }
  });
  const menuSet = creaMenuFiltro({
    titolo: T.librarySets,
    icona: iconaSet(),
    voci: () => setPresenti(stato.scheda === 'preferiti' ? carteAttive() : (carteLette() ?? []), catalogo.products)
      .map(s => ({ valore: s.codice, testo: `${s.codice} · ${s.nome}` })),
    scelti: () => stato.set,
    applica: scelti => { stato.set = scelti; disegnaTutto(); }
  });
  const menuMeccaniche = creaMenuFiltro({
    titolo: T.libraryMechanics,
    icona: iconaMeccaniche(),
    voci: () => {
      const lista = stato.scheda === 'preferiti'
        ? meccanicheDi(carteAttive(), meccanicheLette())
        : meccanicheDiCategoria(carteLette() ?? [], meccanicheLette(), stato.preferenze.categoria);
      return lista.map((m): VoceFiltro => ({ valore: m.name, testo: m.name, conteggio: m.carte, colore: coloreMeccanica(m.name) }));
    },
    scelti: () => stato.meccaniche,
    applica: scelti => { stato.meccaniche = scelti; disegnaTutto(); }
  });
  // Il box del costo: il simbolo Aether (dorato, dal progetto) al posto della scritta
  const aether = el('span', 'aether-icon');
  aether.setAttribute('aria-hidden', 'true');
  const menuCosto = creaMenuFiltro({
    titolo: T.libraryCost,
    icona: aether,
    voci: () => [...new Set(carteAttive().map(c => fasciaCosto(c.cost)))].sort((a, b) => a - b)
      .map(f => ({ valore: String(f), testo: etichettaCosto(f) })),
    scelti: () => new Set([...stato.costi].map(String)),
    applica: scelti => { stato.costi = new Set([...scelti].map(Number)); disegnaTutto(); }
  });
  const menuFiltri: MenuFiltro[] = [menuSezioni, menuSet, menuMeccaniche, menuCosto];

  // La stella a destra: filtro a interruttore, mostra solo le preferite della sezione e categoria correnti
  const stellaFiltro = el('button', 'biblioteca-filter-star');
  stellaFiltro.type = 'button';
  stellaFiltro.setAttribute('aria-label', T.libraryFavoritesOnly);
  stellaFiltro.appendChild(iconaStella());
  stellaFiltro.addEventListener('click', () => { stato.soloPreferite = !stato.soloPreferite; disegnaTutto(); });

  riga.append(cercaBtn, ...menuFiltri.map(m => m.wrap), stellaFiltro);
  filtri.append(riga, ricercaPop);

  // Chip dei filtri attivi (una riga che scorre in orizzontale; "Azzera tutti" resta fisso a destra)
  const attivi = el('div', 'biblioteca-active');
  const attiviLista = el('div', 'biblioteca-active-list');
  const azzeraTutti = el('button', 'biblioteca-active-clear', T.libraryClearAll);
  azzeraTutti.type = 'button';
  attivi.append(attiviLista, azzeraTutti);
  azzeraTutti.addEventListener('click', () => {
    stato.ricerca = '';
    stato.set.clear();
    stato.meccaniche.clear();
    stato.costi.clear();
    stato.soloPreferite = false;
    stato.sezioni.clear();
    cerca.value = '';
    disegnaTutto();
  });

  // Area centrale scorrevole: i gruppi di costo, la griglia, o le preferite
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

  layer.append(head, filtri, attivi, corpo, categorie);

  // --- Disegno ---

  // La riga dei filtri: il testo e lo stato dei box, la stella e la sezione secondo la scheda
  function disegnaFiltri(): void {
    sezioneNome.textContent = testoScheda[stato.scheda];
    bottoniScheda.forEach((b, s) => {
      const attiva = s === stato.scheda;
      b.classList.toggle('is-active', attiva);
      b.setAttribute('aria-pressed', String(attiva));
    });
    const mercato = stato.scheda === 'mercato';
    const preferiteView = stato.scheda === 'preferiti';
    const niente = stato.scheda === 'nemesi' || stato.scheda === 'tesori';
    filtri.hidden = niente;
    categorie.hidden = !mercato;
    menuSezioni.wrap.hidden = !preferiteView;
    stellaFiltro.hidden = !mercato;
    stellaFiltro.classList.toggle('is-active', stato.soloPreferite);
    stellaFiltro.setAttribute('aria-pressed', String(stato.soloPreferite));
    const attivoBox = (m: MenuFiltro, on: boolean) => m.box.classList.toggle('is-active', on);
    attivoBox(menuSezioni, stato.sezioni.size > 0);
    attivoBox(menuSet, stato.set.size > 0);
    attivoBox(menuMeccaniche, stato.meccaniche.size > 0);
    attivoBox(menuCosto, stato.costi.size > 0);
    const cercando = stato.ricerca !== '';
    cercaBtn.classList.toggle('is-active', cercando);
    cercaTesto.textContent = cercando ? stato.ricerca : T.librarySearchPlaceholder;
    cancella.hidden = !cercando;
    bottoniCategoria.forEach((b, c) => {
      const attiva = c === stato.preferenze.categoria;
      b.classList.toggle('is-active', attiva);
      b.setAttribute('aria-pressed', String(attiva));
    });
  }

  // I chip dei filtri attivi: ciascuno si toglie con la sua X; nessun chip = la riga non si vede
  function disegnaAttivi(): void {
    const chip: HTMLElement[] = [];
    const via = (testo: string, rimuovi: () => void, colore?: string | null) => {
      chip.push(creaChip(testo, T.libraryRemoveFilter(testo), () => { rimuovi(); disegnaTutto(); }, colore));
    };
    if (stato.ricerca !== '') via(`"${stato.ricerca}"`, () => { stato.ricerca = ''; cerca.value = ''; });
    stato.sezioni.forEach(s => via(testoScheda[s as Scheda], () => stato.sezioni.delete(s)));
    stato.set.forEach(s => via(s, () => stato.set.delete(s)));
    stato.meccaniche.forEach(m => via(m, () => stato.meccaniche.delete(m), coloreMeccanica(m)));
    stato.costi.forEach(f => via(T.libraryCostChip(etichettaCosto(f)), () => stato.costi.delete(f)));
    if (stato.soloPreferite) via(T.libraryFavoritesOnly, () => { stato.soloPreferite = false; });
    attiviLista.replaceChildren(...chip);
    attivi.hidden = chip.length === 0 || stato.scheda === 'nemesi' || stato.scheda === 'tesori';
  }

  // Lo zoom si apre dalla carta: la stella della carta e quella dello zoom sono la stessa preferita
  const apriZoom = (carta: CartaSupply, chiave: string, origine: HTMLElement): void =>
    apriZoomCarta(carta, chiave, origine, layer);

  // Una griglia o un carosello di carte (con la stella e il pannello di ciascuna)
  function contenitoreCarte(carte: CartaSupply[], griglia: boolean): HTMLElement {
    const contenitore = el('div', griglia ? 'biblioteca-grid' : 'biblioteca-track');
    contenitore.append(...carte.map(c => voceCarta(c, chiaveCarta(SEZIONE_MERCATO, c), apriZoom)));
    return contenitore;
  }

  function disegnaCorpo(): void {
    disconnettiEtichette();
    if (stato.scheda === 'nemesi' || stato.scheda === 'tesori') { corpo.replaceChildren(messaggio(T.libraryComingSoon)); return; }
    if (carteLette() === null) {
      corpo.replaceChildren(messaggio(caricamentoFallito ? T.libraryLoadError : T.libraryLoading));
      return;
    }
    const base = carteLette() ?? [];
    if (stato.scheda === 'preferiti') { disegnaPreferite(base); return; }
    const visibili = filtra(base, stato.preferenze.categoria, {
      ricerca: stato.ricerca, set: stato.set, meccaniche: stato.meccaniche, costi: stato.costi,
      preferite: stato.soloPreferite ? preferite() : null
    });
    if (visibili.length === 0) { corpo.replaceChildren(messaggio(T.libraryEmpty)); return; }
    // Con un solo costo scelto: griglia a due colonne; altrimenti caroselli orizzontali per costo
    const griglia = stato.costi.size === 1;
    const gruppi = raggruppaPerCosto(visibili).map(g => {
      const sezione = el('section', 'biblioteca-group');
      // Intestazione: segmento, "COSTO N" centrato con il simbolo Aether dopo il numero, segmento, numero di carte
      const testata = el('div', 'biblioteca-group-head');
      const titolo = el('h3', 'biblioteca-group-title', T.libraryCostGroup(etichettaCosto(g.fascia)));
      const simbolo = el('span', 'aether-icon');
      simbolo.setAttribute('aria-hidden', 'true');
      titolo.append(simbolo);
      testata.append(el('span', 'biblioteca-group-rule'), titolo, el('span', 'biblioteca-group-rule'),
        el('span', 'biblioteca-group-count', T.libraryCount(g.carte.length)));
      sezione.append(testata, contenitoreCarte(g.carte, griglia));
      return sezione;
    });
    corpo.replaceChildren(...gruppi);
    adattaEtichetteIn(corpo);
  }

  // I Preferiti: una griglia a due colonne con le carte preferite che passano i filtri (nessun carosello)
  function disegnaPreferite(base: CartaSupply[]): void {
    if (preferite().size === 0) {
      // Nessuna preferita: una stella vuota e il messaggio, niente griglia
      const stellaVuota = el('span', 'biblioteca-empty-star');
      stellaVuota.setAttribute('aria-hidden', 'true');
      stellaVuota.appendChild(iconaStella());
      const vuoto = el('div', 'biblioteca-empty');
      vuoto.append(stellaVuota, messaggio(T.libraryFavoritesEmpty));
      corpo.replaceChildren(vuoto);
      return;
    }
    const sezioneScelta = stato.sezioni.size === 0 || stato.sezioni.has(SEZIONE_MERCATO);
    const visibili = sezioneScelta
      ? raggruppaPerCosto(filtra(base, null, {
        ricerca: stato.ricerca, set: stato.set, meccaniche: stato.meccaniche, costi: stato.costi, preferite: preferite()
      })).flatMap(g => g.carte)
      : [];
    if (visibili.length === 0) { corpo.replaceChildren(messaggio(T.libraryFavoritesNoMatch)); return; }
    const conteggio = el('p', 'biblioteca-count-line', T.libraryCount(visibili.length));
    corpo.replaceChildren(conteggio, contenitoreCarte(visibili, true));
    adattaEtichetteIn(corpo);
  }

  let caricamentoFallito = false;

  function disegnaTutto(): void {
    disegnaFiltri();
    disegnaAttivi();
    disegnaCorpo();
  }

  // --- Chiusura ---
  const chiudiBiblioteca = () => {
    smettiDiAscoltare();
    layer.remove();
    updateInert();
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  chiudi.addEventListener('click', chiudiBiblioteca);
  // Esc chiude il livello più in alto: ricerca, tendina della sezione, un menu di filtro, poi la Biblioteca
  layer.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (ricercaAperta) apriRicerca(false);
    else if (menuSezioneAperto) apriMenuSezione(false);
    else if (menuFiltri.some(m => m.aperto())) menuFiltri.forEach(m => m.chiudi());
    else chiudiBiblioteca();
  });
  // Un tocco fuori dal livello aperto lo chiude (il tocco sulla lente o sulla sezione lo gestiscono i loro pulsanti)
  layer.addEventListener('click', e => {
    const bersaglio = e.target instanceof Node ? e.target : null;
    for (const m of menuFiltri) if (m.aperto() && !m.contiene(bersaglio)) m.chiudi();
    if (ricercaAperta && !ricercaPop.contains(bersaglio) && !cercaBtn.contains(bersaglio)) apriRicerca(false);
    if (menuSezioneAperto && !titoloGruppo.contains(bersaglio)) apriMenuSezione(false);
  });
  // Una preferita cambiata (qui o nello zoom): le stelle si aggiornano; la griglia si rifà solo dove serve
  const smettiDiAscoltare = ascoltaPreferite(() => {
    if (stato.scheda === 'preferiti' || stato.soloPreferite) disegnaTutto();
    else aggiornaStelle();
  });

  document.body.appendChild(layer);
  startLayer.inert = true;

  // Le carte e le meccaniche si leggono alla prima apertura: nel frattempo "Caricamento…"
  disegnaTutto();
  Promise.all([caricaCarte(), caricaMeccaniche()]).then(() => {
    caricamentoFallito = false;
    disegnaTutto();
  }, (err: unknown) => {
    console.error(err);
    caricamentoFallito = true;
    disegnaTutto();
  });
  // Il fuoco sulla X (non sulla ricerca: sul telefono aprirebbe la tastiera)
  chiudi.focus({ preventScroll: true });
}
