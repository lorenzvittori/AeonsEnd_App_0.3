// ui/finestre/test-regolazioni.ts: il pannello "Regolazioni" della Modalità test: un pulsante sempre visibile durante uno
// scenario e, aperto, un pannello in basso (circa metà schermo, la partita resta visibile sopra) con due schede: Colori
// (i colori base di stili/palette.css, selettore e, se hanno trasparenza, cursore dell'opacità) e Misure (le variabili di
// ui/schermate/partita-misure.css per zona, campo numerico e unità). Ogni cambio si vede subito (setProperty su :root) e,
// per le misure, ridisegna (le misure lette dal codice, misure.ts, si rileggono). "Ripristina tutto" torna ai valori dei
// CSS; "Copia" mette negli appunti le sole variabili cambiate, come testo CSS con il nome del file.
// Valgono solo nella Modalità test: uscendo si tolgono dalla pagina. Restano salvate a parte (localStorage, chiave propria,
// mai nel salvataggio della partita) e si riapplicano al prossimo scenario. Etichette e gruppi vengono dai commenti dei CSS
// (test-regolazioni-lettura.ts). Non è una finestra modale: il resto della pagina resta attivo.
// Livello 4 (ui/finestre/), file di supporto di test.ts. Dipende da: ui/ base (testi, dom, ridisegno), ui/componenti
// (dialoghi: toast), test-regolazioni-lettura.ts. Usato da: test.ts (avvio e fine dello scenario).

import { T } from '../testi.ts';
import { el, icon, query, queryAll } from '../dom.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { showToast } from '../componenti/dialoghi.ts';
import { COLORI, MISURE, componiColore, componiMisura, dividiColore, predefiniti, regolazioniValide, testoCopia, valoriUguali }
  from './test-regolazioni-lettura.ts';
import type { ColoreBase, Misura } from './test-regolazioni-lettura.ts';

// Chiave propria: le regolazioni non stanno mai nel salvataggio della partita (stato/salvataggio.ts, SAVE_KEY)
export const REGOLAZIONI_KEY = 'aeonsend-app-0.2-regolazioni';

const BASE = predefiniti(COLORI, MISURE);

// Le regolazioni applicate ora alla pagina (nome -> valore), solo quelle diverse dai CSS
const applicate = new Map<string, string>();
let inScenario = false;
let pulsante: HTMLButtonElement | null = null;
let pannello: HTMLElement | null = null;
let scheda: 'colori' | 'misure' = 'colori';

const radice = () => document.documentElement;

function leggiSalvate(): Record<string, string> {
  try { return regolazioniValide(JSON.parse(localStorage.getItem(REGOLAZIONI_KEY) || 'null'), BASE); } catch (err) { return {}; }
}

function salva(): void {
  try {
    if (applicate.size) localStorage.setItem(REGOLAZIONI_KEY, JSON.stringify(Object.fromEntries(applicate)));
    else localStorage.removeItem(REGOLAZIONI_KEY);
  } catch (err) { /* senza salvataggio le regolazioni valgono finché la pagina resta aperta */ }
}

// Valore di una variabile adesso: quello regolato o quello scritto nei CSS
const valoreDi = (nome: string): string => applicate.get(nome) ?? BASE[nome];

// Imposta una variabile sulla pagina (se il valore è quello dei CSS la regolazione si toglie), salva e aggiorna il pulsante
function imposta(nome: string, valore: string): void {
  if (valoriUguali(valore, BASE[nome])) {
    applicate.delete(nome);
    radice().style.removeProperty(nome);
  } else {
    applicate.set(nome, valore);
    radice().style.setProperty(nome, valore);
  }
  salva();
  aggiornaPulsante();
}

function togliTutte(): void {
  applicate.forEach((_, nome) => radice().style.removeProperty(nome));
  applicate.clear();
}

