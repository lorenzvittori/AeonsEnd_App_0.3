// tools/confronto/dati/indietro.mjs: il giro della prova "indietro" (strumento di confronto, CONTESTO_SVILUPPO.md sezione 9):
// menu → Nuova partita → Crea mazzo → partita → finestre una sull'altra → tasto Indietro fino al menu. Stessi passi di
// dati/schermate.mjs, più ['reg', nome] che registra dove si è (schermata, finestre, livelli aperti, messaggio) nelle due
// build: i due registri devono essere uguali. ['indietro'] manda lo stesso evento del tasto Indietro del browser.
// Per allungare il giro: altri passi in fondo (o un giro nuovo) e un ['reg', ...] dopo ogni Indietro.

const REG = nome => ['reg', nome];
const INDIETRO = ['indietro'];

export const GIRO_INDIETRO = [
  REG('menu'),
  ['js', '__c.collezioneCompleta()'],
  ['clic', '.start-home-new'], REG('Nuova partita'),
  INDIETRO, REG('Indietro dalla Nuova partita: menu'),
  ['clic', '.start-home-options'], REG('Opzioni'),
  ['js', 'app.openCollection()'], REG('La mia collezione sopra le Opzioni'),
  INDIETRO, REG('Indietro: chiusa la collezione'),
  INDIETRO, REG('Indietro: chiuse le Opzioni'),
  ['clic', '.start-home-new'],
  ['js', `[...document.querySelectorAll('.nemesis-item')][1].click();`],
  ['clic', '#start-btn'], ['aspetta', 1500], REG('Crea mazzo'),
  ['js', 'app.openSpecificViewer(1)'], REG('Crea mazzo: carte specifiche'),
  ['js', 'app.openGameSetup()'], REG('Crea mazzo: finestra sopra la finestra'),
  INDIETRO, REG('Indietro: chiusa la finestra in cima'),
  INDIETRO, REG('Indietro: chiuse le carte specifiche'),
  INDIETRO, REG('Indietro su Crea mazzo senza niente da chiudere'),
  ['aspetta', 3000],
  ['js', 'app.runDeckBuild()'], ['aspetta', 8000], REG('partita: Pesca carta turno'),
  ['js', 'app.openSideMenu()'], REG('menu laterale'),
  ['js', 'app.openStats()'], REG('statistiche sopra il menu laterale'),
  INDIETRO, REG('Indietro: chiuse le statistiche'),
  INDIETRO, REG('Indietro: chiuso il menu laterale'),
  ['js', "app.openLifeDialog('grave')"], REG('finestra della vita'),
  ['js', 'app.openDiscard()'], REG('scarti sopra la finestra della vita'),
  INDIETRO, REG('Indietro: chiuso il primo livello (la finestra)'),
  INDIETRO, REG('Indietro: chiuso il secondo livello (gli scarti)'),
  ['scenario', 'full-queue'],
  ['js', 'app.openCardDialog(app.partita.queue[0])'],
  ['js', "app.openLifeDialog('nemesis')"], REG('scheda carta e finestra della vita'),
  INDIETRO, INDIETRO, REG('Indietro due volte: tutto chiuso'),
  ['js', 'app.openTurnScreen()'], REG('mazzo dei turni'),
  INDIETRO, REG('Indietro: chiuso il mazzo dei turni'),
  ['js', 'app.openSideMenu()'],
  ['js', 'app.openStart()'], REG('menu iniziale dalla partita'),
  ['js', 'app.openTestScreen()'], REG('schermata Test'),
  INDIETRO, REG('Indietro: chiusa la schermata Test'),
  INDIETRO, REG('Indietro dal menu senza niente da chiudere')
];
