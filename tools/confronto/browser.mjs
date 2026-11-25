// tools/confronto/browser.mjs: il browser senza finestra (Playwright, Chromium) per le prove di confronto (CONTESTO_SVILUPPO.md
// sezione 9). Ogni pagina ha: caso fisso (Math.random con semente), orologio fermo (Date.now, performance.now, timer e
// requestAnimationFrame sono quelli finti di Playwright, uguali per le due build: il tempo avanza solo con aspetta()),
// niente service worker, niente rete fuori dal server locale, errori dell'app raccolti. Qui anche il piccolo linguaggio dei
// passi usato dai file di dati (dati/*.mjs): ['scenario', id], ['clic', selettore], ['js', codice], ['aspetta', ms]...
// Dipende da: playwright, pagina-lib.js. Usato da: confronta.mjs e prove/*.mjs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const LIB = readFileSync(join(import.meta.dirname, 'pagina-lib.js'), 'utf8');
export const ORA = 1700000000000;
export const SAVE_KEY = 'aeonsend-app-0.2-save';

export const VISTE = {
  tel: { width: 375, height: 812 },
  desk: { width: 1280, height: 800 },
  orizz: { width: 812, height: 375 }
};

export const avvia = () => chromium.launch();

// Messaggi che non contano come errori dell'app (il browser di prova non ha avuto un tocco: vibrate è bloccato)
const IGNORA = /vibrate|favicon/i;
// Indirizzi con la porta della build: tolta, così le due build danno lo stesso testo
const senzaPorta = t => String(t).replace(/127\.0\.0\.1:\d+/g, 'HOST');

// Pausa vera (non quella finta dell'orologio di Playwright)
const pausa = ms => new Promise(r => setTimeout(r, ms));

// Una pagina dell'app di una build. opz: { vista: 'tel'|'desk'|'orizz', ridotto, salvataggio (testo JSON), nome }
export async function apri(browser, build, opz = {}) {
  const ctx = await browser.newContext({ viewport: VISTE[opz.vista || 'tel'], serviceWorkers: 'block',
    reducedMotion: opz.ridotto ? 'reduce' : 'no-preference', deviceScaleFactor: 1, hasTouch: false, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx.route(url => !/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(url.toString()), r => r.abort());
  // Orologio fermo: parte da ORA e avanza solo con runFor (senza pauseAt scorrerebbe col tempo vero)
  await ctx.clock.install({ time: ORA - 1000 });
  await ctx.clock.pauseAt(ORA);
  await ctx.addInitScript(LIB);
  if (opz.salvataggio) await ctx.addInitScript(`try { if (!sessionStorage.getItem('__salv')) { localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(opz.salvataggio)}); sessionStorage.setItem('__salv', '1'); } } catch {}`);
  const page = await ctx.newPage();
  const errori = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORA.test(m.text())) errori.push(senzaPorta(m.text())); });
  page.on('pageerror', e => { if (!IGNORA.test(e.message)) errori.push('ECCEZIONE ' + senzaPorta(e.message)); });
  const pg = new Pagina(ctx, page, build, errori, opz);
  await pg.carica();
  return pg;
}

export class Pagina {
  constructor(ctx, page, build, errori, opz) {
    this.ctx = ctx; this.page = page; this.build = build; this.errori = errori; this.opz = opz; this.cdp = null;
  }

  async carica() {
    // opz.percorso: una pagina della build diversa dall'app (es. 'scheletri/'); opz.pronta: espressione che dice quando è pronta;
    // opz.avanza: ms di orologio finto da far passare a ogni controllo (per pagine che aspettano con i timer)
    await this.page.goto(this.build.url + (this.opz.percorso || ''), { waitUntil: 'load' });
    const pronta = this.opz.pronta || `!!(window.app && window.app.allCards && window.app.allCards.length && document.documentElement.classList.contains('ready'))`;
    // Si aspetta in tempo vero (i dati arrivano dalla rete): l'orologio finto avanza sempre della stessa quantità
    for (let i = 0; i < 200; i++) {
      if (await this.page.evaluate(pronta)) break;
      if (this.opz.avanza) await this.page.clock.runFor(this.opz.avanza);
      await pausa(50);
    }
    await this.ora(0);
    await this.assesta(1000);
  }

  // Ora fissa (Date.now) a ORA + ms, senza far scattare timer: toglie ogni dipendenza dai tempi veri
  ora(ms) { return this.page.clock.setSystemTime(ORA + ms); }

  // Pausa vera e animazioni di nuovo alla fine (vedi misuraCoppia)
  async stabilizza() {
    await pausa(120);
    await this.page.evaluate(() => window.__c.finisci());
    await pausa(30);
    await this.page.evaluate(() => window.__c.finisci());
  }
  // Il tempo va avanti (timer e animazioni dell'app), le immagini finiscono di caricarsi, le animazioni CSS vanno alla fine
  async assesta(ms = 800, profondo = false) {
    const { page } = this;
    // A pezzi: tra un pezzo e l'altro si aspetta (in tempo vero) che le immagini richieste dall'app siano arrivate, perché
    // quello che l'app fa dopo il loro arrivo (un timer) parta nel pezzo seguente e non dipenda da quanto è veloce la rete
    const immagini = async () => {
      for (let i = 0; i < 60; i++) {
        if (await page.evaluate(() => window.__c.immaginiPronte())) return;
        await pausa(50);
      }
    };
    for (let i = 0; i < 4; i++) { await immagini(); await page.clock.runFor(Math.max(50, ms / 4)); }
    await immagini();
    await page.clock.runFor(300);
    await immagini();
    await page.clock.runFor(300);
    // Profondo (passi dell'interfaccia): altre piccole attese vere, per le promesse dell'app che si risolvono in tempo vero (decodifica delle immagini)
    for (let i = 0; profondo && i < 4; i++) { await pausa(25); await immagini(); await page.clock.runFor(250); }
    await page.evaluate(() => window.__c.finisci());
    await page.clock.runFor(50);
    await page.evaluate(() => window.__c.finisci());
  }

