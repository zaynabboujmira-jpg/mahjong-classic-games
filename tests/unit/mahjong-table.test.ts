import { describe, expect, it } from 'vitest';
import { CARD, TARGETS, americanValue, americanWin, countHand, distance } from '../../src/engines/mahjong-table/american';
import { charlestonPass, playOut, stepBots, suggestDiscard } from '../../src/engines/mahjong-table/ai';
import { isWinningShape, scoreClassic, shanten, type WinContext } from '../../src/engines/mahjong-table/classic';
import { RULES, TableGame, nextHand, type Variant } from '../../src/engines/mahjong-table/game';
import { FLOWER, GREEN, JOKER, RED, WHITE, buildWall, countKinds, type Meld, type Tile } from '../../src/engines/mahjong-table/tiles';
import { createRng } from '../../src/engines/core/rng';

let nextId = 10_000;
const t = (kind: number): Tile => ({ id: nextId++, kind });
const tiles = (...kinds: number[]) => kinds.map(t);
/** Suits: d(n) dots, b(n) bamboo, c(n) characters. */
const d = (n: number) => n - 1;
const b = (n: number) => 9 + n - 1;
const c = (n: number) => 18 + n - 1;
const E = 27;
const S = 28;
const W = 29;
const N = 30;

const ctx = (over: Partial<WinContext> = {}): WinContext => ({ selfDrawn: false, seat: 1, prevailing: 0, afterKong: false, lastTile: false, flowers: null, ...over });

describe('tile sets', () => {
  it('has 136 classic tiles, 144 with flowers and 152 for American', () => {
    for (const [v, n] of [
      ['chinese', 136],
      ['hong-kong', 144],
      ['american', 152],
    ] as const) {
      const r = RULES[v];
      const wall = buildWall({ flowers: r.flowers, jokers: r.jokers }, createRng(v));
      expect(wall).toHaveLength(n);
      expect(new Set(wall.map((x) => x.id)).size).toBe(n);
    }
  });
});

