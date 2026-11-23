// dati/rete.ts: schermo sempre acceso, service worker, immagini del mazzo per l'uso senza rete. Provvisorio.
// Dipende da: stato/ (catalogo, partita: lettura). Usato da: ui (inizio partita), main.ts (avvio).

import { isRecord } from '../regole/json.ts';
import { partita } from '../stato/partita.ts';

// Schermo sempre acceso finché l'app è aperta e visibile (Screen Wake Lock). Il browser lo toglie da solo quando la
// pagina va in secondo piano: si richiede di nuovo al ritorno e, se il browser lo vuole dopo un tocco, al primo tocco.
export let wakeLock: WakeLockSentinel | null = null;

export async function keepScreenOn(): Promise<void> {
  if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    wakeLock = lock;
    lock.addEventListener('release', () => { wakeLock = null; });
  } catch (err) { wakeLock = null; }
}

// "Risparmio dati" del browser (navigator.connection.saveData, non ancora nei tipi standard del DOM)
function saveDataOn(): boolean {
  const connection: unknown = Reflect.get(navigator, 'connection');
  return isRecord(connection) && !!connection.saveData;
}

export async function prefetchDeckImages(): Promise<void> {
  if (!('caches' in window) || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  if (saveDataOn()) return;
  const urls = [...new Set(partita.deck.concat(partita.queue.map(e => e.data), partita.discard).flatMap(d => [d.image, d.thumb])
    .filter((u): u is string => !!u))];
  const todo: string[] = [];
  for (const u of urls) if (!(await caches.match(u))) todo.push(u);
  // Tre alla volta, per non rallentare le immagini che servono subito
  const next = async () => {
    while (todo.length) {
      const url = todo.shift();
      try { if (url) await fetch(url); } catch (err) { /* senza rete: si riprova alla prossima partita */ }
    }
  };
  await Promise.all([next(), next(), next()]);
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  document.addEventListener('visibilitychange', keepScreenOn);

  document.addEventListener('pointerdown', keepScreenOn, { passive: true });

  keepScreenOn();

  // Senza rete: il service worker (sw.js) salva codice, dati e immagini già viste. All'inizio della partita si scaricano
  // anche le immagini di tutte le carte del mazzo, così le carte pescate più avanti si vedono anche se la rete cade
  // (una volta sola: poi sono già salvate). Niente download in anticipo con "Risparmio dati" attivo.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn(err));
  }
}
