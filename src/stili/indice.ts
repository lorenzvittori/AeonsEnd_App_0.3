// stili/indice.ts: tutti i CSS dell'app, importati da qui e solo da qui (tools/check-moduli.mjs lo controlla), in un
// ordine fisso. Nel CSS a parità di specificità vince la regola che viene dopo: l'ordine qui sotto è quello della
// cascata e non dipende dall'ordine in cui i moduli .ts si importano a vicenda.
// L'ordine:
// - token (design-tokens.css), componenti di base (components.css), struttura della pagina (base.css) e regole comuni
//   (comuni.css): prima di tutto, le schermate li ritoccano;
// - poi i pezzi dell'interfaccia: dove due file ritoccano lo stesso elemento a pari specificità, quello che deve vincere
//   viene dopo (ogni file lo dice nell'intestazione, "Ordine: deve venire dopo ..."). Le poche regole che stanno nel
//   file di un altro pezzo per l'ordine lo dicono nel loro commento ("Ordine: regola di ...").
// Dipende da: i file .css di src/stili/ e di src/ui/. Usato da: main.ts (primo import).

import './design-tokens.css';
import './components.css';
import './base.css';
import './comuni.css';
import '../ui/componenti/dialoghi.css';
import '../ui/componenti/scarti.css';
import '../ui/componenti/pesca-undo.css';
import '../ui/eventi.css';
import '../ui/schermate/opzioni.css';
import '../ui/schermate/vite.css';
import '../ui/schermate/mazzo-turni.css';
import '../ui/schermate/test.css';
import '../ui/componenti/menu-laterale.css';
import '../ui/schermate/menu.css';
import '../ui/schermate/turno-nemesi.css';
import '../ui/componenti/componenti.css';
import '../ui/schermate/turno-giocatori.css';
import '../ui/componenti/testata.css';
import '../ui/schermate/crea-mazzo.css';
import '../ui/schermate/statistiche.css';
