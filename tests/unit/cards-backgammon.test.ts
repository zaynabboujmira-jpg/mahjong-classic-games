import { describe, expect, it } from 'vitest';
import { FULL_DECK, type Card } from '../../src/engines/solitaire/cards';
import { CLUBS, HEARTS, SPADES, deal, power, trickWinner } from '../../src/engines/cards/tricks';
import { Hearts, QUEEN_SPADES, TWO_CLUBS, cardPoints, chooseCard, choosePass } from '../../src/engines/cards/hearts';
import { Spades, chooseBid, chooseSpadesCard } from '../../src/engines/cards/spades';
import { BAR, BLACK, Backgammon, OFF, WHITE, allHome, applyMove, chooseBgSequence, legalSequences, pips, singleMoves, startPosition, winValue, type Position } from '../../src/engines/board/backgammon';
import { createRng } from '../../src/engines/core/rng';

const card = (rank: number, suit: number): Card => FULL_DECK.find((c) => c.rank === rank && c.suit === suit)!;

describe('Trick-taking basics', () => {
  it('deals 13 cards to each of four players, the whole deck', () => {
    const hands = deal(createRng('d'));
    expect(hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(hands.flat().map((c) => c.id)).size).toBe(52);
  });

  it('the highest card of the suit led wins, aces high, trumps beat everything', () => {
    const t = [
      { seat: 0, card: card(10, HEARTS) },
      { seat: 1, card: card(1, HEARTS) },
      { seat: 2, card: card(13, CLUBS) },
      { seat: 3, card: card(2, SPADES) },
    ];
    expect(trickWinner(t)).toBe(1);
    expect(trickWinner(t, SPADES)).toBe(3);
    expect(power(card(1, 0))).toBe(14);
  });
});

/** Plays a whole hand with the built-in bots in every seat. */
const autoHearts = (g: Hearts) => {
  if (g.phase === 'pass') g.pass(g.hands.map((h) => choosePass(h)));
  let guard = 0;
  while (g.phase === 'play' && guard++ < 60) g.play(g.turn, chooseCard(g));
};

