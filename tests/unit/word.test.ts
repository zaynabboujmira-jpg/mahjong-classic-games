import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { ANSWERS } from '../../src/engines/word/answers';
import { LENGTHS, MAX_GUESSES, WordGame, dailyAnswer, dayNumber, emptyStats, parseDictionary, randomAnswer, recordResult, score } from '../../src/engines/word/game';

const dict = (n: 4 | 5 | 6) => parseDictionary(readFileSync(`public/words/${n}.txt`, 'utf8'), n);

describe('scoring guesses', () => {
  it('marks right spot, wrong spot and absent letters', () => {
    expect(score('crane', 'grape')).toEqual(['miss', 'hit', 'hit', 'miss', 'hit']);
    expect(score('grape', 'grape')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    expect(score('pearl', 'grape')).toEqual(['near', 'near', 'hit', 'near', 'miss']);
  });

  it('colours a repeated letter only as often as it appears in the answer', () => {
    // One E in the answer: the exact match wins, the other E is grey.
    expect(score('geese', 'theme')).toEqual(['miss', 'miss', 'hit', 'miss', 'hit']);
    // Two Ls in the guess, one in the answer: the exact match takes it, the other L is grey.
    expect(score('hello', 'world')).toEqual(['miss', 'miss', 'miss', 'hit', 'near']);
    // LAPEL has two Ls: one matches exactly, the other turns the second L orange; one A only.
    expect(score('llama', 'lapel')).toEqual(['hit', 'near', 'near', 'miss', 'miss']);
    expect(score('allay', 'lapel')).toEqual(['near', 'near', 'near', 'miss', 'miss']);
  });
});

describe('word lists', () => {
  it.each(LENGTHS)('%i letters: every answer is a real, unique, right-length word in the dictionary', (n) => {
    const d = dict(n);
    expect(d.size).toBeGreaterThan(3000);
    expect(new Set(ANSWERS[n]).size).toBe(ANSWERS[n].length);
    for (const w of ANSWERS[n]) {
      expect(w).toMatch(new RegExp(`^[a-z]{${n}}$`));
      expect(d.has(w)).toBe(true);
    }
  });
});

describe('daily and unlimited words', () => {
  it('counts days from 2026-01-01 in local time', () => {
    expect(dayNumber(new Date(2026, 0, 1, 0, 1))).toBe(1);
    expect(dayNumber(new Date(2026, 0, 1, 23, 59))).toBe(1);
    expect(dayNumber(new Date(2026, 0, 2, 0, 0))).toBe(2);
    expect(dayNumber(new Date(2026, 10, 13, 12))).toBe(317);
  });

  it('gives everyone the same daily word, different on consecutive days, cycling through all answers', () => {
    expect(dailyAnswer(5, 317)).toBe(dailyAnswer(5, 317));
    expect(dailyAnswer(5, 317)).not.toBe(dailyAnswer(5, 318));
    const n = ANSWERS[5].length;
    const seen = new Set(Array.from({ length: n }, (_, i) => dailyAnswer(5, i + 1)));
    expect(seen.size).toBe(n);
    expect(dailyAnswer(4, 1)).toHaveLength(4);
    expect(dailyAnswer(6, 1)).toHaveLength(6);
  });

  it('picks unlimited words that avoid recent ones', () => {
    const rng = createRng('u');
    const avoid = ANSWERS[4].slice(0, ANSWERS[4].length - 1);
    expect(randomAnswer(4, rng, avoid)).toBe(ANSWERS[4][ANSWERS[4].length - 1]);
  });
});

describe('a game', () => {
  const real = (w: string) => dict(5).has(w);

  it('rejects short and unknown words without using a guess', () => {
    const g = new WordGame(5, 'grape');
    expect(g.submit('gra', real)).toEqual({ ok: false, reason: 'short' });
    expect(g.submit('qzxvw', real)).toEqual({ ok: false, reason: 'unknown' });
    expect(g.guesses).toHaveLength(0);
  });

  it('wins on the answer and stops accepting guesses', () => {
    const g = new WordGame(5, 'grape');
    expect(g.submit('crane', real).ok).toBe(true);
    expect(g.submit('GRAPE', real).ok).toBe(true);
    expect(g.won).toBe(true);
    expect(g.over).toBe(true);
    expect(g.submit('stare', real)).toEqual({ ok: false, reason: 'over' });
  });

  it('loses after six wrong guesses', () => {
    const g = new WordGame(5, 'grape');
    for (const w of ['crane', 'stare', 'pilot', 'mound', 'fizzy', 'jumbo']) g.submit(w, real);
    expect(g.guesses).toHaveLength(MAX_GUESSES);
    expect(g.won).toBe(false);
    expect(g.over).toBe(true);
  });

  it('keeps the best mark per letter for the keyboard', () => {
    const g = new WordGame(5, 'grape');
    g.submit('pearl', real); // P near
    g.submit('plumb', real); // P near
    g.submit('grape', real); // P hit
    expect(g.letterMarks().get('p')).toBe('hit');
    expect(g.letterMarks().get('l')).toBe('miss');
  });

  it('shares a grid without the answer, and restores from storage', () => {
    const g = new WordGame(5, 'grape');
    g.submit('crane', real);
    g.submit('grape', real);
    const text = g.shareText('Word Guess #317');
    expect(text.split('\n')[0]).toBe('Word Guess #317 2/6');
    expect(text.toLowerCase()).not.toContain('grape');
    expect(text.split('\n')).toHaveLength(4);
    const back = WordGame.restore(5, g.serialize());
    expect(back.guesses).toEqual(['crane', 'grape']);
    expect(back.won).toBe(true);
  });
});

describe('stats and streaks', () => {
  it('counts wins, guess distribution and streaks', () => {
    let s = emptyStats();
    s = recordResult(s, true, 3);
    s = recordResult(s, true, 4);
    s = recordResult(s, false, 6);
    s = recordResult(s, true, 2);
    expect(s).toMatchObject({ played: 4, wins: 3, streak: 1, best: 2, dist: [0, 1, 1, 1, 0, 0] });
  });

  it('breaks a daily streak when a day is skipped', () => {
    let s = emptyStats();
    s = recordResult(s, true, 3, 10);
    s = recordResult(s, true, 3, 11);
    expect(s.streak).toBe(2);
    s = recordResult(s, true, 3, 13);
    expect(s.streak).toBe(1);
    expect(s.best).toBe(2);
    expect(s.lastDay).toBe(13);
  });
});
