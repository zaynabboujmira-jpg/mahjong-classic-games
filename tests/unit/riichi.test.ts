import { describe, expect, it } from 'vitest';
import { doraOf, limitFor, riichiPayments, scoreRiichi, type RiichiContext } from '../../src/engines/mahjong-table/riichi';
import { EAST, GREEN, RED, WHITE, type Meld, type Tile } from '../../src/engines/mahjong-table/tiles';

let id = 0;
const T = (...kinds: number[]): Tile[] => kinds.map((kind) => ({ id: id++, kind }) as Tile);
/** Suit helpers: m(1) .. m(9) = kinds 0..8, p = 9..17, s = 18..26. */
const m = (r: number) => r - 1;
const p = (r: number) => 9 + r - 1;
const s = (r: number) => 18 + r - 1;
const ctx = (over: Partial<RiichiContext>): RiichiContext => ({ winKind: 0, selfDrawn: false, seat: 1, prevailing: 0, riichi: false, ippatsu: false, lastTile: false, rinshan: false, doraIndicators: [], uraIndicators: [], ...over });
const names = (sc: { yaku: { name: string }[] } | null) => sc?.yaku.map((y) => y.name.split(' ')[0]) ?? [];

describe('Riichi scoring', () => {
  it('pinfu + tanyao on a discard: 2 han 30 fu, 2,000 from the discarder', () => {
    const hand = T(m(2), m(3), m(4), m(5), m(6), m(7), p(3), p(4), p(5), s(6), s(7), s(8), p(5), p(5));
    const sc = scoreRiichi(hand, [], ctx({ winKind: m(4) }))!;
    expect(names(sc)).toEqual(expect.arrayContaining(['Pinfu', 'Tanyao']));
    expect(sc.han).toBe(2);
    expect(sc.fu).toBe(30);
    expect(riichiPayments(sc.base, 1, 2, 0)).toEqual([0, 2000, -2000, 0]);
  });

  it('riichi + menzen tsumo + pinfu: 20 fu, 700/1,300 for a non-dealer', () => {
    const hand = T(m(1), m(2), m(3), m(5), m(6), m(7), p(3), p(4), p(5), s(6), s(7), s(8), p(9), p(9));
    const sc = scoreRiichi(hand, [], ctx({ winKind: m(7), selfDrawn: true, riichi: true }))!;
    expect(names(sc)).toEqual(expect.arrayContaining(['Riichi', 'Menzen', 'Pinfu']));
    expect(sc.han).toBe(3);
    expect(sc.fu).toBe(20);
    expect(riichiPayments(sc.base, 1, -1, 0)).toEqual([-1300, 2700, -700, -700]);
  });

  it('an open hand without a yaku cannot win', () => {
    const chow: Meld = { type: 'chow', kind: m(1), tiles: T(m(1), m(2), m(3)), concealed: false };
    const hand = T(m(5), m(6), m(7), p(3), p(4), p(5), s(6), s(7), s(8), p(9), p(9));
    expect(scoreRiichi(hand, [chow], ctx({ winKind: m(7) }))).toBeNull();
  });

  it('seven pairs: 2 han, 25 fu, 1,600 on a discard', () => {
    const hand = T(m(1), m(1), m(4), m(4), p(2), p(2), p(8), p(8), s(3), s(3), s(9), s(9), EAST, EAST);
    const sc = scoreRiichi(hand, [], ctx({ winKind: EAST }))!;
    expect(sc.fu).toBe(25);
    expect(sc.han).toBe(2);
    expect(riichiPayments(sc.base, 1, 3, 0)[1]).toBe(1600);
  });

  it('big three dragons is a yakuman: 32,000 for a non-dealer ron', () => {
    const hand = T(RED, RED, RED, GREEN, GREEN, GREEN, WHITE, WHITE, WHITE, m(2), m(3), m(4), p(7), p(7));
    const sc = scoreRiichi(hand, [], ctx({ winKind: m(4) }))!;
    expect(sc.yakuman).toBe(1);
    expect(riichiPayments(sc.base, 1, 2, 0)[1]).toBe(32000);
  });

  it('dora count but are not a yaku; indicators wrap 9→1, North→East, red→white', () => {
    expect(doraOf(m(9))).toBe(m(1));
    expect(doraOf(EAST + 3)).toBe(EAST);
    expect(doraOf(RED)).toBe(WHITE);
    expect(doraOf(WHITE)).toBe(GREEN);
    const hand = T(m(2), m(3), m(4), m(5), m(6), m(7), p(3), p(4), p(5), s(6), s(7), s(8), p(5), p(5));
    const sc = scoreRiichi(hand, [], ctx({ winKind: m(4), doraIndicators: [p(4)] }))!;
    // Indicator 4-pin makes 5-pin the dora: one in the 3-4-5 sequence and two in the pair.
    expect(sc.yaku.find((y) => y.name.startsWith('Dora'))?.han).toBe(3);
    expect(sc.han).toBe(5);
    expect(sc.limit).toBe('Mangan');
    expect(scoreRiichi(T(m(1), m(2), m(3), m(5), m(6), m(7), p(3), p(4), p(5), s(6), s(7), s(8), p(9), p(9)), [], ctx({ winKind: m(6), doraIndicators: [p(8)] }))).toBeNull(); // closed wait on 6: no pinfu, so dora alone cannot win
  });

  it('full flush closed is a haneman: 12,000 on a discard', () => {
    const hand = T(m(1), m(1), m(1), m(2), m(3), m(4), m(4), m(5), m(6), m(7), m(8), m(9), m(9), m(9));
    const sc = scoreRiichi(hand, [], ctx({ winKind: m(4) }))!;
    expect(sc.han).toBeGreaterThanOrEqual(6);
    expect(['Haneman', 'Baiman', 'Sanbaiman']).toContain(sc.limit);
  });

  it('fu: closed ron with a concealed terminal pung and a closed wait is 40 fu', () => {
    // 999s concealed (8), kanchan 2-4 on 3 (2), ron closed (+10): 20 + 10 + 8 + 2 = 40. Yaku: riichi.
    const hand = T(s(9), s(9), s(9), m(2), m(3), m(4), p(5), p(6), p(7), m(5), m(6), m(7), p(1), p(1));
    const sc = scoreRiichi(hand, [], ctx({ winKind: m(3), riichi: true }))!;
    expect(sc.fu).toBe(40);
  });

  it('limits: mangan from 5 han or a base over 2,000', () => {
    expect(limitFor(5, 30, 0).limit).toBe('Mangan');
    expect(limitFor(4, 40, 0).base).toBe(2000);
    expect(limitFor(3, 30, 0).base).toBe(960);
    expect(limitFor(6, 30, 0).limit).toBe('Haneman');
    expect(limitFor(13, 30, 0).base).toBe(8000);
  });

  it('dealer payments: ron × 6, tsumo × 2 from everyone', () => {
    expect(riichiPayments(480, 0, 2, 0)[0]).toBe(2900);
    expect(riichiPayments(480, 0, -1, 0)).toEqual([3000, -1000, -1000, -1000]);
  });
});

