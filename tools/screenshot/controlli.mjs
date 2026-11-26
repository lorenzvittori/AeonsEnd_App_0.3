// tools/screenshot/controlli.mjs: i controlli di tools/screenshot/ su ogni screenshot (tools/screenshot/README.md).
// controllaStato: la pagina è nello stato giusto (voce.atteso, in dati/schermate.mjs). controllaImmagine: l'immagine non è vuota né nera
// e ha le misure giuste. Ognuna restituisce l'elenco dei guasti (vuoto = tutto bene). Dipende da: tools/confronto/browser.mjs (Pagina).

// Voci di `atteso` (dati/schermate.mjs):
//   '.selettore' / '#id' / '[attributo]'  un elemento visibile, con una misura
//   'chiave'                               il testo T.chiave (dizionario dell'app, nella lingua in uso) compare nella pagina
//   ['pulsante', 'chiave']                 il pulsante principale contiene T.chiave
//   ['testo', '.selettore', 'valore']      un elemento visibile con quel selettore che dice esattamente `valore` (un numero, per esempio)
//   ['assente', '.selettore']              nessun elemento visibile con quel selettore
const IN_PAGINA = `
  const visibile = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]'); };
  const testo = chiave => { const v = app.T[chiave]; return typeof v === 'string' ? v : null; };
  // Maiuscole (text-transform dei CSS) e spazi (anche quelli che non vanno a capo) non contano
  const norm = t => String(t).replace(/\\s+/g, ' ').trim().toLowerCase();
  const pagina = norm(document.body.innerText);
  const ora = [];
  for (const voce of ATTESO) {
    if (Array.isArray(voce) && voce[0] === 'pulsante') {
      const t = testo(voce[1]);
      const p = document.getElementById('pulsante-principale');
      if (t === null) ora.push('chiave del dizionario sconosciuta: ' + voce[1]);
      else if (!p || !visibile(p) || !norm(p.textContent).includes(norm(t))) ora.push('il pulsante principale non dice «' + t + '» ma «' + (p ? p.textContent.trim() : '(manca)') + '»');
    } else if (Array.isArray(voce) && voce[0] === 'testo') {
      if (![...document.querySelectorAll(voce[1])].some(e => visibile(e) && norm(e.textContent) === norm(voce[2]))) ora.push(voce[1] + ' non dice «' + voce[2] + '»');
    } else if (Array.isArray(voce) && voce[0] === 'assente') {
      if ([...document.querySelectorAll(voce[1])].some(visibile)) ora.push('c\\'è ' + voce[1] + ' e non dovrebbe esserci');
    } else if (/^[.#\\[]/.test(voce)) {
      if (![...document.querySelectorAll(voce)].some(visibile)) ora.push('manca ' + voce);
    } else {
      const t = testo(voce);
      if (t === null) ora.push('chiave del dizionario sconosciuta: ' + voce);
      else if (!pagina.includes(norm(t))) ora.push('manca il testo «' + t + '»');
    }
  }
  return ora;`;

export async function controllaStato(pg, voce) {
  const atteso = voce.atteso || [];
  const guasti = [];
  if (!atteso.length) guasti.push('la voce non dice cosa aspettarsi (campo `atteso` in dati/schermate.mjs)');
  guasti.push(...await pg.js(`const ATTESO = ${JSON.stringify(atteso)}; ${IN_PAGINA}`));
  // Niente caricamenti a metà: nessuna immagine ancora in arrivo, né rotta, e nessuna carta "in caricamento"
  guasti.push(...await pg.js(`
    const ora = [];
    if (!__c.immaginiPronte()) ora.push('immagini ancora in arrivo');
    const rotte = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getClientRects().length && getComputedStyle(i).visibility !== 'hidden');
    if (rotte.length) ora.push(rotte.length + ' immagini non caricate (' + rotte.slice(0, 2).map(i => i.src.split('/').pop()).join(', ') + ')');
    if (app.T.loadingCard && document.body.innerText.includes(app.T.loadingCard)) ora.push('carta ancora in caricamento');
    if (app.T.imageMissing && document.body.innerText.includes(app.T.imageMissing)) ora.push('immagine non disponibile');
    return ora;`));
  return guasti;
}

// Decodifica il PNG in una pagina vuota e guarda i pixel: misure, quanti colori diversi (campionati), luminosità media
export async function controllaImmagine(pagina, png, scala) {
  const r = await pagina.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const colori = new Set();
    let somma = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      colori.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
      somma += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      n++;
    }
    return { w: c.width, h: c.height, colori: colori.size, luce: somma / n };
  }, png.toString('base64'));
  const guasti = [];
  if (r.w !== 360 * scala || r.h !== 720 * scala) guasti.push(`misure ${r.w}x${r.h} invece di ${360 * scala}x${720 * scala}`);
  if (r.colori < 40) guasti.push(`quasi vuota (${r.colori} colori)`);
  if (r.luce < 6) guasti.push(`nera (luminosità media ${r.luce.toFixed(1)})`);
  return guasti;
}
