// tipi/dati.ts: i tipi dei dati letti all'avvio da public/ (cards.json, nemesis.json, products.json,
// deck-setup.json, Assets/nemesis/nemesis-art.json). Sono prodotti da tools/import-db.py dal DataBase.
// Non dipende da niente. Usato da: regole/, stato/, dati/ (anche dal controllo dei JSON in dati/controllo.ts), ui/.

// Codice prodotto di products.json: "4" = scatola base della wave 4, "4.1" = sua mini espansione
export type CodiceProdotto = string;

// Categoria di una carta nemesi: base, base potenziata, specifica di una nemesi
export type Categoria = 'Basic' | 'Upgraded' | 'Specific';

// Tipo della carta (Power, Minion, Attack: quelle del mazzo nemesi; le altre sono carte speciali di alcune nemesi)
export type TipoCarta = 'Power' | 'Minion' | 'Attack' | 'Corruption' | 'Strike' | 'Gem' | 'Curse' | 'Rush' | 'Reminder';

// Tier: 1-3 per le carte del mazzo nemesi; 0, 4-8, '9+' o null per carte speciali fuori dal mazzo (World Devourer...)
export type Tier = number | '9+' | null;

// Una carta di cards.json
export interface Carta {
  id: string;                    // identificativo unico ("AE204", "NA-1c-26"; più copie: "[D55, D58]")
  name: string;                  // nome inglese stampato sulla carta
  boxCode: CodiceProdotto;       // prodotto in cui è la carta
  category: Categoria;           // Basic / Upgraded / Specific
  nemesis: string | null;        // nemesi della carta Specific (null per Basic e Upgraded)
  tier: Tier;                    // Tier del mazzo nemesi
  type: TipoCarta;               // tipo della carta
  subType: string | null;        // sottotipo stampato (raro)
  hp: number | null;             // vita del minion (null per le altre carte e per i minion a vita variabile)
  hpVariable: boolean;           // minion con la vita "*": la decidono i giocatori quando entra in gioco
  shield: number | null;         // scudo (oggi sempre null nei dati)
  powerTokens: number | null;    // token del potere (null per le carte che non sono poteri)
  removalCost: number | null;    // costo in Æ per scartare il potere (null se non si scarta pagando Æ)
  removable: boolean;            // la carta si può scartare con un effetto (dato del DataBase)
  inNemesisDeck: boolean;        // la carta entra nel mazzo nemesi (false: carte speciali messe da parte)
  quantity: number;              // copie della carta nella scatola
  effect: string;                // testo dell'effetto
  toDiscard: string | null;      // testo "To Discard" (poteri e minion che si scartano con una condizione)
  immediately: string | null;    // testo "Immediately"
  persistent: string | null;     // testo "Persistent"
  powerEffect: string | null;    // testo dell'effetto del potere quando si risolve
  image: string;                 // scansione della carta (percorso in Data/; all'avvio diventa relativo a DATA_ROOT)
  thumb?: string;                // miniatura in thumbs/ (non è nel file: la aggiunge l'avvio, avvio.ts)
}

// Una nemesi di nemesis.json
export interface Nemesi {
  name: string;                  // nome della nemesi
  boxCode: CodiceProdotto | null;// prodotto (null per le Promo, mai giocabili)
  waveOrder: number;             // ordine dentro la wave (per gli elenchi)
  battle: number | null;         // battaglia di deck-setup.json (null: nemesi senza Deck Setup, non giocabile)
  flagBattle5: string | null;    // nota del DataBase sulla battaglia 5 (non usata dall'app)
  owned: boolean;                // posseduta secondo il DataBase (la collezione dell'app è a parte)
  life: number | null;           // vita iniziale della nemesi (null: non nota, vale 0)
  difficulty: number | null;     // difficoltà 1-10 stampata (null: non nota)
}

// products.json: codice prodotto -> nome del prodotto
export type Prodotti = Record<CodiceProdotto, string>;

// Carte per Tier (chiavi "1", "2", "3" nel JSON)
export interface CartePerTier {
  1: number;
  2: number;
  3: number;
}

// Riga di deck-setup.json per una battaglia e un numero di giocatori
export interface RigaDeckSetup {
  basic: CartePerTier;           // carte Basic da estrarre a caso per Tier
  upgradedBasic: CartePerTier;   // carte Upgraded da estrarre a caso per Tier
}

// Una battaglia di deck-setup.json
export interface BattagliaDeckSetup {
  battle: number;                            // numero della battaglia (1-4)
  players: Record<string, RigaDeckSetup>;    // per numero di giocatori ("1".."4")
}

// deck-setup.json (Nemesis Deck Setup)
export interface DeckSetup {
  description?: string;          // spiegazione per chi legge il file (non usata dall'app)
  battles: BattagliaDeckSetup[]; // una voce per battaglia
}

// Immagini di una nemesi (Assets/nemesis/nemesis-art.json)
export interface ArteNemesi {
  card: string;                  // carta della nemesi (fronte)
  portrait?: string;             // ritratto per il menu
  ratio?: number;                // rapporto altezza / larghezza della carta
  back?: string;                 // retro della carta della nemesi
}

// nemesis-art.json: nome della nemesi -> immagini
export type ArteNemesiTutte = Record<string, ArteNemesi>;

// I dati usati dalle regole del mazzo nemesi
export interface DatiRegole {
  cards: Carta[];                // cards.json
  nemeses: Nemesi[];             // nemesis.json
  deckSetup: DeckSetup;          // deck-setup.json
}
