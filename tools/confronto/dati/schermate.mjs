// tools/confronto/dati/schermate.mjs: le schermate e gli stati della prova "schermate" (strumento di confronto,
// tools/confronto/README.md) e degli screenshot (tools/screenshot/README.md). È un unico giro: ogni voce parte da dove è arrivata la
// precedente, esegue i suoi `passi` (linguaggio dei passi in browser.mjs, Pagina.passo) e poi la misura. Per aggiungere una
// schermata: una voce in più, nel punto del giro da cui si raggiunge.
//
// Campi di una voce:
//   id        nome nell'esito
//   passi     [['scenario', id] | ['js', codice] | ['clic', selettore] | ['giu', selettore, dx, dy] | ['su'] | ['muovi', x, y]
//             | ['tasto', 'Escape'] | ['aspetta', ms] | ['seme', n] | ['subito', codice, ms] | ['salvataggio', file]]  (js è sincrono; un'eccezione = errore nell'esito)
//   anche     altri giri in cui la voce si misura oltre a telefono (375x812) e desktop (1280x800):
//             'orizz' (telefono in orizzontale 812x375), 'ridotto' (telefono con riduzione del movimento)
//   forza     [[selettore, [pseudo-classi]]]: stati forzati da misurare dopo la schermata (:hover, :active, :focus, :focus-visible)
//   misura    selettore a cui limitare la misura (default tutta la pagina)
// Per gli screenshot (tools/screenshot/, che percorre GIRO e poi FOTO_IN_PIU; le altre prove ignorano questi campi):
//   foto      nome del file dello screenshot (senza numero né estensione): senza `foto` la voce non si fotografa
//   atteso    cosa deve esserci nella pagina perché lo stato sia quello giusto (voci in tools/screenshot/controlli.mjs: selettore, chiave
//             del dizionario T, ['pulsante', chiave], ['testo', selettore, valore], ['assente', selettore]); obbligatorio con `foto`
//   test      true: è la Modalità test stessa (si fotografa con il pulsante Regolazioni e la scritta TEST visibili)
//   istante   'banner': lo stato dura poco (la scritta Tier): niente animazioni portate alla fine, solo il banner fermo a metà
//
// Nei passi il nome `app` è window.app: se un nome cambia, si aggiorna qui e in pagina-lib.js.

const CHIUDI = ['js', 'app.closeAllModals(); app.closeDiscard()'];
const INDIETRO = ['js', 'app.closeTopForBack()'];
const COLLEZIONE_COMPLETA = ['js', '__c.collezioneCompleta()'];

