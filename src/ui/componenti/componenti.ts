// ui/componenti/componenti.ts: componenti dell'interfaccia: creazione degli elementi (el, icon), immagine della carta,
// box di vita e token, miniatura della coda, bozze del turno giocatori.
// Dipende da: regole/turno-nemesi.ts, ui/testi.ts, stato/ (stato, partita), ui/schermate (turno-nemesi: DRAW_UID,
// mazzo-turni: needsPairChoice). Usato da: quasi tutti i moduli di ui/.

import * as Nemesi from '../../regole/turno-nemesi.ts';
import { I18N_IT } from '../testi.ts';
import { CARD_BACK, ui } from '../../stato/stato.ts';
import { hpMaxOf, hpUnset } from '../../stato/partita.ts';
import { DRAW_UID } from '../schermate/turno-nemesi.js';
import { needsPairChoice } from '../schermate/mazzo-turni.js';
import type { Carta } from '../../tipi/dati.ts';
import type { BozzaCarta, VoceInGioco } from '../../tipi/partita.ts';

// Carta in gioco come si disegna: con la vita in bozza (isDraft) e la vita di prima (hpBefore)
export interface VoceMostrata extends VoceInGioco {
  hpBefore?: number | null;      // vita prima della modifica non salvata
  isDraft?: boolean;             // la vita mostrata è in bozza
}

// Opzioni della miniatura della coda
export interface OpzioniMiniatura {
  index: number;                 // posizione nella coda
  total: number;                 // carte nella coda
  compact?: boolean;             // fascia piccola
  current?: boolean;             // carta da risolvere
  viewed?: boolean;              // carta mostrata grande
  lazy?: boolean;                // immagine caricata quando serve
  full?: boolean;                // scansione intera invece della miniatura
}

