// ui/partita-variante.ts: il momento della schermata "partita" (giocatori, nemesi, pesca, crea-mazzo) e le sue
// varianti (variantePartita): se c'è la zona 6, testo e azione dell'unico pulsante della zona 7, come si comportano le
// carte grandi della zona 5. Funzione pura: riceve la partita e lo stato dell'interfaccia e non tocca niente (provata in
// tests/partita-variante.test.ts). Le zone e il loro disegno sono in index.html e ui/schermate/partita.css.
// Livello 2 (ui/ base). Dipende da: regole/ (mazzo-turni, turno-nemesi), tipi/, ui/testi.ts, ui/pagina.ts (DRAW_UID e
// tipo dello stato dell'interfaccia). Usato da: navigazione (render), ui/componenti/pulsante-principale.ts,
// turno-nemesi-carosello.ts, test.

import { awaitingTurnCard, turnRoundOver } from '../regole/mazzo-turni.ts';
import { hpUnset, isDrawStep } from '../regole/turno-nemesi.ts';
import type { Partita, VoceInGioco } from '../tipi/partita.ts';
import { DRAW_UID } from './pagina.ts';
import type { StatoUi } from './pagina.ts';
import { T } from './testi.ts';

// Momento della partita (attributo data-turno della schermata, #app):
//   giocatori:  turno dei giocatori (coda delle carte grandi, comandi sotto la carta al centro);
//   nemesi:     turno nemesi, carte da risolvere (carosello);
//   pesca:      turno nemesi, passo Pesca (carta coperta da girare);
//   crea-mazzo: prima del primo turno giocatori, i 9 mazzi da cui nasce il mazzo nemesi (cursore al posto del pulsante)
export type MomentoPartita = 'giocatori' | 'nemesi' | 'pesca' | 'crea-mazzo';

// Azione dell'unico pulsante della zona 7 ("principale")
export type AzionePrincipale =
  | 'cursore'            // "Crea mazzo": il pulsante non c'è, al suo posto il cursore
  | 'salva-modifiche'    // turno giocatori con modifiche non salvate
  | 'pesca-carta-turno'  // turno giocatori in attesa della carta del mazzo dei turni
  | 'fine-turno'         // turno giocatori: fine del turno del giocatore
  | 'risolvi'            // turno nemesi: risolve la carta di turno (o la mette in gioco, o imposta la vita)
  | 'pesca'              // turno nemesi, passo Pesca: gira la carta coperta
  | 'torna';             // turno nemesi, si guarda un'altra carta: torna alla carta da risolvere (o da pescare)

// Come si comporta la zona 5 ("carte-grandi"): stesso contenitore, stessa posizione
//   coda:          scorrimento libero, il tocco sulla carta al centro apre la sua scheda (turno giocatori, crea-mazzo);
//   carosello:     si ferma su ogni carta, il pulsante risolve la carta di turno (turno nemesi);
//   carta-coperta: la carta da pescare, da girare (passo Pesca)
export type CarteGrandi = 'coda' | 'carosello' | 'carta-coperta';

// Il momento e le sue varianti
export interface VariantePartita {
  momento: MomentoPartita;
  interattivi: boolean;          // zona 6 presente (comandi della carta al centro): solo turno giocatori e crea-mazzo
  carteGrandi: CarteGrandi;      // comportamento della zona 5
  azione: AzionePrincipale;      // azione del pulsante della zona 7
  testo: string;                 // testo del pulsante della zona 7
  annullaModifiche: boolean;     // "Annulla modifiche" accanto al pulsante (modifiche non salvate, non in crea-mazzo)
}

// Cosa serve della partita e dell'interfaccia (solo lettura)
export type PartitaPerVariante = Pick<Partita, 'resolving' | 'newIndex' | 'currentIndex' | 'queue' | 'turnOrder'>;
export type UiPerVariante = Pick<StatoUi, 'deckBuilding' | 'drafts' | 'trackShuffle' | 'viewedUid' | 'holdUid'>;

