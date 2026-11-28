// ui/schermate/menu.ts: la schermata del menu iniziale, nella pagina iniziale (#start): finestra "Partita in corso"
// (Riprendi partita, cestino per eliminare la sola partita salvata), Nuova partita, Inserisci collezione, Opzioni,
// Biblioteca, Modalità test; selettore della lingua in alto a sinistra; versione in alto a destra; messaggio d'errore
// del caricamento.
// Disegnata dal coordinatore (disegnaMenu, da setStartMode); "Nuova partita" e "Riprendi" usano gli agganci vaiA e
// riprendiPartita.
// Livello 5 (ui/schermate/). Dipende da: stato/ (salvataggio, catalogo, preferenze), ui/ base (testi, pagina, dom,
// ridisegno), ui/componenti/dialoghi.ts, ui/finestre (opzioni, test). Usato da: navigazione, avvio.ts (errore).

import { LINGUA, T } from '../testi.ts';
import { button, dialogShell, openModal } from '../componenti/dialoghi.ts';
import { cancellaPartitaSalvata, readSave } from '../../stato/salvataggio.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { LINGUE, preferenze, setLingua } from '../../stato/preferenze.ts';
import { retryBtn, startError, startErrorText, startLayer } from '../pagina.ts';
import { el, icon, need, pageEl, query } from '../dom.ts';
import type { SalvataggioValido } from '../../tipi/salvataggio.ts';
import { openCollection, openOptions } from '../finestre/opzioni.ts';
import { openLibrary } from '../finestre/biblioteca.ts';
import { openTestScreen } from '../finestre/test.ts';
import { riprendiPartita, vaiA } from '../ridisegno.ts';

// Finestra "Partita in corso" sotto il titolo e, sotto, i pulsanti del menu iniziale. Creati qui, così funzionano
// anche con un index.html vecchio ancora in cache.
export function startChoicePanel(): HTMLElement {
  const existing = document.getElementById('start-choice');
  if (existing) return existing;
  const panel = el('section', 'start-choice');
  panel.id = 'start-choice';
  panel.setAttribute('aria-labelledby', 'start-choice-title');
  const head = el('div', 'start-choice-head');
  const title = el('h2', 'start-choice-title', T.savedGameTitle);
  title.id = 'start-choice-title';
  head.append(title, el('p', 'start-choice-info'));
  const resume = button(T.resumeGame, 'primary', riprendiPartita);
  resume.classList.add('ae-button--full', 'start-choice-resume');
  // Cestino in alto a destra: elimina la sola partita salvata, dopo conferma (è fuori dal pulsante Riprendi)
  const trash = el('button', 'start-choice-delete');
  trash.type = 'button';
  trash.setAttribute('aria-label', T.deleteSaveAria);
  trash.title = T.deleteSaveAria;
  trash.appendChild(icon('trash'));
  trash.addEventListener('click', e => {
    e.stopPropagation();
    openDeleteSave();
  });
  panel.append(head, resume, trash);
  pageEl(document, '.start-separatore', HTMLElement).after(panel);
  return panel;
}

// Conferma prima di eliminare la partita salvata: solo la partita, non preferiti, collezione, impostazioni o lingua
function openDeleteSave(): void {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(T.deleteSaveTitle, '', cancel, { displayTitle: false });
  dialog.appendChild(el('p', 'ae-modal-text', T.deleteSaveText));
  const footer = el('div', 'ae-modal-footer');
  const cancelBtn = button(T.cancel, 'secondary', cancel);
  const confirm = button(T.deleteSaveButton, 'danger', () => {
    close();
    cancellaPartitaSalvata();
    // Menu iniziale ridisegnato: senza partita salvata il box "Partita in corso" sparisce e risalgono le altre voci
    vaiA('menu');
  });
  footer.append(cancelBtn, confirm);
  dialog.appendChild(footer);
  close = openModal(dialog, { onCancel: cancel, initialFocus: cancelBtn });
}

export function startHomeActions(): HTMLElement {
  const existing = document.getElementById('start-home');
  if (existing) return existing;
  const box = el('div', 'start-home');
  box.id = 'start-home';
  const fresh = button(T.newGame, 'primary', () => vaiA('nuova-partita'));
  fresh.classList.add('ae-button--full', 'start-home-new');
  // Collezione vuota: "Inserisci collezione" apre La mia collezione; "Nuova partita" è oscurato
  const addCollection = button(T.addCollection, 'primary', () => openCollection(addCollection, () => {
    const next = query(startHomeActions(), '.start-home-new', HTMLButtonElement);
    if (next && !next.disabled) next.focus({ preventScroll: true });
  }));
  addCollection.classList.add('ae-button--full', 'start-home-collection');
  const options = button(T.options, 'secondary', () => openOptions(options));
  options.classList.add('ae-button--full', 'start-home-options');
  // Biblioteca: a tutto schermo (ui/finestre/biblioteca.ts); il testo è in testi-it.ts / testi-en.ts
  const library = button(T.library, 'secondary', () => openLibrary(library));
  library.classList.add('ae-button--full', 'start-home-library');
  library.dataset.testo = 'library';
  // Modalità test: scenari che partono in un momento preciso della partita
  const test = button(T.testMenu, 'secondary', () => openTestScreen(test));
  test.classList.add('ae-button--full', 'start-home-test');
  box.append(addCollection, fresh, options, library, test);
  startChoicePanel().after(box);
  return box;
}

