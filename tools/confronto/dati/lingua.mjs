// tools/confronto/dati/lingua.mjs: finestre in più per la prova "lingua" (strumento di confronto, CONTESTO_SVILUPPO.md sezione 9),
// dopo il giro di dati/schermate.mjs (stessa forma delle sue voci: id, passi). Sono finestre che il giro non apre: il pannello
// Regolazioni della Modalità test (colori e misure), la conferma di uscita, i dorsi delle carte, la Nuova partita con
// un salvataggio da riprendere. Dipende da: niente. Usato da: prove/lingua.mjs.

const CHIUDI = ['js', 'app.closeAllModals(); app.closeDiscard()'];

export const PIU = [
  { id: 'Regolazioni: colori', passi: [CHIUDI, ['scenario', 'full-queue'], ['clic', '.ae-regolazioni-pulsante']] },
  { id: 'Regolazioni: misure', passi: [['clic', '.ae-reg-scheda[data-scheda="misure"]']] },
  { id: 'Regolazioni: chiuse', passi: [['clic', '.ae-reg-testa .ae-icon-button']] },
  { id: 'conferma di uscita', passi: [['js', 'app.openExitConfirm(() => {})']] },
  { id: 'dorsi delle carte', passi: [CHIUDI, ['js', 'app.openCardBackPicker(null, null)']] },
  { id: 'sfondi', passi: [CHIUDI, ['js', 'app.openBackgroundPicker(null, null)']] },
  { id: 'scarti sulla pila', passi: [CHIUDI, ['scenario', 'full-stats'], ['js', 'app.openDiscard()']] },
  { id: 'menu dopo il test', passi: [CHIUDI, ['js', 'app.openStart()']] },
  { id: 'Opzioni (lingua)', passi: [['clic', '.start-home-options']] }
];
