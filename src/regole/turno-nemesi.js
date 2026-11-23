// regole/turno-nemesi.js: le carte in gioco, il turno nemesi (risoluzione e pesca), la fine del turno dei giocatori,
// la vittoria a mazzo vuoto e le statistiche delle carte uscite.
// Riceve `g`, la partita (nell'app l'oggetto dello stato), di cui usa e modifica solo:
//   queue (carte in gioco, dalla più vecchia), deck (si pesca dalla fine), discard, stats, turn (turni nemesi),
//   currentIndex (carta da risolvere), newIndex (carta appena pescata, -1 = nessuna), resolving (turno nemesi in
//   corso), maxTierDrawn (Tier più alto pescato).
// Le carte in gioco ("voci") sono { uid, data, tokens, hp, turnHp, isNew, paid, bornTurn } (+ hpSet, hpMax per i minion
// a vita variabile); data è la carta di cards.json. uid e ora arrivano da fuori (newUid(), now()).
// Le funzioni che fanno un passo lo dicono ("Modifica g") e restituiscono l'esito (effetto, carta pescata, carte
// uscite); le altre restituiscono un valore e non cambiano niente.
// Usato da: stato/partita.js, ui/schermate/turno-nemesi.js e turno-giocatori.js (attraverso stato/partita.js),
// regole/salvataggio.js, test in tests/turno-nemesi.test.js.

// --- Carte in gioco ---

// Minion con la vita decisa dai giocatori (hpVariable: "*" sulla carta)
export function isVariableMinion(data) {
  return data.type === 'Minion' && data.hpVariable === true;
}

// Voce nuova per una carta che entra in gioco: token e vita della carta; un minion a vita variabile entra senza vita
// ("?": hp 0, turnHp null, hpSet false). bornTurn = turno nemesi in cui entra
export function makeEntry(data, uid, turn) {
  if (isVariableMinion(data)) {
    return { uid, data, tokens: data.powerTokens, hp: 0, turnHp: null, hpSet: false, isNew: false, paid: false, bornTurn: turn };
  }
  return { uid, data, tokens: data.powerTokens, hp: data.hp, turnHp: data.hp, isNew: false, paid: false, bornTurn: turn };
}

// Minion a vita variabile la cui vita non è ancora stata impostata ("?"): non muore a 0
export function hpUnset(entry) {
  return isVariableMinion(entry.data) && !entry.hpSet;
}

export function hasHp(entry) {
  return entry.data.type === 'Minion' && entry.hp !== null && entry.hp !== undefined;
}

// Vita massima: quella della carta o, per un minion a vita variabile, quella impostata la prima volta (hpMax)
export function hpMaxOf(entry) {
  return isVariableMinion(entry.data) ? entry.hpMax : entry.data.hp;
}

// Tetto del +1 alla vita: la vita massima e, nel turno giocatori, anche la vita di inizio turno. Minion a vita
// variabile non ancora impostata: nessun tetto (Infinity)
export function hpCap(entry, nemesisTurn) {
  if (hpUnset(entry)) return Infinity;
  const max = hpMaxOf(entry);
  if (nemesisTurn) return max;
  return Math.min(max, entry.turnHp === undefined || entry.turnHp === null ? entry.hp : entry.turnHp);
}

// Carta che esce dal gioco al prossimo turno nemesi: potere pagato o minion a 0 (tranne i minion con la vita "?")
export function isGone(entry) {
  return !!entry.paid || (hasHp(entry) && entry.hp <= 0 && !hpUnset(entry));
}

export function entryByUid(queue, uid) {
  return queue.find(e => e.uid === uid) || null;
}

// --- Statistiche ---

// Statistiche di una partita nuova. cards: id delle carte di ogni gruppo; startedAt / tierAt / endedAt: istanti;
// mages: per giocatore { damage, powers, kills }
export function emptyStats(deckSize) {
  return { deckSize, minionsKilled: 0, powersPaid: 0, powersResolved: 0, aetherSpent: 0, attacksResolved: 0, minions: [], mages: {},
    cards: { minionsKilled: [], powersPaid: [], powersResolved: [], attacksResolved: [] },
    startedAt: null, tierAt: {}, endedAt: null };
}

// Aggiunge la carta all'elenco di un gruppo. Modifica `stats`
export function statCard(stats, group, data) {
  if (!stats.cards) stats.cards = emptyStats(0).cards;
  if (!Array.isArray(stats.cards[group])) stats.cards[group] = [];
  stats.cards[group].push(data.id);
}