  js(codice) { return this.page.evaluate(`(() => { ${codice} })()`); }
  // Funzione di window.__c con argomenti
  c(nome, ...args) { return this.page.evaluate(([n, a]) => window.__c[n](...a), [nome, args]); }

  async clic(sel) {
    const l = this.page.locator(sel).first();
    // force: il controllo "elemento fermo" di Playwright usa requestAnimationFrame, che qui è quello finto
    await l.click({ timeout: 4000, force: true });
  }

  // Un passo del linguaggio dei file di dati
  async passo(p) {
    const [tipo, a, b, c] = p;
    switch (tipo) {
      case 'js': await this.js(a); break;
      case 'clic': await this.clic(a); break;
      case 'scenario':
        await this.js(`const r = app.startScenario(app.SCENARI.find(s => s.id === ${JSON.stringify(a)})); if (r) throw new Error('scenario: ' + r);`);
        break;
      case 'seme': await this.c('seme', a); return;
      case 'aspetta': await this.page.clock.runFor(a); await this.page.evaluate(() => window.__c.finisci()); return;
      case 'giu': {
        const box = await this.page.locator(a).first().boundingBox();
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await this.page.mouse.down();
        if (b || c) await this.page.mouse.move(box.x + box.width / 2 + (b || 0), box.y + box.height / 2 + (c || 0), { steps: 4 });
        break;
      }
      case 'muovi': await this.page.mouse.move(a, b, { steps: 4 }); break;
      case 'su': await this.page.mouse.up(); break;
      case 'tasto': await this.page.keyboard.press(a); break;
      // Tasto Indietro: lo stesso evento che manda il browser (l'app chiude il livello in primo piano e rimette la voce in più)
      case 'indietro': await this.js("window.dispatchEvent(new PopStateEvent('popstate'))"); break;
      default: throw new Error('passo sconosciuto: ' + tipo);
    }
    // Il puntatore resta fuori dalla pagina: lo :hover sotto un puntatore fermo si aggiorna in tempo vero e cambierebbe da una misura all'altra
    if (tipo !== 'giu' && tipo !== 'muovi') await this.page.mouse.move(-20, -20);
    await this.assesta(600, true);
  }

  async passi(elenco) { for (const p of elenco) await this.passo(p); }

  misura(sel, modo = 'pieno', chiavi) { return this.page.evaluate(([s, m, k]) => window.__c.misura(s, m, k), [sel || null, modo, chiavi || null]); }

  // Misura con una pseudo-classe forzata (:hover, :active, :focus, :focus-visible) sull'elemento `sel` e i suoi discendenti
  async misuraForzata(sel, stati, modo, chiavi) {
    if (!this.cdp) {
      this.cdp = await this.ctx.newCDPSession(this.page);
      await this.cdp.send('DOM.enable');
      await this.cdp.send('CSS.enable');
    }
    const { root } = await this.cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await this.cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    if (!nodeId) return this.misura(sel, modo, chiavi);
    await this.cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: stati });
    try {
      await this.page.evaluate(() => window.__c.finisci());
      return await this.misura(sel, modo, chiavi);
    } finally {
      await this.cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
  }
  async chiudi() { await this.ctx.close(); }
}

// Due pagine, una per build, con le stesse opzioni
export async function coppia(browser, builds, opz) {
  const [a, b] = await Promise.all(builds.map(bd => apri(browser, bd, opz)));
  return { a, b, chiudi: async () => { await a.chiudi(); await b.chiudi(); } };
}

// Misura la stessa parte di pagina (`sel`, con eventuali pseudo-classi forzate) nelle due pagine e restituisce
// { prima, dopo } per diffMisure: prima si confrontano gli hash di tutti gli elementi, poi si rileggono per intero solo
// quelli che differiscono (o che esistono in una pagina sola)
export async function misuraCoppia(a, b, sel, stati) {
  const leggi = (pg, modo, chiavi) => stati ? pg.misuraForzata(sel, stati, modo, chiavi) : pg.misura(sel, modo, chiavi);
  // Una breve pausa in tempo vero: le transizioni CSS e lo :hover vanno col tempo vero e potrebbero cominciare proprio ora
  await Promise.all([a, b].map(pg => pg.stabilizza()));
  const [ha, hb] = await Promise.all([leggi(a, 'hash'), leggi(b, 'hash')]);
  const diverse = [];
  for (const k of new Set([...Object.keys(ha.voci), ...Object.keys(hb.voci)])) {
    if (!ha.voci[k] || !hb.voci[k] || ha.voci[k].h !== hb.voci[k].h) diverse.push(k);
  }
  const base = { assente: ha.assente !== hb.assente, viewport: ha.viewport.join() !== hb.viewport.join() };
  if (!diverse.length && !base.assente && !base.viewport) return null;
  const [pa, pb] = diverse.length ? [await leggi(a, 'pieno', diverse), await leggi(b, 'pieno', diverse)] : [{ ...ha, voci: {} }, { ...hb, voci: {} }];
  return { prima: pa, dopo: pb };
}