describe('classic hands', () => {
  const win = [d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(7), c(7), E, E, E, RED, RED];

  it('recognises standard, seven pairs and thirteen orphans', () => {
    expect(isWinningShape(countKinds(tiles(...win)), 0)).toBe(true);
    expect(isWinningShape(countKinds(tiles(d(1), d(1), d(3), d(3), b(5), b(5), b(7), b(7), c(2), c(2), E, E, RED, RED)), 0)).toBe(true);
    expect(isWinningShape(countKinds(tiles(d(1), d(9), b(1), b(9), c(1), c(9), E, S, W, N, RED, GREEN, WHITE, WHITE)), 0)).toBe(true);
    expect(isWinningShape(countKinds(tiles(d(1), d(2), d(4), b(4), b(5), b(6), c(7), c(7), c(7), E, E, E, RED, RED)), 0)).toBe(false);
  });

  it('counts declared sets', () => {
    // 3 sets in hand + pair, with one declared set
    expect(isWinningShape(countKinds(tiles(d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(7), c(7), RED, RED)), 1)).toBe(true);
    expect(isWinningShape(countKinds(tiles(d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(7), c(7), RED, RED)), 0)).toBe(false);
  });

  it('computes shanten: complete -1, ready 0, one away 1', () => {
    expect(shanten(countKinds(tiles(...win)), 0)).toBe(-1);
    expect(shanten(countKinds(tiles(...win.slice(0, 13))), 0)).toBe(0);
    // Ready on either pair (E or Red).
    expect(shanten(countKinds(tiles(d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(7), c(7), E, E, RED, RED)), 0)).toBe(0);
    // Three sets, a pair and two loners: one tile from ready.
    expect(shanten(countKinds(tiles(d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(7), c(7), E, E, RED, S)), 0)).toBe(1);
  });

  it('scores a chicken hand at 0 faan', () => {
    const s = scoreClassic(tiles(d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(8), c(9), b(7), b(7), b(7), d(5), d(5)), [], ctx());
    expect(s!.faan).toBe(1); // concealed hand
    const open = scoreClassic(tiles(b(4), b(5), b(6), c(7), c(8), c(9), b(7), b(7), b(7), d(5), d(5)), [{ type: 'chow', kind: d(1), tiles: tiles(d(1), d(2), d(3)), concealed: false }], ctx());
    expect(open!.faan).toBe(0);
  });

  it('scores flushes, all pungs and honours', () => {
    const full = scoreClassic(tiles(b(1), b(1), b(1), b(2), b(3), b(4), b(5), b(5), b(5), b(7), b(8), b(9), b(9), b(9)), [], ctx({ selfDrawn: true }));
    expect(full!.items.map((i) => i.name)).toEqual(expect.arrayContaining(['Full flush', 'Self-drawn', 'Concealed hand']));
    expect(full!.faan).toBeGreaterThanOrEqual(9);

    const pungs = scoreClassic(tiles(d(2), d(2), d(2), b(5), b(5), b(5), c(9), c(9), c(9), RED, RED, RED, E, E), [], ctx());
    const names = pungs!.items.map((i) => i.name);
    expect(names).toContain('All pungs');
    expect(names).toContain('Red dragon pung');

    const dragons = scoreClassic(tiles(RED, RED, RED, GREEN, GREEN, GREEN, WHITE, WHITE, WHITE, d(1), d(2), d(3), E, E), [], ctx());
    expect(dragons!.items.map((i) => i.name)).toContain('Big three dragons');

    const orphans = scoreClassic(tiles(d(1), d(9), b(1), b(9), c(1), c(9), E, S, W, N, RED, GREEN, WHITE, E), [], ctx());
    expect(orphans!.faan).toBe(13);
  });

  it('scores seat and round wind pungs', () => {
    const s = scoreClassic(tiles(E, E, E, S, S, S, d(1), d(2), d(3), b(4), b(5), b(6), c(5), c(5)), [], ctx({ seat: 1, prevailing: 0 }));
    const names = s!.items.map((i) => i.name);
    expect(names).toContain('Seat wind pung');
    expect(names).toContain('Round wind pung');
  });

  it('scores flowers only when flowers are in use', () => {
    const hand = tiles(d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(8), c(9), b(7), b(7), b(7), d(5), d(5));
    expect(scoreClassic(hand, [], ctx({ flowers: [] }))!.items.map((i) => i.name)).toContain('No flowers');
    const own = scoreClassic(hand, [], ctx({ seat: 1, flowers: [t(35), t(39), t(36)] }))!;
    expect(own.items.find((i) => i.name === 'Own flowers')!.faan).toBe(2);
    expect(scoreClassic(hand, [], ctx())!.items.map((i) => i.name)).not.toContain('No flowers');
  });

  it('rejects incomplete hands', () => {
    expect(scoreClassic(tiles(d(1), d(2), d(4), b(4), b(5), b(6), c(7), c(7), c(7), E, E, E, RED, RED), [], ctx())).toBeNull();
  });
});

