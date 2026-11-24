// Controllo dei moduli di src/ (npm run check, dopo tsc). Uso: node tools/check-moduli.mjs [--conta]
// tsc controlla tipi, nomi e import dei file .ts; qui si controlla quello che tsc non vede:
// - ogni nome importato da un modulo di src/ esiste tra i suoi export;
// - nessun modulo scrive variabili globali (window.x = ..., globalThis.x = ...), tranne window.app in main.ts;
// - src/regole/ è logica pura: importa solo da src/regole/ e (solo tipi) da src/tipi/, non usa nomi del browser né
//   l'orologio (Date) e non chiama Math.random (il caso arriva come argomento);
// - i file CSS si importano solo da src/stili/indice.ts (l'ordine della cascata è lì) e ci sono tutti;
// - nessun "any" nei tipi; ogni @ts-expect-error ha il motivo sulla stessa riga (@ts-ignore e @ts-nocheck no);
// - la partita in corso (`partita`, stato/partita.ts) si cambia solo in stato/partita.ts: fuori da lì nessuno assegna
//   un suo campo (partita.turn = ..., partita.stats.endedAt = ..., partita.nextUid++), chiama un metodo che cambia un
//   suo elenco (partita.deck.pop(), Object.assign(partita.x, ...)) o le passa a una regola che la modifica
//   (Nemesi.resolveCurrent(partita)). TypeScript lo vede già per i campi diretti (partita è Readonly); qui anche per
//   quelli annidati. Non si vede un elenco della partita preso in una variabile e poi cambiato: lì vale la revisione.
// - nessun ciclo di import in src/ (anche con gli import di soli tipi);
// - i livelli (CONTESTO_SVILUPPO.md, sezione 6): un file importa solo da livelli più bassi. Livelli: 0 tipi/, regole/,
//   stili/; 1 stato/, dati/; 2 ui/ base (i file in ui/ tranne navigazione.ts); 3 ui/componenti/; 4 ui/finestre/;
//   5 ui/schermate/; 6 ui/navigazione.ts; 7 avvio.ts; 8 main.ts. Nei livelli 0-3 (librerie) un file può importare dallo
//   stesso livello (senza cicli); nei livelli 4 e 5 (finestre e schermate) no, salvo i file di supporto della stessa
//   finestra o schermata: nella stessa cartella, <nome>.ts e i suoi <nome>-*.ts si importano tra loro (senza cicli);
// - nessun file di src/ sopra MAX_LINES righe, salvo un commento in testa al file che comincia con "Oltre 500 righe:"
//   e dice perché (elencati qui sotto in uscita);
// - i blocchi fissi della pagina (#start, #queue-view, #resolve-view) si mostrano e si nascondono solo in
//   ui/navigazione.ts (hidden assegnato, toggleAttribute / setAttribute / removeAttribute di 'hidden').
// In uscita anche: numero di file, righe del file più grande, import tra moduli di ui/.
// --conta stampa quanti "any", @ts-expect-error / @ts-ignore, file .js e usi di G (lo stato condiviso di prima) ci sono
// in src/. Esce con 1 se trova problemi.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
// Nomi che src/regole/ non può usare: browser, salvataggio, rete, orologio, stato condiviso
const IMPURE = new Set(['window', 'document', 'globalThis', 'self', 'localStorage', 'sessionStorage', 'navigator', 'fetch',
  'performance', 'location', 'history', 'Date', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'matchMedia', 'getComputedStyle', 'console', 'G', 'caches', 'Image', 'alert', 'confirm']);
const count = process.argv.includes('--conta');
// Il modulo che possiede la partita
const STORE = 'src/stato/partita.ts';
// Metodi che cambiano un elenco
const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin', 'set', 'delete', 'clear', 'add']);
// Regole (src/regole/) che modificano la partita che ricevono
const MUTATING_RULES = new Set(['setLife', 'resolveCurrent', 'drawNewCard', 'startResolution', 'endResolution', 'nemesisTurn',
  'applyDrafts', 'endPlayerTurnCards', 'removeWhileResolving', 'discardEntry', 'discardGone', 'drawFromDeck', 'countMinionKilled',
  'countPowerPaid', 'statCard', 'choosePairPlayer', 'applyTurnDraft']);
