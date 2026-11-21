import { describe, expect, it } from 'vitest';
import { FULL_DECK, type Card } from '../../src/engines/solitaire/cards';
import { Spades2, card2, chooseBid2, chooseKeep, choosePlay2 } from '../../src/engines/cards/spades2';

const c = (rank: number, suit: number): Card => FULL_DECK[suit * 13 + rank - 1]!;

const drawAll = (g: Spades2) => {
  while (g.s.phase === 'draw') g.take(g.s.turn, chooseKeep(g.hand(g.s.turn), g.top!));
};

describe('2-player Spades draw', () => {
  it('gives each player 13 cards and discards 26, the non-dealer drawing first', () => {
    const g = new Spades2('draw');
    expect(g.s.turn).toBe(1 - g.s.dealer);
    const seen = new Set<number>();
    while (g.s.phase === 'draw') {
      const top = g.top!;
      const seat = g.s.turn;
      const keep = seat === 0;
      const discarded = g.take(seat, keep)!;
      expect(discarded.id).not.toBe(keep ? top.id : -1);
      if (keep) expect(g.s.hands[seat]).toContain(top.id);
      else expect(discarded.id).toBe(top.id);
      seen.add(discarded.id);
    }
    expect(g.s.hands[0]).toHaveLength(13);
    expect(g.s.hands[1]).toHaveLength(13);
    expect(g.s.discarded).toBe(26);
    expect(new Set([...g.s.hands[0], ...g.s.hands[1], ...seen]).size).toBe(52);
    expect(g.s.phase).toBe('bid');
  });

  it('refuses a draw out of turn', () => {
    const g = new Spades2('turn');
    expect(g.take(g.s.dealer, true)).toBeNull();
  });
});

describe('2-player Spades play and scoring', () => {
  it('follows suit, keeps spades unbroken, and plays whole games to the target with the computer on both sides', () => {
    for (const seed of ['a', 'b', 'c']) {
      const g = new Spades2(seed, 300);
      let guard = 0;
      while (g.s.phase !== 'game-over' && guard++ < 50) {
        drawAll(g);
        while (g.s.phase === 'bid') g.bid(g.s.turn, chooseBid2(g.hand(g.s.turn)));
        while (g.s.phase === 'play') {
          const seat = g.s.turn;
          const legal = g.legal(seat);
          if (!g.s.trick.length && !g.s.spadesBroken && g.hand(seat).some((x) => x.suit !== 0)) expect(legal.every((x) => x.suit !== 0)).toBe(true);
          if (g.s.trick.length) {
            const led = card2(g.s.trick[0]!.id).suit;
            if (g.hand(seat).some((x) => x.suit === led)) expect(legal.every((x) => x.suit === led)).toBe(true);
          }
          const pick = choosePlay2(g, seat);
          expect(legal.some((x) => x.id === pick.id)).toBe(true);
          expect(g.play(seat, pick)).toBe(true);
        }
        if (g.s.phase === 'round-over') {
          expect(g.s.tricks[0] + g.s.tricks[1]).toBe(13);
          g.newRound();
        }
      }
      expect(g.s.phase).toBe('game-over');
      expect(Math.max(...g.s.scores) >= 300 || Math.min(...g.s.scores) <= -200).toBe(true);
    }
  });

  it('scores bids, bags, sets and Nil', () => {
    const g = new Spades2('score');
    drawAll(g);
    g.bid(g.s.turn, 0);
    g.bid(g.s.turn, 4);
    // Force a result: the Nil bidder took 1 trick, the other 12.
    const nilSeat = g.s.bids[0] === 0 ? 0 : 1;
    const other0 = 1 - nilSeat;
    g.s.hands[nilSeat] = [c(2, 3).id];
    g.s.hands[other0] = [c(3, 3).id];
    g.s.tricks = nilSeat === 0 ? [1, 11] : [11, 1];
    g.s.turn = nilSeat;
    g.play(nilSeat, c(2, 3));
    g.play(other0, c(3, 3));
    const r = g.s.lastRound;
    const nil = r.find((x) => x.seat === nilSeat)!;
    const other = r.find((x) => x.seat !== nilSeat)!;
    expect(nil.points).toBe(-100);
    expect(other.tricks).toBe(12);
    expect(other.points).toBe(40 + 8 - 0);
    expect(other.bags).toBe(8);
  });

  it('bids from the hand: high spades and aces count, a weak hand bids Nil', () => {
    const strong = [c(1, 0), c(13, 0), c(12, 0), c(11, 0), c(1, 1), c(13, 1), c(1, 2), c(5, 0), c(4, 0), c(3, 3), c(4, 3), c(5, 3), c(6, 3)];
    expect(chooseBid2(strong)).toBeGreaterThanOrEqual(6);
    const weak = [c(2, 1), c(3, 1), c(4, 1), c(5, 1), c(2, 2), c(3, 2), c(4, 2), c(6, 2), c(2, 3), c(3, 3), c(4, 3), c(7, 3), c(2, 0)];
    expect(chooseBid2(weak)).toBe(0);
  });

  it('round-trips through saved JSON', () => {
    const g = new Spades2('save');
    drawAll(g);
    const copy = new Spades2(JSON.parse(JSON.stringify(g.s)));
    expect(copy.hand(0).map((x) => x.id)).toEqual(g.hand(0).map((x) => x.id));
    expect(copy.s.phase).toBe('bid');
  });
});