// Selettore della lingua in alto a sinistra del menu iniziale: globo, sigla (IT o EN), freccia; a tendina le due
// lingue, quella in uso con il segno di spunta. Scegliere un'altra lingua la salva e ricarica l'app, come in Opzioni
// (stessa preferenza, quindi i due controlli restano sincronizzati)
export function startLanguagePicker(): HTMLElement {
  const existing = document.getElementById('start-lingua');
  if (existing) return existing;
  const box = el('div', 'start-lingua');
  box.id = 'start-lingua';
  const toggle = el('button', 'start-lingua-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', T.language);
  toggle.append(icon('globe'), el('span', 'start-lingua-sigla', LINGUA.toUpperCase()), icon('chevron-down'));
  const list = el('div', 'start-lingua-menu');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', T.language);
  list.hidden = true;
  let aperto = false;
  const setOpen = (open: boolean) => {
    aperto = open;
    list.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  LINGUE.forEach(code => {
    const selected = code === LINGUA;
    const option = el('button', 'start-lingua-voce');
    option.type = 'button';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(selected));
    option.append(el('span', 'start-lingua-nome', T.languageNames[code]));
    const mark = el('span', 'start-lingua-spunta');
    if (selected) mark.appendChild(icon('check'));
    option.appendChild(mark);
    option.addEventListener('click', () => {
      if (selected) { setOpen(false); return; }
      setLingua(code);
      location.reload();
    });
    list.appendChild(option);
  });
  toggle.addEventListener('click', () => setOpen(!aperto));
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape' && aperto) { e.stopPropagation(); setOpen(false); toggle.focus(); }
  });
  // Un tocco fuori dal selettore lo chiude
  document.addEventListener('pointerdown', e => {
    if (aperto && e.target instanceof Node && !box.contains(e.target)) setOpen(false);
  });
  box.append(toggle, list);
  startLayer.appendChild(box);
  return box;
}

export function updateHomeCollection(): void {
  const box = document.getElementById('start-home');
  if (!box) return;
  const empty = !preferenze.collection || preferenze.collection.size === 0;
  pageEl(box, '.start-home-collection', HTMLElement).hidden = !empty;
  const fresh = pageEl(box, '.start-home-new', HTMLButtonElement);
  fresh.disabled = empty;
  fresh.title = empty ? T.collectionEmptyHint : '';
  // Con la collezione vuota il pulsante principale è "Inserisci collezione" (altrimenti principale solo senza partita
  // salvata, come in setStartMode)
  const primary = !empty && !readSave();
  fresh.classList.toggle('ae-button--primary', primary);
  fresh.classList.toggle('ae-button--secondary', !primary);
}

export function showStartError(text: string, withRetry: boolean): void {
  startError.hidden = false;
  startErrorText.textContent = text;
  retryBtn.hidden = !withRetry;
}

// Disegno del menu iniziale (isHome) o sua chiusura (pagina Nuova partita): la finestra "Partita in corso" (saved: la
// partita salvata, o null) e i pulsanti del menu. Restituisce dove va il fuoco nel menu: Riprendi partita, Nuova partita
// o, con la collezione vuota, "Inserisci collezione"
export function disegnaMenu(saved: SalvataggioValido | null, isHome: boolean): HTMLElement | null {
  const panel = startChoicePanel();
  const home = startHomeActions();
  startLanguagePicker().hidden = !isHome;
  panel.hidden = !isHome || !saved;
  home.hidden = !isHome;
  need(panel.parentElement, 'contenitore della pagina iniziale').classList.toggle('is-choosing', isHome);
  // Con una partita in corso "Nuova partita" è secondario (il principale è Riprendi partita)
  const fresh = pageEl(home, '.start-home-new', HTMLButtonElement);
  fresh.classList.toggle('ae-button--primary', !saved);
  fresh.classList.toggle('ae-button--secondary', !!saved);
  updateHomeCollection();
  if (saved) {
    const head = pageEl(panel, '.start-choice-head', HTMLElement);
    pageEl(head, '.start-choice-info', HTMLElement).textContent = saved.settings.nemesis || '';
    const old = head.querySelector('.nemesis-art');
    if (old) old.remove();
    const nemesis = saved.settings.nemesis;
    const art = nemesis !== null ? catalogo.nemesisArt[nemesis] : undefined;
    head.classList.toggle('has-art', !!art);
    if (art) {
      const portrait = el('span', 'nemesis-art');
      portrait.setAttribute('aria-hidden', 'true');
      portrait.style.backgroundImage = `url("${encodeURI(String(art.portrait))}")`;
      head.prepend(portrait);
    }
  }
  return saved ? query(panel, '.start-choice-resume', HTMLElement)
    : fresh.disabled ? query(home, '.start-home-collection', HTMLElement) : fresh;
}

// Versione e commit: vite.config.ts li costruisce con `define` (src/regole/versione.ts per la composizione)
declare const __VERSIONE__: string;
declare const __COMMIT__: string;

// Versione in alto a destra del menu iniziale; l'hash del commit va nel suggerimento (title), non si traduce
export function scriviVersione(): void {
  const elemento = document.getElementById('versione-app');
  if (!elemento) return;
  elemento.textContent = __VERSIONE__;
  elemento.title = __COMMIT__;
}

// Al caricamento: la versione (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
  scriviVersione();
}