// L'espressione parte da `partita` (partita, partita.queue, partita.stats.cards...)
function rootedAtPartita(n) {
  const wrappers = ['TSNonNullExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'ParenthesizedExpression'];
  while (n && (n.type === 'MemberExpression' || wrappers.includes(n.type))) n = n.type === 'MemberExpression' ? n.object : n.expression;
  return !!n && n.type === 'Identifier' && n.name === 'partita';
}

// L'unico modulo che importa i CSS (l'ordine della cascata)
const CSS_INDEX = 'src/stili/indice.ts';
// Righe massime di un file di src/
const MAX_LINES = 500;
// Il coordinatore, l'unico che mostra e nasconde i blocchi fissi
const NAV = 'src/ui/navigazione.ts';
// I blocchi fissi (nomi degli elementi in ui/pagina.ts e id in index.html)
const FIXED_NAMES = new Set(['startLayer', 'queueView', 'resolveView']);
const FIXED_IDS = new Set(['start', 'queue-view', 'resolve-view']);
// Livello di un file (percorso relativo alla cartella del repo)
function levelOf(rel) {
  if (/^src\/(tipi|regole|stili)\//.test(rel)) return 0;
  if (/^src\/(stato|dati)\//.test(rel)) return 1;
  if (rel.startsWith('src/ui/componenti/')) return 3;
  if (rel.startsWith('src/ui/finestre/')) return 4;
  if (rel.startsWith('src/ui/schermate/')) return 5;
  if (rel === NAV) return 6;
  if (/^src\/ui\/[^/]+$/.test(rel)) return 2;
  if (rel === 'src/avvio.ts') return 7;
  if (rel === 'src/main.ts') return 8;
  return -1;
}
const files = [];
const cssFiles = [];
const cssImported = new Set();
(function walk(dir) {
  readdirSync(dir).forEach(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|ts)$/.test(f)) files.push(p);
    else if (f.endsWith('.css')) cssFiles.push(resolve(p));
  });
})(SRC);