export const GIRO = [
  // --- Pagina iniziale ---
  { id: 'menu (senza collezione)', passi: [], anche: ['orizz', 'ridotto'] },
  { id: 'menu (collezione completa)', passi: [COLLEZIONE_COMPLETA], foto: 'menu-iniziale', atteso: ['newGame', 'options', 'testMenu', ['assente', '#start-choice']],
    forza: [['.start-home-new', ['hover']], ['.start-home-new', ['active']], ['.start-home-new', ['focus-visible']], ['.start-home-options', ['hover']]] },
  { id: 'opzioni', passi: [['clic', '.start-home-options']], anche: ['orizz'], foto: 'opzioni', atteso: ['options', 'myCollection', 'cardBack', 'background'] },
  { id: 'collezione', passi: [['js', 'app.openCollection()']], foto: 'la-mia-collezione', atteso: ['myCollection', 'collectionHint', 'collectionSave', 'selectAll'] },
  { id: 'schermata Test', passi: [INDIETRO, INDIETRO, ['js', 'app.openTestScreen()']], foto: 'modalita-test-scenari', test: true, atteso: ['testTitle', 'testHint'] },
  { id: 'menu dopo la chiusura', passi: [['js', 'app.closeTestScreen()']] },
  { id: 'Nuova partita', passi: [['clic', '.start-home-new']], anche: ['orizz', 'ridotto'], foto: 'nuova-partita', atteso: ['newGameTitle', 'startNew', 'deckOptions', 'battleMode', 'mergeCollection'],
    forza: [['#start-btn', ['hover']], ['#start-btn', ['active']], ['#start-btn', ['focus-visible']]] },
  { id: 'Nuova partita: menu delle wave', passi: [['clic', '.wave-dropdown-toggle']], foto: 'nuova-partita-onde', atteso: ['newGameTitle', '.wave-option'] },
  { id: 'Nuova partita: wave IV e Maggoth, 4 giocatori', anche: ['orizz'], foto: 'nuova-partita-maggoth-4-giocatori', atteso: ['newGameTitle', 'startNew', ['testo', '#choices-players .is-selected, #choices-players [aria-pressed="true"]', '4']], passi: [
    ['js', `[...document.querySelectorAll('.wave-option')].find(e => /^\\s*IV - /.test(e.textContent)).click();`],
    ['js', `[...document.querySelectorAll('.wave-option')].find(e => /^\\s*I - /.test(e.textContent)).click();`],
    ['clic', '.wave-dropdown-toggle'],
    ['js', `[...document.querySelectorAll('.nemesis-item')].find(e => e.textContent.includes('Maggoth')).click();`],
    ['js', `[...document.querySelectorAll('#choices-players button')].find(e => e.textContent.trim() === '4').click();`]] },
  { id: 'Nuova partita: anteprima della nemesi', passi: [['js', 'app.setNemesisPreview(true)']], foto: 'nuova-partita-anteprima-nemesi', atteso: ['newGameTitle', '.nemesis-preview'] },

  // --- Crea mazzo ---
  { id: 'Crea mazzo', passi: [['js', 'app.setNemesisPreview(false)'], ['clic', '#start-btn'], ['aspetta', 1500]], anche: ['orizz', 'ridotto'], foto: 'crea-mazzo', atteso: ['deckBuildTitle', 'slideToBuild'] },
  { id: 'Crea mazzo: carte specifiche', passi: [['js', 'app.openSpecificViewer(1)']], foto: 'crea-mazzo-carte-specifiche', atteso: ['specificTitle', 'close'] },
  { id: 'Crea mazzo: mazzo creato (Pesca carta turno)', passi: [CHIUDI, ['js', 'app.runDeckBuild()'], ['aspetta', 8000]], anche: ['orizz', 'ridotto'],
    foto: 'turno-giocatori-coda-vuota', atteso: [['pulsante', 'drawTurnCard'], 'emptyHintStart', ['testo', '.ae-life-box--grave .ae-life-num', '30']],
    forza: [['#pulsante-principale', ['hover']], ['#pulsante-principale', ['active']], ['#pulsante-principale', ['focus-visible']]] },

  // --- Turno giocatori ---
  { id: 'turno giocatori: coda piena', passi: [['scenario', 'full-queue']], anche: ['orizz', 'ridotto'], foto: 'turno-giocatori-coda-piena', atteso: [['pulsante', 'endTurn'], 'notRemovable'] },
  { id: 'turno giocatori: con modifiche non salvate', anche: ['orizz'], foto: 'turno-giocatori-modifiche-non-salvate', atteso: ['saveChanges', 'cancelChanges'], passi: [
    ['js', `const m = app.partita.queue.filter(e => e.data.type === 'Minion'); app.setDraft(m[0], { hp: 1 }); app.setDraft(m[1], { hp: 2 }); app.render();`]] },
  { id: 'turno giocatori: scheda carta', passi: [['js', 'app.openCardDialog(app.partita.queue[1])']], anche: ['orizz'], foto: 'turno-giocatori-scheda-carta', atteso: ['confirmHp', 'cancel', '.ae-modal'] },
  { id: 'turno giocatori: finestra della vita (Gravehold)', passi: [CHIUDI, ['js', "app.openLifeDialog('grave')"]], foto: 'turno-giocatori-vita-gravehold', atteso: ['.ae-life-modal--grave', ['testo', '.ae-life-modal-title', 'Gravehold']] },
  { id: 'turno giocatori: finestra della vita (nemesi)', passi: [CHIUDI, ['js', "app.openLifeDialog('nemesis')"]], foto: 'turno-giocatori-vita-nemesi', atteso: ['.ae-life-modal--nemesis', 'nemesisWord'] },
  { id: 'turno giocatori: scrubbing della vita', passi: [CHIUDI, ['giu', '.ae-life-box--nemesis', 0, -70]] },
  { id: 'turno giocatori: scarti', passi: [['su'], ['scenario', 'full-stats'], ['js', 'app.openDiscard()']], anche: ['orizz'], foto: 'turno-giocatori-scarti', atteso: ['mostRecent', 'leastRecent', 'close'] },
  { id: 'turno giocatori: menu laterale', passi: [CHIUDI, ['js', 'app.openSideMenu()']], foto: 'turno-giocatori-menu-laterale', atteso: ['menu', 'menuTurn', 'statsInProgress', 'testRestart', 'testExit'] },
  { id: 'turno giocatori: statistiche', passi: [CHIUDI, ['js', 'app.openStats()']], foto: 'turno-giocatori-statistiche', atteso: ['statsTitle', 'statsTimeTitle', 'statsMagesTitle'] },

  // --- Mazzo dei turni ---
  { id: 'mazzo dei turni a riposo', passi: [CHIUDI, ['scenario', 'turn-deck'], ['js', 'app.openTurnScreen()'], ['aspetta', 800]], anche: ['orizz'] },
  { id: 'mazzo dei turni con una carta presa', passi: [['giu', '.ae-turn-pile-slot.is-current .ae-turn-card', 0, 40]] },
  { id: 'mazzo dei turni: carta lasciata', passi: [['su'], ['aspetta', 800]] },

  // --- Carte 1/2 e 3/4 ---
  { id: 'carte 1/2 e 3/4: scelta del giocatore', passi: [CHIUDI, ['scenario', 'pairs']], anche: ['orizz', 'ridotto'] },
  { id: 'carte 1/2 e 3/4: con la memoria del giro prima', passi: [['scenario', 'pair-memory']] },
  { id: 'Wild e fine giro', passi: [['scenario', 'wild-round']] },

  // --- Turno nemesi ---
  { id: 'turno nemesi: Pesca', passi: [['scenario', 'variable-hp']], anche: ['orizz', 'ridotto'], foto: 'turno-nemesi-passo-pesca', atteso: [['pulsante', 'ctaDraw'], '[data-turno="pesca"]'],
    forza: [['#pulsante-principale', ['hover']], ['#pulsante-principale', ['active']]] },
  { id: 'turno nemesi: carta pescata (vita da impostare)', passi: [['seme', 5], ['clic', '#pulsante-principale'], ['aspetta', 2500]], anche: ['orizz'], foto: 'turno-nemesi-minion-vita-da-impostare', atteso: [['pulsante', 'ctaSetHp'], 'newTag'] },
  { id: 'turno nemesi: scheda della carta', passi: [['js', 'app.openCardDialog(app.partita.queue[app.partita.currentIndex])']] },
  { id: 'turno nemesi: cambio Tier', passi: [CHIUDI, ['scenario', 'tier'], ['seme', 6], ['clic', '#pulsante-principale'], ['aspetta', 600]] },
  { id: 'turno nemesi: carta sul mazzo dei turni', passi: [['aspetta', 3000], ['scenario', 'turn-deck']] },

  // --- Fine partita ---
  { id: 'mazzo nemesi vuoto', passi: [['scenario', 'empty-deck']], foto: 'turno-giocatori-mazzo-nemesi-vuoto', atteso: [['pulsante', 'endTurn'], ['testo', '.ae-pile--deck .ae-pile-count', '0'], '.ae-pile--deck.is-empty'] },
  { id: 'vite quasi a zero', passi: [['scenario', 'low-lives']], foto: 'turno-giocatori-vite-quasi-a-zero', atteso: [['pulsante', 'endTurn'], ['testo', '.ae-life-box--grave .ae-life-num', '3'], ['testo', '.ae-life-box--nemesis .ae-life-num', '3']] },
  { id: 'statistiche piene', passi: [['scenario', 'full-stats'], ['js', 'app.openStats()']] },
  { id: 'Vittoria', passi: [CHIUDI, ['scenario', 'victory'], ['js', 'app.showVictory()']], anche: ['orizz', 'ridotto'], foto: 'vittoria', atteso: ['victoryTitle', 'statsTitle', 'mainMenu'] },
  { id: 'Sconfitta', passi: [CHIUDI, ['js', 'app.showDefeat()']], anche: ['orizz'], foto: 'sconfitta', atteso: ['defeatTitle', 'statsTitle', 'continueLabel', 'mainMenu'] },

  // --- Torna al menu ---
  { id: 'menu dopo la partita', passi: [CHIUDI, ['js', 'app.openStart()']] }
];