describe('Hearts', () => {
  it('passes three cards left, then right, across and none', () => {
    const g = new Hearts('p');
    expect(g.passDir).toBe('left');
    const passes = g.hands.map((h) => h.slice(0, 3));
    g.pass(passes);
    expect(g.hands.every((h) => h.length === 13)).toBe(true);
    for (const c of passes[0]!) expect(g.hands[1]!.some((x) => x.id === c.id)).toBe(true);
    const dirs = [];
    for (let r = 0; r < 4; r++) {
      dirs.push(g.passDir);
      autoHearts(g);
      g.newRound();
    }
    expect(dirs.slice(0, 4)).toEqual(['left', 'right', 'across', 'none']);
  });

  it('the two of clubs leads, players follow suit, and no points on the first trick', () => {
    const g = new Hearts('f');
    g.pass(g.hands.map((h) => choosePass(h)));
    expect(g.hands[g.turn]!.some(TWO_CLUBS)).toBe(true);
    expect(g.legal()).toHaveLength(1);
    g.play(g.turn, g.legal()[0]!);
    const seat = g.turn;
    const clubs = g.hands[seat]!.filter((c) => c.suit === CLUBS);
    const legal = g.legal(seat);
    if (clubs.length) expect(legal.every((c) => c.suit === CLUBS)).toBe(true);
    else if (g.hands[seat]!.some((c) => !cardPoints(c))) expect(legal.some(cardPoints)).toBe(false);
  });

  it('hearts cannot be led until broken', () => {
    const g = new Hearts('b');
    g.phase = 'play';
    g.tricksPlayed = 1;
    g.turn = 0;
    g.hands[0] = [card(5, HEARTS), card(9, CLUBS)];
    expect(g.legal(0).map((c) => c.suit)).toEqual([CLUBS]);
    g.heartsBroken = true;
    expect(g.legal(0)).toHaveLength(2);
    g.heartsBroken = false;
    g.hands[0] = [card(5, HEARTS), card(7, HEARTS)];
    expect(g.legal(0)).toHaveLength(2);
  });

  it('every hand hands out exactly 26 points, or a moon shot', () => {
    for (let s = 0; s < 6; s++) {
      const g = new Hearts(`hand${s}`);
      autoHearts(g);
      expect(g.taken.reduce((a, b) => a + b, 0)).toBe(26);
      const total = g.scores.reduce((a, b) => a + b, 0);
      expect(g.moon === null ? total === 26 : total === 78).toBe(true);
      expect(g.hands.every((h) => h.length === 0)).toBe(true);
    }
  });

  it('shooting the moon gives everyone else 26', () => {
    const g = new Hearts('m');
    g.phase = 'play';
    g.scores = [0, 0, 0, 0];
    g.taken = [26, 0, 0, 0];
    g.tricksPlayed = 12;
    g.hands = [[card(3, CLUBS)], [card(4, CLUBS)], [card(5, CLUBS)], [card(6, CLUBS)]];
    g.turn = 0;
    g.taken = [26, 0, 0, 0];
    for (let s = 0; s < 4; s++) g.play(s, g.hands[s]![0]!);
    expect(g.moon).toBe(0);
    expect(g.scores).toEqual([0, 26, 26, 26]);
  });

  it('the bots dump the queen of spades when void, and pass dangerous spades', () => {
    const g = new Hearts('q');
    g.phase = 'play';
    g.tricksPlayed = 2;
    g.hands[1] = [card(12, SPADES), card(2, HEARTS), card(9, CLUBS)].filter(() => true);
    g.hands[1] = [card(12, SPADES), card(2, HEARTS), card(9, HEARTS)];
    g.trick = [{ seat: 0, card: card(5, 2) }];
    g.turn = 1;
    expect(QUEEN_SPADES(chooseCard(g, 1))).toBe(true);
    const pass = choosePass([card(12, SPADES), card(1, SPADES), card(2, SPADES), card(3, CLUBS), card(4, CLUBS), card(5, CLUBS), card(6, CLUBS), card(2, HEARTS), card(3, HEARTS), card(4, 2), card(5, 2), card(6, 2), card(2, CLUBS)]);
    expect(pass.some(QUEEN_SPADES)).toBe(true);
    expect(pass.some(TWO_CLUBS)).toBe(false);
  });

  it('a game ends when someone reaches 100, lowest wins', () => {
    const g = new Hearts('game');
    let guard = 0;
    while (g.phase !== 'game-over' && guard++ < 40) {
      autoHearts(g);
      if (g.phase === 'round-over') g.newRound();
    }
    expect(g.phase).toBe('game-over');
    expect(Math.max(...g.scores)).toBeGreaterThanOrEqual(100);
    expect(g.winners().every((w) => g.scores[w] === Math.min(...g.scores))).toBe(true);
  });
});

