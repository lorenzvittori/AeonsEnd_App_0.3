// Controllo dei moduli di src/ (npm run check, dopo tsc). Uso: node tools/check-moduli.mjs [--globali]
// In questa fase il codice è JavaScript e tsc non lo controlla (checkJs spento: la conversione a TypeScript è la fase C).
// Qui si controlla quello che con i moduli ES si rompe facilmente:
// - ogni nome usato in un modulo è dichiarato nel modulo, importato, o è un nome del browser / di JavaScript
//   (elenco BROWSER qui sotto: un nome nuovo del browser si aggiunge lì);
// - ogni nome importato esiste tra gli export del modulo da cui si importa;
// - nessun modulo scrive variabili globali (window.x = ..., globalThis.x = ...), tranne window.app in main.js;
// - src/regole/ è logica pura: importa solo da src/regole/, usa solo i nomi di JavaScript dell'elenco PURE (niente
//   document, window, localStorage, fetch, orologio...) e non chiama Math.random (il caso arriva come argomento).
// --globali stampa i nomi del browser usati (per aggiornare l'elenco). Esce con codice 1 se trova qualcosa.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BROWSER = new Set(['Array', 'Boolean', 'Date', 'Element', 'Error', 'Event', 'HTMLElement', 'Image', 'Infinity', 'JSON',
  'Map', 'Math', 'NaN', 'WeakSet', 'caches', 'Number', 'Object', 'Promise', 'Set', 'String', 'URL', 'WeakMap', 'Symbol', 'ResizeObserver',
  'CSS', 'cancelAnimationFrame', 'clearInterval', 'clearTimeout', 'console', 'document', 'encodeURI', 'encodeURIComponent',
  'fetch', 'getComputedStyle', 'history', 'innerHeight', 'innerWidth', 'isFinite', 'localStorage', 'location', 'matchMedia',
  'navigator', 'parseFloat', 'parseInt', 'performance', 'requestAnimationFrame', 'sessionStorage', 'setInterval', 'setTimeout',
  'undefined', 'window', 'Node', 'KeyboardEvent', 'PointerEvent', 'MutationObserver', 'IntersectionObserver', 'DOMRect',
  'globalThis', 'queueMicrotask', 'structuredClone', 'Intl', 'RegExp', 'TypeError', 'decodeURIComponent', 'atob', 'btoa',
  'devicePixelRatio', 'scrollX', 'scrollY', 'visualViewport', 'Reflect', 'Proxy', 'BigInt', 'alert', 'confirm']);
const listGlobals = process.argv.includes('--globali');
// Nomi globali permessi in src/regole/ (solo JavaScript, niente browser né orologio: Date è escluso)
const PURE = new Set(['Array', 'Boolean', 'Error', 'Infinity', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'Set',
  'String', 'TypeError', 'undefined', 'isFinite', 'parseFloat', 'parseInt']);

const files = [];
(function walk(dir) { readdirSync(dir).forEach(f => { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); }); })(SRC);

