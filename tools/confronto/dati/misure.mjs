// tools/confronto/dati/misure.mjs: i casi della prova "misure" (strumento di confronto, tools/confronto/README.md): per ogni
// variabile di src/ui/schermate/partita-misure.css, quali due cose separa (o quale altezza/larghezza ha) e in quali
// momenti della partita si può provare. La prova aumenta la variabile di 10px e controlla che lo spazio misurato tra le
// due cose cresca di 10px (o di `fattore` × 10).
//
// Un caso: { v, a: [selettore, bordo], b: [selettore, bordo], turni?, fattore?, prima?, nota? }
//   v        la variabile (--nome)
//   a, b     le due cose: selettore (la prima visibile) e bordo ('top' | 'bottom' | 'left' | 'right'); lo spazio è b − a
//            (per un'altezza: a = 'top' e b = 'bottom' della stessa cosa)
//   turni    in quali momenti si prova (default: tutti): 'giocatori' | 'nemesi'
//   fattore  di quanto cresce lo spazio per +10px della variabile (default 1; 2 se la variabile conta da tutti e due i lati)
//   prima    altre variabili da impostare prima di misurare, { '--nome': 'valore' } (es. togliere un minimo che nasconde l'effetto)
// I casi che non si possono provare così stanno in NON_PROVABILI, con il motivo.
//
// Dipende da: niente (solo dati). Usato da: prove/misure.mjs.

export const VISTE_PROVA = ['tel', 'tel390', 'desk'];

// I momenti: come si arriva (passi del linguaggio di browser.mjs) e come si riconosce
export const MOMENTI = [
  // Turno giocatori con la coda piena, al centro un minion (Carriode Colony: i comandi −5 −1 +1 nella zona 6)
  { id: 'giocatori', atteso: 'giocatori', passi: [['scenario', 'full-queue'], ['js', `const q = document.getElementById('queue'); const s = document.querySelectorAll('.queue-slot')[1];
    q.scrollLeft += s.getBoundingClientRect().left + s.getBoundingClientRect().width / 2 - q.getBoundingClientRect().width / 2; q.dispatchEvent(new Event('scroll')); app.render();`]] },
  // Turno nemesi con il carosello di 10 carte (finisce il turno del giocatore e la carta turno è la nemesi)
  { id: 'nemesi', passi: [['scenario', 'full-queue'], ['js', 'app.fineTurnoGiocatore(); app.render()']], atteso: 'nemesi' }
];

// Selettori usati più volte (la prima corrispondenza visibile)
const STATO = '.queue-slot .ae-status-badge, .ae-focus-status';
const CARTA = '.queue-slot .ae-card-art, .ae-focus-stage';
const SLOT = '.queue-slot, .ae-focus-slide';
const ZONA5 = '[data-zona="carte-grandi"]';
const ZONA6 = '[data-zona="interattivi"]';
const PILA = '.ae-header-piles .ae-pile';
const CASELLA = '.ae-turn-seg';
const PICCOLA = '.ae-compact-rail .ae-queue-item';
const PICCOLINA_ICONA = '.ae-compact-rail .ae-status-badge .ae-icon';
const PICCOLINA_NUMERO = '.ae-compact-rail .ae-status-badge span:not(.ae-icon)';
const GRANDE_ICONA = '.queue-slot .ae-status-badge .ae-icon, .ae-focus-status .ae-icon';
const GRANDE_NUMERO = '.queue-slot .ae-status-badge span:not(.ae-icon), .ae-focus-status span:not(.ae-icon)';

