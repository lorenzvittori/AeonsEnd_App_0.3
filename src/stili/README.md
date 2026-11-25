# src/stili/

I CSS comuni a tutta l'app, i colori e l'ordine di tutti i CSS. Livello 0. Gli altri CSS stanno accanto al `.ts` che crea i loro
elementi (`ui/componenti/`, `ui/finestre/`, `ui/schermate/`).

## File
- `indice.ts`: **l'unico** modulo che importa i CSS (primo import di `main.ts`), in un ordine fisso: è la cascata.
- `palette.css`: **tutti i colori dell'app**, in due strati: colori base (`--colore-oro: #dfae59;`, un nome che dice il colore e un
  commento "Nome: dove si usa", raggruppati da `/* --- titolo --- */`) e ruoli (`--ae-gold: var(--colore-oro);`, `--ae-text`, `--ombra`...:
  dicono a cosa serve il colore e puntano a un colore base). Un colore base può avere una trasparenza sua (`#rrggbbaa`: oggi `--colore-velo`).
- `design-tokens.css`: spazi, raggi, durate, font (Cinzel per i titoli, Inter per l'interfaccia, da Google Fonts; senza rete fallback di sistema).
- `components.css`: componenti di base (pulsanti, badge, carta, finestre, scarti, toast, interruttore).
- `base.css`: pagina, shell (`#app`), sfondo unico, colonna centrale su tablet e desktop (da 768px), avviso del telefono in orizzontale.
- `comuni.css`: regole comuni a più schermate (menu a tendina `.ae-select`).

## Tablet e desktop (da 768px di larghezza, `base.css`)
La partita è la stessa del telefono in una colonna al centro (`--ae-col`, calcolata da `sizeColumn`: carta + 2 × 54px, mai meno di 440px); lo sfondo
riempie lo schermo; la pagina iniziale ha la sua colonna da 560px. Il tablet in verticale ha carte grandi (circa 460px a 768×1024), il desktop è
limitato dall'altezza (carte da 270-300px). La rotella del mouse scorre carte grandi e fasce piccole.

## Ordine della cascata
- A parità di specificità vince la regola che viene dopo, quindi **l'ordine di `indice.ts` è la cascata**: `palette`, `design-tokens`,
  `components`, `base`, `comuni`, poi `partita-misure` e `partita`, poi i pezzi (un file che ritocca elementi di un altro viene dopo di lui;
  ogni file lo dice nell'intestazione, "Ordine: deve venire dopo ..."). Le poche regole che stanno nel file di un altro pezzo per
  l'ordine hanno il commento "Ordine: regola di X.css; sta qui perché deve venire dopo ...".
- Una regola nuova va nel file del suo pezzo. Se ritocca a pari specificità un elemento stilato da un file importato dopo, o si alza la
  specificità o la regola va in quel file con il commento "Ordine: ...". Se si sposta un `.css`, in `indice.ts` cambia solo il percorso,
  mai la posizione. `check-moduli` rifiuta un `.css` importato altrove o non importato.

## Colori (controllati da Stylelint: `npm run colori`, lanciato anche da `npm run check`)
- Fuori da `palette.css` nessun colore scritto a mano nei CSS di `src/`: né esadecimali, né `rgb()`/`rgba()`/`hsl()`..., né nomi (`red`).
  Restano permessi `transparent`, `currentColor`, `inherit` e `color-mix()`. Un'eccezione ha un commento che dice perché
  (`/* stylelint-disable-next-line color-no-hex -- motivo */`; senza motivo, o non più necessaria, il controllo fallisce). I colori dentro
  le immagini SVG in `url("data:image/svg+xml...")` non si vedono (oggi: il segno bianco in `mazzo-turni.css`, la maschera in `turno-giocatori.css`).
- **Cambiare un colore:** si cambia il valore del colore base in `palette.css` (cambia ovunque lo usano i ruoli che lo puntano).
- **Aggiungere un ruolo:** nel CSS `var(--ruolo)`; la trasparenza è `color-mix(in srgb, var(--ruolo) 60%, transparent)`, mai un `rgba`. Il ruolo
  va nel secondo blocco di `palette.css` con il commento "dove si vede" e punta a un colore base che c'è già (se manca, prima il colore base).
  `tests/regolazioni.test.ts` controlla che ogni ruolo punti a un colore base che esiste.
- Il pannello Regolazioni della Modalità test legge colori e misure da questi CSS (formato `--nome: valore; /* etichetta */`): vedi
  [../ui/finestre/README.md](../ui/finestre/README.md).

## Da sapere prima di modificare
- Dopo uno spostamento o una divisione di file CSS, `npm run confronta -- <tag>` deve dare "schermate" identico (`getComputedStyle` di tutti gli elementi).
- Dividendo un `.ts` il suo `.css` resta intero (o si divide in pezzi consecutivi nello stesso punto di `indice.ts`).