describe('American card', () => {
  it('has 20 hands, each expanding to exact 14-tile targets with no repeated tile kind', () => {
    expect(CARD).toHaveLength(20);
    for (const h of CARD) expect(TARGETS.some((x) => x.hand === h)).toBe(true);
    for (const target of TARGETS) {
      expect(target.groups.reduce((n, g) => n + g.size, 0)).toBe(14);
      expect(new Set(target.groups.map((g) => g.kind)).size).toBe(target.groups.length);
    }
  });

  const likeOnes = TARGETS.find((x) => x.hand.id === 'like-1' && x.groups.every((g) => g.kind === FLOWER || (g.kind % 9) + 1 === 1))!;

  it('wins with jokers in groups of three or more', () => {
    const hand = tiles(FLOWER, FLOWER, d(1), d(1), d(1), JOKER, b(1), b(1), JOKER, JOKER, c(1), c(1), c(1), c(1));
    expect(americanWin(hand, [])?.hand.id).toBe('like-1');
    expect(americanValue(likeOnes, hand, []).jokerless).toBe(false);
  });

  it('never lets a joker stand in for a pair', () => {
    // NN EE WW SS 11 11 11: replace one North with a joker.
    const ok = tiles(N, N, E, E, W, W, S, S, d(1), d(1), b(1), b(1), c(1), c(1));
    expect(americanWin(ok, [])?.hand.id).toBe('pairs-1');
    const withJoker = tiles(N, JOKER, E, E, W, W, S, S, d(1), d(1), b(1), b(1), c(1), c(1));
    expect(americanWin(withJoker, [])).toBeNull();
  });

  it('measures distance in tiles still needed', () => {
    const { counts, jokers } = countHand(tiles(FLOWER, FLOWER, d(1), d(1), d(1), b(1), b(1), c(1), JOKER, E, S, W, N));
    // Needs one more 1 Dot, two 1 Bams and three 1 Craks (6), minus the joker.
    expect(distance(likeOnes, counts, jokers, [])).toBe(5);
  });

  it('doubles jokerless hands, except Singles and Pairs', () => {
    const hand = tiles(FLOWER, FLOWER, d(1), d(1), d(1), d(1), b(1), b(1), b(1), b(1), c(1), c(1), c(1), c(1));
    const target = americanWin(hand, [])!;
    expect(americanValue(target, hand, [])).toEqual({ value: 50, jokerless: true });
    const pairs = tiles(N, N, E, E, W, W, S, S, d(1), d(1), b(1), b(1), c(1), c(1));
    expect(americanValue(americanWin(pairs, [])!, pairs, [])).toEqual({ value: 50, jokerless: false });
  });

  it('requires exposures to match a group of the hand, and concealed hands to have none', () => {
    const pung: Meld = { type: 'pung', kind: N, tiles: tiles(N, N, N), concealed: false };
    const rest = tiles(E, E, E, E, W, W, W, W, S, S, S);
    expect(americanWin(rest, [pung])?.hand.id).toBe('wind-1');
    const pair: Meld = { type: 'pung', kind: d(1), tiles: tiles(d(1), d(1), d(1)), concealed: false };
    expect(americanWin(tiles(N, N, E, E, W, W, S, S, b(1), b(1), c(1)), [pair])).toBeNull();
  });
});

/** A rigged classic game: seat `from` holds `discard` and is about to throw it. */
function rig(variant: Variant, hands: Record<number, number[]>, from: number, discard: number) {
  const g = new TableGame(RULES[variant], 'rig');
  for (const [p, kinds] of Object.entries(hands)) {
    g.seats[Number(p)]!.hand = tiles(...kinds);
    g.seats[Number(p)]!.melds = [];
  }
  const thrown = t(discard);
  g.seats[from]!.hand.push(thrown);
  g.current = from;
  g.phase = 'turn';
  return { g, thrown };
}

const filler = [d(1), d(4), d(7), b(2), b(5), b(8), c(3), c(6), c(9), E, S, W, N];