// Testo del pulsante per la carta da risolvere. Anche sull'ultima carta si va solo avanti: la pesca è un passo a parte,
// con il pulsante "Pesca".
export function actionText(entry: VoceInGioco, isNew: boolean, roundOver: boolean): string {
  const { data, tokens } = entry;
  // Minion con vita "?": non si mette in gioco finché non si imposta la vita; il pulsante apre la sua scheda
  if (hpUnset(entry)) return T.ctaSetHp;
  // Ultima carta del giro dei turni: "Metti in gioco · Mischia mazzo"
  if (isNew) return data.type === 'Attack' ? T.ctaResolved
    : roundOver ? T.ctaPutInPlayShuffle : T.ctaPutInPlayEnd;
  // Potere: il token se ne va da solo; il pulsante dice solo cosa succede dopo (Number: null vale 0)
  if (data.type === 'Power') return Number(tokens) > 1 ? T.ctaPowerNext : T.ctaPowerLast;
  // Minion (resta in gioco) e attacco (va negli scarti)
  return T.ctaResolved;
}

// Turno nemesi: si sta guardando una carta diversa da quella da risolvere (o da pescare)? Stessa scelta della carta
// mostrata del carosello (turno-nemesi-carosello.ts, renderResolve)
export function inAnteprima(p: PartitaPerVariante, u: UiPerVariante): boolean {
  if (u.holdUid) return false;
  const drawStep = isDrawStep(p);
  const active = p.queue[p.currentIndex] || null;
  const viewedUid = u.holdUid || u.viewedUid;
  const byUid = viewedUid === null ? null : p.queue.find(e => e.uid === viewedUid) || null;
  const viewed = (viewedUid === DRAW_UID && drawStep) ? null : (byUid || active);
  const viewingDraw = drawStep && !viewed;
  return drawStep ? !viewingDraw : viewed !== active;
}

// Il momento della partita e le sue varianti
export function variantePartita(p: PartitaPerVariante, u: UiPerVariante): VariantePartita {
  if (p.resolving) {
    const drawStep = isDrawStep(p);
    const active = p.queue[p.currentIndex] || null;
    const momento: MomentoPartita = drawStep ? 'pesca' : 'nemesi';
    const carteGrandi: CarteGrandi = drawStep ? 'carta-coperta' : 'carosello';
    if (inAnteprima(p, u)) {
      return { momento, interattivi: false, carteGrandi, azione: 'torna',
        testo: drawStep ? T.backToDraw : T.backToActive, annullaModifiche: false };
    }
    const testo = drawStep || !active ? T.ctaDraw : actionText(active, p.newIndex >= 0, turnRoundOver(p.turnOrder));
    return { momento, interattivi: false, carteGrandi, azione: drawStep ? 'pesca' : 'risolvi', testo, annullaModifiche: false };
  }
  // Turno giocatori (e "Crea mazzo", che ha la stessa disposizione con il cursore al posto del pulsante)
  const saving = u.drafts.size > 0;
  const awaiting = awaitingTurnCard(p.turnOrder, p.resolving);
  // A inizio giro (dopo il primo) "Pesca la prima carta turno"; all'ultimo turno del giro "Fine turno · Mischia mazzo"
  // (anche durante l'animazione del mazzo mischiato)
  const testo = saving ? T.saveChanges
    : u.trackShuffle ? T.endTurnShuffle
    : awaiting ? (p.turnOrder.round >= 1 && !(p.turnOrder.history || []).length ? T.drawFirstTurnCard : T.drawTurnCard)
    : turnRoundOver(p.turnOrder) ? T.endTurnShuffle : T.endTurn;
  if (u.deckBuilding) {
    return { momento: 'crea-mazzo', interattivi: true, carteGrandi: 'coda', azione: 'cursore', testo, annullaModifiche: false };
  }
  const azione: AzionePrincipale = saving ? 'salva-modifiche' : awaiting ? 'pesca-carta-turno' : 'fine-turno';
  return { momento: 'giocatori', interattivi: true, carteGrandi: 'coda', azione, testo, annullaModifiche: saving };
}