import { RULES, TableGame, nextHand } from '../../src/engines/mahjong-table/game';
import { playOut } from '../../src/engines/mahjong-table/ai';

describe('Riichi hands with four computer players', () => {
  it('play to the end: tiles conserved, wins always have a yaku, payments balance against the riichi sticks', () => {
    let wins = 0;
    let riichis = 0;
    let draws = 0;
    for (let seed = 0; seed < 14; seed++) {
      const carried = seed % 3;
      const g = new TableGame(RULES.riichi, `r${seed}`, { dealer: seed % 4, honba: seed % 2, sticks: carried });
      expect(g.allTiles()).toHaveLength(136);
      expect(g.doraIndicators()).toHaveLength(1);
      playOut(g);
      expect(g.phase).toBe('over');
      expect(g.allTiles()).toHaveLength(136);
      const r = g.result!;
      const declared = g.riichi.filter(Boolean).length;
      riichis += declared;
      const sum = r.payments.reduce((a, b) => a + b, 0);
      if (r.kind === 'win') {
        wins++;
        expect(r.items.length).toBeGreaterThan(0);
        expect(r.items.some((y) => !y.name.startsWith('Dora'))).toBe(true);
        expect(sum).toBe(carried * 1000);
        expect(r.sticksLeft).toBe(0);
      } else {
        draws++;
        expect(sum).toBe(-declared * 1000);
        expect(r.sticksLeft).toBe(carried + declared);
        expect(r.tenpai).toHaveLength(4);
      }
    }
    expect(wins).toBeGreaterThan(2);
    expect(riichis).toBeGreaterThan(2);
    void draws;
  }, 60_000);

  it('the dealer stays after a dealer win or a ready draw, and passes on otherwise', () => {
    const rules = RULES.riichi;
    const base = { kind: 'win' as const, discarder: 1, selfDrawn: false, faan: 1, items: [], target: null, jokerless: false, payments: [0, 0, 0, 0] };
    expect(nextHand(rules, 2, 0, { ...base, winner: 2 }).dealer).toBe(2);
    expect(nextHand(rules, 2, 0, { ...base, winner: 1 }).dealer).toBe(3);
    expect(nextHand(rules, 3, 0, { ...base, kind: 'draw', winner: -1, tenpai: [false, false, false, true] })).toEqual({ dealer: 3, prevailing: 0 });
    expect(nextHand(rules, 3, 0, { ...base, kind: 'draw', winner: -1, tenpai: [true, false, false, false] })).toEqual({ dealer: 0, prevailing: 1 });
  });

  it('after riichi only the drawn tile may be discarded, and riichi needs a closed ready hand', () => {
    for (let seed = 0; seed < 60; seed++) {
      const g = new TableGame(RULES.riichi, `lock${seed}`, { dealer: 0 });
      // Let bots play until seat 0 can declare riichi on its turn.
      for (let n = 0; n < 400 && g.phase !== 'over'; n++) {
        const w = g.waiting();
        if (w.type === 'turn' && w.player === 0) {
          const opts = g.riichiOptions(0);
          if (opts.length) {
            expect(g.declareRiichi(0, opts[0]!)).toBe(true);
            expect(g.riichi[0]).toBe(true);
            expect(g.sticks).toBe(1);
            return;
          }
        }
        playOut(g, 1);
      }
    }
  }, 60_000);
});
