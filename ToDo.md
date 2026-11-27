# Grandi miglioramenti:
[x] Aggiungere ordine turno
[x] Implementare biblioteca carte (Nemesi, Mercato, Tesori, Preferiti; box 1, 2, 4, 5 e mini espansioni)
[] Assistente per la creazione del mercato

# Stato al 28/11 (dai commit del 26-27/11)
Fatto:
- [x] Biblioteca: pulsante nel menu, Mercato a tutto schermo, filtri su una riga (ricerca, box, meccaniche, costo), chip dei filtri attivi, preferiti con la stella e sezione Preferiti
- [x] Biblioteca: carte tutte della stessa altezza, angoli come nelle partite, pannello sotto la carta con box e meccaniche, simbolo Aether
- [x] Dati: cards_nemesis.json, cards_supply.json, cards_treasure.json, mechanics.json; box 2 e 5 (con mini espansioni) importati
- [x] Collezione: si possono scegliere solo le wave 1, 2, 4 e 5
- [x] import-db trova le immagini nemesi anche con il prefisso "1 - " nelle cartelle del DataBase (Bane Sire aggiornata; carte nemesi da 243 a 469)
- [x] Nemesi: retro delle carte salvato (campo back), campo toDiscardSpend, controllo automatico POWER n (npm run check)
- [x] Versione automatica v0.3.x nel menu iniziale
- [x] Mazzo dei turni: linea del tempo sotto le carte; token della nemesi nella finestra Pesca nuovo turno
Da fare:
- [] Assistente per la creazione del mercato
- [x] Barra dei turni (sezione sotto)
- [x] Menu principale: Continua partita e Opzioni (collezione, back, sfondo, lingua, animazione)
- [] Regole dentro il gioco
- [] Creare il menu "modalità" e forse ristrutturare in menu inizia partita
- [] Mettere bene le lingue, mettere francese e tedesco

# Generale:
- [] rifare menu iniziale sopratutto titolo e "riprendi partita"
- [] capire come gestire la "collezione". possibilità:
    * togliere la collezione così nella biblioteca posso vedere tutto e poi la seleziono nel menu wave dentro nuova partita. in quesot modo posso fare boss anche che non ho. 
    * se invece tengo la collezione posso mettere un simbolo (lucchetto chiuso o aperto) per le nemesi che posso giocatore anche se non ho la scatola. 
- [] mettere in ordine per battaglia le nemesi nel menu nemesi di nuova partita


# Biblioteca:
- [] Togliere preferiti dal menu a tendina in alto
- [] Aggiungere logi/icone per Nemesi, Mercato e Tesori
- [] Rivedere il menu delle scatola, mettere le spedizioni indentate a destra sotto le wave e togliere x.y * NAME, tenere solo x * NAME
- [] mettere il numero di carte avvianco al costo nel menu del costo
- [] aggiungere "seleziona tutto" nel menu costo e boxes
- [] aggiungere "tutti" nel menu in basso quindi gemme/reliqui/incantesimi insieme
- [] nel menu meccaniche le voglio vedere tutte ma sono oscurate (non selezionabili) quelle relative a tipi di carte che non sto vedendo. affianco al nome della meccanica mettere il tipo, non solo il numero. Es: "Dual Breach"[icona incantesimo] (numero delle carte)