function aggiornaPulsante(): void {
  if (!pulsante) return;
  pulsante.textContent = applicate.size ? T.regolazioniAttive(applicate.size) : T.regolazioni;
  pulsante.classList.toggle('is-attive', applicate.size > 0);
}

// --- Pannello ----------------------------------------------------------------------------------------------------------

function rigaColore(c: ColoreBase): HTMLElement {
  const riga = el('div', 'ae-reg-riga');
  const { hex, opacita } = dividiColore(valoreDi(c.nome));
  const [nomeColore, ...resto] = c.etichetta.split(': ');
  const testo = el('label', 'ae-reg-etichetta');
  testo.append(el('span', 'ae-reg-nome', nomeColore), el('span', 'ae-reg-nota', resto.join(': ')));
  const selettore = el('input', 'ae-reg-colore');
  selettore.type = 'color';
  selettore.value = hex;
  selettore.dataset.variabile = c.nome;
  selettore.setAttribute('aria-label', c.etichetta);
  riga.append(testo, selettore);
  if (opacita !== null) {
    const cursore = el('input', 'ae-reg-opacita');
    cursore.type = 'range';
    cursore.min = '0';
    cursore.max = '100';
    cursore.step = '1';
    cursore.value = String(Math.round(opacita * 100));
    cursore.dataset.variabile = c.nome;
    cursore.setAttribute('aria-label', T.regolazioniOpacita(c.etichetta));
    const cambia = () => imposta(c.nome, componiColore(selettore.value, Number(cursore.value) / 100));
    cursore.addEventListener('input', cambia);
    selettore.addEventListener('input', cambia);
    riga.appendChild(cursore);
  } else {
    selettore.addEventListener('input', () => imposta(c.nome, componiColore(selettore.value, null)));
  }
  return riga;
}

function passoDi(m: Misura): string {
  if (m.unita === '') return '0.05';
  return /\./.test(m.valore) ? '0.1' : '1';
}

function rigaMisura(m: Misura): HTMLElement {
  const riga = el('div', 'ae-reg-riga');
  const testo = el('label', 'ae-reg-etichetta');
  testo.append(el('span', 'ae-reg-nome', m.etichetta), el('span', 'ae-reg-nota', m.nome));
  const campo = el('input', 'ae-reg-numero');
  campo.type = 'number';
  campo.inputMode = 'decimal';
  campo.step = passoDi(m);
  campo.value = String(parseFloat(valoreDi(m.nome)));
  campo.dataset.variabile = m.nome;
  campo.setAttribute('aria-label', m.etichetta);
  campo.addEventListener('input', () => {
    const n = parseFloat(campo.value);
    if (!isFinite(n)) return;
    imposta(m.nome, componiMisura(n, m.unita));
    richiediRidisegno();
  });
  riga.append(testo, campo, el('span', 'ae-reg-unita', m.unita || '×'));
  return riga;
}

function disegnaCorpo(): void {
  if (!pannello) return;
  const corpo = query(pannello, '.ae-reg-corpo', HTMLElement);
  if (!corpo) return;
  corpo.replaceChildren();
  const gruppi = scheda === 'colori' ? COLORI : MISURE;
  gruppi.forEach(g => {
    const sezione = el('section', 'ae-reg-gruppo');
    sezione.appendChild(el('h3', 'ae-reg-titolo', g.titolo));
    if (scheda === 'colori') (g.voci as ColoreBase[]).forEach(c => sezione.appendChild(rigaColore(c)));
    else (g.voci as Misura[]).forEach(m => sezione.appendChild(rigaMisura(m)));
    corpo.appendChild(sezione);
  });
  queryAll(pannello, '.ae-reg-scheda', HTMLButtonElement).forEach(b => b.setAttribute('aria-selected', String(b.dataset.scheda === scheda)));
}