export const CASI = [
  // --- 1 testata ---
  { v: '--testata-altezza', a: ['#topbar', 'top'], b: ['#topbar', 'bottom'] },
  { v: '--testata-spazio-sopra', a: ['#topbar', 'top'], b: [PILA, 'top'] },
  { v: '--testata-margine-sinistro', a: ['#topbar', 'left'], b: ['.ae-phase', 'left'] },
  { v: '--testata-margine-destro', a: ['.ae-menu-button', 'right'], b: ['#topbar', 'right'] },
  { v: '--testata-spazio-colonne', a: [PILA + ':last-child', 'right'], b: ['.ae-menu-button', 'left'], nota: 'insieme a --testata-pile-margine-destro' },
  { v: '--testata-pile-altezza', a: [PILA, 'top'], b: [PILA, 'bottom'] },
  { v: '--testata-pile-spazio', a: [PILA + ':first-child', 'right'], b: [PILA + ':last-child', 'left'] },
  { v: '--testata-pile-margine-destro', a: [PILA + ':last-child', 'right'], b: ['.ae-menu-button', 'left'] },
  { v: '--testata-pile-numero', a: ['.ae-header-piles .ae-pile-count', 'top'], b: ['.ae-header-piles .ae-pile-count', 'bottom'] },

  // --- 2 fascia turno ---
  { v: '--turno-spazio-sopra', a: ['#topbar', 'bottom'], b: ['.ae-turn-track-bar', 'top'] },
  { v: '--turno-margine-lati', a: ['#fascia-turno', 'left'], b: ['.ae-turn-track-bar', 'left'] },
  { v: '--turno-barra-altezza', a: ['.ae-turn-track-bar', 'top'], b: ['.ae-turn-track-bar', 'bottom'] },
  { v: '--turno-casella-accesa', a: ['.ae-turn-seg.is-current', 'left'], b: ['.ae-turn-seg.is-current', 'right'] },
  { v: '--turno-caselle-spazio', a: [CASELLA + ':nth-child(1)', 'right'], b: [CASELLA + ':nth-child(2)', 'left'] },
  { v: '--turno-scritte-distanza', a: ['.ae-turn-track-bar', 'bottom'], b: ['.ae-turn-labels', 'top'] },
  { v: '--turno-scritte-altezza', a: ['.ae-turn-labels', 'top'], b: ['.ae-turn-labels', 'bottom'] },

  // --- 3 fascia carte piccole ---
  { v: '--carte-piccole-distanza-sopra', a: ['#fascia-turno', 'bottom'], b: ['#rail', 'top'] },
  { v: '--carte-piccole-altezza', a: ['#rail', 'top'], b: ['#rail', 'bottom'] },
  { v: '--carte-piccole-margine', a: ['#rail', 'left'], b: [PICCOLA + ':first-child', 'left'] },
  { v: '--carte-piccole-spazio', a: [PICCOLA + ':nth-child(1)', 'right'], b: [PICCOLA + ':nth-child(2)', 'left'] },
  { v: '--carta-piccola-larghezza', a: [PICCOLA + ':first-child', 'left'], b: [PICCOLA + ':first-child', 'right'] },
  { v: '--carte-piccole-goccia-numero', a: [PICCOLINA_ICONA, 'right'], b: [PICCOLINA_NUMERO, 'left'], nota: 'tra la goccia e il numero della prima carta piccola con la vita' },

  // --- 4 vite ---
  { v: '--vite-spazio-sopra', a: ['#rail', 'bottom'], b: ['.ae-life-box', 'top'] },
  { v: '--vite-sovrapposizione-zona-5', a: [ZONA5, 'top'], b: ['.ae-life-box', 'bottom'] },
  { v: '--vite-margine-lati', a: ['#vite', 'left'], b: ['.ae-life-box', 'left'] },
  { v: '--vite-box-altezza', a: ['.ae-life-box', 'top'], b: ['.ae-life-box', 'bottom'] },
  { v: '--vite-box-larghezza-minima-sfondo', a: ['.ae-life-box.has-bg', 'left'], b: ['.ae-life-box.has-bg', 'right'] },
  { v: '--vite-box-margine-interno', a: ['.ae-life-box', 'left'], b: ['.ae-life-box', 'right'], fattore: 2,
    prima: { '--vite-box-larghezza-minima': '0px', '--vite-box-larghezza-minima-sfondo': '0px' }, nota: 'senza il minimo di larghezza, che altrimenti vince' },
  { v: '--vite-scritta-distanza', a: ['.ae-life-tag', 'bottom'], b: ['.ae-life-box', 'top'] },

  // --- 5 fascia carte grandi ---
  { v: '--carte-grandi-spazio-sopra', a: [ZONA5, 'top'], b: [STATO, 'top'], prima: { '--carte-grandi-avanzo-sopra': '0', '--carte-grandi-avanzo-sotto': '0' }, nota: 'senza avanzo sopra, che altrimenti si somma' },
  { v: '--carte-grandi-alone-sotto', a: [ZONA6, 'top'], b: ['#focus', 'bottom'], turni: ['nemesi'], nota: 'di quanto il carosello sporge sotto la carta' },
  { v: '--carte-grandi-spazio', a: ['.queue-slot:nth-child(1), .ae-focus-slide:nth-child(1)', 'right'], b: ['.queue-slot:nth-child(2), .ae-focus-slide:nth-child(2)', 'left'] },
  { v: '--carte-grandi-goccia-numero', a: [GRANDE_ICONA, 'right'], b: [GRANDE_NUMERO, 'left'], nota: 'tra la goccia e il numero della riga vita/token della prima carta grande con la vita' },
  { v: '--carte-grandi-numero-interlinea', a: [GRANDE_NUMERO, 'top'], b: [GRANDE_NUMERO, 'bottom'], nota: 'altezza della riga del numero' },
  { v: '--carte-grandi-riga-stato-altezza', a: [STATO, 'top'], b: [STATO, 'bottom'] },
  { v: '--carte-grandi-riga-stato-distanza', a: [STATO, 'bottom'], b: [CARTA, 'top'] },
  { v: '--carte-grandi-token', a: ['.queue-slot .ae-token, .ae-focus-status .ae-token', 'top'], b: ['.queue-slot .ae-token, .ae-focus-status .ae-token', 'bottom'], nota: 'la riga vita/token è alta il suo valore: si alza anche la riga se il token è più alto' },
  { v: '--carte-grandi-icona', a: ['.queue-slot .ae-status-badge .ae-icon, .ae-focus-status .ae-icon', 'top'], b: ['.queue-slot .ae-status-badge .ae-icon, .ae-focus-status .ae-icon', 'bottom'] },

  // --- 6 pulsanti interattivi ---
  { v: '--interattivi-altezza', a: [ZONA6, 'top'], b: [ZONA6, 'bottom'] },
  { v: '--interattivi-distanza', a: [CARTA, 'bottom'], b: [ZONA6, 'top'] },
  { v: '--interattivi-spazio', a: ['#interattivi .queue-controls .ae-button:nth-child(1)', 'right'], b: ['#interattivi .queue-controls .ae-button:nth-child(2)', 'left'], turni: ['giocatori'] },

  // --- 7 pulsante principale ---
  { v: '--principale-spazio-sopra', a: [ZONA6, 'bottom'], b: ['#pulsante-principale', 'top'] },
  { v: '--principale-spazio-sotto', a: ['#pulsante-principale', 'bottom'], b: ['#dock', 'bottom'] },
  { v: '--principale-margine-lati', a: ['#dock', 'left'], b: ['#pulsante-principale', 'left'] },
  { v: '--principale-altezza', a: ['#pulsante-principale', 'top'], b: ['#pulsante-principale', 'bottom'] }
];