// Stati in più per gli screenshot (tools/screenshot/): si percorrono dopo GIRO e ognuno comincia dal proprio scenario, senza dipendere dalla voce
// prima (tranne la scheda Regolazioni, che si chiude all'inizio della voce dopo). Non entrano nel confronto delle build né nella prova lingua.
const RIMETTI = ['js', "document.querySelector('.ae-regolazioni .ae-icon-button')?.click(); app.closeAllModals(); app.closeDiscard()"];
const PAUSA = ['aspetta', 600];   // dopo un cambio di scenario la coda e le immagini finiscono di sistemarsi
// Finestra "Pesca nuovo turno" dopo la fine di un turno: si tocca il dorso (si pesca) e poi fuori dalla finestra (si chiude: se esce la
// nemesi il turno nemesi parte a schermo)
const PESCA_TURNO = [['clic', '.ae-draw-turn-stage'], ['aspetta', 900], ['js', "document.querySelector('.ae-draw-turn-backdrop').click()"], ['aspetta', 2500]];
const SCEGLI_COPPIA = (turnOrder) => ['js', `const b = app.SCENARI.find(s => s.id === 'pairs'); const r = app.startScenario({ ...b, turnOrder: ${JSON.stringify(turnOrder)} }); if (r) throw new Error(r);`];