// Costo in Æ per scartare un potere (removalCost di cards.json); 0 se il costo non è in Æ
export function aetherCost(data) {
  return Number(data.removalCost) || 0;
}

// Minion ucciso: contato, con i turni nemesi passati da quando è entrato. Modifica `stats`
export function countMinionKilled(stats, entry, turn) {
  stats.minionsKilled++;
  statCard(stats, 'minionsKilled', entry.data);
  stats.minions.push({ id: entry.data.id, name: entry.data.name, turns: Math.max(0, turn - (entry.bornTurn || 0)) });
}

// Potere scartato pagando il costo: contato con gli Æ spesi. Modifica `stats`
export function countPowerPaid(stats, entry) {
  stats.powersPaid++;
  statCard(stats, 'powersPaid', entry.data);
  stats.aetherSpent += aetherCost(entry.data);
}

// --- Mazzo, coda e scarti ---

// Toglie la voce dalla coda e mette la carta negli scarti. Modifica g
export function discardEntry(g, entry) {
  const i = g.queue.indexOf(entry);
  if (i >= 0) g.queue.splice(i, 1);
  g.discard.push(entry.data);
}

// Carta grigia che esce dal gioco: minion ucciso o potere pagato nelle statistiche, poi negli scarti. Modifica g
export function discardGone(g, entry) {
  if (entry.data.type === 'Minion') countMinionKilled(g.stats, entry, g.turn);
  else if (entry.data.type === 'Power') countPowerPaid(g.stats, entry);
  discardEntry(g, entry);
}

// Il mazzo nemesi non si rimescola: vuoto = niente pesca
export function canDraw(g) {
  return g.deck.length > 0;
}

// Toglie e restituisce la carta in cima (fine dell'array), o null a mazzo vuoto. Modifica g
export function drawFromDeck(g) {
  return g.deck.pop() || null;
}

// Vittoria a mazzo vuoto: dopo il primo turno nemesi, mazzo vuoto e nessun potere né minion in gioco
export function isVictory(g) {
  return g.turn > 0 && g.deck.length === 0 && !g.queue.some(e => e.data.type === 'Power' || e.data.type === 'Minion');
}

// --- Turno nemesi ---

// Passo Pesca: turno nemesi con tutte le carte in gioco risolte
export function isDrawStep(g) {
  return g.resolving && g.newIndex < 0 && g.currentIndex >= g.queue.length;
}

// Fine della risoluzione (ritorno al turno giocatori). Modifica g
export function endResolution(g) {
  g.newIndex = -1;
  g.resolving = false;
  g.currentIndex = 0;
}

// Inizio della risoluzione: nessuna carta è più "nuova", si parte dalla più vecchia; coda vuota e mazzo vuoto = fine
// subito. Modifica g
export function startResolution(g) {
  g.queue.forEach(e => { e.isNew = false; });
  g.currentIndex = 0;
  g.newIndex = -1;
  g.resolving = true;
  if (g.queue.length === 0 && !canDraw(g)) endResolution(g);
}

// Turno nemesi: turno +1 e inizio della risoluzione. Modifica g
export function nemesisTurn(g) {
  g.turn++;
  startResolution(g);
}

// Pulsante principale sulla carta da risolvere. Carta appena pescata: un attacco va negli scarti ('discard'), le altre
// restano in gioco ('play'); poi fine della risoluzione. Altrimenti: potere con più di un token = −1 token e avanti
// ('token'); minion = resta e avanti ('next'); potere all'ultimo token o attacco = negli scarti ('discard'). Finita la
// coda senza carte da pescare, fine della risoluzione. Poteri e attacchi risolti vanno nelle statistiche.
// Modifica g. Restituisce l'effetto
export function resolveCurrent(g) {
  const entry = g.queue[g.currentIndex];
  const { data, tokens } = entry;
  if (g.newIndex >= 0) {
    let effect;
    if (data.type === 'Attack') {
      g.stats.attacksResolved++;
      statCard(g.stats, 'attacksResolved', data);
      discardEntry(g, entry);
      effect = 'discard';
    } else {
      entry.isNew = false;
      effect = 'play';
    }
    endResolution(g);
    return effect;
  }
  let effect;
  if (data.type === 'Power' && tokens > 1) {
    entry.tokens--;
    g.currentIndex++;
    effect = 'token';
  } else if (data.type === 'Minion') {
    g.currentIndex++;
    effect = 'next';
  } else {
    if (data.type === 'Power') { g.stats.powersResolved++; statCard(g.stats, 'powersResolved', data); }
    else if (data.type === 'Attack') { g.stats.attacksResolved++; statCard(g.stats, 'attacksResolved', data); }
    discardEntry(g, entry);
    effect = 'discard';
  }
  if (g.currentIndex >= g.queue.length && !canDraw(g)) endResolution(g);
  return effect;
}

