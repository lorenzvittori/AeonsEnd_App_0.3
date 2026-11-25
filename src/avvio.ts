// avvio.ts: avvio dell'app (init: lettura e controllo dei dati, pagina iniziale), telefono in orizzontale, Riprova.
// I dati letti vanno nel catalogo (stato/catalogo.ts); poi la prima partita da zero (nuovaPartita, come sempre: il mazzo
// della nemesi scelta è pronto per la pagina iniziale), il primo disegno e il menu iniziale (ui/navigazione.ts).
// Livello 7. Dipende da: stato/ (catalogo, partita), dati/ (dati, controllo), ui/ (pagina, testi, dom, dialoghi, banner,
// schermate/menu e nuova-partita, navigazione). Usato da: main.ts (avvio, ultimo modulo).

import { T } from './ui/testi.ts';
import { loadJson } from './dati/dati.ts';
import { checkCards, checkDeckSetup, checkNemeses, checkNemesisArt, checkProducts,
  reportProblems } from './dati/controllo.ts';
import { nuovaPartita } from './stato/partita.ts';
import { loadImage, updateInert } from './ui/componenti/dialoghi.ts';
import { showStartError } from './ui/schermate/menu.ts';
import { caricaCatalogo } from './stato/catalogo.ts';
import { CARD_BACK, DATA_ROOT, retryBtn, startBtn, startError, THUMB_DIR } from './ui/pagina.ts';
import { preloadBannerFont } from './ui/componenti/banner.ts';
import { el } from './ui/dom.ts';
import { render, setStartMode } from './ui/navigazione.ts';
import { buildStartPage, showStartSkeleton } from './ui/schermate/nuova-partita.ts';

// Avvio: legge cards.json, deck-setup.json, nemesis.json e products.json (e le immagini delle nemesi, facoltative), li
// controlla (dati/controllo.ts: carte e nemesi sbagliate si scartano con un errore in console) e mostra la pagina
// iniziale (con "Riprendi partita" se ce n'è una salvata)
export let initRunning = false;

export async function init(): Promise<void> {
  if (initRunning) return;
  initRunning = true;
  startError.hidden = true;
  startBtn.disabled = true;
  showStartSkeleton();
  updateInert();
  try {
    const [cardsData, setupData, nemesisData, productData, artData] = await Promise.all([
      loadJson(DATA_ROOT + 'cards.json'), loadJson(DATA_ROOT + 'deck-setup.json'), loadJson(DATA_ROOT + 'nemesis.json'),
      loadJson(DATA_ROOT + 'products.json'), loadJson('Assets/nemesis/nemesis-art.json').catch(() => ({}))
    ]);
    const art = checkNemesisArt(artData || {});
    const products = checkProducts(productData || {});
    const cards = checkCards(cardsData);
    const nemeses = checkNemeses(nemesisData);
    const setup = checkDeckSetup(setupData);
    reportProblems([...cards.problems, ...nemeses.problems, ...products.problems, ...art.problems]);
    if (cards.value.length === 0) throw new Error('Nessuna carta trovata in cards.json');
    // Le scansioni delle carte stanno nella cartella Data/, le miniature in thumbs/ con lo stesso percorso
    cards.value.forEach(c => {
      c.thumb = DATA_ROOT + String(c.image).replace(/^Data\//, THUMB_DIR);
      c.image = DATA_ROOT + c.image;
    });
    caricaCatalogo({ cards: cards.value, deckSetup: setup, nemeses: nemeses.value, products: products.value, nemesisArt: art.value });
    buildStartPage();
    nuovaPartita();
    // Il retro si scarica subito, così alla prima pesca è già pronto
    loadImage(CARD_BACK);
    preloadBannerFont();
    render();
    setStartMode('home', true);
  } catch (err) {
    console.error(err);
    // Senza replaceChildren: se l'errore viene da un browser vecchio, qui non deve fallire di nuovo
    const list = document.getElementById('nemesis-list');
    if (list) list.innerHTML = '';
    // Sotto il messaggio, il motivo tecnico (utile per capire il problema su un dispositivo che non si può ispezionare)
    showStartError(T.loadError + '\n(' + (err instanceof Error && err.message ? err.message : String(err)) + ')', true);
  } finally {
    initRunning = false;
  }
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  // Telefono in orizzontale: lo spazio in altezza non basta per le carte; si chiede di girarlo (CSS: .ae-rotate)
  document.body.appendChild(el('div', 'ae-rotate', T.rotatePhone));

  // Errore di caricamento dei dati: "Riprova" rilegge tutto
  retryBtn.addEventListener('click', init);

  init();
}
