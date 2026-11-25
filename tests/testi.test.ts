// I dizionari dei testi (src/ui/testi-it.ts, src/ui/testi-en.ts): stesse chiavi e stessa forma, nessun valore vuoto, le
// funzioni restituiscono una stringa (anche per 0, 1 e 2: singolare e plurale), i testi fissi di index.html hanno una
// chiave in tutte le lingue. Il tipo Testi (testi-en.ts è scritto come `Testi`) fa già fallire tsc se una chiave manca; qui
// si controllano le cose che i tipi non vedono.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DIZIONARI, applicaTestiFissi, testoDi } from '../src/ui/testi.ts';
import type { Testi } from '../src/ui/testi.ts';
import { LINGUE } from '../src/stato/preferenze.ts';

// Forma di un valore: chiavi (ordinate), tipo, numero di parametri delle funzioni
function forma(v: unknown): unknown {
  if (typeof v === 'function') return `funzione/${v.length}`;
  if (Array.isArray(v)) return v.map(forma);
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, forma(Reflect.get(v, k))]));
  return typeof v;
}

// Tutti i testi di un valore (percorso e stringa); le funzioni si chiamano con n per ogni parametro
function testiDi(v: unknown, percorso: string, n: number, out: { percorso: string; testo: string }[] = []): { percorso: string; testo: string }[] {
  if (typeof v === 'string') out.push({ percorso, testo: v });
  else if (typeof v === 'function') {
    // Con numeri (singolare e plurale) e con un testo (nomi): restituisce sempre una stringa
    for (const arg of [n, 'Nome']) {
      const argomenti = Array.from({ length: v.length }, () => arg);
      const r: unknown = v(...argomenti);
      const testo = typeof r === 'string' ? r : typeof r === 'number' ? String(r) : '';
      expect(testo, `${percorso}(${argomenti.join(', ')}) restituisce una stringa`).not.toBe('');
      out.push({ percorso: `${percorso}(${argomenti.join(', ')})`, testo });
    }
  } else if (Array.isArray(v)) v.forEach((x, i) => testiDi(x, `${percorso}[${i}]`, n, out));
  else if (v !== null && typeof v === 'object') for (const k of Object.keys(v)) testiDi(Reflect.get(v, k), `${percorso}.${k}`, n, out);
  else expect.fail(`${percorso}: valore non ammesso (${typeof v})`);
  return out;
}

describe('dizionari dei testi', () => {
  it('ogni lingua preferita ha il suo dizionario', () => {
    expect(Object.keys(DIZIONARI).sort()).toEqual([...LINGUE].sort());
  });

  it('italiano e inglese hanno le stesse chiavi, della stessa forma (funzioni con gli stessi parametri)', () => {
    expect(forma(DIZIONARI.en)).toEqual(forma(DIZIONARI.it));
  });

  it.each(LINGUE)('(%s) nessun valore vuoto e nessun "undefined": le funzioni danno una stringa per 0, 1 e 2', lingua => {
    for (const n of [0, 1, 2]) {
      for (const { percorso, testo } of testiDi(DIZIONARI[lingua], 'T', n)) {
        expect(testo.trim(), `${percorso} è vuoto`).not.toBe('');
        // (con "Nome" al posto di un numero NaN è normale: il controllo vale per le chiamate con i numeri)
        expect(testo, `${percorso} contiene undefined`).not.toMatch(/undefined|\[object/);
        if (!percorso.includes('(Nome')) expect(testo, `${percorso} contiene NaN`).not.toMatch(/NaN/);
      }
    }
  });

  it('singolare e plurale: 1 e 2 danno testi diversi dove il conto conta', () => {
    for (const lingua of LINGUE) {
      const T = DIZIONARI[lingua];
      expect(T.players(1), lingua).not.toBe(T.players(2));
      expect(T.tokens(1), lingua).not.toBe(T.tokens(2));
      expect(T.minionTurns(1), lingua).not.toBe(T.minionTurns(2));
      expect(T.collectionSummary(1, 1), lingua).not.toBe(T.collectionSummary(2, 2));
      expect(T.deckLabel(1), lingua).not.toBe(T.deckLabel(2));
    }
  });

  it('inglese: niente parole né lettere italiane rimaste', () => {
    const italiano = /[àèéìòù]|\b(carta|carte|turno|turni|nemesi|giocatore|giocatori|mazzo|partita|vita|scarti|annulla|chiudi|esci|salva|vittoria|sconfitta|pesca|opzioni|riprova|riprendi|nessuna|nessun)\b/i;
    // Le scritte uguali nelle due lingue di proposito (il nome della voce Lingua / Language, i nomi propri) non contano
    for (const { percorso, testo } of testiDi(DIZIONARI.en, 'T', 2)) {
      if (percorso.startsWith('T.language')) continue;
      expect(testo, percorso).not.toMatch(italiano);
    }
  });
});

describe('testi fissi di index.html', () => {
  const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
  const chiavi = [...html.matchAll(/data-testo(?:-aria|-title)?="([^"]+)"/g)].map(m => m[1]);

  it('ci sono, e ogni chiave è una scritta fissa in tutte le lingue', () => {
    expect(chiavi.length).toBeGreaterThan(10);
    for (const lingua of LINGUE) {
      for (const k of chiavi) expect(testoDi(DIZIONARI[lingua], k), `${lingua}: ${k}`).toBeTypeOf('string');
    }
  });

  it('nessun testo scritto a mano tra i tag (a parte il nome del gioco)', () => {
    const senzaCommenti = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    const testi = [...senzaCommenti.matchAll(/>([^<>]*[A-Za-zàèéìòù]{3}[^<>]*)</g)].map(m => m[1].trim()).filter(Boolean);
    expect(testi.filter(t => !/^(Aeons End App|Aeon's End|Nemesis Companion)/.test(t))).toEqual([]);
    // Neppure negli attributi di testo (aria-label, title, alt, placeholder) senza la chiave
    expect([...senzaCommenti.matchAll(/\s(aria-label|title|alt|placeholder)="([^"]+)"/g)].map(m => m[0].trim())).toEqual([]);
  });

  it('applicaTestiFissi scrive testo e attributi, e lascia stare le chiavi che non sono scritte fisse', () => {
    const scritti: Record<string, string> = {};
    const elemento = (attrs: Record<string, string>) => ({
      getAttribute: (n: string) => attrs[n] ?? null,
      setAttribute: (n: string, v: string) => { scritti[n + '@' + (attrs['data-testo'] ?? attrs['data-testo-aria'] ?? attrs['data-testo-title'])] = v; },
      set textContent(v: string) { scritti['testo@' + attrs['data-testo']] = v; }
    });
    const per: Record<string, unknown[]> = {
      '[data-testo]': [elemento({ 'data-testo': 'close' }), elemento({ 'data-testo': 'discardTitle' })],
      '[data-testo-aria]': [elemento({ 'data-testo-aria': 'menu' })],
      '[data-testo-title]': [elemento({ 'data-testo-title': 'cancel' })]
    };
    const radice = { querySelectorAll: (s: string) => per[s] ?? [] } as unknown as ParentNode;
    const T: Testi = DIZIONARI.en;
    applicaTestiFissi(radice, T);
    expect(scritti['testo@close']).toBe(T.close);
    expect(scritti['aria-label@menu']).toBe(T.menu);
    expect(scritti['title@cancel']).toBe(T.cancel);
    expect(scritti['testo@discardTitle']).toBeUndefined();
  });
});
