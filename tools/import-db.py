"""Ponte DataBase -> app: genera cards_nemesis.json, cards_supply.json, cards_treasure.json, products.json e le
immagini delle carte dal DataBase.

Legge (SOLO LETTURA; gli Excel vengono prima copiati in una cartella temporanea e letta la copia):
    <DataBase>/Data/NEMESIS_CARDS.xlsx      una riga per carta nemesi
    <DataBase>/Data/SUPPLY_CARDS.xlsx       una riga per carta supply (Gem, Relic, Spell)
    <DataBase>/Data/TREASURE_CARDS.xlsx     una riga per carta tesoro (Treasured..., Treasure Level N)
    <DataBase>/Data/DataBase_*.xlsx         foglio MAIN: Path_FRONT dell'immagine (PNG), ritrovato per UID (supply e tesori)
    <DataBase>/pipeline.py                  BOXES_NAMES: codice scatola -> nome del prodotto

Scrive nel repository dell'app:
    cards_nemesis.json, cards_supply.json, cards_treasure.json, products.json, mechanics.json (solo supply)
    Data/Nemesis/<BoxCode>_<Prodotto>/<_Basics | _Upgraded | Nemesi>/Tier_<N>/<Nome>.webp   (WebP 90, max 1640 px)
    thumbs/Nemesis/...  (stesso albero, miniature ~264 x 369)
    Data/Supply/<codice>/<Gem | Relic | Spell>/<Nome>.webp e Data/Treasure/<codice>/<Level_N>/<Nome>.webp, con le
        miniature in thumbs/Supply e thumbs/Treasure (stessi formati e qualita' delle nemesi)
    Assets/nemesis/<slug>.webp, -back.webp, -portrait.webp, nemesis-art.json   (illustrazioni delle nemesi, dalla
        plancia "mat" nel MAIN; si fanno solo per le nemesi che non hanno ancora la voce, --force-art le rifa tutte)
    tools/anteprima-nemesi/   con --anteprima: pagina per confrontare i ritagli (immagini fuori da git, non pubblicata)

Le carte di The New Age che l'app aveva gia' (vecchio cards.json, ora cards_nemesis.json) NON vengono riconvertite: la
scansione e la miniatura esistenti vengono spostate con "git mv" nel nuovo percorso. Un file gia' presente non si
sovrascrive mai, salvo con --force. Le carte il cui PNG manca (e che non hanno gia' l'immagine nell'app) NON entrano nei
file JSON: lo script le elenca per scatola nelle segnalazioni. Rilanciato due volte, lo script dà lo stesso risultato.

Uso (dalla cartella del repository, servono openpyxl e Pillow):
    python tools/import-db.py                      # DataBase predefinito: ..\\DataBase
    python tools/import-db.py "C:\\percorso\\DataBase"
    python tools/import-db.py --no-images          # solo i JSON delle nemesi e products.json
    python tools/import-db.py --solo-supply        # solo cards_supply.json e Data/Supply, thumbs/Supply
    python tools/import-db.py --solo-tesori        # solo cards_treasure.json e Data/Treasure, thumbs/Treasure
    python tools/import-db.py --force              # rifa' anche le immagini e le miniature gia' presenti
"""

import argparse
import ast
import glob
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

import openpyxl
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]  # cartella del repository
# File del sito (Data/, thumbs/, Assets/, cards_nemesis.json, cards_supply.json, products.json...): stanno
# in public/. I percorsi scritti DENTRO i JSON restano relativi alla radice del sito (Data/..., Assets/...)
SITE = ROOT / 'public'
IMG_ROOT = Path('Data') / 'Nemesis'
THUMB_ROOT = Path('thumbs') / 'Nemesis'
MAX_WIDTH = 1640
WEBP_QUALITY = 90
THUMB_SIZE = (264, 369)
THUMB_QUALITY = 76
CARDS_NEMESIS = 'cards_nemesis.json'  # era cards.json: il nome dice che sono le carte del mazzo nemesi

# Supply e tesori (per la biblioteca): file Excel, JSON, cartelle delle immagini (sotto Data/ e thumbs/)
EXTRA = {
    'supply': {'excel': 'SUPPLY_CARDS.xlsx', 'json': 'cards_supply.json', 'main_type': 'Supply',
               'img': Path('Data') / 'Supply', 'thumb': Path('thumbs') / 'Supply'},
    'treasure': {'excel': 'TREASURE_CARDS.xlsx', 'json': 'cards_treasure.json', 'main_type': 'Treasure',
                 'img': Path('Data') / 'Treasure', 'thumb': Path('thumbs') / 'Treasure'},
}
SUPPLY_TYPES = ('Gem', 'Relic', 'Spell')

# Colonna Excel -> chiave JSON (iniziale minuscola); quelle che non servono calcoli
PLAIN_TEXT = {'ID': 'id', 'Name': 'name', 'BoxCode': 'boxCode', 'Type': 'type', 'SubType': 'subType'}
PLAIN_NUMBER = {'Shield': 'shield', 'PowerTokens': 'powerTokens', 'RemovalCost': 'removalCost', 'Quantity': 'quantity'}
FLAGS = {'Removable': 'removable', 'InNemesisDeck': 'inNemesisDeck'}
PREFIX = re.compile(r'^(TO DISCARD|IMMEDIATELY|PERSISTENT|POWER\s*\d+)\s*:\s*(.*)$')
PART_KEY = {'TO DISCARD': 'toDiscard', 'IMMEDIATELY': 'immediately', 'PERSISTENT': 'persistent'}

