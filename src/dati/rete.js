// dati/rete.js: Schermo sempre acceso, service worker, immagini per l'uso senza rete. Provvisorio.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../stato/condivise.js';

// Schermo sempre acceso finché l'app è aperta e visibile (Screen Wake Lock). Il browser lo toglie da solo quando la
// pagina va in secondo piano: si richiede di nuovo al ritorno e, se il browser lo vuole dopo un tocco, al primo tocco.
export let wakeLock = null;

export async function keepScreenOn() {
  if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (err) { wakeLock = null; }
}

export async function prefetchDeckImages() {
  if (!('caches' in window) || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  if (navigator.connection && navigator.connection.saveData) return;
  const urls = [...new Set(G.deck.concat(G.queue.map(e => e.data), G.discard).flatMap(d => [d.image, d.thumb]).filter(Boolean))];
  const todo = [];
  for (const u of urls) if (!(await caches.match(u))) todo.push(u);
  // Tre alla volta, per non rallentare le immagini che servono subito
  const next = async () => {
    while (todo.length) {
      try { await fetch(todo.shift()); } catch (err) { /* senza rete: si riprova alla prossima partita */ }
    }
  };
  await Promise.all([next(), next(), next()]);
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
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