// Variabili che la prova non prova con "+10px", con il motivo (stanno nell'elenco dell'esito)
export const NON_PROVABILI = [
  { v: '--carta-larghezza', motivo: 'proporzione della carta (63 mm), non una misura in px' },
  { v: '--carta-altezza', motivo: 'proporzione della carta (88 mm), non una misura in px' },
  { v: '--vite-spazio', motivo: 'è uno spazio MINIMO tra i due box (stanno ai lati, space-between): la distanza vera dipende dalla larghezza dello schermo' },
  { v: '--vite-box-larghezza-minima', motivo: 'vale per il box senza sfondo: in questi momenti tutti e due i box hanno lo sfondo' },
  { v: '--vite-box-raggio', motivo: 'arrotondamento degli angoli, non uno spazio: si controlla a occhio' },
  { v: '--carte-grandi-avanzo-sopra', motivo: 'è un peso, non px: lo prova il controllo fisso "pesi dell\'avanzo"' },
  { v: '--carte-grandi-avanzo-sotto', motivo: 'è un peso, non px: lo prova il controllo fisso "pesi dell\'avanzo"' },
  { v: '--carte-grandi-margine-lato', motivo: 'entra solo nel calcolo della larghezza della carta quando è la larghezza a limitare (la carta non è un bordo misurabile)' },
  { v: '--carte-grandi-vicine-visibili', motivo: 'entra solo nel calcolo della larghezza della carta (quanto si vede delle vicine): la carta si arrotonda per difetto' },
  { v: '--carta-pescata-spazio-sopra', motivo: 'vale solo per la carta da pescare/pescata, nello stato "Pesca" (la prova non lo percorre)' },
  { v: '--carta-pescata-margine-lati', motivo: 'vale solo per la carta da pescare/pescata, nello stato "Pesca" (la prova non lo percorre)' },
  { v: '--carte-grandi-numero', motivo: 'misura del carattere del numero, non uno spazio: si controlla a occhio' },
  { v: '--testata-test-altezza', motivo: 'vale solo per la scritta TEST della Modalità test (la prova non la percorre)' },
  { v: '--colonna-larghezza-minima', motivo: 'solo tablet e desktop, e solo se la carta non la supera: lo prova il controllo della colonna a 1280×800' },
  { v: '--colonna-vicine-visibili', motivo: 'solo tablet e desktop: decide la larghezza della colonna, non uno spazio tra due cose' },
  { v: '--principale-spazio', motivo: 'spazio tra pulsante e "Annulla modifiche" (compare solo con modifiche non salvate): non provato in questi momenti' },
  { v: '--principale-margine-interno-giocatori', motivo: 'spazio tra la scritta e il bordo dentro il pulsante: dipende dal testo' },
  { v: '--principale-margine-interno-nemesi', motivo: 'spazio tra la scritta e il bordo dentro il pulsante: dipende dal testo' },
  { v: '--principale-margine-interno-stretto', motivo: 'solo schermi sotto i 346px' }
];