# Rinomini delle meccaniche, lato app (il DataBase non si tocca): nome nel DataBase -> nome nell'app. Si applica alla
# colonna Mechanics di tutte le carte che il ponte scrive (cards_supply.json, cards_treasure.json) e ai nomi di
# mechanics.json (name = nome nell'app, dbName = nome nel DataBase). Una voce che non trova nessuna riga del DataBase
# finisce nelle segnalazioni. Per aggiungerne una: una riga qui sotto, "Nome nel DataBase": "Nome nell'app", poi
# rilanciare il ponte. Il nome va scritto esattamente come nella colonna Mechanics (maiuscole e spazi compresi).
RINOMINI_MECCANICHE = {
    'Dual Breach Spell': 'Dual Breach',
    'Cards that Interact with Trinket': 'Trinket Interaction',
}


# ------------------------------------------------------------------------------------------------ utilita'
def slugify(text: str) -> str:
    """Nome sicuro per file e cartelle: copia di aeon_db/naming.py, in piu' senza parentesi (Aeon's End (Core Box)
    -> Aeons_End_Core_Box)."""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    text = re.sub(r'[^\w\s-]', '', text).strip()
    text = re.sub(r'\s+', '_', text)
    return text or 'senza_nome'


def box_key(name) -> str:
    """Rende confrontabili i nomi delle scatole (maiuscole, alias di naming.py)."""
    n = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', str(name or '')).strip().lower()
    aliases = {'core set': "aeon's end (core box)", "aeon's end": "aeon's end (core box)"}
    return aliases.get(n, n)


def text_or_none(v):
    """Cella -> testo, oppure None se vuota o '-'."""
    if v is None:
        return None
    s = str(v)
    return None if s.strip() in ('', '-') else s


def number_or_text(v):
    """Cella -> intero se e' un numero; None se vuota o '-'; altrimenti il testo."""
    s = text_or_none(v)
    if s is None:
        return None
    s = s.strip()
    return int(s) if re.fullmatch(r'\d+', s) else s


def tier_value(v):
    """Tier: intero, '9+' (testo) o None."""
    return number_or_text(v)


def mechanics_names(v):
    """Colonna Mechanics ("Pulse Token;Recall") -> nomi come nel DataBase, senza spazi ai bordi; vuota -> []."""
    text = text_or_none(v)
    if text is None:
        return []
    return [m.strip() for m in text.split(';') if m.strip()]


def nome_app(nome_db):
    """Nome di una meccanica nell'app: il rinomino di RINOMINI_MECCANICHE, altrimenti lo stesso nome."""
    return RINOMINI_MECCANICHE.get(nome_db, nome_db)


def mechanics_list(v):
    """Colonna Mechanics -> elenco di nomi nell'app (con i rinomini), come va in cards_supply.json e cards_treasure.json."""
    return [nome_app(m) for m in mechanics_names(v)]


def natural_key(s):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r'(\d+)', str(s or ''))]


def code_key(code):
    return [int(p) for p in str(code).split('.')]


def read_sheet(path, sheet=None):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    head = list(rows[0])
    return [dict(zip(head, r)) for r in rows[1:] if any(c is not None for c in r)]


def read_boxes_names(pipeline_py: Path) -> dict:
    """BOXES_NAMES da pipeline.py, senza importarlo (importa config e altro)."""
    tree = ast.parse(pipeline_py.read_text(encoding='utf-8'))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'BOXES_NAMES' for t in node.targets):
            return ast.literal_eval(node.value)
    raise SystemExit('BOXES_NAMES non trovato in pipeline.py')


def split_effect(effect, issues, label, ctype):
    """Effect -> (toDiscard, immediately, persistent, powerEffect). Segnala nei problemi i testi dubbi."""
    out = {'toDiscard': None, 'immediately': None, 'persistent': None, 'powerEffect': None}
    if not effect:
        return out
    parts = defaultdict(list)
    current = None
    pre = []
    power_labels = set()
    for line in str(effect).replace('\r', '').split('\n'):
        m = PREFIX.match(line.strip())
        if m:
            tag = re.sub(r'\s+', ' ', m.group(1))
            if tag.startswith('POWER'):
                power_labels.add(tag)
                tag = 'POWER'
            current = tag
            if parts[current]:
                issues.append(f'{label}: prefisso "{tag}" ripetuto, i testi sono stati uniti')
            parts[current].append(m.group(2))
        elif current is None:
            pre.append(line)
        else:
            parts[current].append(line)
    if not parts:
        if ctype == 'Power':
            issues.append(f'{label}: Power senza prefissi, Effect non diviso')
        return out
    if any(p.strip() for p in pre):
        issues.append(f'{label}: testo prima del primo prefisso non assegnato a nessun campo: "{" / ".join(p for p in pre if p.strip())}"')
    if len(power_labels) > 1:
        issues.append(f'{label}: piu\' prefissi POWER diversi {sorted(power_labels)}, testi uniti in powerEffect')
    for tag, lines in parts.items():
        text = '\n'.join(lines).strip() or None
        out['powerEffect' if tag == 'POWER' else PART_KEY[tag]] = text
    return out


def tier_folder(tier):
    return 'No_Tier' if tier is None else f'Tier_{tier}'


def tier_sort(tier):
    if tier is None:
        return 99
    if isinstance(tier, int):
        return tier
    return int(re.match(r'\d+', tier).group()) + 0.5  # "9+"


def git(*args):
    return subprocess.run(['git', '-C', str(ROOT), *args], capture_output=True, text=True)


