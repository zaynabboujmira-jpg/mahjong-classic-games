import { countHand, exposureGroup, groupKind, rankTargets, TARGETS, distance } from './american';
import { shanten } from './classic';
import { EAST, JOKER, KINDS, countKinds, isDragon, isHonor, isSuited, isTerminal, suitOf, type Meld, type Tile } from './tiles';
import type { Claim, TableGame } from './game';

/*
 * Client-side bots. Classic bots play efficiently (fewest tiles from ready,
 * then the most ways to improve), lean towards a flush or valuable honour
 * pungs when the rules need faan, and play safer tiles when an opponent
 * looks close. American bots pick the card hands their tiles are closest
 * to and keep what those hands need, jokers above all.
 */

// ------------------------------------------------------------ classic

/** Unseen copies of each kind from player p's point of view. */
function unseen(game: TableGame, p: number): number[] {
  const seen = new Array<number>(KINDS).fill(0);
  const add = (t: Tile) => t.kind < KINDS && seen[t.kind]!++;
  game.seats[p]!.hand.forEach(add);
  for (const s of game.seats) {
    s.river.forEach(add);
    s.melds.forEach((m) => m.tiles.forEach(add));
  }
  return seen.map((n) => Math.max(0, 4 - n));
}

/** The suit this hand is collecting for a flush, if any (needs rules with a faan minimum). */
function flushSuit(hand: readonly Tile[], melds: readonly Meld[], threshold: number): number | null {
  const bySuit = [0, 0, 0];
  let honors = 0;
  const all = [...hand, ...melds.flatMap((m) => m.tiles)];
  for (const t of all) {
    if (isSuited(t.kind)) bySuit[suitOf(t.kind)]!++;
    else if (isHonor(t.kind)) honors++;
  }
  const best = bySuit.indexOf(Math.max(...bySuit));
  if (bySuit[best]! + honors < threshold) return null;
  if (melds.some((m) => isSuited(m.kind) && suitOf(m.kind) !== best)) return null;
  return best;
}

const isValueHonor = (game: TableGame, p: number, k: number) => isDragon(k) || k === EAST + game.seatWind(p) || k === EAST + game.prevailing;

function classicDiscard(game: TableGame, p: number): Tile {
  const s = game.seats[p]!;
  const counts = countKinds(s.hand);
  const melds = s.melds.length;
  const left = unseen(game, p);
  const flush = flushSuit(s.hand, s.melds, game.rules.minFaan >= 3 ? 9 : 11);
  // Danger: an opponent with three or more exposed sets may be ready.
  const threat = game.seats.findIndex((o, q) => q !== p && o.melds.filter((m) => !m.concealed).length >= 3);

  const kinds = [...new Set(s.hand.map((t) => t.kind))];
  const shantens = kinds.map((k) => {
    counts[k]!--;
    const sh = shanten(counts, melds);
    counts[k]!++;
    return sh;
  });
  const minSh = Math.min(...shantens);
  let bestKind = kinds[0]!;
  let bestScore = -Infinity;
  kinds.forEach((k, i) => {
    const sh = shantens[i]!;
    if (sh > minSh + 1) return;
    counts[k]!--;
    let accept = 0;
    if (sh === minSh) {
      for (let j = 0; j < KINDS; j++) {
        if (!left[j]) continue;
        counts[j]!++;
        if (shanten(counts, melds) < sh) accept += left[j]!;
        counts[j]!--;
      }
    }
    counts[k]!++;
    let score = -sh * 1000 + accept * 4;
    const n = counts[k]!;
    if (isHonor(k)) score += isValueHonor(game, p, k) ? (n >= 2 ? -150 : -10) : n === 1 ? 25 : 0;
    else if (isTerminal(k) && n === 1) score += 6;
    if (flush !== null && isSuited(k) && suitOf(k) !== flush) score += 120;
    if (flush !== null && isSuited(k) && suitOf(k) === flush) score -= 60;
    if (threat >= 0 && sh >= 1) {
      if (game.seats[threat]!.river.some((t) => t.kind === k)) score += 300;
      else score -= (4 - left[k]!) < 3 ? 40 : 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKind = k;
    }
  });
  // Discard the copy that was not just drawn when possible (purely cosmetic).
  const copies = s.hand.filter((t) => t.kind === bestKind);
  return copies.find((t) => t.id !== game.drawnId) ?? copies[0]!;
}

/** Best shanten reachable by discarding one tile from `counts` (14-tile state). */
function bestAfterDiscard(counts: number[], melds: number): number {
  let best = 99;
  for (let k = 0; k < KINDS; k++) {
    if (!counts[k]) continue;
    counts[k]!--;
    best = Math.min(best, shanten(counts, melds));
    counts[k]!++;
  }
  return best;
}