describe('claims', () => {
  it('offers chow only to the next player, pung to anyone', () => {
    const { g, thrown } = rig('chinese', { 0: filler, 1: [b(3), b(4), ...filler.slice(2)], 2: [b(5), b(5), ...filler.slice(2)], 3: [b(3), b(4), ...filler.slice(2)] }, 0, b(5));
    g.discard(0, thrown.id);
    expect(g.claimOptions(1).some((o) => o.type === 'chow')).toBe(true);
    expect(g.claimOptions(3).some((o) => o.type === 'chow')).toBe(false);
    expect(g.claimOptions(2).some((o) => o.type === 'pung')).toBe(true);
  });

  it('lets a pung beat a chow and a win beat both', () => {
    const ready = [d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(8), c(9), E, E, E, b(9)];
    const { g, thrown } = rig('chinese', { 0: filler, 1: [b(7), b(8), ...filler.slice(2)], 2: [b(9), b(9), ...filler.slice(2)], 3: ready }, 0, b(9));
    g.discard(0, thrown.id);
    expect(g.claimOptions(3).some((o) => o.type === 'win')).toBe(true);
    g.respond(1, g.claimOptions(1).find((o) => o.type === 'chow')!);
    g.respond(2, g.claimOptions(2).find((o) => o.type === 'pung')!);
    g.respond(3, { type: 'win' });
    expect(g.phase).toBe('over');
    expect(g.result!.winner).toBe(3);
    expect(g.result!.discarder).toBe(0);
    expect(g.result!.payments.reduce((a, x) => a + x, 0)).toBe(0);
    expect(g.result!.payments[0]).toBeLessThan(g.result!.payments[1]!); // discarder pays double
  });

  it('gives the pung to the caller over the chow', () => {
    const { g, thrown } = rig('chinese', { 0: filler, 1: [b(7), b(8), ...filler.slice(2)], 2: [b(9), b(9), ...filler.slice(2)], 3: filler }, 0, b(9));
    g.discard(0, thrown.id);
    g.respond(1, g.claimOptions(1).find((o) => o.type === 'chow')!);
    g.respond(2, g.claimOptions(2).find((o) => o.type === 'pung')!);
    expect(g.current).toBe(2);
    expect(g.seats[2]!.melds[0]).toMatchObject({ type: 'pung', kind: b(9) });
    expect(g.seats[0]!.river).toHaveLength(0);
  });

  it('does not offer a win below the Hong Kong 3-faan minimum', () => {
    const chicken = [d(1), d(2), d(3), b(4), b(5), b(6), c(7), c(8), c(9), b(7), b(7), b(7), d(5)];
    const { g, thrown } = rig('hong-kong', { 0: filler, 1: chicken, 2: filler, 3: filler }, 0, d(5));
    g.seats[1]!.bonus = [t(34), t(38)]; // not own flowers for seat 1 (dealer 0: seat 1 is South)
    g.seats[1]!.melds = [];
    g.discard(0, thrown.id);
    expect(g.claimOptions(1).some((o) => o.type === 'win')).toBe(false);
    const { g: g2, thrown: t2 } = rig('chinese', { 0: filler, 1: chicken, 2: filler, 3: filler }, 0, d(5));
    g2.discard(0, t2.id);
    expect(g2.claimOptions(1).some((o) => o.type === 'win')).toBe(true);
  });

  it('never allows a discarded joker to be called (American)', () => {
    const g = new TableGame(RULES.american, 'joker-discard');
    g.phase = 'turn';
    g.charleston = null;
    g.current = 0;
    const j = t(JOKER);
    g.seats[0]!.hand.push(j);
    g.seats[1]!.hand = tiles(JOKER, JOKER, ...filler.slice(2));
    g.discard(0, j.id);
    expect(g.claimOptions(1)).toEqual([]);
  });
});