# ------------------------------------------------------------------------------- illustrazioni delle nemesi
# Le illustrazioni hanno una misura fissa (sotto):
# qui la fonte e' la plancia della nemesi nel MAIN (Format "mat", Type "Nemesis", Category = Name = nome nemesi).
ART_DIR = SITE / 'Assets' / 'nemesis'
ART_CARD_WIDTH = 1000
ART_PORTRAIT = (480, 212)  # circa 2,26:1, la forma del riquadro nel pulsante (menu.css: .nemesis-art)
ART_QUALITY = 90
# Ritaglio standard (frazioni della carta: sinistra, alto, destra, basso); l'altezza si calcola dalla proporzione
# di ART_PORTRAIT (None). Eccezioni per nemesi in ART_CROPS.
ART_DEFAULT_CROP = (0.073, 0.06, 0.927, None)
ART_CROPS = {
    # 'Nome nemesi': (0.073, 0.06, 0.927, None),
}
PREVIEW_DIR = ROOT / 'tools' / 'anteprima-nemesi'


def art_slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def portrait_box(img, crop):
    w, h = img.size
    left, top, right, bottom = crop
    box_w = (right - left) * w
    box_h = box_w * ART_PORTRAIT[1] / ART_PORTRAIT[0] if bottom is None else (bottom - top) * h
    return (round(left * w), round(top * h), round(left * w + box_w), round(top * h + box_h))


def make_portrait(img, name):
    return img.crop(portrait_box(img, ART_CROPS.get(name, ART_DEFAULT_CROP))).resize(ART_PORTRAIT, Image.LANCZOS)


def make_card(img):
    card = img.copy()
    card.thumbnail((ART_CARD_WIDTH, ART_CARD_WIDTH * 2), Image.LANCZOS)
    return card


def build_nemesis_art(data, main_rows, args, issues):
    """Crea Assets/nemesis/<slug>.webp, -back.webp, -portrait.webp e aggiorna nemesis-art.json.
    Salta le nemesi che hanno gia' la voce e i file (salvo --force-art); le voci esistenti non si toccano."""
    names = {n['name'] for n in json.loads((SITE / 'nemesis.json').read_text(encoding='utf-8-sig'))}
    manifest_path = ART_DIR / 'nemesis-art.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig')) if manifest_path.exists() else {}
    ART_DIR.mkdir(parents=True, exist_ok=True)
    done, skipped, previews = [], [], []
    for m in main_rows:
        name = str(m.get('Name') or '').strip()
        if not (m.get('Type') == 'Nemesis' and m.get('Format') == 'mat' and name and name == str(m.get('Category') or '').strip()):
            continue
        if name not in names:
            issues.append(f'illustrazione nemesi: "{name}" non e\' in nemesis.json, saltata')
            continue
        s = art_slug(name)
        files = [ART_DIR / f'{s}.webp', ART_DIR / f'{s}-portrait.webp', ART_DIR / f'{s}-back.webp']
        front = find_front(data, m.get('Path_FRONT'))
        back_val = str(m.get('Path_BACK') or '').strip()
        has_back = back_val not in ('', '-')
        back = find_front(data, back_val) if has_back else None
        if front is None:
            issues.append(f'illustrazione nemesi {name}: Path_FRONT mancante o file non trovato ({m.get("Path_FRONT")})')
            continue
        exists = name in manifest and all(f.exists() for f in files[:2] + ([files[2]] if back else []))
        if args.anteprima:  # solo il ritaglio fatto dal DB, nella cartella dell'anteprima (fuori da git)
            PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
            with Image.open(front) as img:
                make_portrait(img.convert('RGB'), name).save(PREVIEW_DIR / f'db-{s}-portrait.webp', 'WEBP',
                                                             quality=ART_QUALITY, method=6)
            previews.append((name, s))
        if exists and not args.force_art:
            skipped.append(name)
            continue
        with Image.open(front) as img:
            img = img.convert('RGB')
            card = make_card(img)
            card.save(files[0], 'WEBP', quality=ART_QUALITY, method=6)
            make_portrait(img, name).save(files[1], 'WEBP', quality=ART_QUALITY, method=6)
            entry = {'card': f'Assets/nemesis/{s}.webp', 'portrait': f'Assets/nemesis/{s}-portrait.webp',
                     'ratio': round(card.height / card.width, 4)}
        if has_back:
            if back is None:
                issues.append(f'illustrazione nemesi {name}: retro non trovato ({back_val})')
            else:
                with Image.open(back) as img:
                    make_card(img.convert('RGB')).save(files[2], 'WEBP', quality=ART_QUALITY, method=6)
                entry['back'] = f'Assets/nemesis/{s}-back.webp'
        manifest[name] = entry
        done.append(name)
    if done:
        manifest = {k: manifest[k] for k in sorted(manifest)}
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f'illustrazioni nemesi: {len(done)} fatte ({", ".join(done) or "-"}), {len(skipped)} gia\' presenti (saltate)')
    return previews


