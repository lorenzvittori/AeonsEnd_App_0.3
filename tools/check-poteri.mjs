// Controllo dei numeri scritti nel testo delle nemesi (npm run check): public/cards_nemesis.json.
// 1. ogni carta con "POWER n:" nell'effetto ha powerTokens uguale a n (il numero intero dopo "POWER ");
// 2. ogni carta con "TO DISCARD: Spend x Æ." ha toDiscardSpend uguale a x.
// Il dato di powerTokens viene dalla colonna PowerTokens del DataBase; le correzioni a mano sono in
// DataBase/correzioni.json. Il confronto con la wiki (da fare nella pipeline) e' in ToDo.md.
// Esce con 1 se trova differenze.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const carte = JSON.parse(readFileSync(join(radice, 'public', 'cards_nemesis.json'), 'utf8'));

const problemi = [];
for (const c of carte) {
  const effetto = String(c.effect ?? '').replace(/\r/g, '');
  const power = [...effetto.matchAll(/^POWER (\d+):/gm)].map(m => Number(m[1]));
  if (power.length > 1) problemi.push(`${c.id} ${c.name}: piu' POWER nell'effetto (${power.join(', ')})`);
  if (power.length === 1 && c.powerTokens !== power[0]) {
    problemi.push(`${c.id} ${c.name}: powerTokens è ${c.powerTokens}, ma l'effetto dice POWER ${power[0]}`);
  }
  const spend = [...effetto.matchAll(/^TO DISCARD: Spend (\d+) Æ\.?\s*$/gm)].map(m => Number(m[1]));
  if (spend.length === 1 && c.toDiscardSpend !== spend[0]) {
    problemi.push(`${c.id} ${c.name}: toDiscardSpend è ${c.toDiscardSpend}, ma l'effetto dice Spend ${spend[0]}`);
  }
  if (spend.length === 0 && c.toDiscardSpend !== null && c.toDiscardSpend !== undefined) {
    problemi.push(`${c.id} ${c.name}: toDiscardSpend ${c.toDiscardSpend} senza "TO DISCARD: Spend" nell'effetto`);
  }
}

if (problemi.length) {
  console.error(`check-poteri: ${problemi.length} differenze in cards_nemesis.json`);
  for (const p of problemi) console.error('  ' + p);
  process.exit(1);
}
const conPower = carte.filter(c => /^POWER \d+:/m.test(String(c.effect ?? ''))).length;
console.log(`Poteri: ${conPower} carte con POWER n coincidono con powerTokens; toDiscardSpend coerente`);