// Elemento nuovo con classe e testo; il tipo segue il tag (el('button') è un HTMLButtonElement)
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Primo elemento dentro root che corrisponde al selettore ed è del tipo indicato; null altrimenti (il tipo si controlla
// davvero, non si suppone)
export function query<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T | null {
  const node = root.querySelector(selector);
  return node instanceof type ? node : null;
}

// Tutti gli elementi dentro root che corrispondono al selettore e sono del tipo indicato
export function queryAll<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T[] {
  return Array.from(root.querySelectorAll(selector)).filter((n): n is T => n instanceof type);
}

export function icon(name: string): HTMLSpanElement {
  const span = el('span', 'ae-icon ae-icon--' + name);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

// Nome del tipo in italiano (Minion, Potere, Attacco; gli altri tipi restano in inglese)
export function typeName(data: Pick<Carta, 'type'>): string {
  const names: Record<string, string> = I18N_IT.types;
  return names[data.type] || data.type;
}

export function hasHp(entry: VoceInGioco): boolean {
  return Nemesi.hasHp(entry);
}

// Stato numerico della carta in parole (per i lettori di schermo)
export function statusText(entry: VoceInGioco): string {
  if (hasHp(entry) && hpUnset(entry)) return I18N_IT.hpUnknown;
  if (hasHp(entry) && typeof hpMaxOf(entry) === 'number') return I18N_IT.hpLong(entry.hp, hpMaxOf(entry));
  if (hasHp(entry) && typeof entry.data.hp !== 'number') return I18N_IT.hpOnly(entry.hp);
  if (hasHp(entry)) return I18N_IT.hpLong(entry.hp, entry.data.hp);
  if (entry.data.type === 'Power') return I18N_IT.tokens(entry.tokens);
  return '';
}

// Riquadro segnaposto quando l'immagine non si carica: nome, tipo e avviso (mai un rettangolo vuoto)
export function placeholderArt(data: Carta): HTMLSpanElement {
  const box = el('span', 'ae-card-art ae-card-art--placeholder');
  box.append(el('strong', '', data.name), el('small', '', typeName(data)), el('em', '', I18N_IT.imageMissing));
  return box;
}

// Immagine di una carta. thumb = miniatura WebP (se non c'è si usa la scansione); se manca anche quella, segnaposto.
// sync: immagine già scaricata e decodificata (carte grandi del turno nemesi): si disegna subito, senza lampo vuoto
export function cardArt(data: Carta, { thumb = false, lazy = false, sync = false }: { thumb?: boolean; lazy?: boolean; sync?: boolean } = {}): HTMLSpanElement {
  const box = el('span', 'ae-card-art');
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = sync ? 'sync' : 'async';
  img.width = 264;
  img.height = 369;
  if (lazy) img.loading = 'lazy';
  // (String: una carta senza miniatura dà "undefined", come l'assegnazione diretta a src)
  img.src = thumb ? String(data.thumb) : encodeURI(data.image);
  img.addEventListener('error', () => {
    if (thumb && img.dataset.fallback !== '1') {
      img.dataset.fallback = '1';
      img.src = encodeURI(data.image);
      return;
    }
    box.replaceWith(Object.assign(placeholderArt(data), { className: box.className + ' ae-card-art--placeholder' }));
  });
  box.appendChild(img);
  return box;
}

// Token del potere: un'immagine (Assets/power-token-2.webp) per ogni token rimasto
export function tokenIcons(n: number): HTMLSpanElement {
  const row = el('span', 'ae-tokens');
  row.setAttribute('aria-hidden', 'true');
  // Più di 5 token: un token e il numero, come la vita dei minion (cuore e numero)
  if (n > 5) {
    row.classList.add('is-count');
    row.append(el('span', 'ae-token'), el('span', 'ae-token-count', String(n)));
    return row;
  }
  for (let i = 0; i < Math.max(0, n); i++) row.appendChild(el('span', 'ae-token'));
  // 4 o 5 token: i token si rimpiccioliscono di 3/n, così la fila (e il box) resta larga come con 3; lo spazio libero
  // si divide in parti uguali tra token e tra token e bordo (style.css .has-many-tokens)
  if (n > 3) {
    row.classList.add('is-many');
    row.style.setProperty('--ae-token-zoom', String(3 / n));
    row.style.setProperty('--ae-token-n', String(n));
  }
  return row;
}

// Carta che va negli scarti all'inizio del prossimo turno nemesi: potere con costo pagato o minion ucciso (vita 0 salvata).
// Nel turno giocatori resta in coda, grigia. Un minion a vita variabile non ancora impostata non muore a 0
// (regole/turno-nemesi.ts)
export function isGone(entry: VoceInGioco): boolean {
  return Nemesi.isGone(entry);
}

// Turno giocatori: modifiche non ancora salvate di una carta (vita in bozza, costo pagato in bozza)
export function draftOf(entry: VoceInGioco): BozzaCarta | null {
  return ui.drafts.get(entry.uid) || null;
}

export function draftHp(entry: VoceInGioco): number | null {
  const d = draftOf(entry);
  return d && d.hp !== undefined ? d.hp : entry.hp;
}

export function setDraft(entry: VoceInGioco, patch: BozzaCarta): void {
  if (needsPairChoice()) return;
  const d: BozzaCarta = Object.assign({}, draftOf(entry), patch);
  if (d.hp === entry.hp) delete d.hp;
  if (!d.paid) delete d.paid;
  if (Object.keys(d).length) ui.drafts.set(entry.uid, d); else ui.drafts.delete(entry.uid);
}

// Copia della carta con la vita in bozza, per disegnare box e fascia
export function displayEntry(entry: VoceInGioco): VoceMostrata {
  const d = draftOf(entry);
  // isDraft: la vita è in bozza, il box mostra "x/X" con X = vita prima del danno (dopo Salva solo "x")
  if (!d) return entry;
  const view: VoceMostrata = Object.assign({}, entry);
  if (d.hp !== undefined) Object.assign(view, { hp: d.hp, hpBefore: entry.hp, isDraft: true });
  if (d.paid) view.paid = true;
  return view;
}

// Box sopra la carta: goccia + vita attuale (minion), un token per ogni token (potere), vuoto per gli attacchi.
// Uguale nella coda e nelle due fasce piccole.
export function statusBadge(entry: VoceMostrata): HTMLSpanElement {
  const badge = el('span', 'ae-status-badge');
  badge.setAttribute('aria-hidden', 'true');
  if (hasHp(entry)) {
    badge.classList.add('ae-status-badge--danger');
    // Vita + goccia; con una modifica non ancora salvata: vita / vita prima del danno (vita variabile non ancora
    // impostata: "?"; in bozza solo "x", senza "/X")
    const hpText = entry.isDraft ? (hpUnset(entry) ? String(entry.hp) : I18N_IT.hp(entry.hp, entry.hpBefore))
      : hpUnset(entry) ? '?' : String(entry.hp);
    // Box "?" toccabile: apre la scheda della carta per impostare la vita (unsetHpClick)
    if (hpUnset(entry) && !entry.isDraft) { badge.classList.add('is-unset'); badge.dataset.uid = String(entry.uid); }
    // Testo lungo (per esempio 13/17): nella fascia piccola il box si allarga e il testo si stringe
    if (hpText.length > 3) badge.classList.add('is-long');
    badge.append(icon('heart'), el('span', '', hpText));
  } else if (entry.data.type === 'Power') {
    badge.classList.add('ae-status-badge--tokens');
    // (Number: null vale 0, come nei confronti di JavaScript)
    const tokens = Number(entry.tokens);
    if (tokens > 3 && tokens <= 5) badge.classList.add('has-many-tokens');
    badge.appendChild(tokenIcons(tokens));
  } else {
    // Attacco: nessun badge, solo lo spazio per tenere allineate le carte
    badge.classList.add('ae-status-badge--empty');
    badge.textContent = '·';
  }
  return badge;
}

// Miniatura della coda (pulsante)
export function queueItem(entry: VoceMostrata, opts: OpzioniMiniatura): HTMLButtonElement {
  const { data } = entry;
  const button = el('button', 'ae-queue-item');
  button.type = 'button';
  button.dataset.uid = String(entry.uid);
  button.setAttribute('role', 'listitem');
  if (entry.isNew) button.classList.add('is-new');
  if (isGone(entry)) button.classList.add('is-paid');
  if (opts.current) button.setAttribute('aria-current', 'true');
  if (opts.viewed) button.dataset.viewed = 'true';

  const parts = [data.name, typeName(data), statusText(entry), I18N_IT.cardOf(opts.index + 1, opts.total)];
  if (entry.isNew) parts.push(I18N_IT.newTag.toLowerCase());
  if (data.type === 'Power' && data.removable === false) parts.push(I18N_IT.notRemovable.toLowerCase());
  if (entry.paid) parts.push(I18N_IT.paidNote.toLowerCase());
  else if (isGone(entry)) parts.push(I18N_IT.killedNote.toLowerCase());
  if (opts.current) parts.push('da risolvere');
  if (opts.viewed && !opts.current) parts.push('in anteprima');
  button.setAttribute('aria-label', parts.filter(Boolean).join(', '));

  const meta = el('span', 'ae-queue-meta');
  meta.setAttribute('aria-hidden', 'true');
  meta.append(el('strong', '', data.name), el('small', '', typeName(data)));

  // Le carte grandi della VistaCoda usano la scansione intera, le altre la miniatura.
  // Fascia piccola: miniatura disegnata subito (sync), così ridisegnando la fascia (per esempio con Turno Nemesi) le carte
  // non spariscono per un attimo
  const art = cardArt(data, { thumb: !opts.full, lazy: opts.lazy, sync: !!opts.compact });
  button.append(statusBadge(entry), meta, art);
  // Fascia piccola: potere che non si può scartare pagando (niente "TO DISCARD") = simbolo di divieto in un box uguale a
  // quello di token e vita, in basso al centro (simmetrico al box in alto)
  if (opts.compact && data.type === 'Power' && data.removable === false) {
    const ban = el('span', 'ae-status-badge ae-ban-badge');
    ban.setAttribute('aria-hidden', 'true');
    ban.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" '
      + 'stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>';
    button.appendChild(ban);
  }
  if (entry.isNew) {
    const tag = el('span', 'ae-new-tag', I18N_IT.newTag);
    tag.setAttribute('aria-hidden', 'true');
    button.appendChild(tag);
  }
  return button;
}

// Posto della carta che si pescherà, nella fascia durante la risoluzione: solo il bordo tratteggiato.
// Non è cliccabile e i lettori di schermo lo saltano.
export function nextSlotItem(): HTMLDivElement {
  const item = el('div', 'ae-queue-item ae-next-slot');
  item.setAttribute('aria-hidden', 'true');
  const badge = el('span', 'ae-status-badge ae-status-badge--empty', '·');
  // Anche qui il box NUOVA, come sul dorso al passo Pesca
  const tag = el('span', 'ae-new-tag', I18N_IT.newTag);
  item.append(badge, el('span', 'ae-card-art'), tag);
  return item;
}

// Prossima carta da pescare nella fascia della VistaRisoluzione: solo il retro (non si vede quale carta è) e NUOVA.
// Non è cliccabile, tranne nel passo da pescare.
export function nextCardItem({ current = false, viewed = false }: { current?: boolean; viewed?: boolean } = {}): HTMLButtonElement | HTMLDivElement {
  const item = current ? el('button', 'ae-queue-item ae-next-card') : el('div', 'ae-queue-item ae-next-card');
  if (item instanceof HTMLButtonElement) {
    // Nel passo da pescare è la carta da "risolvere": si può toccare per tornarci
    item.type = 'button';
    item.dataset.uid = String(DRAW_UID);
    item.setAttribute('aria-current', 'true');
  }
  if (viewed) item.dataset.viewed = 'true';
  item.setAttribute('role', 'listitem');
  item.setAttribute('aria-label', I18N_IT.nextCard);
  const badge = el('span', 'ae-status-badge ae-status-badge--empty', '·');
  badge.setAttribute('aria-hidden', 'true');
  const art = el('span', 'ae-card-art');
  const img = document.createElement('img');
  img.alt = '';
  img.src = CARD_BACK;
  art.appendChild(img);
  const tag = el('span', 'ae-new-tag', I18N_IT.newTag);
  tag.setAttribute('aria-hidden', 'true');
  item.append(badge, art, tag);
  return item;
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