export const FOTO_IN_PIU = [
  // Turno giocatori: i comandi della carta al centro (un minion: la sua vita; un potere: Rimuovi)
  { id: 'turno giocatori: comandi di un minion', passi: [RIMETTI, ['scenario', 'full-queue'], PAUSA, ['js', "app.scrollToCard(app.partita.queue.find(e => e.data.type === 'Minion').uid, 'center')"], PAUSA],
    foto: 'turno-giocatori-comandi-minion', atteso: [['pulsante', 'endTurn'], '.queue-controls', ['assente', '.ae-regolazioni']] },
  { id: 'turno giocatori: comandi di un potere rimovibile', passi: [['js', "app.scrollToCard(app.partita.queue.find(e => e.data.name === 'Morbid Gyre').uid, 'center')"], PAUSA],
    foto: 'turno-giocatori-comandi-potere-rimovibile', atteso: [['pulsante', 'endTurn'], 'removePowerShort'] },
  // Carte 1/2 e 3/4: chi gioca questo turno?
  // Finestra "Pesca nuovo turno": prima il dorso, poi la carta girata (di chi è il turno)
  { id: 'pesca nuovo turno: dorso', passi: [['scenario', 'full-queue'], ['clic', '#pulsante-principale'], ['aspetta', 600]],
    foto: 'pesca-nuovo-turno-dorso', atteso: ['drawTurnTitle', '.ae-draw-turn-stage', ['assente', '.ae-flip.is-flipped']] },
  { id: 'pesca nuovo turno: carta girata', passi: [['clic', '.ae-draw-turn-stage'], ['aspetta', 1200]],
    foto: 'pesca-nuovo-turno-carta-girata', atteso: ['.ae-draw-turn .ae-flip.is-flipped', '.ae-draw-turn-who'] },
  { id: 'carte 1/2: scelta del giocatore', passi: [RIMETTI, ['scenario', 'pairs'], ['clic', '#pulsante-principale'], ['clic', '.ae-draw-turn-stage'], ['aspetta', 1200]],
    foto: 'scelta-giocatore-carta-1-2', atteso: ['pairChoiceTitle', '.ae-draw-turn .ae-pair-pick', ['testo', '.ae-pair-pick', '1']] },
  { id: 'carte 3/4: scelta del giocatore', passi: [SCEGLI_COPPIA({ left: ['p34', 'nemesis', 'p12', 'p34', 'nemesis'], drawn: ['p12'], picks: { 0: { player: 'p1', forced: false } }, pairNext: { p12: 'p1', p34: null }, round: 1 }), ['clic', '#pulsante-principale'], ['clic', '.ae-draw-turn-stage'], ['aspetta', 1200]],
    foto: 'scelta-giocatore-carta-3-4', atteso: ['pairChoiceTitle', '.ae-draw-turn .ae-pair-pick', ['testo', '.ae-pair-pick', '3']] },
  // Mazzo dei turni (Carapace Queen: carte dei giocatori e della nemesi nel mazzo)
  { id: 'mazzo dei turni: a riposo', passi: [CHIUDI, ['scenario', 'variable-hp'], ['js', 'app.openTurnScreen()'], ['aspetta', 800]],
    foto: 'mazzo-dei-turni-a-riposo', atteso: ['turnDeckTitle', 'turnHint', 'turnPileTitle', 'turnCurrent', 'turnResetAll'] },
  { id: 'mazzo dei turni: con le carte rivelate', passi: [['clic', '.ae-turn-eye--all']],
    foto: 'mazzo-dei-turni-carte-rivelate', atteso: ['turnDeckTitle', 'turnHint', '.ae-turn-eye--all[title="Copri tutto"], .ae-turn-eye--all[title="Cover all"]'] },
  // Turno nemesi (Maggoth, il mazzo del test "Carte sul mazzo dei turni": Hissing Acid potere con 3 token, poi Sunder attacco)
  { id: 'turno nemesi: potere con token', passi: [CHIUDI, ['scenario', 'turn-deck'], ['seme', 5], ['clic', '#pulsante-principale'], ['aspetta', 2500], ['clic', '#pulsante-principale'], ['aspetta', 1500], ...PESCA_TURNO],
    foto: 'turno-nemesi-potere-con-token', atteso: [['pulsante', 'ctaPowerNext'], '.ae-token'] },
  { id: 'turno nemesi: attacco pescato (con alone)', passi: [['clic', '#pulsante-principale'], ['aspetta', 1500], ['seme', 7], ['clic', '#pulsante-principale'], ['aspetta', 2500]],
    foto: 'turno-nemesi-attacco-pescato', atteso: [['pulsante', 'ctaAttackEnd'], 'newTag'] },
  // Anteprima di un'altra carta: la carta pescata è già in gioco ma si guarda l'altra (Volcanic Zala), la prima (Drillbeak Wurm) resta da risolvere
  { id: 'turno nemesi: anteprima di un\'altra carta', passi: [['aspetta', 2500], CHIUDI, ['scenario', 'tier'], ['seme', 6], ['clic', '#pulsante-principale'], ['aspetta', 600],
    ['clic', '#pulsante-principale'], ['aspetta', 2500], ['clic', '#pulsante-principale'], ['aspetta', 1500], ...PESCA_TURNO,
    ['js', "app.viewCard(app.partita.queue.find(e => e.data.name === 'Volcanic Zala').uid)"], ['aspetta', 800]],
    foto: 'turno-nemesi-anteprima-altra-carta', atteso: [['pulsante', 'backToActive']] },
  { id: 'turno nemesi: cambio Tier (banner)', passi: [['aspetta', 2500], CHIUDI, ['scenario', 'tier'], ['seme', 6], ['clic', '#pulsante-principale'], ['aspetta', 600],
    ['subito', "document.getElementById('pulsante-principale').click()", 400]], istante: 'banner',
    foto: 'turno-nemesi-cambio-tier-banner', atteso: ['.ae-tier-banner', ['testo', '.ae-tier-banner-text', 'Tier 2']] },
  // Conferma di uscita (menu laterale, poi "Esci dal test")
  { id: 'conferma di uscita', passi: [['aspetta', 2500], CHIUDI, ['scenario', 'full-queue'], ['js', 'app.openSideMenu()'],
    ['js', "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === app.T.testExit).click()"]],
    foto: 'conferma-uscita', atteso: ['exitConfirmTitle', 'exitConfirmText', 'exitConfirm', 'cancel'] },
  // Modalità test: il pannello Regolazioni sopra la partita (scenario e Regolazioni visibili)
  { id: 'Modalità test: pannello Regolazioni', passi: [CHIUDI, ['scenario', 'full-queue'], ['clic', '.ae-regolazioni-pulsante']], test: true,
    foto: 'modalita-test-regolazioni', atteso: ['regolazioniTitolo', 'regolazioniColori', 'regolazioniMisure', 'regolazioniRipristina', '.ae-phase-test'] },
  // Il menu iniziale con una partita salvata (si usa uno dei salvataggi di tools/confronto/salvataggi/)
  { id: 'menu con Riprendi partita', passi: [RIMETTI, ['salvataggio', 'main-v273-sito-pubblicato.json'], ['js', 'app.openStart()']],
    foto: 'menu-iniziale-riprendi-partita', atteso: ['savedGameTitle', 'resumeGame', 'newGame', 'options', '.start-choice-info'] }
];

