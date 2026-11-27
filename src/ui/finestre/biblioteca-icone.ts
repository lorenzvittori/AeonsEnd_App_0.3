// ui/finestre/biblioteca-icone.ts: le icone SVG della barra inferiore della Biblioteca (Gemme, Reliquie, Incantesimi) e
// la lente della ricerca. Geometrie fisse dalla specifica (viewBox -4 -4 56 56, stroke 3, currentColor): non vengono da
// librerie esterne. Il colore lo dà il CSS (biblioteca.css) con color.
// Livello 6 (finestre). Dipende da: tipi/dati.ts (TipoSupply). Usato da: ui/finestre/biblioteca.ts.

import type { TipoSupply } from '../../tipi/dati.ts';

const ATTRIBUTI = 'viewBox="-4 -4 56 56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';

const SVG_GEMME = `<svg xmlns="http://www.w3.org/2000/svg" ${ATTRIBUTI}>
  <path d="M16 40 V14 L24 5 L32 14 V40 Z
           M16 14 L24 20 L32 14
           M24 20 V40
           M16 40 H9 L4 22 L10 15 L16 20
           M32 40 H39 L44 22 L38 15 L32 20"/>
</svg>`;

const SVG_RELIQUIE = `<svg xmlns="http://www.w3.org/2000/svg" ${ATTRIBUTI}>
  <path d="M5 5 L24 19 L43 5
           M24 19 V23
           M24 23 L37 28 V37 L24 44
           L11 37 V28 Z
           M24 29 L30 34 L24 39
           L18 34 Z"/>
</svg>`;

const SVG_INCANTESIMI = `<svg xmlns="http://www.w3.org/2000/svg" ${ATTRIBUTI}>
  <g transform="translate(0 2.4) scale(1 .9)">
    <path d="M24 4
             Q24 18 38 24
             Q24 30 24 44
             Q24 30 10 24
             Q24 18 24 4 Z
             M39 4
             Q39 11 46 11
             Q39 11 39 18
             Q39 11 32 11
             Q39 11 39 4 Z
             M8 5
             Q8 11 14 11
             Q8 11 8 17
             Q8 11 2 11
             Q8 11 8 5 Z"/>
  </g>
</svg>`;

const SVG_LENTE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`;

// Icone dei filtri della barra (dalla specifica): scatola (set), fulmine (meccaniche), stella (preferiti)
const SVG_SET = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8 L12 3.5 L21.5 8 L12 12.5 Z M2.5 8 V16.5 L12 21 L21.5 16.5 V8 M12 12.5 V21 M7 5.85 L16.5 10.35"/></svg>`;
const SVG_MECCANICHE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 L3 14 H11 L11 22 L21 10 H13 Z"/></svg>`;
const SVG_STELLA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 2.5 L15 8.5 L22 9.5 L17 14.5 L18.2 21.5 L12 18.2 L5.8 21.5 L7 14.5 L2 9.5 L9 8.5 Z"/></svg>`;
// Filtro per sezione (le tre righe): nella sezione Preferiti, al posto della stella
const SVG_SEZIONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6 H20 M7 12 H17 M10 18 H14"/></svg>`;
// Freccia verso il basso dei box (10 px)
const SVG_FRECCIA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5 L6 8 L9.5 4.5"/></svg>`;

// Icona di una categoria del Mercato
const SVG_CATEGORIA: Record<TipoSupply, string> = { Gem: SVG_GEMME, Relic: SVG_RELIQUIE, Spell: SVG_INCANTESIMI };

// Un SVG della specifica come elemento (il markup è fisso, non viene da dati)
function svgElemento(markup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const radice = doc.documentElement;
  if (!(radice instanceof SVGSVGElement)) throw new TypeError('icona SVG non valida');
  const copia = document.importNode(radice, true);
  copia.setAttribute('aria-hidden', 'true');
  copia.setAttribute('focusable', 'false');
  return copia;
}

export function iconaCategoria(categoria: TipoSupply): SVGSVGElement {
  return svgElemento(SVG_CATEGORIA[categoria]);
}

export function iconaLente(): SVGSVGElement {
  return svgElemento(SVG_LENTE);
}

export function iconaSet(): SVGSVGElement {
  return svgElemento(SVG_SET);
}

export function iconaMeccaniche(): SVGSVGElement {
  return svgElemento(SVG_MECCANICHE);
}

export function iconaStella(): SVGSVGElement {
  return svgElemento(SVG_STELLA);
}

export function iconaSezione(): SVGSVGElement {
  return svgElemento(SVG_SEZIONE);
}

export function iconaFreccia(): SVGSVGElement {
  return svgElemento(SVG_FRECCIA);
}