describe('Spades', () => {
  const autoSpades = (g: Spades) => {
    while (g.phase === 'bid') g.bid(g.turn, chooseBid(g.hands[g.turn]!, g.bids[(g.turn + 2) % 4] ?? null));
    let guard = 0;
    while (g.phase === 'play' && guard++ < 60) g.play(g.turn, chooseSpadesCard(g));
  };

  it('spades cannot be led until broken, and they trump', () => {
    const g = new Spades('l');
    for (let i = 0; i < 4; i++) g.bid(g.turn, 3);
    g.turn = 0;
    g.hands[0] = [card(1, SPADES), card(4, HEARTS)];
    expect(g.legal(0).map((c) => c.suit)).toEqual([HEARTS]);
    g.hands[0] = [card(1, SPADES), card(2, SPADES)];
    expect(g.legal(0)).toHaveLength(2);
  });

  it('scores a made bid with bags, a set, and Nil', () => {
    const g = new Spades('s');
    g.bids = [3, 2, 4, 0];
    g.tricks = [4, 1, 5, 3];
    g.phase = 'play';
    g.tricksPlayed = 12;
    g.hands = [[card(2, CLUBS)], [card(3, CLUBS)], [card(4, CLUBS)], [card(5, CLUBS)]];
    g.trick = [];
    g.turn = 0;
    for (let s = 0; s < 4; s++) g.play(s, g.hands[s]![0]!);
    // East (seat 3) won the last trick with the 5 of clubs: tricks [4,1,5,4].
    expect(g.tricks).toEqual([4, 1, 5, 4]);
    const [us, them] = g.lastRound;
    expect(us!.points).toBe(70 + 2);
    expect(g.bags[0]).toBe(2);
    // West bid 2, took 1: set (-20). East's Nil failed (-100); its 4 tricks are bags.
    expect(them!.points).toBe(-20 - 100);
    expect(them!.nil).toEqual([{ seat: 3, made: false }]);
  });

  it('ten bags cost 100 points', () => {
    const g = new Spades('bags');
    g.bags = [9, 0];
    g.bids = [2, 3, 2, 3];
    g.tricks = [3, 3, 3, 3];
    g.phase = 'play';
    g.tricksPlayed = 13;
    (g as unknown as { endRound: () => void }).endRound();
    expect(g.lastRound[0]!.bagPenalty).toBe(true);
    expect(g.scores[0]).toBe(40 + 2 - 100);
    expect(g.bags[0]).toBe(1);
  });

  it('bids are sensible: strong hands bid high, very weak hands may go Nil', () => {
    const strong = [1, 13, 12, 11, 10].map((r) => card(r, SPADES)).concat([card(1, HEARTS), card(13, HEARTS), card(1, CLUBS), card(2, 2), card(3, 2), card(4, 2), card(5, 2), card(6, 2)]);
    expect(chooseBid(strong)).toBeGreaterThanOrEqual(6);
    const weak = [2, 3, 4].map((r) => card(r, HEARTS)).concat([2, 3, 4, 5].map((r) => card(r, CLUBS)), [2, 3, 4, 5].map((r) => card(r, 2)), [card(2, SPADES), card(3, SPADES)]);
    expect(chooseBid(weak)).toBe(0);
  });

  it('whole games between bots finish with a winner', () => {
    for (const seed of ['a', 'b']) {
      const g = new Spades(seed);
      let guard = 0;
      while (g.phase !== 'game-over' && guard++ < 60) {
        autoSpades(g);
        expect(g.tricks.reduce((a, b) => a + b, 0)).toBe(13);
        if (g.phase === 'round-over') g.newRound();
      }
      expect(g.winner()).not.toBeNull();
    }
  });
});

const pos = (spec: Record<number, number>, bar: [number, number] = [0, 0], off: [number, number] = [0, 0]): Position => {
  const board = new Array<number>(24).fill(0);
  for (const [k, v] of Object.entries(spec)) board[Number(k)] = v;
  return { board, bar, off };
};