function patternNames(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach(q => patternNames(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach(e => patternNames(e, out));
  else if (p.type === 'RestElement') patternNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
  return out;
}
function blockDecls(stmts) {
  const out = [];
  stmts.forEach(s => {
    if (s.type === 'ExportNamedDeclaration' && s.declaration) s = s.declaration;
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') s.declarations.forEach(d => patternNames(d.id, out));
    if ((s.type === 'ClassDeclaration' || s.type === 'FunctionDeclaration') && s.id) out.push(s.id.name);
    if (s.type === 'ImportDeclaration') s.specifiers.forEach(sp => out.push(sp.local.name));
  });
  return out;
}
function varDecls(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach(n => varDecls(n, out)); return out; }
  if (/Function/.test(node.type)) return out;
  if (node.type === 'VariableDeclaration' && node.kind === 'var') node.declarations.forEach(d => patternNames(d.id, out));
  for (const k of Object.keys(node)) if (!['type', 'loc'].includes(k) && node[k] && typeof node[k] === 'object') varDecls(node[k], out);
  return out;
}

const problems = [];
const usedGlobals = new Set();
const exportsOf = new Map();
const parsed = files.map(f => {
  const code = readFileSync(f, 'utf8');
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const exps = new Set();
  ast.body.forEach(s => {
    if (s.type === 'ExportNamedDeclaration') {
      if (s.declaration) {
        if (s.declaration.type === 'VariableDeclaration') s.declaration.declarations.forEach(d => patternNames(d.id).forEach(n => exps.add(n)));
        else if (s.declaration.id) exps.add(s.declaration.id.name);
      }
      s.specifiers.forEach(sp => exps.add(sp.exported.name));
    }
  });
  exportsOf.set(resolve(f), exps);
  return { f, ast };
});

for (const { f, ast } of parsed) {
  const rel = relative(ROOT, f).split(sep).join('/');
  const pure = rel.startsWith('src/regole/');
  if (pure) ast.body.filter(s => s.type === 'ImportDeclaration' || (s.type === 'ExportNamedDeclaration' && s.source) || s.type === 'ExportAllDeclaration')
    .forEach(s => { if (!/^\.\/[^/]+$/.test(s.source.value)) problems.push(`${rel}:${s.loc.start.line}: regole pure: import fuori da src/regole/: ${s.source.value}`); });
  // Import: il modulo esiste e il nome è esportato
  ast.body.filter(s => s.type === 'ImportDeclaration').forEach(s => {
    if (!s.source.value.startsWith('.')) return;
    const target = resolve(dirname(f), s.source.value);
    if (/\.css$/.test(target)) { if (!existsSync(target)) problems.push(`${rel}: CSS importato che non esiste: ${s.source.value}`); return; }
    const exps = exportsOf.get(target);
    if (!exps) { problems.push(`${rel}:${s.loc.start.line}: modulo inesistente ${s.source.value}`); return; }
    s.specifiers.forEach(sp => { if (sp.type === 'ImportSpecifier' && !exps.has(sp.imported.name)) problems.push(`${rel}:${s.loc.start.line}: ${sp.imported.name} non è esportato da ${s.source.value}`); });
  });
  // Nomi liberi (né dichiarati né importati)
  const scopes = [new Set(blockDecls(ast.body))];
  const known = n => scopes.some(s => s.has(n));
  const free = (id) => { if (!known(id.name)) { if (pure && !PURE.has(id.name)) problems.push(`${rel}:${id.loc.start.line}: regole pure: nome globale non permesso: ${id.name}`); if (BROWSER.has(id.name)) usedGlobals.add(id.name); else problems.push(`${rel}:${id.loc.start.line}: nome non dichiarato né importato: ${id.name}`); } };
  function visit(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    let pushed = 0;
    const push = names => { scopes.push(new Set(names)); pushed++; };
    if (/Function/.test(node.type)) {
      const names = [];
      node.params.forEach(p => patternNames(p, names));
      if (node.type === 'FunctionExpression' && node.id) names.push(node.id.name);
      if (node.body.type === 'BlockStatement') names.push(...varDecls(node.body.body), ...blockDecls(node.body.body));
      push(names);
      node.params.forEach(p => visitPattern(p));
      if (node.body.type === 'BlockStatement') node.body.body.forEach(s => visit(s, node.body)); else visit(node.body, node);
      scopes.pop();
      return;
    }
    if (node.type === 'BlockStatement') push(blockDecls(node.body));
    if (node.type === 'SwitchStatement') push(blockDecls(node.cases.flatMap(c => c.consequent)));
    if (['ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type)) {
      const init = node.init || node.left;
      if (init && init.type === 'VariableDeclaration') push(init.declarations.flatMap(d => patternNames(d.id)));
    }
    if (node.type === 'CatchClause' && node.param) push(patternNames(node.param));
    switch (node.type) {
      case 'Identifier': free(node); break;
      case 'MemberExpression':
        visit(node.object, node);
        if (node.computed) visit(node.property, node);
        if (pure && node.object.type === 'Identifier' && node.object.name === 'Math' && !known('Math') && node.property.name === 'random') {
          problems.push(`${rel}:${node.loc.start.line}: regole pure: Math.random (il caso si passa come argomento)`);
        }
        // Scritture globali
        if (parent && parent.type === 'AssignmentExpression' && parent.left === node && node.object.type === 'Identifier'
          && ['window', 'globalThis', 'self'].includes(node.object.name) && !(rel === 'src/main.js' && node.property.name === 'app')) {
          problems.push(`${rel}:${node.loc.start.line}: variabile globale ${node.object.name}.${node.property.name || '?'}`);
        }
        break;
      case 'Property': if (node.computed) visit(node.key, node); visit(node.value, node); break;
      case 'MethodDefinition': case 'PropertyDefinition': if (node.computed) visit(node.key, node); visit(node.value, node); break;
      case 'VariableDeclarator': visitPattern(node.id); visit(node.init, node); break;
      case 'ImportDeclaration': break;
      case 'ExportNamedDeclaration': visit(node.declaration, node); break;
      case 'LabeledStatement': visit(node.body, node); break;
      case 'BreakStatement': case 'ContinueStatement': break;
      default:
        for (const k of Object.keys(node)) {
          if (['type', 'start', 'end', 'loc'].includes(k)) continue;
          const v = node[k];
          if (Array.isArray(v)) v.forEach(x => x && typeof x.type === 'string' && visit(x, node));
          else if (v && typeof v.type === 'string') visit(v, node);
        }
    }
    for (let i = 0; i < pushed; i++) scopes.pop();
  }
  function visitPattern(p) {
    if (!p) return;
    if (p.type === 'AssignmentPattern') { visitPattern(p.left); visit(p.right, p); }
    else if (p.type === 'ObjectPattern') p.properties.forEach(q => { if (q.type === 'RestElement') visitPattern(q.argument); else { if (q.computed) visit(q.key, q); visitPattern(q.value); } });
    else if (p.type === 'ArrayPattern') p.elements.forEach(visitPattern);
    else if (p.type === 'RestElement') visitPattern(p.argument);
    else if (p.type === 'MemberExpression') visit(p, null);
  }
  ast.body.forEach(s => visit(s, ast));
}

if (listGlobals) console.log([...usedGlobals].sort().join(' '));
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nModuli: ${problems.length} problemi`);
  process.exit(1);
}
console.log(`Moduli: ${files.length} file di src/ controllati (nomi, import, nessuna variabile globale; src/regole/ pura)`);
