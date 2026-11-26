# src/dati/

Caricamento dei dati e uso della rete. Livello 1: importa da `tipi/`, `regole/` e `stato/`, mai da `ui/`.

## File
- `dati.ts`: lettura dei JSON di `public/` (senza cache del browser, il contenuto è `unknown`), caso del browser
  (`shuffle`), battaglia della nemesi.
- `controllo.ts`: controllo dei JSON all'avvio (chiamato da `avvio.ts`): campi obbligatori, tipi, valori ammessi. Una carta o
  una nemesi sbagliata si scarta con `console.error("Dati non validi: ...")` (id e campo); un file con la forma sbagliata, o un
  `deck-setup.json` sbagliato, ferma l'avvio. I messaggi sono in italiano, solo per la console.
- `collezione.ts`: la collezione (wave e prodotti posseduti, salvata nel browser), nemesi giocabili, `waveLabel` (cifre romane
  + nome in `products.json`). `COLLECTION_WAVES`: per ora solo le wave 1 e 4 sono selezionabili; i prodotti delle altre già
  salvati si tolgono all'avvio (`loadCollection`). Le chiavi del formato vecchio ("4 - The New Age|Shattered Dreams") si
  convertono nei codici ("4.1") e si risalvano (`convertCollectionKey`). Collezione vuota = Nuova partita non disponibile.
- `rete.ts`: schermo sempre acceso (Screen Wake Lock, `keepScreenOn`: all'avvio, al ritorno in primo piano, al primo tocco),
  registrazione del service worker `public/sw.js`, immagini delle carte del mazzo scaricate all'inizio o alla ripresa
  (`prefetchDeckImages`, non con "Risparmio dati").

## Formato dei dati (in `public/`, generati da `tools/import-db.py`: non si modificano a mano)
- `cards_nemesis.json`: `id` (testo del DataBase, es. `"NA-1b-02"`: solo identificatore, mai nei nomi dei file), `name`, `boxCode`
  (prodotto: `"1"`, `"4"`, `"4.2"`), `category`, `nemesis` (solo Specific), `tier` (0…8, `"9+"`, null), `inNemesisDeck` (solo
  queste entrano nel mazzo), `type` (Attack | Power | Minion), `subType`, `hp`, `hpVariable`, `shield`, `powerTokens`,
  `quantity`, `removalCost` (Æ per scartare il potere), `removable`, `image` (`Data/Nemesis/<Box>_<Prodotto>/.../Tier_N/<Nome>.webp`).
  `effect`, `toDiscard`, `immediately`, `persistent`, `powerEffect` sono testi non usati dall'app.
- `cards_supply.json` e `cards_treasure.json` (per la biblioteca: **non si leggono all'avvio**, li controlla `controllo.ts` nei
  test): `id` (copiato dal DataBase così com'è, es. `"[AE055, AE061]"`), `name`, `boxCode`, `type` (supply: Gem | Relic | Spell;
  tesori: Treasured Gem | Treasured Spell | Treasured Relic | Treasure Level 1-3), `level` (solo tesori: 1 per i Treasured, N per
  "Treasure Level N"), `cost` (numero in Æ; nei tesori può essere null), `mechanics` (parole chiave, o null), `effect` (testo, a capo
  con `\n`), `image` (`Data/Supply/<codice>/<Gem | Relic | Spell>/<Nome>.webp`, tesori: `Data/Treasure/<codice>/Level_N/<Nome>.webp`),
  `thumb` (stesso percorso sotto `thumbs/`). Entrano solo le carte con l'immagine.
- `products.json`: `{ codice: nome }` (`"4": "The New Age"`, `"4.1": "Shattered Dreams"`). Il codice senza punto è la
  scatola base della wave; la wave è la parte prima del punto (`waveOfCode`).
- `nemesis.json`: `name`, `boxCode` (null per le Promo, mai giocabili), `waveOrder`, `battle`, `flagBattle5`, `life` (vita
  iniziale, solo le 14 giocabili), `owned` (non più usato). `deck-setup.json`: tabella del Nemesis Deck Setup.
- Immagini: `Data/Nemesis/...` (WebP q90, max 1640px), `thumbs/Nemesis/...` (264×369, stesso albero con `thumbs/` al posto di
  `Data/`), `Assets/nemesis/` (`<slug>.webp`, `-back`, `-portrait`, `nemesis-art.json`), `Assets/ui/` (dorsi in `backs/`
  con `-thumb`, sfondi in `decor/`, Gravehold in `gravehold/`, carte e token dei turni, icone).

- Nemesi giocabili (14): The New Age (Maggoth 45, Arachnos 70, Ageless Walker 80, Fenrix 60 della scatola base; The Wailing 50, The Wanderer 40,
  Necroswarm 70 mini espansioni) e wave 1 (Rageborne 70, Crooked Mask 70, Horde-Crone 60, Blight Lord 70, Wayward One 60, Carapace Queen 60,
  Prince of Gluttons 70; gli ultimi due hanno un minion a vita variabile). Il numero è la vita iniziale (`life`).
- I dorsi in `Assets/ui/backs/` sono 28 più quello predefinito (`decor/card-back-logo.webp`); le carte dei turni in `Assets/ui/turn-cards/<carta>.webp`
  (p1…p4, p12, p34, nemesis, wild, back; 252×352) e i token dei giocatori in `Assets/ui/turn-tokens/pN.webp` e quello della nemesi in `Assets/ui/turn-tokens/N.webp` (232×232).

## Da sapere prima di modificare
- Un'immagine già pubblicata sostituita con lo **stesso nome**: i telefoni tengono la vecchia; si cambia `MEDIA_CACHE` in
  `public/sw.js` (oggi `ae-media-v2`). Codice e dati: prima la rete, poi l'ultima copia; immagini e font: prima la copia.
- Il Core Set non ha Upgraded: con la sola wave 1, dalla battaglia 2 il mazzo è più corto di `deck-setup.json` (domanda aperta).
- Prova: `tests/dati-json.test.ts` passa `controllo.ts` sui veri `public/*.json`.
