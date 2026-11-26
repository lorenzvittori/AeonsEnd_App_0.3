// scheletri/oggetti.ts: gli OGGETTI veri dell'app che la pagina scheletri/ disegna (oltre alle fasce delle zone): per ognuno un nome breve,
// la zona, come trovarlo nell'app (selettore CSS) e le variabili di partita-misure.css che lo riguardano. Solo dati: gli oggetti si
// misurano dal vivo (getBoundingClientRect nell'app dell'iframe, scheletri.ts); quelli che nel turno scelto non ci sono si saltano
// (i comandi della carta nel turno nemesi, "Annulla modifiche" senza modifiche non salvate...).
// Modo: 'tutti' = ogni elemento che si vede (numerati); 'centro' = quello che sta al centro dello schermo (la carta grande);
// 'vicine' = gli altri, nel pezzo che si vede (le carte vicine). I selettori sono gli stessi di tools/confronto/dati/misure.mjs.
// Dipende da: niente (solo dati). Usato da: scheletri.ts.

export interface OggettoDef {
  id: string;
  nome: string;
  zona: number;            // 1-7
  sel: string;
  modo?: 'tutti' | 'centro' | 'vicine';
  vars: string[];          // le variabili di partita-misure.css che lo riguardano (la prima è la principale)
}

const CARTA = '.queue-slot .ae-card-art, .ae-focus-stage';
const STATO = '.queue-slot .ae-status-badge, .ae-focus-status';
const COMANDI = '.queue-slot.is-centred > .queue-controls';

export const OGGETTI: OggettoDef[] = [
  // 1 testata
  { id: 'testata', nome: 'Testata', zona: 1, sel: '#topbar', vars: ['--testata-altezza', '--testata-spazio-sopra'] },
  { id: 'nome-nemesi', nome: 'Nome nemesi', zona: 1, sel: '.ae-phase-name', vars: ['--testata-margine-sinistro'] },
  { id: 'riga-turno', nome: 'Riga del turno', zona: 1, sel: '.ae-phase-turn', vars: ['--testata-margine-sinistro'] },
  { id: 'mazzo', nome: 'Mazzo', zona: 1, sel: '#pila-mazzo', vars: ['--testata-pile-altezza', '--testata-pile-numero', '--testata-pile-spazio'] },
  { id: 'scarti', nome: 'Scarti', zona: 1, sel: '#pila-scarti', vars: ['--testata-pile-altezza', '--testata-pile-spazio', '--testata-pile-margine-destro'] },
  { id: 'menu', nome: 'Menu', zona: 1, sel: '#menu-btn', vars: ['--testata-margine-destro', '--testata-spazio-colonne'] },
  // 2 fascia turno
  { id: 'barra-turni', nome: 'Barra dei turni', zona: 2, sel: '.ae-turn-track-bar', vars: ['--turno-barra-altezza', '--turno-spazio-sopra', '--turno-margine-lati'] },
  { id: 'casella', nome: 'Casella', zona: 2, sel: '.ae-turn-seg', modo: 'tutti', vars: ['--turno-casella-accesa', '--turno-caselle-spazio'] },
  { id: 'scritta-turno', nome: 'Scritta', zona: 2, sel: '.ae-turn-label', modo: 'tutti', vars: ['--turno-scritte-altezza', '--turno-scritte-distanza'] },
  // 3 fascia carte piccole
  { id: 'carta-piccola', nome: 'Carta piccola', zona: 3, sel: '#rail .ae-queue-item', modo: 'tutti',
    vars: ['--carte-piccole-altezza', '--carta-piccola-larghezza', '--carte-piccole-margine', '--carte-piccole-spazio'] },
  { id: 'stato-piccola', nome: 'Vita/token piccola', zona: 3, sel: '.ae-compact-rail .ae-status-badge', modo: 'tutti', vars: ['--carte-piccole-goccia-numero'] },
  // 4 vite
  { id: 'vita-gravehold', nome: 'Vita Gravehold', zona: 4, sel: '.ae-life-box--grave', vars: ['--vite-box-altezza', '--vite-margine-lati', '--vite-box-larghezza-minima-sfondo'] },
  { id: 'vita-nemesi', nome: 'Vita nemesi', zona: 4, sel: '.ae-life-box--nemesis', vars: ['--vite-box-altezza', '--vite-margine-lati', '--vite-spazio'] },
  { id: 'scritta-gravehold', nome: 'GRAVEHOLD', zona: 4, sel: '.ae-life-box--grave .ae-life-tag', vars: ['--vite-scritta-distanza'] },
  { id: 'scritta-nemesis', nome: 'NEMESIS', zona: 4, sel: '.ae-life-box--nemesis .ae-life-tag', vars: ['--vite-scritta-distanza'] },
  // 5 fascia carte grandi
  { id: 'riga-stato', nome: 'Riga vita/token', zona: 5, sel: STATO, modo: 'tutti',
    vars: ['--carte-grandi-riga-stato-altezza', '--carte-grandi-riga-stato-distanza', '--carte-grandi-spazio-sopra'] },
  { id: 'goccia', nome: 'Goccia', zona: 5, sel: '.queue-slot .ae-status-badge .ae-icon, .ae-focus-status .ae-icon', modo: 'tutti', vars: ['--carte-grandi-icona', '--carte-grandi-goccia-numero'] },
  { id: 'token', nome: 'Token', zona: 5, sel: '.queue-slot .ae-token, .ae-focus-status .ae-token', modo: 'tutti', vars: ['--carte-grandi-token'] },
  { id: 'numero', nome: 'Numero', zona: 5, sel: '.queue-slot .ae-status-badge > span:not(.ae-icon):not(.ae-tokens), .ae-focus-status > span:not(.ae-icon):not(.ae-tokens)', modo: 'tutti',
    vars: ['--carte-grandi-numero-interlinea', '--carte-grandi-numero', '--carte-grandi-goccia-numero'] },
  { id: 'carta-grande', nome: 'Carta grande', zona: 5, sel: CARTA, modo: 'centro',
    vars: ['--carte-grandi-riga-stato-distanza', '--interattivi-distanza', '--carte-grandi-margine-lato', '--carte-grandi-spazio'] },
  { id: 'carta-vicina', nome: 'Carta vicina', zona: 5, sel: CARTA, modo: 'vicine', vars: ['--carte-grandi-vicine-visibili', '--carte-grandi-spazio'] },
  // 6 pulsanti interattivi
  { id: 'comandi', nome: 'Comandi', zona: 6, sel: COMANDI, vars: ['--interattivi-altezza', '--interattivi-distanza'] },
  { id: 'comando', nome: 'Comando', zona: 6, sel: COMANDI + ' .ae-button', modo: 'tutti', vars: ['--interattivi-spazio'] },
  // 7 pulsante principale
  { id: 'principale', nome: 'Pulsante principale', zona: 7, sel: '#pulsante-principale',
    vars: ['--principale-altezza', '--principale-spazio-sopra', '--principale-margine-lati', '--principale-spazio-sotto'] },
  { id: 'annulla', nome: 'Annulla modifiche', zona: 7, sel: '#annulla-modifiche', vars: ['--principale-spazio'] }
];
