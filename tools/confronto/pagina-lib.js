// tools/confronto/pagina-lib.js: codice iniettato in ogni pagina delle due build prima dell'app (strumento di confronto,
// CONTESTO_SVILUPPO.md sezione 9). Definisce window.__c: caso fisso (Math.random con semente), animazioni portate alla
// fine, misura di tutti gli elementi visibili (stile calcolato, posizione, testo, attributi) e i passi di gioco delle
// prove "partite". Le prove usano window.app: se un nome cambia in una fase futura, si aggiorna qui e in dati/.
// Non è l'app: non entra nella build. Dipende da: window.app (src/main.ts). Usato da: browser.mjs.

(() => {
  // Caso fisso (mulberry32, lo stesso di tests/aiuto.ts); a ogni passo delle prove si riparte da una semente nota
  let s = 1;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const C = window.__c = {};
  // Scorrimenti sempre immediati (uno scorrimento morbido in corso cambierebbe le posizioni da una misura all'altra)
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '*, *::before, *::after { scroll-behavior: auto !important; }';
    document.head.append(st);
  });
  C.seme = n => { s = n >>> 0; };

  // Immagini caricate dall'app con new Image() (non stanno nella pagina): si tengono d'occhio finché non sono arrivate
  const inArrivo = new Set();
  const descr = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descr, set(v) {
    descr.set.call(this, v);
    if (this.complete) return;
    inArrivo.add(this);
    const fine = () => inArrivo.delete(this);
    this.addEventListener('load', fine, { once: true });
    this.addEventListener('error', fine, { once: true });
  } });
  C.immaginiPronte = () => inArrivo.size === 0 && [...document.images].every(im => im.complete);

  // Animazioni e transizioni portate alla fine (quelle infinite vengono annullate)
  C.finisci = () => {
    for (let i = 0; i < 3; i++) {
      document.getAnimations().forEach(a => { try { a.finish(); } catch { a.cancel(); } });
    }
  };

  // Per tools/screenshot/: la scritta Tier si ferma a metà della sua animazione (finisci() la porterebbe a opacità 0: sparita), tutto il resto va alla fine
  C.fermaBanner = () => {
    const suoi = new Set([...document.querySelectorAll('.ae-tier-banner, .ae-tier-banner *')].flatMap(e => e.getAnimations()));
    document.getAnimations().forEach(a => {
      if (suoi.has(a)) { a.pause(); a.currentTime = 700; return; }
      try { a.finish(); } catch { a.cancel(); }
    });
    return suoi.size;
  };

  // --- Misura ---
  const SALTA = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META', 'TITLE', 'HEAD', 'BASE']);
  const ATTR = /^(aria-|data-|role$|title$|alt$|src$|href$|placeholder$|disabled$|hidden$|tabindex$|type$|value$|inert$)/;
  const tag = e => e.tagName.toLowerCase();
  // Chiave: posizione (stabile se cambia una classe); etichetta: selettore leggibile con le classi
  function percorso(el) {
    const chiave = [];
    const lab = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.id) { chiave.unshift('#' + e.id); lab.unshift('#' + e.id); break; }
      if (e === document.documentElement) { chiave.unshift('html'); lab.unshift('html'); break; }
      const i = e.parentElement ? [...e.parentElement.children].indexOf(e) + 1 : 1;
      chiave.unshift(tag(e) + ':nth-child(' + i + ')');
      const cls = [...e.classList].slice(0, 3).map(c => '.' + c).join('');
      lab.unshift(tag(e) + cls + ':nth-child(' + i + ')');
    }
    return { chiave: chiave.join(' > '), lab: lab.join(' > ') };
  }
  const testoProprio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
  const r2 = n => Math.round(n * 100) / 100;

  // Hash di un testo (due FNV-1a a 32 bit con semi diversi, scritti di seguito): per confrontare le pagine senza trasferire
  // tutti i valori; solo gli elementi che differiscono si rileggono per intero
  function hash(t) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
  }

  // Misura gli elementi sotto `sel` (la prima corrispondenza; senza sel tutta la pagina).
  // modo 'hash': { viewport, voci: { chiave: { l: etichetta, h: hash } } }
  // modo 'pieno' (con `chiavi`: solo quegli elementi): { nomi: [proprietà CSS], viewport, voci: { chiave: { l: etichetta,
  //   v: 'valori|…', r: 'x,y,w,h', t: testo, a: {attributi}, p: {pseudo-elemento: 'valori|…'} } } }
  C.misura = (sel, modo, chiavi) => {
    C.finisci();
    const radice = sel ? document.querySelector(sel) : document.documentElement;
    const out = { nomi: [], viewport: [innerWidth, innerHeight], voci: {} };
    if (!radice) { out.assente = sel; return out; }
    const scelti = chiavi ? new Set(chiavi) : null;
    const tutti = [radice, ...radice.querySelectorAll('*')];
    for (const e of tutti) {
      if (SALTA.has(e.tagName) || e.closest('svg') && e.tagName.toLowerCase() === 'title') continue;
      const { chiave, lab } = percorso(e);
      if (scelti && !scelti.has(chiave)) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none') continue;
      if (e.getClientRects().length === 0 && cs.display !== 'contents') continue;
      // Solo le proprietà vere: le variabili CSS (--x) compaiono nell'elenco solo su alcuni elementi, e il loro effetto si vede già nelle proprietà che le usano
      if (!out.nomi.length) out.nomi = [...cs].filter(n => !n.startsWith('--'));
      const r = e.getBoundingClientRect();
      const a = {};
      // data-testo* è solo il marcatore che dice da quale chiave del dizionario viene il testo: il testo si confronta lo stesso
      for (const at of e.attributes) if (ATTR.test(at.name) && !at.name.startsWith('data-testo')) a[at.name] = at.value;
      const voce = { l: lab, v: out.nomi.map(n => cs.getPropertyValue(n)).join('\u0001'), r: [r.x, r.y, r.width, r.height].map(r2).join(','),
        t: testoProprio(e), a };
      for (const ps of ['::before', '::after']) {
        const pc = getComputedStyle(e, ps);
        if (pc.content && pc.content !== 'none' && pc.content !== 'normal') {
          (voce.p = voce.p || {})[ps] = out.nomi.map(n => pc.getPropertyValue(n)).join('\u0001');
        }
      }
      out.voci[chiave] = modo === 'hash' ? { l: lab, h: hash(JSON.stringify([voce.v, voce.r, voce.t, voce.a, voce.p]).replace(/127\.0\.0\.1:\d+/g, 'HOST').replace(/-[A-Za-z0-9_-]{8}\.(png|webp|svg|jpg|jpeg|woff2?|ttf|gif)/g, '.$1')) } : voce;
    }
    return out;
  };
  // --- Lingua (prova "lingua") ---
  // Per ogni elemento visibile con del testo: il testo, quante righe occupa, se esce dal suo box (scrollWidth > clientWidth,
  // senza scorrimento previsto) o dallo schermo; gli attributi di testo (aria-label, title, alt, placeholder); e i testi
  // sbagliati ("undefined", "NaN", "[object", "null"). La prova li confronta tra italiano e inglese.
  const ATTR_TESTO = ['aria-label', 'title', 'alt', 'placeholder'];
  const SBAGLIATO = /\bundefined\b|\bNaN\b|\[object|\bnull\b/;
  const righe = e => {
    const cime = new Set();
    for (const n of e.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) if (q.width > 0) cime.add(Math.round(q.top / 4));
    }
    return cime.size;
  };
  C.lingua = () => {
    C.finisci();
    const out = { viewport: [innerWidth, innerHeight], voci: {}, brutti: [] };
    for (const e of document.documentElement.querySelectorAll('*')) {
      if (SALTA.has(e.tagName) || e.closest('svg')) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || e.getClientRects().length === 0) continue;
      const { chiave, lab } = percorso(e);
      const t = testoProprio(e);
      const a = {};
      for (const n of ATTR_TESTO) if (e.hasAttribute(n)) a[n] = e.getAttribute(n);
      const voce = { l: lab, t, a };
      if (t) {
        voce.righe = righe(e);
        voce.bottone = !!e.closest('button, [role=button], .ae-button, .ae-text-button');
        const r = e.getBoundingClientRect();
        const scorre = /auto|scroll/.test(cs.overflowX);
        if (cs.display !== 'inline' && !scorre && e.scrollWidth > e.clientWidth + 1) voce.esce = e.scrollWidth + ' > ' + e.clientWidth;
        if (r.right > innerWidth + 1 || r.left < -1) voce.fuori = Math.round(r.left) + '..' + Math.round(r.right);
      }
      if (SBAGLIATO.test([t, ...Object.values(a)].join(' '))) out.brutti.push(lab + ': ' + [t, ...Object.values(a)].join(' | '));
      out.voci[chiave] = voce;
    }
    return out;
  };
  // --- Partite ---
  const app = () => window.app;
  const must = (v, che) => { if (v == null) throw new Error('manca: ' + che); return v; };
  // Testo di un elemento per id (le versioni più vecchie possono non averlo: allora vuoto)
  const testo = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : ''; };
  C.vista = () => ({ turno: app().app.dataset.turno || null, pulsante: testo('pulsante-principale'), fase: testo('phase-label'),
    start: !app().startLayer.hidden, modali: app().modals.length,
    // carta mostrata e carta da risolvere (uid): se differiscono dopo un'azione, l'app mostra un'anteprima senza che nessuno l'abbia chiesta
    carta: (() => { const p = app().partita; const act = p.queue[p.currentIndex]; return app().ui.viewedUid + '/' + (act ? act.uid : ''); })() });
  C.registro = () => JSON.stringify({ stato: app().snapshot(), vista: C.vista() });

  // Collezione completa e scelte, senza passare dalle schermate (per le partite scritte come sequenze di azioni)
  C.avviaApi = (giocatori, nemesi) => {
    const a = app();
    a.collection = new Set(Object.keys(a.products));
    a.settings = { players: giocatori, nemesis: nemesi, battleMode: true, mergeCollection: true };
    a.nuovaPartita();
    a.ui.deckBuilding = false;
    a.ui.deckShown = null;
    a.ui.deckDark = false;
    a.closeStart();
    a.render();
  };
  // Collezione completa (prima di aprire la pagina Nuova partita)
  C.collezioneCompleta = () => {
    const a = app();
    a.collection = new Set(Object.keys(a.products));
    a.saveCollection();
    a.aggiornaInizio();
  };

  // Un passo di gioco con le azioni del modulo della partita (come i tocchi dell'app; stessa politica di tests/partita.test.ts)
  // uccidi: il minion da risolvere (sempre se appena pescato, altrimenti a ogni quarto passo) si porta a 0 dalla scheda
  C.passo = (i, uccidi) => {
    const a = app();
    const p = a.partita;
    let az;
    // Il pulsante principale vero (come il tocco di chi gioca): così passano da dove passa l'app (la carta mostrata si aggiorna)
    const clicca = () => { C.finisci(); document.getElementById('pulsante-principale').click(); };
    // Finestra "Pesca nuovo turno" (versioni nuove; in quelle vecchie non c'è): si pesca toccando il dorso, poi si chiude toccando fuori
    const pescaDallaFinestra = () => {
      const w = document.querySelector('.ae-draw-turn');
      if (!w) return;
      const stage = w.querySelector('.ae-draw-turn-stage');
      if (stage && !stage.disabled) stage.click();
      if (w.parentElement) w.parentElement.click();
    };
    if (a.awaitingTurnCard()) { if (!document.querySelector('.ae-draw-turn')) clicca(); pescaDallaFinestra(); az = 'pesca carta turno'; }
    else if (!p.resolving) {
      const cur = a.currentTurn();
      const m = p.queue.find(e => e.data.type === 'Minion' && !a.hpUnset(e) && Number(e.hp) > 0);
      if (cur && a.isPairCard(cur.kind) && !cur.player) { a.scegliGiocatoreCoppia(a.pairOptions(cur.kind)[i % 2]); az = 'scelta'; }
      else if (i % 3 === 0 && m) { a.salvaModifiche(new Map([[m.uid, { hp: Number(m.hp) - 1 }]])); az = 'salva modifiche'; }
      else if (i % 7 === 0 && p.deck.length > 2) { a.scartaCimaDelMazzo(); az = 'scarta dal mazzo'; }
      else { clicca(); az = 'fine turno'; }
    } else if (a.isDrawStep(p)) { clicca(); az = 'pesca'; }
    else {
      const c = must(p.queue[p.currentIndex], 'carta da risolvere');
      if (a.hpUnset(c)) { a.cambiaVitaMinion(c, 5, true); az = 'vita'; }
      else if (uccidi && c.data.type === 'Minion' && (p.newIndex >= 0 || i % 4 === 0)) { a.cambiaVitaMinion(c, 0, false); az = 'minion ucciso'; }
      else if (i % 5 === 0) { a.cambiaVita('nemesis', Math.max(0, p.nemesisLife - 2)); az = 'vita nemesi'; }
      else { clicca(); az = 'risolvi'; }
    }
    a.render();
    return az;
  };
  C.undo = () => { app().undo(); app().render(); return 'undo'; };
  C.alPassoPesca = () => { const p = app().partita; return p.resolving && p.queue.length > 0 && app().isDrawStep(p); };
  C.inTurnoGiocatori = () => !app().partita.resolving;
  C.finita = () => app().partita.deck.length === 0 && app().isVictory();
})();