function visit(node, fn, parent) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => visit(c, fn, node));
    else if (v && typeof v.type === 'string') visit(v, fn, node);
  }
}
function patternNames(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach(q => patternNames(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach(e => patternNames(e, out));
  else if (p.type === 'RestElement') patternNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
  else if (p.type === 'TSParameterProperty') patternNames(p.parameter, out);
  return out;
}
const lineOf = (code, pos) => code.slice(0, pos).split('\n').length;

const problems = [];
const exportsOf = new Map();
const parsed = files.map(f => {
  const code = readFileSync(f, 'utf8');
  const ast = parseAst(code, { lang: f.endsWith('.ts') ? 'ts' : 'js', sourceType: 'module' });
  const exps = new Set();
  ast.body.forEach(s => {
    if (s.type === 'ExportNamedDeclaration') {
      const d = s.declaration;
      if (d) {
        if (d.type === 'VariableDeclaration') d.declarations.forEach(x => patternNames(x.id).forEach(n => exps.add(n)));
        else if (d.id) exps.add(d.id.name);
      }
      s.specifiers.forEach(sp => exps.add(sp.exported.name));
    }
  });
  exportsOf.set(resolve(f), exps);
  return { f, code, ast };
});

let anyCount = 0;
let gCount = 0;
const expectList = [];
// Import tra moduli di src/ (anche di soli tipi): file -> [{ to, line }]
const edges = new Map();
// Righe di ogni file e file con l'eccezione dichiarata per le righe
const linesOf = new Map();
const longOk = [];
for (const { f, code, ast } of parsed) {
  const rel = relative(ROOT, f).split(sep).join('/');
  const pure = rel.startsWith('src/regole/');
  const store = rel === STORE;
  edges.set(rel, []);
  const lines = code.split(/\r?\n/).length;
  linesOf.set(rel, lines);
  // Eccezione per le righe: un commento "Oltre 500 righe: <motivo>" nel blocco di commento in testa
  const head = (code.match(/^(\s*\/\/[^\n]*\n)+/) || [''])[0];
  if (lines > MAX_LINES) {
    const m = head.match(/Oltre 500 righe:\s*(\S.*)/);
    if (m) longOk.push(`${rel} (${lines} righe): ${m[1].trim()}`);
    else problems.push(`${rel}: ${lines} righe, più di ${MAX_LINES} (dividere per compito, o "Oltre 500 righe: <motivo>" in testa)`);
  }
  // Import: il modulo esiste e il nome è esportato
  ast.body.filter(s => s.type === 'ImportDeclaration' || ((s.type === 'ExportNamedDeclaration' || s.type === 'ExportAllDeclaration') && s.source))
    .forEach(s => {
      const src = s.source.value;
      const line = lineOf(code, s.start);
      if (pure) {
        const typeOnly = s.importKind === 'type' || s.exportKind === 'type';
        if (!/^\.\/[^/]+$/.test(src) && !(typeOnly && /^\.\.\/tipi\/[^/]+$/.test(src))) {
          problems.push(`${rel}:${line}: regole pure: import fuori da src/regole/ (o non solo tipi da src/tipi/): ${src}`);
        }
      }
      if (!src.startsWith('.')) return;
      const target = resolve(dirname(f), src);
      if (/\.css$/.test(target)) {
        if (rel !== CSS_INDEX) problems.push(`${rel}:${line}: CSS importato fuori da ${CSS_INDEX} (l'ordine della cascata è lì): ${src}`);
        else cssImported.add(target);
        if (!existsSync(target)) problems.push(`${rel}: CSS importato che non esiste: ${src}`);
        return;
      }
      const exps = exportsOf.get(target);
      if (!exps) { problems.push(`${rel}:${line}: modulo inesistente ${src}`); return; }
      edges.get(rel).push({ to: relative(ROOT, target).split(sep).join('/'), line });
      if (s.type === 'ImportDeclaration') {
        s.specifiers.forEach(sp => {
          if (sp.type === 'ImportSpecifier' && !exps.has(sp.imported.name)) problems.push(`${rel}:${line}: ${sp.imported.name} non è esportato da ${src}`);
        });
      }
    });
  // Nomi dichiarati nel modulo (un nome locale non è quello del browser)
  const declared = new Set();
  visit(ast, n => {
    if (n.type === 'VariableDeclarator') patternNames(n.id).forEach(x => declared.add(x));
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) declared.add(n.id.name);
    if (/Function/.test(n.type) && n.params) n.params.forEach(p => patternNames(p).forEach(x => declared.add(x)));
    if (n.type === 'ImportSpecifier' || n.type === 'ImportDefaultSpecifier' || n.type === 'ImportNamespaceSpecifier') declared.add(n.local.name);
    if (n.type === 'CatchClause' && n.param) patternNames(n.param).forEach(x => declared.add(x));
  });
  visit(ast, (n, parent) => {
    if (n.type === 'TSAnyKeyword') { anyCount++; problems.push(`${rel}:${lineOf(code, n.start)}: tipo any`); }
    // Scritture globali
    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier'
      && ['window', 'globalThis', 'self'].includes(n.left.object.name)
      && !(/^src\/main\.(js|ts)$/.test(rel) && n.left.property.name === 'app')) {
      problems.push(`${rel}:${lineOf(code, n.start)}: variabile globale ${n.left.object.name}.${n.left.property.name || '?'}`);
    }
    // Blocchi fissi mostrati o nascosti fuori dal coordinatore
    if (rel !== NAV) {
      const fixedObj = o => !!o && ((o.type === 'Identifier' && FIXED_NAMES.has(o.name))
        || (o.type === 'CallExpression' && o.arguments.length && o.arguments[0].type === 'Literal' && FIXED_IDS.has(o.arguments[0].value)));
      const where = `${rel}:${lineOf(code, n.start)}: i blocchi fissi (#start, #queue-view, #resolve-view) si mostrano e si nascondono solo in ${NAV}`;
      if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && !n.left.computed
        && n.left.property.name === 'hidden' && fixedObj(n.left.object)) problems.push(where);
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed
        && ['toggleAttribute', 'setAttribute', 'removeAttribute'].includes(n.callee.property.name)
        && n.arguments[0] && n.arguments[0].type === 'Literal' && n.arguments[0].value === 'hidden' && fixedObj(n.callee.object)) problems.push(where);
    }
    // G, lo stato condiviso di prima (non esiste più)
    if (n.type === 'Identifier' && n.name === 'G' && !(parent && parent.type === 'MemberExpression' && parent.property === n && !parent.computed)) gCount++;
    // La partita si cambia solo nel suo modulo
    if (!store) {
      const where = `${rel}:${lineOf(code, n.start)}: la partita si cambia solo in ${STORE}`;
      if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && rootedAtPartita(n.left)) problems.push(`${where} (assegnazione)`);
      if (n.type === 'UpdateExpression' && n.argument.type === 'MemberExpression' && rootedAtPartita(n.argument)) problems.push(`${where} (${n.operator})`);
      if (n.type === 'UnaryExpression' && n.operator === 'delete' && rootedAtPartita(n.argument)) problems.push(`${where} (delete)`);
      if (n.type === 'CallExpression') {
        const c = n.callee;
        const name = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed ? c.property.name : null);
        if (c.type === 'MemberExpression' && MUTATORS.has(name) && rootedAtPartita(c.object)) problems.push(`${where} (${name})`);
        const args = n.arguments || [];
        if (name === 'assign' && args[0] && rootedAtPartita(args[0])) problems.push(`${where} (Object.assign)`);
        if (MUTATING_RULES.has(name) && args.some(a => rootedAtPartita(a))) problems.push(`${where} (regola ${name})`);
      }
    }
    if (!pure) return;
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'Math' && !n.computed && n.property.name === 'random') {
      problems.push(`${rel}:${lineOf(code, n.start)}: regole pure: Math.random (il caso si passa come argomento)`);
    }
    if (n.type === 'Identifier' && IMPURE.has(n.name) && !declared.has(n.name)) {
      const isKey = parent && ((parent.type === 'MemberExpression' && parent.property === n && !parent.computed)
        || ((parent.type === 'Property' || parent.type === 'TSPropertySignature') && parent.key === n && !parent.computed));
      if (!isKey) problems.push(`${rel}:${lineOf(code, n.start)}: regole pure: nome non permesso: ${n.name}`);
    }
  });
  // Eccezioni ai tipi: ognuna con il motivo sulla stessa riga
  code.split(/\r?\n/).forEach((l, i) => {
    const m = l.match(/@ts-(expect-error|ignore|nocheck)(.*)$/);
    if (!m) return;
    expectList.push(`${rel}:${i + 1}: ${l.trim()}`);
    if (m[1] !== 'expect-error') problems.push(`${rel}:${i + 1}: usare @ts-expect-error con il motivo, non @ts-${m[1]}`);
    else if (m[2].replace(/[\s:–-]/g, '').length < 10) problems.push(`${rel}:${i + 1}: @ts-expect-error senza motivo`);
  });
}

