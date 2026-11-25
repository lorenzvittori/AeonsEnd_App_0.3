// tools/confronto/costruzione.mjs: costruisce le due versioni da confrontare in .confronto/ (strumento di confronto,
// CONTESTO_SVILUPPO.md sezione 9). <ref> (tag o commit) in una worktree git .confronto/<ref>/ con node_modules collegato a
// quello del repo, costruita con `vite build`; la versione attuale (comprese le modifiche non committate) direttamente dal
// repo in .confronto/attuale/dist. Una build di <ref> già fatta si riusa se il commit non è cambiato.
// Dipende da: Node, git, vite. Usato da: confronta.mjs.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, rmdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const RADICE = resolve(import.meta.dirname, '..', '..');
export const CONFRONTO = join(RADICE, '.confronto');

const git = (...args) => execFileSync('git', args, { cwd: RADICE, encoding: 'utf8' }).trim();
const nomeSicuro = ref => ref.replace(/[^A-Za-z0-9._-]/g, '_');

// vite build in `cartella` (con node_modules accanto), scrivendo in `uscita`
function costruisci(cartella, uscita) {
  const vite = join(RADICE, 'node_modules', 'vite', 'bin', 'vite.js');
  execFileSync(process.execPath, [vite, 'build', '--outDir', uscita, '--emptyOutDir', '--logLevel', 'warn'],
    { cwd: cartella, stdio: ['ignore', 'inherit', 'inherit'] });
}

// La build di <ref>: restituisce { dist, sha, riusata }
export function costruisciRef(ref) {
  const sha = git('rev-parse', '--verify', ref + '^{commit}');
  const cartella = join(CONFRONTO, nomeSicuro(ref));
  const dist = join(cartella, 'dist');
  const segno = join(cartella, '.build-sha');
  if (existsSync(join(dist, 'index.html')) && existsSync(segno) && readFileSync(segno, 'utf8') === sha) {
    return { dist, sha, riusata: true };
  }
  mkdirSync(CONFRONTO, { recursive: true });
  const sorgenti = join(cartella, 'src-ref');
  // Worktree pulita sul commit (se c'è già, la si riporta al commit voluto)
  if (!existsSync(sorgenti)) execFileSync('git', ['worktree', 'add', '--detach', '--force', sorgenti, sha], { cwd: RADICE, stdio: 'ignore' });
  else {
    execFileSync('git', ['checkout', '--detach', '--force', sha], { cwd: sorgenti, stdio: 'ignore' });
    execFileSync('git', ['clean', '-fdq', '-e', 'node_modules'], { cwd: sorgenti, stdio: 'ignore' });
  }
  const moduli = join(sorgenti, 'node_modules');
  if (!existsSync(moduli)) symlinkSync(join(RADICE, 'node_modules'), moduli, 'junction');
  costruisci(sorgenti, dist);
  writeFileSync(segno, sha);
  pulisciRef(ref);
  return { dist, sha, riusata: false };
}

// La versione attuale (anche non committata)
export function costruisciAttuale() {
  const dist = join(CONFRONTO, 'attuale', 'dist');
  mkdirSync(join(CONFRONTO, 'attuale'), { recursive: true });
  costruisci(RADICE, dist);
  return { dist, sha: git('rev-parse', 'HEAD') + '+attuale', riusata: false };
}

// Toglie la worktree dei sorgenti (la build resta). Prima si scollega node_modules (una giunzione verso quello del repo):
// una cancellazione ricorsiva che la seguisse svuoterebbe il vero node_modules
export function pulisciRef(ref) {
  const sorgenti = join(CONFRONTO, nomeSicuro(ref), 'src-ref');
  if (!existsSync(sorgenti)) return;
  const moduli = join(sorgenti, 'node_modules');
  try { if (lstatSync(moduli).isSymbolicLink()) rmdirSync(moduli); } catch { /* non c'è */ }
  if (existsSync(moduli)) return; // non scollegato: meglio lasciare tutto com'è che rischiare node_modules
  try { execFileSync('git', ['worktree', 'remove', '--force', sorgenti], { cwd: RADICE, stdio: 'ignore' }); } catch { rmSync(sorgenti, { recursive: true, force: true }); }
}