def write_preview_page(previews):
    """tools/anteprima-nemesi/index.html: ritaglio 480x212 del DB e, per le nemesi che l'app ha gia', quello attuale."""
    cells = []
    for name, s in sorted(previews, key=lambda p: p[0]):
        cur = ART_DIR / f'{s}-portrait.webp'
        db_file = PREVIEW_DIR / f'db-{s}-portrait.webp'
        has_old = cur.exists() and cur.read_bytes() != db_file.read_bytes()
        cells.append(
            f'<figure><div class="row"><div><img src="db-{s}-portrait.webp" width="480" height="212" alt="">'
            f'<small>dal DataBase</small></div>'
            + (f'<div><img src="../../public/Assets/nemesis/{s}-portrait.webp" width="480" height="212" alt="">'
               f'<small>attuale nell\'app</small></div>' if has_old else '')
            + f'</div><figcaption>{name}</figcaption></figure>')
    html = ('<!doctype html>\n<html lang="it"><head><meta charset="utf-8"><title>Anteprima ritagli nemesi</title>\n'
            '<style>body{background:#16181d;color:#e8e8e8;font:15px system-ui,sans-serif;margin:16px}'
            'h1{font-size:20px}.grid{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;background:#22252c;'
            'padding:10px;border-radius:8px}.row{display:flex;gap:10px}small{display:block;color:#9aa;font-size:12px;'
            'margin-top:2px}img{display:block;max-width:100%;height:auto}figcaption{font-weight:600;margin-top:6px}</style>'
            '</head><body>\n<h1>Ritagli delle illustrazioni delle nemesi (480 x 212)</h1>\n<div class="grid">\n'
            + '\n'.join(cells) + '\n</div></body></html>\n')
    (PREVIEW_DIR / 'index.html').write_text(html, encoding='utf-8', newline='\n')