// Livelli: un import va solo verso un livello più basso (stesso livello: librerie 0-3, o file di supporto della stessa
// finestra o schermata nei livelli 4-5)
const allRel = [...edges.keys()];
// Famiglia di un file di finestre/ o schermate/: il file principale (<nome>.ts) di cui è supporto (<nome>-*.ts)
function familyOf(rel) {
  const dir = rel.slice(0, rel.lastIndexOf('/') + 1);
  const base = rel.slice(dir.length).replace(/\.ts$/, '');
  const mains = allRel.filter(r => r.startsWith(dir) && !r.slice(dir.length).includes('/'))
    .map(r => r.slice(dir.length).replace(/\.ts$/, ''))
    .filter(m => base === m || base.startsWith(m + '-'))
    .sort((a, b) => a.length - b.length);
  return dir + (mains[0] || base);
}
for (const [from, list] of edges) {
  const lf = levelOf(from);
  if (lf < 0) { problems.push(`${from}: file fuori dai livelli (aggiungerlo in levelOf, tools/check-moduli.mjs)`); continue; }
  for (const { to, line } of list) {
    const lt = levelOf(to);
    if (lt > lf) problems.push(`${from}:${line}: livelli: import verso l'alto (${lf} -> ${lt}): ${to} (usare un aggancio di ui/ridisegno.ts o una funzione passata come argomento)`);
    else if (lt === lf && lf >= 4 && lf <= 5 && familyOf(from) !== familyOf(to)) {
      problems.push(`${from}:${line}: livelli: import dallo stesso livello (${lf}): ${to} (solo i file di supporto della stessa finestra o schermata)`);
    } else if (lt === lf && lf >= 6) problems.push(`${from}:${line}: livelli: import dallo stesso livello (${lf}): ${to}`);
  }
}
// Cicli (Tarjan sulle componenti fortemente connesse)
{
  let index = 0;
  const stack = [], onStack = new Set(), idx = new Map(), low = new Map();
  const strong = v => {
    idx.set(v, index); low.set(v, index); index++;
    stack.push(v); onStack.add(v);
    for (const { to } of edges.get(v) || []) {
      if (!edges.has(to)) continue;
      if (!idx.has(to)) { strong(to); low.set(v, Math.min(low.get(v), low.get(to))); }
      else if (onStack.has(to)) low.set(v, Math.min(low.get(v), idx.get(to)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      const self = (edges.get(v) || []).some(e => e.to === v);
      if (comp.length > 1 || self) problems.push(`ciclo di import tra ${comp.length} file: ${comp.sort().join(', ')}`);
    }
  };
  allRel.forEach(v => { if (!idx.has(v)) strong(v); });
}
// Numeri: file, righe del file più grande, import tra moduli di ui/
const largest = [...linesOf].sort((a, b) => b[1] - a[1])[0];
let uiImports = 0;
for (const [from, list] of edges) if (from.startsWith('src/ui/')) uiImports += list.filter(e => e.to.startsWith('src/ui/')).length;
console.log(`File di src/: ${files.length}; file più grande: ${largest[0]} (${largest[1]} righe); import tra moduli di ui/: ${uiImports}`);
if (longOk.length) { console.log(`File oltre ${MAX_LINES} righe (con il motivo):`); longOk.forEach(l => console.log('  ' + l)); }

if (count) {
  console.log(`any: ${anyCount}`);
  console.log(`@ts-expect-error / @ts-ignore: ${expectList.length}`);
  expectList.forEach(l => console.log('  ' + l));
  console.log(`file .js in src/: ${files.filter(f => f.endsWith('.js')).length}`);
  console.log(`usi di G: ${gCount}`);
}
// Ogni file CSS di src/ è importato (da stili/indice.ts): altrimenti le sue regole non arrivano all'app
cssFiles.filter(f => !cssImported.has(f)).forEach(f => problems.push(`${relative(ROOT, f).split(sep).join('/')}: CSS non importato da ${CSS_INDEX}`));
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nModuli: ${problems.length} problemi`);
  process.exit(1);
}
console.log(`Moduli: ${files.length} file di src/ controllati (import, nessuna variabile globale, src/regole/ pura, niente any, partita cambiata solo in ${STORE})`);
