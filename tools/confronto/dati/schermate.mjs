// tools/confronto/dati/schermate.mjs: le schermate e gli stati della prova "schermate" (strumento di confronto,
// CONTESTO_SVILUPPO.md sezione 9). È un unico giro (come quello della fase E): ogni voce parte da dove è arrivata la
// precedente, esegue i suoi `passi` (linguaggio dei passi in browser.mjs, Pagina.passo) e poi la misura. Per aggiungere una
// schermata: una voce in più, nel punto del giro da cui si raggiunge.
//
// Campi di una voce:
//   id        nome nell'esito
//   passi     [['scenario', id] | ['js', codice] | ['clic', selettore] | ['giu', selettore, dx, dy] | ['su'] | ['muovi', x, y]
//             | ['tasto', 'Escape'] | ['aspetta', ms] | ['seme', n]]  (js è sincrono; un'eccezione = errore nell'esito)
//   anche     altri giri in cui la voce si misura oltre a telefono (375x812) e desktop (1280x800):
//             'orizz' (telefono in orizzontale 812x375), 'ridotto' (telefono con riduzione del movimento)
//   forza     [[selettore, [pseudo-classi]]]: stati forzati da misurare dopo la schermata (:hover, :active, :focus, :focus-visible)
//   misura    selettore a cui limitare la misura (default tutta la pagina)
//
// Nei passi il nome `app` è window.app: se un nome cambia in una fase futura, si aggiorna qui e in pagina-lib.js.

const CHIUDI = ['js', 'app.closeAllModals(); app.closeDiscard()'];
const INDIETRO = ['js', 'app.closeTopForBack()'];
const COLLEZIONE_COMPLETA = ['js', '__c.collezioneCompleta()'];

