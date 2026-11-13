import { describe, expect, it } from 'vitest';
import { dayNumber } from '../../src/engines/core/day';
import {
  DAILY_GAMES,
  dailyLink,
  dailySeed,
  dailyStreak,
  emptyProgress,
  memoryKV,
  readProgress,
  recordDaily,
  recordWin,
  resetAll,
  type Progress,
} from '../../src/engines/core/progress';
import { summarize } from '../../src/engines/core/stats';

const at = (day: number) => new Date(2026, 0, day, 12); // local noon on day `day`
const won = (...days: number[]): Progress => ({
  wins: {},
  daily: Object.fromEntries(days.map((d) => [String(d), { sudoku: { won: true } }])),
});

describe('dayNumber', () => {
  it('counts local days from 1 January 2026', () => {
    expect(dayNumber(new Date(2026, 0, 1, 0, 1))).toBe(1);
    expect(dayNumber(new Date(2026, 0, 1, 23, 59))).toBe(1);
    expect(dayNumber(new Date(2026, 1, 1))).toBe(32);
    expect(dayNumber(new Date(2027, 0, 1))).toBe(366);
  });
});

describe('daily links', () => {
  it('use the shared seed for the seeded games', () => {
    expect(dailySeed(42)).toBe('daily42');
    expect(dailyLink('sudoku', 42)).toContain('puzzle=daily42');
    expect(dailyLink('klondike', 42)).toContain('seed=daily42');
    expect(dailyLink('mahjong', 42)).toContain('seed=daily42');
    expect(dailyLink('word-guess', 42)).toBe('/word-guess/?mode=daily');
  });
});

describe('dailyStreak', () => {
  it('is zero with no daily wins', () => {
    expect(dailyStreak(emptyProgress(), 10)).toEqual({ current: 0, best: 0 });
  });
  it('counts consecutive days ending today', () => {
    expect(dailyStreak(won(8, 9, 10), 10)).toEqual({ current: 3, best: 3 });
  });
  it('stays alive when yesterday was won and today is not played yet', () => {
    expect(dailyStreak(won(8, 9), 10)).toEqual({ current: 2, best: 2 });
  });
  it('breaks after a missed day but keeps the best run', () => {
    expect(dailyStreak(won(1, 2, 3, 4, 7, 8), 10)).toEqual({ current: 0, best: 4 });
    expect(dailyStreak(won(1, 2, 3, 4, 9, 10), 10)).toEqual({ current: 2, best: 4 });
  });
  it('ignores days with only losses', () => {
    const p = won(8, 10);
    p.daily['9'] = { 'word-guess': { won: false } };
    expect(dailyStreak(p, 10)).toEqual({ current: 1, best: 1 });
  });
});

describe('recordWin and recordDaily', () => {
  it('counts wins per game', () => {
    const kv = memoryKV();
    recordWin('klondike', null, at(5), kv);
    recordWin('klondike', null, at(5), kv);
    recordWin('spider', null, at(5), kv);
    expect(readProgress(kv).wins).toEqual({ klondike: 2, spider: 1 });
    expect(readProgress(kv).daily).toEqual({});
  });

  it("completes the daily challenge only with today's seed", () => {
    const kv = memoryKV();
    recordWin('klondike', dailySeed(4), at(5), kv); // yesterday's deal
    recordWin('klondike', 'abc123', at(5), kv); // a random deal
    expect(readProgress(kv).daily).toEqual({});
    recordWin('klondike', dailySeed(5), at(5), kv);
    expect(readProgress(kv).daily['5']).toEqual({ klondike: { won: true } });
  });

  it('maps Mahjong Solitaire to the mahjong daily and ignores non-daily games', () => {
    const kv = memoryKV();
    recordWin('mahjong-solitaire', dailySeed(5), at(5), kv);
    recordWin('minesweeper', dailySeed(5), at(5), kv);
    expect(readProgress(kv).daily['5']).toEqual({ mahjong: { won: true } });
    expect(readProgress(kv).wins).toEqual({ 'mahjong-solitaire': 1, minesweeper: 1 });
  });

  it('keeps the first result of the day, unless a later one is a win', () => {
    const kv = memoryKV();
    recordDaily('word-guess', false, 6, at(5), kv);
    recordDaily('word-guess', true, 3, at(5), kv);
    expect(readProgress(kv).daily['5']!['word-guess']).toEqual({ won: true, guesses: 3 });
    recordDaily('word-guess', true, 1, at(5), kv);
    recordDaily('word-guess', false, 6, at(5), kv);
    expect(readProgress(kv).daily['5']!['word-guess']).toEqual({ won: true, guesses: 3 });
  });

  it('resetAll clears everything', () => {
    const kv = memoryKV({ 'sudoku:best:easy': 90_000 });
    recordWin('sudoku', null, at(5), kv);
    resetAll(kv);
    expect(kv.keys()).toEqual([]);
    expect(readProgress(kv)).toEqual(emptyProgress());
  });
});