def move_file(src: Path, dst: Path):
    """git mv se il file e' tracciato, altrimenti spostamento normale."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    r = git('mv', str(src.relative_to(ROOT)), str(dst.relative_to(ROOT)))
    if r.returncode != 0:
        shutil.move(str(src), str(dst))


def write_image(src_png: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src_png) as img:
        has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
        img = img.convert('RGBA' if has_alpha else 'RGB')
        if img.width > MAX_WIDTH:  # mai ingrandire
            img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
        img.save(dst, 'WEBP', quality=WEBP_QUALITY, method=6)


def write_thumb(src_webp: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src_webp) as img:
        img = img.convert('RGB')
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        img.save(dst, 'WEBP', quality=THUMB_QUALITY, method=6)


# ------------------------------------------------------------------------------- supply e tesori (biblioteca)
# Una riga per carta: Box = scatola principale, MiniExpansion = espansione. La scatola dell'app e' la mini espansione
# se c'e', altrimenti Box (come per le nemesi). L'immagine e' il Path_FRONT del MAIN, trovato per UID.
def find_front(data: Path, path_front):
    """File dell'immagine dal Path_FRONT del MAIN, o None. Le cartelle del DataBase hanno un prefisso di numero
    ("1 - Aeons_End_(Core_Box)", "1.2 The_Nameless") che nel MAIN non c'e': si cerca la cartella senza prefisso."""
    text = text_or_none(path_front)
    if text is None:
        return None
    cur = data
    for part in text.replace('\\', '/').split('/'):
        if (cur / part).exists():
            cur = cur / part
            continue
        found = [d for d in cur.iterdir() if d.is_dir() and re.sub(r'^\d+(\.\d+)?\s*-?\s*', '', d.name) == part] \
            if cur.is_dir() else []
        if len(found) != 1:
            return None
        cur = found[0]
    return cur if cur.is_file() else None


def box_code_of(name, products):
    """Nome di scatola (come nell'Excel) -> codice "x.y" di BOXES_NAMES; None se non c'e'."""
    by_name = {box_key(v): k for k, v in products.items()}
    return by_name.get(box_key(name))


def treasure_level(kind_type):
    """Type del tesoro -> livello: "Treasure Level N" -> N; "Treasured ..." (Gem, Spell, Relic) -> 1; altro -> None."""
    t = str(kind_type or '').strip()
    m = re.fullmatch(r'Treasure Level (\d+)', t)
    if m:
        return int(m.group(1))
    return 1 if t.startswith('Treasured ') else None


def check_box(label, code, box, mini, products, issues):
    """Box (scatola grande), MiniExpansion (espansione, se c'e') e boxCode devono dire la stessa scatola: il nome del
    prodotto di boxCode (products.json) e' la mini espansione o, se manca, la scatola grande; la scatola grande deve
    essere quella della wave di boxCode. Le incoerenze vanno nelle segnalazioni (il dato non si corregge da solo)."""
    expected = mini or box
    if code is None or expected is None:
        return
    name = products.get(code)
    if name is None or box_key(name) != box_key(expected):
        issues.append(f'{label}: boxCode "{code}" ({name or "non in products.json"}) non corrisponde a "{expected}"')
        return
    base = box_code_of(box, products) if box else None
    if box and (base is None or base.split('.')[0] != code.split('.')[0]):
        issues.append(f'{label}: Box "{box}" non e\' la scatola grande di boxCode "{code}"')


def scrivi_mechanics(data: Path, issues):
    """public/mechanics.json: le meccaniche delle carte SUPPLY del DataBase (colonna Mechanics di SUPPLY_CARDS.xlsx,
    tutte le righe, anche quelle senza immagine). Per ciascuna: "name" (nome nell'app), "dbName" (nome nel DataBase),
    "it" (nome italiano, ancora null) e "cards" (quante carte di cards_supply.json la hanno, cioe' quelle entrate
    nell'app; 0 se nessuna). Ordine alfabetico del nome nell'app. Le meccaniche dei tesori non vanno qui (sono in
    cards_treasure.json). Legge gli Excel in sola lettura (copia temporanea). Le voci di RINOMINI_MECCANICHE che non
    trovano nessuna riga del DataBase (supply o tesori) vanno nelle segnalazioni."""
    supply_db, tutte = set(), set()
    with tempfile.TemporaryDirectory(prefix='import-db-') as tmp:
        tmp = Path(tmp)
        for kind, cfg in EXTRA.items():
            shutil.copy2(data / cfg['excel'], tmp / cfg['excel'])
            for r in read_sheet(tmp / cfg['excel']):
                for m in mechanics_names(r.get('Mechanics')):
                    tutte.add(m)
                    if kind == 'supply':
                        supply_db.add(m)
    for voce in RINOMINI_MECCANICHE:
        if voce not in tutte:
            issues.append(f'rinomino meccanica "{voce}": nessuna riga del DataBase la ha (voce da togliere o da correggere)')

    # quante carte supply entrate nell'app hanno ciascuna meccanica (cards_supply.json appena scritto)
    conteggi = defaultdict(int)
    for c in json.loads((SITE / 'cards_supply.json').read_text(encoding='utf-8-sig')):
        for m in c['mechanics']:
            conteggi[m] += 1
    coppie = sorted(((nome_app(m), m) for m in supply_db), key=lambda p: (p[0].casefold(), p[0]))
    fuori = set(conteggi) - {app for app, _ in coppie}
    if fuori:
        issues.append(f'meccaniche in cards_supply.json che non sono in mechanics.json: {", ".join(sorted(fuori))}')
    out = [{'name': app, 'dbName': db, 'it': None, 'cards': conteggi.get(app, 0)} for app, db in coppie]
    text = json.dumps(out, indent=4, ensure_ascii=False, separators=(',', ':  '))
    (SITE / 'mechanics.json').write_text(text + '\n', encoding='utf-8', newline='\n')
    print(f'mechanics.json: {len(out)} meccaniche delle supply')


def importa_extra(data: Path, main_rows, products, args, issues, kinds):
    """Supply e/o tesori: cards_supply.json / cards_treasure.json, le immagini in Data/ e le miniature in thumbs/.
    Entrano solo le carte con l'immagine; le altre si elencano per scatola nelle segnalazioni."""
    if args.no_images:
        print('supply e tesori: saltati (--no-images, servono le immagini)')
        return
    for kind in kinds:
        cfg = EXTRA[kind]
        by_uid = {m['UID']: m for m in main_rows if m.get('Type') == cfg['main_type']}
        with tempfile.TemporaryDirectory(prefix='import-db-') as tmp:
            tmp = Path(tmp)
            shutil.copy2(data / cfg['excel'], tmp / cfg['excel'])
            rows = read_sheet(tmp / cfg['excel'])

        cards, skipped = [], []
        for r in rows:
            label = f'{r["ID"]} {r["Name"]}'
            product = r.get('MiniExpansion') or r['Box']
            code = box_code_of(product, products)
            if code is None:
                issues.append(f'{label}: scatola "{product}" non e\' in BOXES_NAMES, saltata')
                continue
            card = {'id': str(r['ID']), 'name': str(r['Name']).strip(), 'boxCode': code,
                    'box': text_or_none(r.get('Box')), 'miniExpansion': text_or_none(r.get('MiniExpansion')),
                    'type': str(r['Type']).strip(), 'mechanics': mechanics_list(r.get('Mechanics')),
                    'effect': text_or_none(r.get('Effect'))}
            check_box(label, code, card['box'], card['miniExpansion'], products, issues)
            cost = number_or_text(r.get('Cost'))
            if kind == 'supply':
                if card['type'] not in SUPPLY_TYPES:
                    issues.append(f'{label}: Type "{card["type"]}" non ammesso (Gem, Relic, Spell), saltata')
                    continue
                if not isinstance(cost, int):
                    issues.append(f'{label}: Cost "{r.get("Cost")}" non e\' un numero, saltata')
                    continue
                card['_rank'] = SUPPLY_TYPES.index(card['type'])
                card['_group'] = card['type']
                card['cost'] = cost
            else:
                level = treasure_level(card['type'])
                if level is None:
                    issues.append(f'{label}: Type "{card["type"]}" senza livello, saltata')
                    continue
                card['level'] = level
                card['_rank'] = level
                card['_group'] = f'Level_{level}'
                card['cost'] = cost if isinstance(cost, int) else None
            card['_row'] = r
            cards.append(card)

        # ordine stabile: scatola, tipo o livello, nome
        cards.sort(key=lambda c: (code_key(c['boxCode']), c['_rank'], natural_key(c['name']), natural_key(c['id'])))

        # percorsi e immagini: Data/<Supply|Treasure>/<codice>/<gruppo>/<Nome>.webp, miniatura nello stesso albero
        used = {}
        stats = defaultdict(int)
        for c in cards:
            rel = Path(c['boxCode']) / slugify(c['_group']) / f'{slugify(c["name"])}.webp'
            if rel in used:  # stesso nome nella stessa cartella: aggiungo l'ID
                alt = rel.with_name(f'{slugify(c["name"])}_{slugify(c["id"])}.webp')
                issues.append(f'{c["id"]} {c["name"]}: nome gia\' usato da {used[rel]} nella stessa cartella, file chiamato {alt.name}')
                rel = alt
            used[rel] = c['id']
            c['image'] = (cfg['img'] / rel).as_posix()
            c['thumb'] = (cfg['thumb'] / rel).as_posix()

            m = by_uid.get(c['_row']['UID'])
            png = find_front(data, m.get('Path_FRONT')) if m else None
            dst, thumb = SITE / c['image'], SITE / c['thumb']
            if png is not None and (not dst.exists() or args.force):
                write_image(png, dst)
                stats['immagini convertite dal DataBase'] += 1
            elif dst.exists():
                stats['immagini gia presenti'] += 1
            if dst.exists() and (not thumb.exists() or args.force):
                write_thumb(dst, thumb)
                stats['miniature generate'] += 1
            elif dst.exists():
                stats['miniature gia presenti'] += 1
            if not dst.exists():
                skipped.append(c)

        # le carte senza immagine non entrano nel file
        kept = [c for c in cards if (SITE / c['image']).exists()]
        if skipped:
            per_box = defaultdict(int)
            for c in skipped:
                per_box[c['boxCode']] += 1
            issues.append(f'{len(skipped)} {kind} senza immagine NON messe in {cfg["json"]}: ' +
                          ', '.join(f'{k} ({v})' for k, v in sorted(per_box.items(), key=lambda kv: code_key(kv[0]))))

        out = []
        for c in kept:
            item = {'id': c['id'], 'name': c['name'], 'boxCode': c['boxCode'], 'box': c['box'],
                    'miniExpansion': c['miniExpansion'], 'type': c['type']}
            if kind == 'treasure':
                item['level'] = c['level']
            item.update({'cost': c['cost'], 'mechanics': c['mechanics'], 'effect': c['effect'],
                         'image': c['image'], 'thumb': c['thumb']})
            out.append(item)
        text = json.dumps(out, indent=4, ensure_ascii=False, separators=(',', ':  '))
        (SITE / cfg['json']).write_text(text + '\n', encoding='utf-8', newline='\n')

        print(f'{len(rows)} righe in {cfg["excel"]} -> {len(out)} carte in {cfg["json"]}')
        for k, v in sorted(stats.items()):
            print(f'  {k}: {v}')
        by = defaultdict(int)
        for c in kept:
            by[c['boxCode']] += 1
        print('  per scatola: ' + ', '.join(f'{k} {v}' for k, v in sorted(by.items(), key=lambda kv: code_key(kv[0]))))
    scrivi_mechanics(data, issues)


def stampa_segnalazioni(issues):
    print(f'{len(issues)} segnalazioni:')
    for i in issues:
        print('  -', i)


# ------------------------------------------------------------------------------------------------ programma
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('db', nargs='?', default=str(ROOT.parent / 'DataBase'), help='cartella del DataBase (default ..\\DataBase)')
    ap.add_argument('--force', action='store_true', help='rifa anche immagini e miniature gia presenti')
    ap.add_argument('--no-images', action='store_true', help='solo i JSON delle nemesi e products.json')
    ap.add_argument('--solo-supply', action='store_true', help='rifa solo cards_supply.json e le sue immagini')
    ap.add_argument('--solo-tesori', action='store_true', help='rifa solo cards_treasure.json e le sue immagini')
    ap.add_argument('--force-art', action='store_true', help='rifa anche le illustrazioni delle nemesi gia presenti')
    ap.add_argument('--anteprima', action='store_true', help='crea anche tools/anteprima-nemesi/ (non pubblicata)')
    args = ap.parse_args()

    db = Path(args.db).resolve()
    data = db / 'Data'
    issues = []

    # copia degli Excel in una cartella temporanea: si legge la copia
    with tempfile.TemporaryDirectory(prefix='import-db-') as tmp:
        tmp = Path(tmp)
        for f in [data / 'NEMESIS_CARDS.xlsx', *map(Path, glob.glob(str(data / 'DataBase_*.xlsx')))]:
            shutil.copy2(f, tmp / f.name)
        rows = read_sheet(tmp / 'NEMESIS_CARDS.xlsx')
        main_rows = []
        for f in sorted(tmp.glob('DataBase_*.xlsx')):
            main_rows += read_sheet(f, 'MAIN')
    boxes = read_boxes_names(db / 'pipeline.py')
    products = {k.replace('wave', '', 1): v[0] for k, v in boxes.items()}

    # ---- solo supply o solo tesori: il resto (nemesi, prodotti, illustrazioni) non si tocca
    if args.solo_supply or args.solo_tesori:
        kinds = [k for k, on in (('supply', args.solo_supply), ('treasure', args.solo_tesori)) if on]
        importa_extra(data, main_rows, products, args, issues, kinds)
        stampa_segnalazioni(issues)
        return

    # ---- abbinamento NEMESIS_CARDS <-> MAIN (scatola vera + nome; omonimi anche per ID)
    index = defaultdict(list)
    for m in main_rows:
        if m.get('Type') == 'Nemesis' and m.get('Format') == 'card':
            index[(box_key(m['Box']), str(m['Name']).strip().lower())].append(m)

    def norm_id(v):
        return re.sub(r'[\s\[\]]', '', str(v or '')).lower()

    def find_main(r):
        cand = index.get((box_key(r.get('MiniExpansion') or r['Box']), str(r['Name']).strip().lower()), [])
        if len(cand) > 1:
            cand = [c for c in cand if norm_id(c['ID']) == norm_id(r['ID'])] or \
                   [c for c in cand if norm_id(r['ID']) and norm_id(r['ID']) in norm_id(c['ID'])] or cand
            if len(cand) > 1:
                issues.append(f'omonimo non risolto: {r["ID"]} {r["Name"]} ha {len(cand)} righe nel MAIN, presa la prima')
        return cand[0] if cand else None

    # ---- vecchio cards_nemesis.json (per riusare le scansioni e le miniature di The New Age)
    old_cards = []
    cards_path = SITE / CARDS_NEMESIS
    if cards_path.exists():
        old_cards = json.loads(cards_path.read_text(encoding='utf-8-sig'))
    old_by_id = {c['id']: c for c in old_cards}
    old_by_name = defaultdict(list)
    for c in old_cards:
        cat = {'Basic Nemesis': 'Basic', 'Upgraded Basic Nemesis': 'Upgraded'}.get(c.get('category'), c.get('nemesis'))
        old_by_name[(c['name'].strip().lower(), cat)].append(c)
    used_old = set()

    # ---- carte
    cards = []
    for r in rows:
        label = f'{r["ID"]} {r["Name"]}'
        card = {}
        for col, key in PLAIN_TEXT.items():
            card[key] = text_or_none(r.get(col)) if key not in ('id', 'name') else str(r[col])
        nem_cell = str(r['Nemesis']).strip() if r.get('Nemesis') else ''
        category = {'Basic': 'Basic', 'Upgraded Basic': 'Upgraded'}.get(nem_cell, 'Specific')
        card['category'] = category
        card['nemesis'] = nem_cell if category == 'Specific' else None
        card['tier'] = tier_value(r.get('Tier'))
        hp = text_or_none(r.get('Hp'))
        card['hp'] = int(hp) if hp and re.fullmatch(r'\d+', hp.strip()) else None
        card['hpVariable'] = hp is not None and hp.strip() == '*'
        if hp and card['hp'] is None and not card['hpVariable']:
            issues.append(f'{label}: Hp "{hp}" non riconosciuto')
        for col, key in PLAIN_NUMBER.items():
            card[key] = number_or_text(r.get(col))
        for col, key in FLAGS.items():
            card[key] = str(r.get(col) or '').strip().upper() == 'X'
        effect = r.get('Effect')
        card['effect'] = None if effect is None else str(effect)
        card.update(split_effect(effect, issues, label, card['type']))
        card['_box'] = r.get('MiniExpansion') or r['Box']
        card['_row'] = r
        cards.append(card)

    # ordine stabile: BoxCode, nemesi (Basic, Upgraded, poi per nome), Tier, ID
    cat_rank = {'Basic': 0, 'Upgraded': 1, 'Specific': 2}
    cards.sort(key=lambda c: (code_key(c['boxCode']), cat_rank[c['category']], (c['nemesis'] or '').lower(),
                              tier_sort(c['tier']), natural_key(c['id'])))

    # ---- percorsi, abbinamento con le immagini del DataBase e con le scansioni gia' nell'app
    used_paths = {}
    plan = []
    for c in cards:
        code = c['boxCode']
        product = products.get(code)
        if product is None:
            issues.append(f'{c["id"]} {c["name"]}: BoxCode "{code}" non e\' in BOXES_NAMES')
            product = c['_box']
        group = {'Basic': '_Basics', 'Upgraded': '_Upgraded'}.get(c['category']) or slugify(c['nemesis'])
        folder = Path(f'{code}_{slugify(product)}') / group / tier_folder(c['tier'])
        stem = slugify(c['name'])
        rel = folder / f'{stem}.webp'
        if rel in used_paths:  # nome uguale nella stessa cartella: aggiungo l'ID
            alt = folder / f'{stem}_{slugify(c["id"])}.webp'
            issues.append(f'{c["id"]} {c["name"]}: nome gia\' usato da {used_paths[rel]} nella stessa cartella, file chiamato {alt.name}')
            rel = alt
        used_paths[rel] = c['id']
        c['image'] = (IMG_ROOT / rel).as_posix()
        c['_thumb'] = (THUMB_ROOT / rel).as_posix()

        m = find_main(c['_row'])
        c['_png'] = None
        if m is None:
            issues.append(f'{c["id"]} {c["name"]}: nessuna riga abbinata nel MAIN')
        elif not m.get('Path_FRONT'):
            issues.append(f'{c["id"]} {c["name"]}: Path_FRONT vuoto nel MAIN')
        else:
            png = find_front(data, m['Path_FRONT'])
            if png is not None:
                c['_png'] = png
            else:
                issues.append(f'{c["id"]} {c["name"]}: immagine non trovata ({m["Path_FRONT"]})')

        c['_old'] = None

    # scansione e miniatura gia' nell'app (vecchio cards_nemesis.json, solo The New Age): prima per id, poi per nome + nemesi
    # (gli omonimi di altre scatole, per esempio Doom Aegis del Core Set, non vi rientrano)
    for c in cards:
        old = old_by_id.get(c['id'])
        if old is not None and old['id'] not in used_old:
            c['_old'] = old
            used_old.add(old['id'])
    for c in cards:
        if c['_old'] is None and c['boxCode'].split('.')[0] == '4':
            cands = [o for o in old_by_name.get((c['name'].strip().lower(), c['nemesis'] or c['category']), [])
                     if o['id'] not in used_old]
            if cands:
                c['_old'] = cands[0]
                used_old.add(cands[0]['id'])

    # ---- immagini e miniature
    stats = defaultdict(int)
    if not args.no_images:
        for c in cards:
            dst, thumb = SITE / c['image'], SITE / c['_thumb']
            old = c['_old']
            old_img = SITE / old['image'] if old else None
            old_thumb = None
            if old:  # carte gia' nel nuovo albero: stessa posizione sotto thumbs/; le piu' vecchie: thumbs/<id>.webp
                old_thumb = (SITE / 'thumbs' / Path(old['image']).relative_to('Data')) \
                    if old['image'].startswith('Data/Nemesis/') else SITE / 'thumbs' / f'{old["id"]}.webp'
            if old_img is not None and old_img.resolve() == dst.resolve():
                old_img = None  # e' gia' al suo posto
            if dst.exists() and not args.force:
                stats['immagini gia presenti'] += 1
            elif old_img is not None and old_img.exists() and not args.force:
                move_file(old_img, dst)
                stats['immagini spostate (git mv)'] += 1
            elif c['_png'] is not None:
                write_image(c['_png'], dst)
                stats['immagini convertite dal DataBase'] += 1
            else:
                issues.append(f'{c["id"]} {c["name"]}: immagine mancante, nessuna copia fatta')
                stats['immagini mancanti'] += 1
            if thumb.exists() and not args.force:
                stats['miniature gia presenti'] += 1
            elif old_thumb is not None and old_thumb.exists() and not args.force:
                move_file(old_thumb, thumb)
                stats['miniature spostate (git mv)'] += 1
            elif dst.exists():
                write_thumb(dst, thumb)
                stats['miniature generate'] += 1
            else:
                issues.append(f'{c["id"]} {c["name"]}: miniatura non fatta (manca l\'immagine)')

        # cartelle vecchie rimaste vuote (i file non tracciati, per esempio i .jpg, restano dove sono)
        leftovers = []
        for base in (SITE / 'Data', SITE / 'thumbs'):
            for d in sorted((p for p in base.rglob('*') if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
                rel = d.relative_to(SITE).as_posix()
                if any(rel == f'{b}/{s}' or rel.startswith(f'{b}/{s}/')
                       for b in ('Data', 'thumbs') for s in ('Nemesis', 'Supply', 'Treasure')):
                    continue
                if not any(d.iterdir()):
                    d.rmdir()
                else:
                    files = [f for f in d.iterdir() if f.is_file()]
                    if files and not any(s.is_dir() for s in d.iterdir()):
                        leftovers.append(rel)
        for d in SITE.joinpath('Data').iterdir():
            if d.is_dir() and d.name not in ('Nemesis', 'Supply', 'Treasure') and not any(d.iterdir()):
                d.rmdir()
        if leftovers:
            issues.append('cartelle vecchie non vuote (restano dove sono): ' + ', '.join(sorted(leftovers)))

    # ---- le carte senza immagine non entrano in cards_nemesis.json (entreranno quando il PNG ci sara' e si rilancera' il ponte)
    no_image = [c for c in cards if not (SITE / c['image']).exists()]
    if no_image:
        cards = [c for c in cards if (SITE / c['image']).exists()]
        per_box = defaultdict(int)
        for c in no_image:
            per_box[c['boxCode']] += 1
        issues.append(f'{len(no_image)} carte senza immagine NON messe in {CARDS_NEMESIS}: ' +
                      ', '.join(f'{k} ({v})' for k, v in sorted(per_box.items(), key=lambda kv: code_key(kv[0]))))

    # ---- cards_nemesis.json e products.json
    out_cards = []
    for c in cards:
        box, mini = text_or_none(c['_row'].get('Box')), text_or_none(c['_row'].get('MiniExpansion'))
        check_box(c['id'], c['boxCode'], box, mini, products, issues)
        out_cards.append({
            'id': c['id'], 'name': c['name'], 'boxCode': c['boxCode'], 'box': box, 'miniExpansion': mini,
            'category': c['category'],
            'nemesis': c['nemesis'], 'tier': c['tier'], 'type': c['type'], 'subType': c['subType'],
            'hp': c['hp'], 'hpVariable': c['hpVariable'], 'shield': c['shield'], 'powerTokens': c['powerTokens'],
            'removalCost': c['removalCost'], 'removable': c['removable'], 'inNemesisDeck': c['inNemesisDeck'],
            'quantity': c['quantity'], 'effect': c['effect'], 'toDiscard': c['toDiscard'],
            'immediately': c['immediately'], 'persistent': c['persistent'], 'powerEffect': c['powerEffect'],
            'mechanics': [],  # le nemesi non hanno la colonna Mechanics
            'image': c['image'],
        })
    # 4 spazi e due spazi dopo i due punti, come il vecchio file (PowerShell)
    text = json.dumps(out_cards, indent=4, ensure_ascii=False, separators=(',', ':  '))
    cards_path.write_text(text + '\n', encoding='utf-8', newline='\n')  # cards_nemesis.json

    # tutti i codici di BOXES_NAMES (l'app mostra anche le wave non ancora disponibili)
    prod_out = {k: products[k] for k in sorted(products, key=code_key)}
    (SITE / 'products.json').write_text(json.dumps(prod_out, indent=4, ensure_ascii=False, separators=(',', ':  ')) + '\n',
                                        encoding='utf-8', newline='\n')

    # ---- illustrazioni delle nemesi (Assets/nemesis)
    if not args.no_images:
        previews = build_nemesis_art(data, main_rows, args, issues)
        if args.anteprima:
            write_preview_page(previews)

    # ---- supply e tesori (cards_supply.json, cards_treasure.json, Data/Supply, Data/Treasure, thumbs/...)
    importa_extra(data, main_rows, products, args, issues, ['supply', 'treasure'])

    # ---- riepilogo
    print(f'{len(rows)} righe in NEMESIS_CARDS -> {len(out_cards)} carte in {CARDS_NEMESIS}, {len(prod_out)} prodotti in products.json')
    for k, v in sorted(stats.items()):
        print(f'  {k}: {v}')
    by = defaultdict(int)
    for c in cards:
        by[(c['boxCode'], c['category'])] += 1
    for (code, cat), n in sorted(by.items(), key=lambda kv: (code_key(kv[0][0]), kv[0][1])):
        print(f'  {code:>4} {cat:<9} {n}')
    print(f'{len(issues)} segnalazioni:')
    for i in issues:
        print('  -', i)


if __name__ == '__main__':
    sys.exit(main())