export const GIRO = [
  // --- Pagina iniziale ---
  { id: 'menu (senza collezione)', passi: [], anche: ['orizz', 'ridotto'] },
  { id: 'menu (collezione completa)', passi: [COLLEZIONE_COMPLETA],
    forza: [['.start-home-new', ['hover']], ['.start-home-new', ['active']], ['.start-home-new', ['focus-visible']], ['.start-home-options', ['hover']]] },
  { id: 'opzioni', passi: [['clic', '.start-home-options']], anche: ['orizz'] },
  { id: 'collezione', passi: [['js', 'app.openCollection()']] },
  { id: 'schermata Test', passi: [INDIETRO, INDIETRO, ['js', 'app.openTestScreen()']] },
  { id: 'menu dopo la chiusura', passi: [['js', 'app.closeTestScreen()']] },
  { id: 'Nuova partita', passi: [['clic', '.start-home-new']], anche: ['orizz', 'ridotto'],
    forza: [['#start-btn', ['hover']], ['#start-btn', ['active']], ['#start-btn', ['focus-visible']]] },
  { id: 'Nuova partita: menu delle wave', passi: [['clic', '.wave-dropdown-toggle']] },
  { id: 'Nuova partita: wave IV e Maggoth, 4 giocatori', anche: ['orizz'], passi: [
    ['js', `[...document.querySelectorAll('.wave-option')].find(e => /^\\s*IV - /.test(e.textContent)).click();`],
    ['js', `[...document.querySelectorAll('.wave-option')].find(e => /^\\s*I - /.test(e.textContent)).click();`],
    ['clic', '.wave-dropdown-toggle'],
    ['js', `[...document.querySelectorAll('.nemesis-item')].find(e => e.textContent.includes('Maggoth')).click();`],
    ['js', `[...document.querySelectorAll('#choices-players button')].find(e => e.textContent.trim() === '4').click();`]] },
  { id: 'Nuova partita: anteprima della nemesi', passi: [['js', 'app.setNemesisPreview(true)']] },

  // --- Crea mazzo ---
  { id: 'Crea mazzo', passi: [['js', 'app.setNemesisPreview(false)'], ['clic', '#start-btn'], ['aspetta', 1500]], anche: ['orizz', 'ridotto'] },
  { id: 'Crea mazzo: carte specifiche', passi: [['js', 'app.openSpecificViewer(1)']] },
  { id: 'Crea mazzo: mazzo creato (Pesca carta turno)', passi: [CHIUDI, ['js', 'app.runDeckBuild()'], ['aspetta', 8000]], anche: ['orizz', 'ridotto'],
    forza: [['#pulsante-principale', ['hover']], ['#pulsante-principale', ['active']], ['#pulsante-principale', ['focus-visible']]] },

  // --- Turno giocatori ---
  { id: 'turno giocatori: coda piena', passi: [['scenario', 'full-queue']], anche: ['orizz', 'ridotto'] },
  { id: 'turno giocatori: con modifiche non salvate', anche: ['orizz'], passi: [
    ['js', `const m = app.partita.queue.filter(e => e.data.type === 'Minion'); app.setDraft(m[0], { hp: 1 }); app.setDraft(m[1], { hp: 2 }); app.render();`]] },
  { id: 'turno giocatori: scheda carta', passi: [['js', 'app.openCardDialog(app.partita.queue[1])']], anche: ['orizz'] },
  { id: 'turno giocatori: finestra della vita (Gravehold)', passi: [CHIUDI, ['js', "app.openLifeDialog('grave')"]] },
  { id: 'turno giocatori: finestra della vita (nemesi)', passi: [CHIUDI, ['js', "app.openLifeDialog('nemesis')"]] },
  { id: 'turno giocatori: scrubbing della vita', passi: [CHIUDI, ['giu', '.ae-life-box--nemesis', 0, -70]] },
  { id: 'turno giocatori: scarti', passi: [['su'], ['scenario', 'full-stats'], ['js', 'app.openDiscard()']], anche: ['orizz'] },
  { id: 'turno giocatori: menu laterale', passi: [CHIUDI, ['js', 'app.openSideMenu()']] },
  { id: 'turno giocatori: statistiche', passi: [CHIUDI, ['js', 'app.openStats()']] },

  // --- Mazzo dei turni ---
  { id: 'mazzo dei turni a riposo', passi: [CHIUDI, ['scenario', 'turn-deck'], ['js', 'app.openTurnScreen()'], ['aspetta', 800]], anche: ['orizz'] },
  { id: 'mazzo dei turni con una carta presa', passi: [['giu', '.ae-turn-pile-slot.is-current .ae-turn-card', 0, 40]] },
  { id: 'mazzo dei turni: carta lasciata', passi: [['su'], ['aspetta', 800]] },

  // --- Carte 1/2 e 3/4 ---
  { id: 'carte 1/2 e 3/4: scelta del giocatore', passi: [CHIUDI, ['scenario', 'pairs']], anche: ['orizz', 'ridotto'] },
  { id: 'carte 1/2 e 3/4: con la memoria del giro prima', passi: [['scenario', 'pair-memory']] },
  { id: 'Wild e fine giro', passi: [['scenario', 'wild-round']] },

  // --- Turno nemesi ---
  { id: 'turno nemesi: Pesca', passi: [['scenario', 'variable-hp']], anche: ['orizz', 'ridotto'],
    forza: [['#pulsante-principale', ['hover']], ['#pulsante-principale', ['active']]] },
  { id: 'turno nemesi: carta pescata (vita da impostare)', passi: [['seme', 5], ['clic', '#pulsante-principale'], ['aspetta', 2500]], anche: ['orizz'] },
  { id: 'turno nemesi: scheda della carta', passi: [['js', 'app.openCardDialog(app.partita.queue[app.partita.currentIndex])']] },
  { id: 'turno nemesi: cambio Tier', passi: [CHIUDI, ['scenario', 'tier'], ['seme', 6], ['clic', '#pulsante-principale'], ['aspetta', 600]] },
  { id: 'turno nemesi: carta sul mazzo dei turni', passi: [['aspetta', 3000], ['scenario', 'turn-deck']] },

  // --- Fine partita ---
  { id: 'mazzo nemesi vuoto', passi: [['scenario', 'empty-deck']] },
  { id: 'vite quasi a zero', passi: [['scenario', 'low-lives']] },
  { id: 'statistiche piene', passi: [['scenario', 'full-stats'], ['js', 'app.openStats()']] },
  { id: 'Vittoria', passi: [CHIUDI, ['scenario', 'victory'], ['js', 'app.showVictory()']], anche: ['orizz', 'ridotto'] },
  { id: 'Sconfitta', passi: [CHIUDI, ['js', 'app.showDefeat()']], anche: ['orizz'] },

  // --- Torna al menu ---
  { id: 'menu dopo la partita', passi: [CHIUDI, ['js', 'app.openStart()']] }
];

// Giri: telefono, desktop (tutte le voci) e, solo per le voci con `anche`, telefono in orizzontale e con riduzione del movimento
export const GIRI = [
  { id: 'telefono 375x812', vista: 'tel', tutte: true },
  { id: 'desktop 1280x800', vista: 'desk', tutte: true },
  { id: 'telefono in orizzontale 812x375', vista: 'orizz', anche: 'orizz' },
  { id: 'telefono con riduzione del movimento', vista: 'tel', ridotto: true, anche: 'ridotto' }
];

