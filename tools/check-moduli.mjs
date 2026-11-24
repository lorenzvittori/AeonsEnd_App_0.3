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
for (const { f, code, ast } of parsed) {
  const rel = relative(ROOT, f).split(sep).join('/');
  const pure = rel.startsWith('src/regole/');
  const store = rel === STORE;
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
