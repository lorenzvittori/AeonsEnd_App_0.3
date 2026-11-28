// ui/finestre/menu-laterale-tempo.ts: tempo di gioco mostrato nel menu laterale. Conta solo mentre la partita è in corso e la pagina
// è visibile (le pause con l'app chiusa o in secondo piano non contano). Il totale si salva nel browser, legato all'ora
// di inizio della partita: la ripresa continua da dove era, una partita nuova riparte da zero. Non passa per l'undo.
// Livello 4 (ui/finestre/). Dipende da: stato/partita.ts (lettura). Usato da: menu-laterale.ts.

import { partita } from '../../stato/partita.ts';

const CHIAVE = 'ae-tempo-partita';

let inizio: number | null = null; // ora di inizio della partita a cui si riferisce `base`
let base = 0;                     // millisecondi già contati (salvati)
let da: number | null = null;     // istante da cui si sta contando adesso (null: in pausa)
let avviato = false;

function leggiSalvato(): { inizio: number; ms: number } | null {
  try {
    const raw = localStorage.getItem(CHIAVE);
    if (!raw) return null;
    const v = JSON.parse(raw) as { inizio?: unknown; ms?: unknown };
    return typeof v.inizio === 'number' && typeof v.ms === 'number' ? { inizio: v.inizio, ms: v.ms } : null;
  } catch {
    return null; // storage non disponibile: si riparte da zero
  }
}

function scrivi(): void {
  try {
    if (inizio !== null) localStorage.setItem(CHIAVE, JSON.stringify({ inizio, ms: base }));
  } catch {
    /* storage non disponibile: il tempo resta in memoria */
  }
}

// Se la partita è un'altra (nuova o ripresa) il conteggio si allinea alla sua ora di inizio
function allinea(): void {
  const s = partita.stats.startedAt;
  if (s === inizio) return;
  inizio = s;
  base = 0;
  da = null;
  if (s !== null) {
    const salvato = leggiSalvato();
    if (salvato && salvato.inizio === s) base = salvato.ms;
  }
}

// Conta solo con partita in corso (non finita) e pagina visibile; passa da attivo a pausa salvando il totale
function aggiorna(): void {
  allinea();
  const deveContare = typeof document === 'undefined' || document.visibilityState !== 'hidden'
    ? inizio !== null && !partita.stats.endedAt
    : false;
  if (deveContare && da === null) da = Date.now();
  if (!deveContare && da !== null) {
    base += Date.now() - da;
    da = null;
    scrivi();
  }
}

// Avvio all'apertura dell'app: ascolta la visibilità della pagina (una volta sola)
export function avviaTempoPartita(): void {
  if (avviato) return;
  avviato = true;
  document.addEventListener('visibilitychange', aggiorna);
  window.addEventListener('pagehide', () => { aggiorna(); if (da !== null) { base += Date.now() - da; da = null; scrivi(); } });
  aggiorna();
}

// Millisecondi di gioco fin qui
export function tempoPartita(): number {
  aggiorna();
  return base + (da !== null ? Date.now() - da : 0);
}

// Formato HH:MM:SS (le ore possono superare 99)
export function formatoOrologio(ms: number): string {
  const tot = Math.floor(Math.max(0, ms) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(tot / 3600))}:${p(Math.floor((tot % 3600) / 60))}:${p(tot % 60)}`;
}
