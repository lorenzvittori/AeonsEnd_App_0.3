// ui/finestre/menu-laterale-icone.ts: le icone lineari del menu laterale della partita (SVG inline, dal mockup approvato). Ogni
// icona usa currentColor: il colore lo dà il CSS della voce. Livello 4 (ui/finestre/). Dipende da: nulla. Usato da:
// menu-laterale.ts.

export type IconaMenu = 'orologio' | 'annulla' | 'scarti' | 'statistiche' | 'trofeo' | 'freccia' | 'chiudi';

// Percorsi SVG del mockup (viewBox 0 0 24 24)
const PERCORSI: Record<IconaMenu, string> = {
  orologio: '<circle cx="12" cy="12" r="10"/><path d="M12 5.5 V12 L17 14.5"/>',
  annulla: '<path d="M2 9 L8 3 M2 9 L8 15 M2 9 H13 Q22 9 22 20"/>',
  scarti: '<rect x="5" y="1" width="14" height="19" rx="2"/><path d="M2 5 V23 H15"/>',
  statistiche: '<path d="M2 2 V21 H23 M7 16 V11 M13 16 V5 M19 16 V8"/>',
  trofeo: '<path d="M6 2 H18 V9 Q18 16 12 16 Q6 16 6 9 Z M6 5 H2 V8 Q2 12 7 12 M18 5 H22 V8 Q22 12 17 12 M12 16 V22 M6 22 H18"/>',
  freccia: '<path d="M9 6 L15 12 L9 18"/>',
  chiudi: '<path d="M6 6 L18 18 M18 6 L6 18"/>'
};

const NS = 'http://www.w3.org/2000/svg';

// Icona lineare in dimensione px (la dimensione e il colore li imposta il chiamante con le classi/CSS)
export function iconaMenu(nome: IconaMenu, px: number): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(px));
  svg.setAttribute('height', String(px));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('ae-menu-icon', 'ae-menu-icon--' + nome);
  // Il contenuto è solo dei percorsi qui sopra (costanti del modulo), non testo dell'utente
  svg.innerHTML = PERCORSI[nome];
  return svg;
}
