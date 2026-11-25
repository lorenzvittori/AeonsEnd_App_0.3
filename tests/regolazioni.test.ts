// Pannello "Regolazioni" della Modalità test, la parte pura (ui/finestre/test-regolazioni-lettura.ts): la lettura dei
// colori base di palette.css e delle misure di partita-misure.css dai commenti dei file stessi, i valori, il filtro delle
// regolazioni salvate e il testo che si copia. I file veri si leggono anche da disco, per controllare che il modulo
// (che li importa con ?raw) e i CSS dicano la stessa cosa.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLORI, MISURE, componiColore, componiMisura, dividiColore, leggiColori, leggiMisure, predefiniti, regolazioniValide,
  testoCopia, valoriUguali } from '../src/ui/finestre/test-regolazioni-lettura.ts';

const ROOT = join(import.meta.dirname, '..');
const palette = readFileSync(join(ROOT, 'src/stili/palette.css'), 'utf8');
const misure = readFileSync(join(ROOT, 'src/ui/schermate/partita-misure.css'), 'utf8');

const CAMPIONE_COLORI = `
/* intestazione: --colore-finto: #123456; non è una dichiarazione */
:root {
  /* --- Gruppo A --- */
  --colore-oro: #DFAE59;        /* Oro: accento */
  --colore-velo: #040508d1;     /* Velo: dietro le finestre */
  --colore-rotto: rosso;        /* non è un colore */
  --altro: #ffffff;             /* non è --colore-* */

  /* --- Gruppo B --- */
  --colore-nero: #000000;
}
:root {
  --ae-gold: var(--colore-oro); /* ruolo: non si legge */
}`;

const CAMPIONE_MISURE = `
:root {
  /* --- Carte --- */
  --carta-larghezza: 63;        /* proporzioni: larghezza */
  /* --- 1 testata --- */
  --testata-altezza: 58px;      /* altezza minima */
  --testata-spazio: 7.8px;
  --vite-margine: -3.8px;       /* negativo */
  --spostamento: calc(var(--a) + 2px);   /* calc: non si regola */
  --scala: 0.9;                 /* frazione */
  /* --- 2 fascia turno --- */
  --turno-casella: 122px;       /* casella accesa */
}`;

