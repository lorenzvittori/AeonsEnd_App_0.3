// stato/salvataggio.ts: la partita salvata nel browser (localStorage): scrittura (scriviPartita, chiamata da save in
// stato/partita.ts dopo ogni azione) e lettura (readSave, per "Riprendi partita"), più il segno "partita già scritta"
// (statoSalvataggio.gameSaved). Il formato è in tipi/salvataggio.ts, la fotografia in regole/salvataggio.ts.
// Livello 1 (stato/). Dipende da: regole/salvataggio.ts, regole/json.ts, stato/preferenze.ts, tipi/.
// Usato da: stato/partita.ts (save), ui/ (ripresa, Nuova partita), main.ts (app.noSave), test.

import * as Salv from '../regole/salvataggio.ts';
import { parseJson } from '../regole/json.ts';
import { preferenze } from './preferenze.ts';
import type { SalvataggioValido, StatoPartita } from '../tipi/salvataggio.ts';

// Partita salvata nel browser (localStorage).
// lorenzvittori.github.io è lo stesso dominio per tutti i siti: la chiave è diversa da quella di AeonsEnd_APP
// (aeonsend-save-v1) e del suo prototipo new_design_0.2 (aeonsend-clone-save-v2), così le partite non si sovrascrivono.
export const SAVE_KEY = 'aeonsend-app-0.2-save';

// Versione del formato del salvataggio: le carte hanno gli id del DataBase; i salvataggi con un'altra versione (o
// senza) si ignorano e si cancellano
export const SAVE_VERSION = 2;

// Pagina scheletri/ (misura dell'app in un iframe): app.noSave = true e la partita salvata non cambia
export const opzioniSalvataggio = { noSave: false };

// La partita in corso è già stata scritta nel browser (gameSaved): da lì si salva sempre, anche al turno 0. Lo rimette a
// false "Nuova partita", a true la ripresa di una partita salvata
export const statoSalvataggio = { gameSaved: false };

// La partita si salva solo dal primo turno nemesi (prima, anche durante "Crea mazzo", non si scrive niente e resta
// l'eventuale partita salvata prima). Una partita già salvata (ripresa, o tornata al turno 0 con l'undo) si salva sempre.
export function scriviPartita(partita: Readonly<StatoPartita>): void {
  // Modalità test: niente salvataggio, la partita salvata vera resta com'è
  if (partita.testRun) return;
  if (opzioniSalvataggio.noSave) return;
  if (partita.turn < 1 && !statoSalvataggio.gameSaved) return;
  statoSalvataggio.gameSaved = true;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(Salv.buildSave(SAVE_VERSION, preferenze.settings, Salv.snapshotGame(partita), partita.undoStack)));
  } catch (err) {
    console.warn('Salvataggio non riuscito', err);
  }
}

// Elimina la sola partita salvata (chiamata dopo la conferma del menu iniziale): preferiti, collezione, impostazioni e
// lingua sono altre chiavi e restano
export function cancellaPartitaSalvata(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { console.warn('Partita salvata non eliminata', err); }
  statoSalvataggio.gameSaved = false;
}

export function readSave(): SalvataggioValido | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const saved = raw === null ? null : parseJson(raw);
    const check = Salv.checkSave(saved, SAVE_VERSION);
    // Salvataggio di un'altra versione (carte con gli id di prima del DataBase): si ignora e si cancella
    if (check === 'other-version') {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    if (check === 'ok' && Salv.isResumableSave(saved)) return saved;
  } catch (err) {
    console.warn('Salvataggio illeggibile', err);
  }
  return null;
}