describe('Backgammon', () => {
  it('starts with 15 checkers each and 167 pips', () => {
    const p = startPosition();
    expect(p.board.filter((v) => v > 0).reduce((a, b) => a + b, 0)).toBe(15);
    expect(-p.board.filter((v) => v < 0).reduce((a, b) => a + b, 0)).toBe(15);
    expect(pips(p, WHITE)).toBe(167);
    expect(pips(p, BLACK)).toBe(167);
  });

  it('moves land only on open points, hitting single checkers', () => {
    const p = pos({ 10: 1, 7: -2, 8: -1 });
    const moves = singleMoves(p, WHITE, 3);
    expect(moves).toEqual([]);
    const two = singleMoves(p, WHITE, 2);
    expect(two).toEqual([{ from: 10, to: 8, die: 2, hit: true }]);
    const after = applyMove(p, WHITE, two[0]!);
    expect(after.bar[BLACK]).toBe(1);
    expect(after.board[8]).toBe(1);
  });

  it('a checker on the bar must enter first', () => {
    const p = pos({ 5: 3, 20: -2 }, [1, 0]);
    const m = singleMoves(p, WHITE, 4);
    expect(m).toEqual([]);
    expect(singleMoves(p, WHITE, 3)).toEqual([{ from: BAR, to: 21, die: 3, hit: false }]);
  });

  it('bears off only with everything home, using higher dice from the furthest point', () => {
    const p = pos({ 3: 2, 1: 1, 23: -2 });
    expect(allHome(p, WHITE)).toBe(true);
    expect(singleMoves(p, WHITE, 6).map((m) => m.from)).toEqual([3]);
    expect(singleMoves(p, WHITE, 2).some((m) => m.from === 1 && m.to === OFF)).toBe(true);
    const notHome = pos({ 3: 2, 8: 1 });
    expect(singleMoves(notHome, WHITE, 4).some((m) => m.to === OFF)).toBe(false);
  });

  it('must use both dice when possible, and the higher die when only one fits', () => {
    // Only the 6 or the 1 can be played, not both: the 6 must be used.
    const p = pos({ 7: 1, 0: -2, 6: -2, 5: -2 });
    const seqs = legalSequences(p, WHITE, [6, 1]);
    expect(seqs.every((s) => s.length === 1 && s[0]!.die === 6)).toBe(true);
    // Doubles give four moves.
    const d = legalSequences(startPosition(), WHITE, [3, 3]);
    expect(d.every((s) => s.length === 4)).toBe(true);
  });

  it('plays a turn move by move with undo', () => {
    const g = new Backgammon('t');
    g.turn = WHITE;
    g.setDice([3, 1]);
    const first = g.nextMoves();
    expect(first.length).toBeGreaterThan(0);
    const m = first.find((x) => x.from === 7 && x.to === 4)!;
    expect(g.move(m)).toBe(true);
    expect(g.nextMoves().every((x) => x.die === 1)).toBe(true);
    expect(g.undoMove()).toBe(true);
    expect(g.pos.board[7]).toBe(3);
    g.move(m);
    g.move(g.nextMoves().find((x) => x.from === 5 && x.to === 4)!);
    expect(g.turnComplete).toBe(true);
    expect(g.pos.board[4]).toBe(2);
    expect(g.endTurn()).toBe(true);
    expect(g.turn).toBe(BLACK);
  });

  it('scores single games, gammons and backgammons', () => {
    expect(winValue(pos({ 20: -1 }, [0, 0], [15, 14]), WHITE)).toBe(1);
    expect(winValue(pos({ 20: -15 }, [0, 0], [15, 0]), WHITE)).toBe(2);
    expect(winValue(pos({ 3: -15 }, [0, 0], [15, 0]), WHITE)).toBe(3);
  });

  it('the AI makes points and avoids blots; Medium beats Easy', () => {
    const g = new Backgammon('ai');
    g.turn = WHITE;
    g.setDice([3, 1]);
    const seq = chooseBgSequence(g, 'medium');
    for (const m of seq) g.move(m);
    // The classic 3-1 opening makes the 5-point (index 4).
    expect(g.pos.board[4]).toBe(2);

    let wins = 0;
    for (let n = 0; n < 10; n++) {
      const m = new Backgammon(`match${n}`);
      m.opening();
      let guard = 0;
      const rng = createRng(`r${n}`);
      while (m.winner === null && guard++ < 600) {
        const s = chooseBgSequence(m, m.turn === WHITE ? 'medium' : 'easy', rng);
        for (const x of s) m.move(x);
        if (m.winner !== null) break;
        m.endTurn();
        m.roll();
      }
      if (m.winner === WHITE) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(7);
    // Hard answers quickly.
    const h = new Backgammon('hard');
    h.turn = WHITE;
    h.setDice([6, 5]);
    const t = Date.now();
    expect(chooseBgSequence(h, 'hard').length).toBe(2);
    expect(Date.now() - t).toBeLessThan(1500);
  }, 60_000);
});