describe('summarize', () => {
  const unlocked = (kv: ReturnType<typeof memoryKV>, today = 10) =>
    summarize(kv, today)
      .achievements.filter((a) => a.unlocked)
      .map((a) => a.id)
      .sort();

  it('lists all 16 games and ten locked achievements for a new player', () => {
    const s = summarize(memoryKV(), 1);
    expect(s.games).toHaveLength(16);
    expect(new Set(s.games.map((g) => g.id)).size).toBe(16);
    expect(s.gamesPlayed).toBe(0);
    expect(s.totalWins).toBe(0);
    expect(s.achievements).toHaveLength(10);
    expect(s.achievements.every((a) => !a.unlocked)).toBe(true);
  });

  it('aggregates bests, word stats and wins across games', () => {
    const kv = memoryKV({
      'mahjong:best:turtle': 200_000,
      'mahjong:best:fish': 150_000,
      'klondike:best:1': 300_000,
      'klondike:best:3': 240_000,
      'sudoku:best:easy': 95_000,
      'mines:best:beginner': 12_000,
      'word:stats:5': { played: 4, wins: 3, best: 2, dist: [0, 0, 1, 2, 0, 0] },
      'maze-chomper:best': 12_400,
      'memory:best:normal': 9,
      'paddle:wins:normal': 2,
      'table:hong-kong': { hands: 3 },
    });
    recordWin('klondike', null, at(10), kv);
    const s = summarize(kv, 10);
    const g = (id: string) => s.games.find((x) => x.id === id)!;
    expect(g('mahjong-solitaire').best).toBe('2:30 (2/6 layouts)');
    expect(g('klondike')).toMatchObject({ played: true, wins: 1, best: '4:00' });
    expect(g('sudoku').best).toBe('1:35 (easy)');
    expect(g('minesweeper').best).toBe('0:12 (beginner)');
    expect(g('word-guess')).toMatchObject({ played: true, wins: 3 });
    expect(g('maze-chomper').best).toBe('12,400 points');
    expect(g('color-memory').best).toBe('9 rounds');
    expect(g('paddle-ball')).toMatchObject({ wins: 2, best: '2 wins' });
    expect(g('mahjong-4p').best).toBe('3 hands played');
    expect(g('spider').played).toBe(false);
    expect(s.gamesPlayed).toBe(9);
    expect(s.totalWins).toBe(1 + 3 + 2);
    expect(unlocked(kv)).toEqual(['first-win']);
  });

  it('unlocks the daily, streak and perfect-day achievements', () => {
    const kv = memoryKV();
    for (let d = 1; d <= 7; d++) recordWin('sudoku', dailySeed(d), at(d), kv);
    for (const game of DAILY_GAMES) recordDaily(game, true, game === 'word-guess' ? 4 : undefined, at(7), kv);
    const s = summarize(kv, 7);
    expect(s.streak).toEqual({ current: 7, best: 7 });
    expect(s.dailyDays).toBe(7);
    expect(unlocked(kv, 7)).toEqual(['daily-debut', 'first-win', 'perfect-day', 'streak-7']);
  });

  it('unlocks the game-specific achievements', () => {
    const layouts = ['turtle', 'dragon', 'pyramid', 'fortress', 'butterfly', 'fish'];
    const arcade = ['maze-chomper', 'alien-invaders', 'space-rocks', 'river-hopper', 'flappy-wing', 'ocean-grow'];
    const kv = memoryKV({
      ...Object.fromEntries(layouts.map((l) => [`mahjong:best:${l}`, 100_000])),
      ...Object.fromEntries(arcade.map((id) => [`${id}:best`, 10])),
      'memory:best:normal': 5,
      'paddle:wins:normal': 1,
      'klondike:best:1': 1,
      'spider:best:1': 1,
      'freecell:best:default': 1,
      'sudoku:best:expert': 600_000,
      'mines:best:expert': 200_000,
      'word:stats:5': { played: 1, wins: 1, best: 1, dist: [0, 1, 0, 0, 0, 0] },
    });
    expect(unlocked(kv)).toEqual(['arcade-master', 'card-shark', 'first-win', 'mine-expert', 'sudoku-expert', 'tile-master', 'word-wizard']);
  });

  it('does not unlock Arcade Master without a Paddle Ball win', () => {
    const arcade = ['maze-chomper', 'alien-invaders', 'space-rocks', 'river-hopper', 'flappy-wing', 'ocean-grow'];
    const kv = memoryKV({ ...Object.fromEntries(arcade.map((id) => [`${id}:best`, 10])), 'memory:best:normal': 5 });
    expect(unlocked(kv)).not.toContain('arcade-master');
  });
});