describe('American play', () => {
  it('runs the Charleston: three tiles each way, never jokers, with the optional second and courtesy pass', () => {
    const g = new TableGame(RULES.american, 'charleston');
    expect(g.waiting()).toMatchObject({ type: 'charleston', stage: 'first', dir: 'right' });
    const joker = t(JOKER);
    g.seats[0]!.hand.splice(0, 1, joker);
    expect(g.submitPass(0, [joker.id, g.seats[0]!.hand[1]!.id, g.seats[0]!.hand[2]!.id])).toBe(false);
    for (let pass = 0; pass < 3; pass++) {
      const mine = charlestonPass(g.seats[0]!.hand).map((x) => x.id);
      expect(g.submitPass(0, mine)).toBe(true);
      stepBots(g);
      for (const id of mine) expect(g.seats[0]!.hand.some((x) => x.id === id)).toBe(false);
    }
    expect(g.waiting()).toMatchObject({ type: 'charleston', stage: 'vote' });
    g.voteSecond(false);
    expect(g.waiting()).toMatchObject({ type: 'charleston', stage: 'courtesy', dir: 'across' });
    expect(g.submitPass(0, [])).toBe(true);
    stepBots(g);
    expect(g.waiting()).toEqual({ type: 'turn', player: g.dealer });
    expect(g.seats.map((s) => s.hand.length).sort()).toEqual([13, 13, 13, 14]);
    expect(g.allTiles()).toHaveLength(152);
  });

  it('swaps a natural tile for a joker in an exposure on your turn', () => {
    const g = new TableGame(RULES.american, 'swap');
    g.phase = 'turn';
    g.charleston = null;
    g.current = 0;
    const joker = t(JOKER);
    g.seats[1]!.melds.push({ type: 'pung', kind: d(5), tiles: [t(d(5)), t(d(5)), joker], concealed: false });
    const five = t(d(5));
    g.seats[0]!.hand.push(five);
    const swaps = g.jokerSwaps(0);
    expect(swaps).toHaveLength(1);
    expect(g.swapJoker(0, 1, 0)).toBe(true);
    expect(g.seats[0]!.hand).toContain(joker);
    expect(g.seats[1]!.melds[0]!.tiles).toContain(five);
    expect(g.jokerSwaps(0)).toHaveLength(0);
  });
});

describe('full games with bots in every seat', () => {
  const runs: [Variant, number][] = [
    ['chinese', 8],
    ['hong-kong', 6],
    ['american', 30],
  ];
  it.each(runs)('%s: hands finish, tiles are conserved, scores are zero-sum and wins are legal', (variant, n) => {
    let wins = 0;
    for (let i = 0; i < n; i++) {
      const g = new TableGame(RULES[variant], `full-${i}`, { dealer: i % 4 });
      playOut(g);
      expect(g.phase).toBe('over');
      const all = g.allTiles();
      expect(all).toHaveLength(g.totalTiles);
      expect(new Set(all.map((x) => x.id)).size).toBe(g.totalTiles);
      const r = g.result!;
      expect(r.payments.reduce((a, x) => a + x, 0)).toBe(0);
      if (r.kind === 'win') {
        wins++;
        if (!RULES[variant].american) expect(r.faan).toBeGreaterThanOrEqual(RULES[variant].minFaan);
        else expect(r.target).not.toBeNull();
        expect(r.payments[r.winner]).toBeGreaterThan(0);
      }
    }
    expect(wins).toBeGreaterThan(0);
  }, 120_000);

  it('suggests a discard from the hand on your turn', () => {
    for (const v of ['chinese', 'american'] as Variant[]) {
      const g = new TableGame(RULES[v], 'hint');
      if (v === 'american') {
        g.phase = 'turn';
        g.charleston = null;
      }
      const tile = suggestDiscard(g, 0);
      expect(g.seats[0]!.hand).toContain(tile);
      if (v === 'american') expect(tile.kind).not.toBe(JOKER);
    }
  });

  it('rotates the deal: American every hand, classic only when the dealer loses', () => {
    const win = (winner: number) => ({ kind: 'win' as const, winner, discarder: -1, selfDrawn: true, faan: 3, items: [], target: null, jokerless: false, payments: [0, 0, 0, 0] });
    expect(nextHand(RULES.chinese, 0, 0, win(0))).toEqual({ dealer: 0, prevailing: 0 });
    expect(nextHand(RULES.chinese, 0, 0, win(2))).toEqual({ dealer: 1, prevailing: 0 });
    expect(nextHand(RULES.chinese, 3, 0, win(1))).toEqual({ dealer: 0, prevailing: 1 });
    expect(nextHand(RULES.american, 0, 0, win(0))).toEqual({ dealer: 1, prevailing: 0 });
  });
});