// L'ordine dei file nella cartella degli screenshot (i nomi di `foto`); una foto che non c'è qui va in fondo, nell'ordine del giro
export const ORDINE_FOTO = [
  'menu-iniziale', 'menu-iniziale-riprendi-partita',
  'nuova-partita', 'nuova-partita-onde', 'nuova-partita-maggoth-4-giocatori', 'nuova-partita-anteprima-nemesi',
  'opzioni', 'la-mia-collezione',
  'crea-mazzo', 'crea-mazzo-carte-specifiche',
  'turno-giocatori-coda-vuota', 'turno-giocatori-coda-piena', 'turno-giocatori-comandi-minion', 'turno-giocatori-comandi-potere-rimovibile',
  'turno-giocatori-modifiche-non-salvate', 'turno-giocatori-scheda-carta', 'turno-giocatori-vita-gravehold', 'turno-giocatori-vita-nemesi',
  'turno-giocatori-scarti', 'turno-giocatori-menu-laterale', 'turno-giocatori-statistiche',
  'pesca-nuovo-turno-dorso', 'pesca-nuovo-turno-carta-girata', 'scelta-giocatore-carta-1-2', 'scelta-giocatore-carta-3-4',
  'mazzo-dei-turni-a-riposo', 'mazzo-dei-turni-carte-rivelate',
  'turno-nemesi-passo-pesca', 'turno-nemesi-minion-vita-da-impostare', 'turno-nemesi-potere-con-token', 'turno-nemesi-attacco-pescato',
  'turno-nemesi-anteprima-altra-carta', 'turno-nemesi-cambio-tier-banner',
  'turno-giocatori-mazzo-nemesi-vuoto', 'turno-giocatori-vite-quasi-a-zero', 'vittoria', 'sconfitta',
  'modalita-test-scenari', 'modalita-test-regolazioni', 'conferma-uscita'
];

// Giri: telefono, desktop (tutte le voci) e, solo per le voci con `anche`, telefono in orizzontale e con riduzione del movimento
export const GIRI = [
  { id: 'telefono 375x812', vista: 'tel', tutte: true },
  { id: 'desktop 1280x800', vista: 'desk', tutte: true },
  { id: 'telefono in orizzontale 812x375', vista: 'orizz', anche: 'orizz' },
  { id: 'telefono con riduzione del movimento', vista: 'tel', ridotto: true, anche: 'ridotto' }
];