function copia(): void {
  const testo = testoCopia(Object.fromEntries(applicate), COLORI, MISURE);
  if (!testo) { showToast(T.regolazioniNiente); return; }
  const fatto = () => showToast(T.regolazioniCopiato(applicate.size));
  const rimedio = () => {
    // Senza appunti asincroni (pagina non sicura): si copia con un campo di testo temporaneo
    const area = el('textarea');
    area.value = testo;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); fatto(); } catch (err) { showToast(T.regolazioniNonCopiato); }
    area.remove();
  };
  if (navigator.clipboard) navigator.clipboard.writeText(testo).then(fatto, rimedio);
  else rimedio();
}

function ripristina(): void {
  const cambiavano = applicate.size > 0;
  togliTutte();
  salva();
  aggiornaPulsante();
  disegnaCorpo();
  if (cambiavano) richiediRidisegno();
}

function chiudiPannello(): void {
  if (!pannello) return;
  pannello.remove();
  pannello = null;
  if (pulsante) { pulsante.hidden = false; pulsante.focus({ preventScroll: true }); }
}

function apriPannello(): void {
  if (pannello || !inScenario) return;
  const p = el('div', 'ae-regolazioni');
  p.setAttribute('role', 'region');
  p.setAttribute('aria-label', T.regolazioniTitolo);
  const testa = el('div', 'ae-reg-testa');
  const titolo = el('h2', 'ae-reg-pannello-titolo', T.regolazioniTitolo);
  const chiudi = el('button', 'ae-icon-button');
  chiudi.type = 'button';
  chiudi.setAttribute('aria-label', T.close);
  chiudi.appendChild(icon('close'));
  chiudi.addEventListener('click', chiudiPannello);
  testa.append(titolo, chiudi);
  const schede = el('div', 'ae-reg-schede');
  schede.setAttribute('role', 'tablist');
  (['colori', 'misure'] as const).forEach(s => {
    const b = el('button', 'ae-reg-scheda', s === 'colori' ? T.regolazioniColori : T.regolazioniMisure);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.scheda = s;
    b.addEventListener('click', () => { scheda = s; disegnaCorpo(); });
    schede.appendChild(b);
  });
  const azioni = el('div', 'ae-reg-azioni');
  const ripristinaTutto = el('button', 'ae-button ae-button--secondary', T.regolazioniRipristina);
  ripristinaTutto.type = 'button';
  ripristinaTutto.addEventListener('click', ripristina);
  const copiaVoci = el('button', 'ae-button ae-button--secondary', T.regolazioniCopia);
  copiaVoci.type = 'button';
  copiaVoci.addEventListener('click', copia);
  azioni.append(ripristinaTutto, copiaVoci);
  p.append(testa, schede, azioni, el('div', 'ae-reg-corpo'));
  p.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); chiudiPannello(); } });
  document.body.appendChild(p);
  pannello = p;
  if (pulsante) pulsante.hidden = true;
  disegnaCorpo();
  chiudi.focus({ preventScroll: true });
}

// --- Dentro e fuori dallo scenario ---------------------------------------------------------------------------------------

// Uno scenario è partito (o ripartito): si riapplicano le regolazioni salvate e compare il pulsante
export function avviaRegolazioni(): void {
  inScenario = true;
  togliTutte();
  Object.entries(leggiSalvate()).forEach(([nome, valore]) => { applicate.set(nome, valore); radice().style.setProperty(nome, valore); });
  if (!pulsante) {
    pulsante = el('button', 'ae-regolazioni-pulsante');
    pulsante.type = 'button';
    pulsante.addEventListener('click', apriPannello);
    document.body.appendChild(pulsante);
  }
  pulsante.hidden = pannello !== null;
  aggiornaPulsante();
  if (pannello) disegnaCorpo();
}

// Fine del test: tutto torna com'era (le regolazioni restano salvate per il prossimo scenario)
export function terminaRegolazioni(): void {
  if (!inScenario) return;
  inScenario = false;
  togliTutte();
  if (pannello) { pannello.remove(); pannello = null; }
  if (pulsante) { pulsante.remove(); pulsante = null; }
}
