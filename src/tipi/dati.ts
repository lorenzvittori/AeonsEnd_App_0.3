// tipi/dati.ts: i tipi dei dati letti all'avvio da public/ (cards_nemesis.json, nemesis.json, products.json,
// deck-setup.json, Assets/nemesis/nemesis-art.json). Sono prodotti da tools/import-db.py dal DataBase.
// Non dipende da niente. Usato da: regole/, stato/, dati/ (anche dal controllo dei JSON in dati/controllo.ts), ui/.

// Codice prodotto di products.json: "4" = scatola base della wave 4, "4.1" = sua mini espansione
export type CodiceProdotto = string;

// Categoria di una carta nemesi: base, base potenziata, specifica di una nemesi
export type Categoria = 'Basic' | 'Upgraded' | 'Specific';

// Tipo della carta (Power, Minion, Attack: quelle del mazzo nemesi; le altre sono carte speciali di alcune nemesi)
export type TipoCarta = 'Power' | 'Minion' | 'Attack' | 'Corruption' | 'Strike' | 'Gem' | 'Curse' | 'Rush' | 'Reminder';

// Tipo di una carta supply (biblioteca) e di una carta tesoro (il Type del DataBase: "Treasured Gem" ecc.)
export type TipoSupply = 'Gem' | 'Relic' | 'Spell';
export type TipoTesoro = 'Treasured Gem' | 'Treasured Spell' | 'Treasured Relic' | 'Treasure Level 1' | 'Treasure Level 2' | 'Treasure Level 3';

// Tier: 1-3 per le carte del mazzo nemesi; 0, 4-8, '9+' o null per carte speciali fuori dal mazzo (World Devourer...)
export type Tier = number | '9+' | null;

// Una carta di cards_nemesis.json
export interface Carta {
  id: string;                    // identificativo unico ("AE204", "NA-1c-26"; più copie: "[D55, D58]")
  name: string;                  // nome inglese stampato sulla carta
  boxCode: CodiceProdotto;       // prodotto in cui è la carta
  box: string | null;            // scatola grande (colonna Box del DataBase, es. "The New Age")
  miniExpansion: string | null;  // mini espansione (null se la carta è della scatola grande)
  mechanics: string[];           // meccaniche: sempre [] per le nemesi (il DataBase non le ha)
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
  toDiscardSpend: number | null; // X di "To Discard: Spend X Æ" (null se la carta non ha questo effetto)
  image: string;                 // scansione della carta (percorso in Data/; all'avvio diventa relativo a DATA_ROOT)
  back?: string;                 // retro della carta (Path_BACK del DataBase), se c'e' un file: stesso albero di image, nome _back
  thumb?: string;               // miniatura in thumbs/ (non è nel file: la aggiunge l'avvio, avvio.ts)
}

// Una carta supply di cards_supply.json (per la biblioteca: non si legge all'avvio). Il costo è in Æ
export interface CartaSupply {
  id: string;                    // identificativo copiato dal DataBase così com'è ("[AE055, AE061]": più copie)
  name: string;                  // nome inglese stampato sulla carta
  boxCode: CodiceProdotto;       // prodotto in cui è la carta (la mini espansione se c'è, altrimenti la scatola base)
  box: string | null;            // scatola grande (colonna Box, es. "The New Age")
  miniExpansion: string | null;  // mini espansione (null se non c'è)
  type: TipoSupply;              // Gem, Relic, Spell
  cost: number;                  // costo in Æ
  mechanics: string[];           // meccaniche (colonna Mechanics divisa su ";"), [] se nessuna
  effect: string | null;         // testo dell'effetto, a capo con \n
  image: string;                 // scansione della carta (Data/Supply/...)
  thumb: string;                 // miniatura (thumbs/Supply/...)
}

// Una carta tesoro di cards_treasure.json: come la supply, con il livello (1 per i Treasured, 1-3 per i Treasure Level)
export interface CartaTesoro extends Omit<CartaSupply, 'type' | 'cost'> {
  type: TipoTesoro;              // "Treasured Gem" | "Treasured Spell" | "Treasured Relic" | "Treasure Level 1-3"
  level: number;                 // livello del tesoro (ricavato dal Type)
  cost: number | null;           // costo in Æ (i tesori spesso non ce l'hanno)
}

// Una meccanica di public/mechanics.json (solo quelle delle carte supply): il nome nell'app (quello in cards_*.json),
// il nome nel DataBase (dbName, diverso solo se c'è un rinomino), il nome italiano (null finché non c'è) e quante
// carte di cards_supply.json la hanno (0 se nessuna)
export interface Meccanica {
  name: string;
  dbName: string;
  it: string | null;
  cards: number;
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
  cards: Carta[];                // cards_nemesis.json
  nemeses: Nemesi[];             // nemesis.json
  deckSetup: DeckSetup;          // deck-setup.json
}
