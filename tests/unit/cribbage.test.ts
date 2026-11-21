import { describe, expect, it } from 'vitest';
import { FULL_DECK, type Card } from '../../src/engines/solitaire/cards';
import { Cribbage, chooseDiscard, choosePeg, pegScore, scoreHand, total, card, TARGET } from '../../src/engines/cards/cribbage';

/** rank 1..13, suit 0 spades, 1 hearts, 2 diamonds, 3 clubs */
const c = (rank: number, suit = 0): Card => FULL_DECK[suit * 13 + rank - 1]!;
const pts = (hand: Card[], starter: Card, crib = false) => total(scoreHand(hand, starter, crib));

describe('cribbage show scoring', () => {
  it('scores the 29 hand', () => {
    expect(pts([c(5, 1), c(5, 2), c(5, 3), c(11, 0)], c(5, 0))).toBe(29);
  });
  it('scores a double run with fifteens', () => {
    // 7-8 twice (4), pair of 8s (2), two runs 7-8-9 (6)
    expect(pts([c(7, 0), c(8, 1), c(8, 2), c(9, 3)], c(13, 1))).toBe(12);
  });
  it('counts only the longest runs', () => {
    expect(scoreHand([c(2, 0), c(3, 1), c(4, 2), c(5, 3)], c(6, 1)).filter((i) => i.kind === 'run')).toEqual([expect.objectContaining({ points: 5 })]);
  });
  it('a four-card flush counts in the hand but not in the crib', () => {
    const hand = [c(1, 1), c(3, 1), c(7, 1), c(9, 1)];
    expect(pts(hand, c(12, 0))).toBe(4);
    expect(pts(hand, c(12, 0), true)).toBe(0);
    expect(pts(hand, c(12, 1), true)).toBe(5);
  });
  it('nobs: the jack of the starter suit', () => {
    expect(scoreHand([c(11, 2), c(3, 0), c(7, 1), c(9, 3)], c(1, 2)).map((i) => i.kind)).toContain('nobs');
    expect(pts([c(11, 2), c(3, 0), c(7, 1), c(9, 3)], c(1, 2))).toBe(1);
  });
  it('a hand with nothing scores 0 (a 19 hand)', () => {
    expect(pts([c(2, 0), c(4, 1), c(6, 2), c(13, 3)], c(8, 0))).toBe(0);
  });
});

describe('cribbage pegging', () => {
  it('scores 15, 31, pairs and runs', () => {
    expect(pegScore([c(5), c(10, 1)]).points).toBe(2);
    expect(pegScore([c(7), c(7, 1), c(7, 2)]).points).toBe(6);
    expect(pegScore([c(7), c(7, 1), c(7, 2), c(7, 3)]).points).toBe(12);
    expect(pegScore([c(3), c(5, 1), c(4, 2)]).points).toBe(3);
    expect(pegScore([c(10), c(10, 1), c(11), c(1)]).points).toBe(2); // 31 only
    expect(pegScore([c(6), c(4, 1), c(5, 2)]).points).toBe(5); // fifteen + run of 3
  });
  it('a run must be among the latest cards', () => {
    expect(pegScore([c(3), c(4), c(9), c(5, 1)]).points).toBe(0);
  });
});

describe('cribbage game', () => {
  it('plays whole computer-vs-computer games to 121 with legal moves', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const g = new Cribbage(seed);
      let guard = 0;
      while (g.s.phase !== 'game-over' && guard++ < 5000) {
        const s = g.s;
        if (s.phase === 'discard') {
          expect(s.hands[0]).toHaveLength(6);
          const out = chooseDiscard(s.hands[0].map(card), s.dealer === 0).map((x) => x.id);
          expect(g.discard(out)).toBe(true);
          if (g.s.phase === 'peg') {
            expect(g.s.crib).toHaveLength(4);
            expect(g.s.hands[0]).toHaveLength(4);
          }
        } else if (s.phase === 'peg') {
          expect(g.legal(s.turn).length).toBeGreaterThan(0);
          expect(g.play(s.turn, choosePeg(g, s.turn))).toBe(true);
          expect(g.s.count).toBeLessThanOrEqual(31);
        } else if (s.phase === 'show') {
          if (g.s.showStep === 0) expect(g.s.played).toHaveLength(8);
          g.next();
        }
      }
      expect(g.s.phase).toBe('game-over');
      expect(Math.max(...g.s.scores)).toBe(TARGET);
      expect(g.s.scores[g.s.winner!]).toBe(TARGET);
    }
  });

  it('restores from saved JSON and keeps playing', () => {
    const g = new Cribbage('save');
    g.discard(g.s.hands[0].slice(0, 2));
    const copy = new Cribbage('x', JSON.parse(JSON.stringify(g.s)));
    expect(copy.s).toEqual(g.s);
    expect(copy.legal(copy.s.turn).length).toBeGreaterThan(0);
  });

  it('rejects illegal moves', () => {
    const g = new Cribbage('rules');
    expect(g.discard([g.s.hands[0][0]!])).toBe(false);
    expect(g.discard([999, 998])).toBe(false);
    g.discard(g.s.hands[0].slice(0, 2));
    const other = 1 - g.s.turn;
    expect(g.play(other, g.s.pegHands[other]![0]!)).toBe(false);
  });

  it('the computer keeps the 5s and fifteens', () => {
    const six = [c(5, 0), c(5, 1), c(10, 2), c(11, 3), c(1, 0), c(9, 2)];
    const out = chooseDiscard(six, false).map((x) => x.rank);
    expect(out).not.toContain(5);
  });
});