# Scheda Mazzo Turno 
- Interazione necessarie (solo The New Age e Core Set):
[x] vedere gli scarti: Hatch, Unrelenting Ire, Thunderous Tempest.
[x] rimescolare dagli scarti al mazzo una o più carte a scelta: Nothingness, Sunder, Lash, Talix.
[x] rivelare la prima carta e rimetterla in cima o in fondo: Flare, Xaxos’s Flare e Hissing Acid la rimettono solo in cima; Quartz Shard e Lash’s Quartz Shard permettono anche il fondo.
[x] rivelare tutto il mazzo e sceglierne l’ordine: Xaxos.
[x] errore: quando rivelo tutto o copro tutto le carte negli scarti si muovo, non devono farlo. 
[x] diminuire grandezza cerchio dell'occhio della prima carta mazzo turno 
[x] errore: quando c'è una sola carta nel mazzo turno e la sposto posso mettere la carta sia nel posto precedete sia alla sua sinitra. soluzione: quando muovo l'ultima carta del mazzo gli unici posti in cui posso andare sono: in cima al mazzo scarti (e c'è già il cerchio) oppure tornare nel mazzo turno al posto della carta fantasma e non serve il cerchio. 
[x] errore: quando il mazzo turno è vuoto e sposto una carta scarti il luogo tratteggiato sotto il mazzo turno deve avere la stessa dimensione delle carte degli scarti. 
[x] errore: manca il cerchio nella carta del mazzo turno quando muovo una carta dagli scarti e il mazzo turno è vuoto
[x] quando ci c'è 1 carta nel mazzo turno, la scritta "mazzo turno" deve avere la stessa dimensione font di quando non ce ne sono più
[x] errore: carte + box carte insieme devono sempre toccare bordo sinistro e bordo destro dell'app che dovrebbero essere 16px a sx e dx. le dimennsioni poi devono essere relative come sono già ora. 




# Barra dei turni
quella che lo scheletro chiama barra della fase è la barra dei turni, non la barra delle carte turno. quindi servono queste modifiche:
- se nella scheda mazzo turno sposto una carta dagli scarti in cima o in fondo al mazzo si compare in alto a destra come turno futuro ma non scompare come turno passato, lo stesso vale per la carta turno corrente, se io, durante il turno del giocatore 4, rimetto dentro la carta 3/4 del turno in corso in cima al deck deve rimanere "Giocatore 4" in viola e a destra il turno successivo. in questo caso il software dovrebbe dedurre che è obbligatoriamente il giocatore 3.
- in questo modo in alto i turni possono essere molti più di 6


# Palette
- fare un file palette in cui ci sono tutte le palette del gioco
. da capire se può essere dinamico, nel senso che tutti  file vanno a leggere da questo unico per capire i colori da usare


# DOMDANDE:
- quando gioco contro una nemesi devo usare solo le carte della wave della nemesi?
    - NO
- se devo rimettere in gioco la turn order card di un giocatore ma gioco con le regole di the new age e metto una carta 3/4, devo poi riscegliere chi gioca? No, segui la regole dei toke 1/2 e 3/4


# Generale:
- [x] cambiare visualizzazione di VITTORIA
- [x] Fare una back senza la scritta da usare per i mazzi
- non mettere il nome nemesi e le info al centro ma spostale attaccate a destra
- [x] creare la time line
- [x] inserire nelle statistiche il tempo della partita
- [x] nei turni in gioco dei Minions, mettere la foto del Minion
- rifare creazione del mazzo, la 0.3 ha delle buone idee
- [x] quando faccio danni ad un Minion che ha vita X devo vedere x/X
- Rimpicciolire le carte in alto per guadagnare spazio, tenere i token potere e la vita. si può pensare di non fare la miniatura ma di creare delle carte solo gialle per i poteri e solo azzurre per i minion, o ancora meglio, tenere solo la parte in alto della carta, solo lartwork
- dare feedback di danni come nella 0.3
- [x] le wave non numerarle con numeri arabi ma con numeri romani
- [x] Aggiungere la scelta del back delle carte come valore estetico e customizzabile in più (idea: mettere il back delle carte da briscola)
- Mettere le regole dentro il Gioco, magari copiando la wiki o addirittura mettendo una parte di ai (chiamata API)
- [x] rorfare il webp di bane sire (commit 89047e5)
- il box per il divieto rosso sulle carte potere più piccolo
-  

# Menu Principale 
- [x] togliere il box dei pulsanti, mostra solo le scritte
- Ci deve essere: Nuova Partita, continua partita, opzioni, Biblioteca (Biblioteca fatta)
- Opzioni -> collezione, scelta back, scelta sfondo, scelta lingua, scelta se fare animazione di creazione mazzo

# Menu Nuova Partita
- [x] Togliere titolo Aeons End e Nemesis Companion e scrivere Nuova Partita
- [x] Sostituire il menu con la X che mi fa tornare al menu iniziale
- [x] la sezione con Nuova partita e la X per uscire deve essere blcocata e sfumare di nero il resto
- [x] per la wave metti un menu a tendina da cui selezionare, posso selezionarne più di una
- [x] A destra della sezione Nemesi metti un simbolo per la scelta causale della nemesi tra tutte quelle in collezione
- [x] il pulsante inizia partita ha una maschera nera sopra che sfuma, ma inizia a sfumare subito sopra il pulsante. metti un po' di pxel di nero al 100% e poi inizia a sfumare come adesso.
- [x] la freccia verso il basso per aprire i dettagli del boss deve essere attaccata al boss selezionato, ora è troppo in basso

# Finestra Collezione
- [x] Ci deve essere Seleziona tutto e deseleziona tutto
- [x] il flag on/off delle espansioni devono essere più piccole le leggermente più a sinistra del falg della wave

# Barra informativa superiore
- [x] inverti il nome della nemesi e i mazzi pesca e scarti. A sinitra mette il nome della nemesi, sotto metti battaglia, giocatori e turno. a destra metti mazzo pesca e mazzo scarti, ancora a destra il pulsante menu. 

# Barra lista carte piccole (in ogni fase):
- quando una carta viene rimossa(minion ucciso, potere pagato o risolto, attacco risolto) deve passare da trasparenza 100 a trasparenza 0 nello stesso tempo in un la carta grande va nel mazzo pesca. nella lista, le carta a destra della carta rimossa si rispostano a sinistra solo dopo che la carta è arrivata a 0 di trasparenza. a quel punto di blocco le carte si spostano velocemnte a sinistra in modo "pensate" con un'animazione che le fa rimbalzare unsa sola volta poco.
- nel poteri aggiungi un box in basso alle carte in cui metti il costo da pagare per scartalo
- [x] aumenta la velocita si passaggio da una carta a quella cliccata del 50% 


# Vista grande carte (in ogni fase):
- [x] devo poter vedere le interazioni (modificare vita per i minin e rimuovere poteri) solo per la carta al centro dello schermo, per le altre no. 
- [x] se clicco su una carta che non è quella centrale, non mi apre la carta ma mi sposta su quella carta. la carta la apro solo se clicco la carta centrale nella visualizzzazione grande. 
- quando rimuovo una carta, le altre carte non si adattano subito e si mettano al centro, aspettano che la carta sia nel mazzo pesca e poi si spostano al centro. 
- vorrei che lo Swipe fosse più "magnetico", non può bloccarsi tra due carte, le animazioni più elastiche. 
- [x] bug: nel turno nemesi ora vedo la vita dei minion del tipo x/X anche se non gli ho fatto danno
- [x] quando faccio danno ad un minion voglio vedere x/X ma X non deve essere la vita iniziale del minion ma la vita che aveva prima del danno.