function classicClaim(game: TableGame, p: number, options: Claim[]): Claim | null {
  const win = options.find((o) => o.type === 'win');
  if (win) return win;
  const s = game.seats[p]!;
  const tile = game.lastDiscard!.tile;
  const counts = countKinds(s.hand);
  const melds = s.melds.length;
  const now = shanten(counts, melds);
  const flush = flushSuit(s.hand, s.melds, game.rules.minFaan >= 3 ? 9 : 11);
  const needsValue = game.rules.minFaan > 0;
  const value = isValueHonor(game, p, tile.kind);
  const offSuit = flush !== null && isSuited(tile.kind) && suitOf(tile.kind) !== flush;

  const kong = options.find((o) => o.type === 'kong');
  if (kong && !offSuit) {
    counts[tile.kind]! -= 3;
    const after = shanten(counts, melds + 1);
    counts[tile.kind]! += 3;
    if (after <= now) return kong;
  }
  const pung = options.find((o) => o.type === 'pung');
  if (pung && !offSuit) {
    counts[tile.kind]! -= 2;
    const after = bestAfterDiscard(counts, melds + 1);
    counts[tile.kind]! += 2;
    if (after < now && (!needsValue || value || flush !== null || now <= 1)) return pung;
    if (value && after <= now) return pung;
  }
  if (!offSuit && (!needsValue || flush !== null)) {
    for (const o of options) {
      if (o.type !== 'chow') continue;
      for (let k = o.start; k < o.start + 3; k++) if (k !== tile.kind) counts[k]!--;
      const after = bestAfterDiscard(counts, melds + 1);
      for (let k = o.start; k < o.start + 3; k++) if (k !== tile.kind) counts[k]!++;
      if (after < now) return o;
    }
  }
  return null;
}

function classicTurn(game: TableGame, p: number): void {
  if (game.canSelfWin(p)) {
    game.selfWin(p);
    return;
  }
  const s = game.seats[p]!;
  for (const kind of game.kongOptions(p)) {
    const counts = countKinds(s.hand);
    const before = bestAfterDiscard(counts, s.melds.length);
    const added = s.melds.some((m) => m.type === 'pung' && m.kind === kind);
    counts[kind]! -= added ? 1 : 4;
    const after = shanten(counts, s.melds.length + (added ? 0 : 1));
    if (after <= before) {
      game.declareKong(p, kind);
      return;
    }
  }
  game.discard(p, classicDiscard(game, p).id);
}

// ------------------------------------------------------------ American

/** How good a 13-tile American hand is: closest distance, then how many hands are near. */
function americanEval(hand: readonly Tile[], melds: readonly Meld[]): number {
  const { counts, jokers } = countHand(hand);
  const groups = melds.map(exposureGroup);
  let best = Infinity;
  let bestValue = 0;
  let near = 0;
  const ds: number[] = [];
  for (const t of TARGETS) {
    const d = distance(t, counts, jokers, groups);
    if (d === Infinity) continue;
    ds.push(d);
    if (d < best || (d === best && t.hand.value > bestValue)) {
      best = d;
      bestValue = t.hand.value;
    }
  }
  for (const d of ds) if (d <= best + 1) near++;
  return -best * 100 + Math.min(near, 20) + bestValue / 10;
}