describe('lettura dei colori base', () => {
  const gruppi = leggiColori(CAMPIONE_COLORI);

  it('legge gruppi, nomi, valori ed etichette; ignora ruoli, righe non colore e commenti di testa', () => {
    expect(gruppi.map(g => g.titolo)).toEqual(['Gruppo A', 'Gruppo B']);
    expect(gruppi[0].voci).toEqual([
      { nome: '--colore-oro', valore: '#dfae59', etichetta: 'Oro: accento', trasparente: false },
      { nome: '--colore-velo', valore: '#040508d1', etichetta: 'Velo: dietro le finestre', trasparente: true }
    ]);
    expect(gruppi[1].voci.map(v => v.nome)).toEqual(['--colore-nero']);
  });

  it('palette.css vero: il modulo (?raw) e il file su disco dicono la stessa cosa', () => {
    expect(COLORI).toEqual(leggiColori(palette));
  });

  it('palette.css vero: tutti i colori base sono letti, ognuno con etichetta e in un gruppo', () => {
    const dichiarati = [...palette.matchAll(/^\s*(--colore-[\w-]+):\s*#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?;/gm)].map(m => m[1]);
    const letti = COLORI.flatMap(g => g.voci.map(v => v.nome));
    expect(letti).toEqual(dichiarati);
    expect(new Set(letti).size).toBe(letti.length);
    COLORI.forEach(g => { expect(g.titolo).not.toBe(''); g.voci.forEach(v => expect(v.etichetta, v.nome).not.toBe(v.nome)); });
    // Un solo colore con trasparenza propria: il velo
    expect(COLORI.flatMap(g => g.voci).filter(v => v.trasparente).map(v => v.nome)).toEqual(['--colore-velo']);
  });

  it('ogni ruolo di palette.css punta a un colore base che esiste', () => {
    const basi = new Set(COLORI.flatMap(g => g.voci.map(v => v.nome)));
    const usati = [...palette.matchAll(/var\((--colore-[\w-]+)\)/g)].map(m => m[1]);
    expect(usati.length).toBeGreaterThan(50);
    usati.forEach(nome => expect(basi.has(nome), nome).toBe(true));
  });
});

describe('lettura delle misure', () => {
  it('legge i gruppi per zona, numero e unità; salta calc() e righe senza numero', () => {
    const gruppi = leggiMisure(CAMPIONE_MISURE);
    expect(gruppi.map(g => g.titolo)).toEqual(['Carte', '1 testata', '2 fascia turno']);
    expect(gruppi[0].voci[0]).toMatchObject({ nome: '--carta-larghezza', numero: 63, unita: '', etichetta: 'proporzioni: larghezza' });
    expect(gruppi[1].voci.map(v => [v.nome, v.numero, v.unita])).toEqual([
      ['--testata-altezza', 58, 'px'], ['--testata-spazio', 7.8, 'px'], ['--vite-margine', -3.8, 'px'], ['--scala', 0.9, '']]);
    // senza commento l'etichetta è il nome
    expect(gruppi[1].voci[1].etichetta).toBe('--testata-spazio');
  });

  it('partita-misure.css vero: il modulo e il file dicono la stessa cosa; le 7 zone più le carte', () => {
    expect(MISURE).toEqual(leggiMisure(misure));
    expect(MISURE.map(g => g.titolo)).toEqual(['Carte (tutte le zone)', '1 testata', '2 fascia turno', '3 fascia carte piccole',
      '4 vite', '5 fascia carte grandi', '6 pulsanti interattivi', '7 pulsante principale']);
  });

  it('partita-misure.css vero: tutte le variabili numeriche sono lette, con etichetta; solo i calc() restano fuori', () => {
    const tutte = [...misure.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(m => ({ nome: m[1], valore: m[2].trim() }));
    const numeriche = tutte.filter(v => !v.valore.startsWith('calc(')).map(v => v.nome);
    const lette = MISURE.flatMap(g => g.voci.map(v => v.nome));
    expect(lette).toEqual(numeriche);
    expect(tutte.length - numeriche.length).toBe(1);
    MISURE.forEach(g => g.voci.forEach(v => expect(v.etichetta, v.nome).not.toBe(v.nome)));
  });
});

describe('valori', () => {
  it('colore e opacità: dividi e componi', () => {
    expect(dividiColore('#DFAE59')).toEqual({ hex: '#dfae59', opacita: null });
    const velo = dividiColore('#040508d1');
    expect(velo.hex).toBe('#040508');
    expect(velo.opacita).toBeCloseTo(0.82, 2);
    expect(componiColore('#040508', velo.opacita)).toBe('#040508d1');
    expect(componiColore('#FF0000', null)).toBe('#ff0000');
    expect(componiColore('#ff0000', 0)).toBe('#ff000000');
    expect(componiColore('#ff0000', 1)).toBe('#ff0000ff');
    expect(componiColore('#ff0000', 2)).toBe('#ff0000ff');
  });

  it('misura: numero e unità, senza decimali di troppo', () => {
    expect(componiMisura(58, 'px')).toBe('58px');
    expect(componiMisura(7.8000000001, 'px')).toBe('7.8px');
    expect(componiMisura(0.9, '')).toBe('0.9');
    expect(componiMisura(-3.8, 'px')).toBe('-3.8px');
  });

  it('valoriUguali: maiuscole nei colori, numeri nelle misure', () => {
    expect(valoriUguali('#DFAE59', '#dfae59')).toBe(true);
    expect(valoriUguali('#dfae59', '#dfae5a')).toBe(false);
    expect(valoriUguali('58px', '58.0px')).toBe(true);
    expect(valoriUguali('58px', '59px')).toBe(false);
    expect(valoriUguali('58px', '58%')).toBe(false);
  });
});

describe('regolazioni salvate e testo da copiare', () => {
  const base = predefiniti(COLORI, MISURE);

  it('regolazioniValide tiene solo nomi che esistono e valori dello stesso tipo e della stessa unità', () => {
    expect(regolazioniValide(null, base)).toEqual({});
    expect(regolazioniValide([1, 2], base)).toEqual({});
    expect(regolazioniValide('x', base)).toEqual({});
    const salvate = {
      '--colore-oro': '#AABBCC',            // colore valido (maiuscole)
      '--colore-velo': '#aabbcc',           // il velo ha trasparenza: servono 8 cifre
      '--colore-nero': 'rosso',             // non è un colore
      '--testata-altezza': '60px',          // misura valida
      '--turno-barra-altezza': '3%',        // altra unità: no
      '--carta-larghezza': '70',            // numero puro: sì
      '--non-esiste': '1px',                // nome sconosciuto
      '--colore-bianco': 5                  // non è una stringa
    };
    expect(regolazioniValide(salvate, base)).toEqual({ '--colore-oro': '#aabbcc', '--testata-altezza': '60px', '--carta-larghezza': '70' });
  });

  it('testoCopia: solo le variabili cambiate, con il file di ognuna; niente se non è cambiato niente', () => {
    expect(testoCopia({}, COLORI, MISURE)).toBe('');
    const t = testoCopia({ '--testata-altezza': '60px', '--colore-oro': '#aabbcc' }, COLORI, MISURE);
    expect(t).toBe(
      '/* src/stili/palette.css: cambia il valore delle righe con questi nomi */\n:root {\n  --colore-oro: #aabbcc;\n}\n\n'
      + '/* src/ui/schermate/partita-misure.css: cambia il valore delle righe con questi nomi */\n:root {\n  --testata-altezza: 60px;\n}');
    const soloMisure = testoCopia({ '--turno-casella-accesa': '130px' }, COLORI, MISURE);
    expect(soloMisure).not.toContain('palette.css');
    expect(soloMisure).toContain('--turno-casella-accesa: 130px;');
  });
});
