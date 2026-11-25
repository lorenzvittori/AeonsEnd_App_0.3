// tools/confronto/dati/partite.mjs: le partite della prova "partite" (strumento di confronto, CONTESTO_SVILUPPO.md sezione 9).
// Per aggiungerne una: un oggetto in più nell'elenco.
//   id         nome nell'esito
//   nemesi     nome della nemesi (come in nemesis.json)
//   giocatori  2, 3 o 4
//   via        'api' (scelte impostate nello stato) oppure 'ui' (dalla pagina Nuova partita con i clic veri: wave spuntata nel
//              menu delle wave, nemesi nell'elenco, giocatori, Inizia partita, Crea mazzo)
//   onda       solo con via 'ui': la wave da spuntare ("IV" per Maggoth); si tolgono le altre
//   seme       punto di partenza del caso (a ogni passo si riparte da seme + numero del passo)
//   passi      quante azioni giocare (poi si prosegue fino al turno giocatori)
//   undo       numeri dei passi dopo i quali si preme Undo (due Undo di fila se il numero è ripetuto)
//   ripresa    dopo questo passo (nel turno giocatori) la pagina si ricarica e la partita si riprende dal salvataggio
export const PARTITE = [
  { id: 'Maggoth 2 giocatori (UI, wave IV spuntata)', nemesi: 'Maggoth', giocatori: 2, via: 'ui', onda: 'IV', seme: 11, passi: 70, undo: [12, 13, 40], ripresa: 30 },
  { id: 'Maggoth 4 giocatori', nemesi: 'Maggoth', giocatori: 4, via: 'api', seme: 21, passi: 90, undo: [25, 60], ripresa: 45 },
  { id: 'Carapace Queen 3 giocatori', nemesi: 'Carapace Queen', giocatori: 3, via: 'api', seme: 5, passi: 70, undo: [18, 19, 50], ripresa: 33 },
  { id: 'Rageborne 2 giocatori', nemesi: 'Rageborne', giocatori: 2, via: 'api', seme: 3, passi: 60, undo: [20, 41], ripresa: 28 },
  { id: 'Fenrix 4 giocatori', nemesi: 'Fenrix', giocatori: 4, via: 'api', seme: 31, passi: 80, undo: [15, 16, 55], ripresa: 36 },
  { id: 'The Wailing 3 giocatori', nemesi: 'The Wailing', giocatori: 3, via: 'api', seme: 27, passi: 80, undo: [30, 62], ripresa: 40 },
  { id: 'Crooked Mask 2 giocatori', nemesi: 'Crooked Mask', giocatori: 2, via: 'api', seme: 9, passi: 60, undo: [14, 35], ripresa: 22 }
];