/** The least useful non-joker tile of a hand. */
export function americanDiscard(hand: readonly Tile[], melds: readonly Meld[], avoid: readonly Tile[] = []): Tile {
  let best: Tile | null = null;
  let bestScore = -Infinity;
  const tried = new Set<number>();
  for (const t of hand) {
    if (t.kind === JOKER || tried.has(groupKind(t.kind)) || avoid.includes(t)) continue;
    tried.add(groupKind(t.kind));
    const score = americanEval(
      hand.filter((u) => u !== t),
      melds,
    );
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ?? hand.find((t) => !avoid.includes(t))!;
}

/** Three tiles (no jokers) a bot passes in the Charleston. */
export function charlestonPass(hand: readonly Tile[], count = 3): Tile[] {
  const out: Tile[] = [];
  let rest = hand.slice();
  for (let i = 0; i < count; i++) {
    const naturals = rest.filter((t) => t.kind !== JOKER);
    if (!naturals.length) break;
    const t = americanDiscard(rest, []);
    if (t.kind === JOKER) break;
    out.push(t);
    rest = rest.filter((u) => u !== t);
  }
  return out;
}

function americanClaim(game: TableGame, p: number, options: Claim[]): Claim | null {
  const win = options.find((o) => o.type === 'win');
  if (win) return win;
  const s = game.seats[p]!;
  const tile = game.lastDiscard!.tile;
  const now = rankTargets(s.hand, s.melds, 1)[0]?.distance ?? Infinity;
  for (const o of options) {
    if (o.type === 'win' || o.type === 'chow') continue;
    const size = o.type === 'pung' ? 3 : o.type === 'kong' ? 4 : 5;
    const g = groupKind(tile.kind);
    const naturals = s.hand.filter((t) => groupKind(t.kind) === g).slice(0, size - 1 - o.jokers);
    const jokers = s.hand.filter((t) => t.kind === JOKER).slice(0, o.jokers);
    const rest = s.hand.filter((t) => !naturals.includes(t) && !jokers.includes(t));
    const meld: Meld = { type: o.type, kind: g, tiles: [tile, ...naturals, ...jokers], concealed: false };
    // After exposing, the bot discards one tile: compare the best distance it can reach.
    const melds = [...s.melds, meld];
    const discard = americanDiscard(rest, melds);
    const after = rankTargets(
      rest.filter((t) => t !== discard),
      melds,
      1,
    )[0]?.distance;
    if (after !== undefined && after < now) return o;
  }
  return null;
}

function americanTurn(game: TableGame, p: number): void {
  if (game.canSelfWin(p)) {
    game.selfWin(p);
    return;
  }
  const s = game.seats[p]!;
  // Taking a joker is almost always worth it: do it when it does not hurt.
  const bestAfterDiscard = (hand: readonly Tile[]) => {
    const d = americanDiscard(hand, s.melds);
    return americanEval(
      hand.filter((t) => t !== d),
      s.melds,
    );
  };
  for (const swap of game.jokerSwaps(p)) {
    const natural = s.hand.find((t) => t.id === swap.tileId)!;
    const swapped = [...s.hand.filter((t) => t !== natural), { id: -1, kind: JOKER }];
    if (bestAfterDiscard(swapped) >= bestAfterDiscard(s.hand)) {
      game.swapJoker(p, swap.owner, swap.meld);
      if (game.canSelfWin(p)) {
        game.selfWin(p);
        return;
      }
      break;
    }
  }
  game.discard(p, americanDiscard(s.hand, s.melds).id);
}

// ------------------------------------------------------------ driver

/** The move a bot (or the hint for the human) would discard now. */
export function suggestDiscard(game: TableGame, p: number): Tile {
  const s = game.seats[p]!;
  return game.rules.american ? americanDiscard(s.hand, s.melds) : classicDiscard(game, p);
}

/**
 * Plays one bot action if a bot is to act: a whole turn, every pending bot
 * claim answer, or every pending bot Charleston pass. Returns false when it
 * is the human's move (seat 0) or the hand is over.
 */
export function stepBots(game: TableGame): boolean {
  const w = game.waiting();
  if (w.type === 'over') return false;
  if (w.type === 'turn') {
    if (w.player === 0) return false;
    if (game.rules.american) americanTurn(game, w.player);
    else classicTurn(game, w.player);
    return true;
  }
  if (w.type === 'claim') {
    const bots = w.players.filter((p) => p !== 0);
    if (!bots.length) return false;
    // Bots answer in seat order; the engine resolves once everyone has answered.
    for (const p of bots) {
      const options = game.claimOptions(p);
      game.respond(p, game.rules.american ? americanClaim(game, p, options) : classicClaim(game, p, options));
    }
    return true;
  }
  const bots = w.players.filter((p) => p !== 0);
  if (!bots.length || w.stage === 'vote') return false;
  for (const p of bots) game.submitPass(p, charlestonPass(game.seats[p]!.hand).map((t) => t.id));
  return true;
}

/** Plays a whole hand with bots in every seat (tests and simulations). */
export function playOut(game: TableGame, maxSteps = 2000): number {
  let steps = 0;
  for (; steps < maxSteps && game.phase !== 'over'; steps++) {
    const w = game.waiting();
    if (w.type === 'turn' && w.player === 0) {
      if (game.rules.american) americanTurn(game, 0);
      else classicTurn(game, 0);
    } else if (w.type === 'claim' && w.players.includes(0)) {
      const o = game.claimOptions(0);
      game.respond(0, game.rules.american ? americanClaim(game, 0, o) : classicClaim(game, 0, o));
    } else if (w.type === 'charleston' && w.stage === 'vote') game.voteSecond(true);
    else if (w.type === 'charleston' && w.players.includes(0)) game.submitPass(0, charlestonPass(game.seats[0]!.hand).map((t) => t.id));
    else stepBots(game);
  }
  return steps;
}