// Pesca del passo Pesca: la carta in cima entra in fondo alla coda come nuova (uid da newUid()) e diventa la carta da
// risolvere. Prima carta del Tier 2 o 3: l'ora now() va in stats.tierAt (now si chiama solo allora). Mazzo vuoto: fine
// della risoluzione e null. Modifica g. Restituisce { entry, newTier } (newTier: 2 o 3 alla prima carta del Tier, o null)
export function drawNewCard(g, newUid, now) {
  const data = drawFromDeck(g);
  if (!data) {
    endResolution(g);
    return null;
  }
  const entry = makeEntry(data, newUid(), g.turn);
  entry.isNew = true;
  g.queue.push(entry);
  g.newIndex = g.queue.length - 1;
  g.currentIndex = g.newIndex;
  let newTier = null;
  if (data.tier >= 2 && data.tier > g.maxTierDrawn) {
    newTier = data.tier;
    if (!g.stats.tierAt) g.stats.tierAt = {};
    g.stats.tierAt[data.tier] = now();
  }
  if (data.tier > g.maxTierDrawn) g.maxTierDrawn = data.tier;
  return { entry, newTier };
}

// Minion eliminato durante il turno nemesi: contato, negli scarti, e gli indici della risoluzione seguono la coda (se
// era la carta appena pescata, fine della risoluzione). Modifica g
export function removeWhileResolving(g, entry) {
  const index = g.queue.indexOf(entry);
  const wasNew = g.newIndex >= 0 && index === g.newIndex;
  countMinionKilled(g.stats, entry, g.turn);
  discardEntry(g, entry);
  if (wasNew) { endResolution(g); return; }
  if (index < g.currentIndex) g.currentIndex--;
  if (g.newIndex > index) g.newIndex--;
  if (g.currentIndex >= g.queue.length && g.newIndex < 0 && !canDraw(g)) endResolution(g);
}

// --- Turno giocatori ---

// "Salva modifiche": le bozze (Map uid -> { hp?, paid? }) diventano definitive. Statistiche dei maghi per il giocatore
// del turno (mage 'p1'..'p4', o null = nessuno): danni ai minion, minion uccisi, poteri pagati. La prima impostazione
// della vita di un minion a vita variabile non è danno e diventa vita di inizio turno e vita massima (solo se > 0).
// Poi le carte grigie vanno negli scarti. Modifica g. Restituisce le voci uscite
export function applyDrafts(g, drafts, mage) {
  const m = mage ? (g.stats.mages[mage] = g.stats.mages[mage] || { damage: 0, powers: 0, kills: 0 }) : null;
  drafts.forEach((d, uid) => {
    const entry = entryByUid(g.queue, uid);
    if (!entry) return;
    if (d.hp !== undefined) {
      const firstSet = hpUnset(entry);
      if (m && entry.data.type === 'Minion' && !firstSet) {
        m.damage += Math.max(0, entry.hp - d.hp);
        if (d.hp <= 0 && entry.hp > 0) m.kills++;
      }
      entry.hp = d.hp;
      if (firstSet && d.hp > 0) { entry.hpSet = true; entry.turnHp = d.hp; entry.hpMax = d.hp; }
    }
    if (d.paid) {
      if (m && !entry.paid) m.powers++;
      entry.paid = true;
    }
  });
  const gone = g.queue.filter(isGone);
  gone.forEach(e => discardGone(g, e));
  return gone;
}

// Fine del turno di un giocatore, per le carte: la vita attuale diventa quella di inizio turno e le carte grigie vanno
// negli scarti. Modifica g
export function endPlayerTurnCards(g) {
  g.queue.forEach(e => { e.turnHp = e.hp; });
  g.queue.filter(isGone).forEach(e => discardGone(g, e));
}
