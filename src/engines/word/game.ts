import { createRng, shuffleInPlace } from '../core/rng';
import { ANSWERS } from './answers';

export type WordLength = 4 | 5 | 6;
export const LENGTHS: readonly WordLength[] = [4, 5, 6];
export const MAX_GUESSES = 6;

/** Right letter in the right spot / in the word elsewhere / not in the word. */
export type Mark = 'hit' | 'near' | 'miss';

/**
 * Marks a guess against the answer. Repeated letters are handled the usual
 * way: exact matches first, then "near" only while unmatched copies of that
 * letter remain in the answer.
 */
export function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: guess.length }, () => 'miss');
  const left = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit';
    else left.set(answer[i]!, (left.get(answer[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'hit') continue;
    const n = left.get(guess[i]!) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(guess[i]!, n - 1);
    }
  }
  return marks;
}

/** Day number in the player's local calendar, counted from 2026-01-01 (day 1). */
export function dayNumber(date: Date): number {
  const start = Date.UTC(2026, 0, 1);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000) + 1;
}

/** Answers in a fixed shuffled order per length, so the daily word is not alphabetical. */
const orders = new Map<WordLength, readonly string[]>();
function order(length: WordLength): readonly string[] {
  let o = orders.get(length);
  if (!o) {
    o = shuffleInPlace(ANSWERS[length].slice(), createRng(`word-daily-${length}`));
    orders.set(length, o);
  }
  return o;
}

/** The daily answer: the same for everyone on the same calendar day. */
export function dailyAnswer(length: WordLength, day: number): string {
  const o = order(length);
  return o[(((day - 1) % o.length) + o.length) % o.length]!;
}

/** A random answer for unlimited play, avoiding the most recent ones. */
export function randomAnswer(length: WordLength, rng: () => number, avoid: readonly string[] = []): string {
  const pool = ANSWERS[length].filter((w) => !avoid.includes(w));
  const list = pool.length ? pool : ANSWERS[length];
  return list[Math.floor(rng() * list.length)]!;
}

/** Fixed-width dictionary string (as served from /words/N.txt) to a lookup set. */
export function parseDictionary(data: string, length: WordLength): Set<string> {
  const set = new Set<string>();
  const clean = data.trim().toLowerCase();
  for (let i = 0; i + length <= clean.length; i += length) set.add(clean.slice(i, i + length));
  for (const w of ANSWERS[length]) set.add(w);
  return set;
}

export type SubmitResult = { ok: true; marks: Mark[] } | { ok: false; reason: 'short' | 'unknown' | 'over' };

export class WordGame {
  readonly length: WordLength;
  readonly answer: string;
  readonly guesses: string[] = [];
  readonly marks: Mark[][] = [];

  constructor(length: WordLength, answer: string) {
    if (answer.length !== length) throw new Error('Answer length mismatch');
    this.length = length;
    this.answer = answer.toLowerCase();
  }

  get won() {
    return this.guesses.includes(this.answer);
  }
  get over() {
    return this.won || this.guesses.length >= MAX_GUESSES;
  }

  /** Validates and records a guess. `isWord` checks the dictionary. */
  submit(guess: string, isWord: (w: string) => boolean): SubmitResult {
    const g = guess.toLowerCase();
    if (this.over) return { ok: false, reason: 'over' };
    if (g.length !== this.length || !/^[a-z]+$/.test(g)) return { ok: false, reason: 'short' };
    if (!isWord(g)) return { ok: false, reason: 'unknown' };
    const m = score(g, this.answer);
    this.guesses.push(g);
    this.marks.push(m);
    return { ok: true, marks: m };
  }

  /** Best mark seen for each letter, for colouring the keyboard. */
  letterMarks(): Map<string, Mark> {
    const rank: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };
    const out = new Map<string, Mark>();
    this.guesses.forEach((g, r) =>
      [...g].forEach((ch, i) => {
        const m = this.marks[r]![i]!;
        const prev = out.get(ch);
        if (!prev || rank[m] > rank[prev]) out.set(ch, m);
      }),
    );
    return out;
  }

  /** Spoiler-free result grid for sharing. */
  shareText(title: string): string {
    const sq: Record<Mark, string> = { hit: '\u{1F7E9}', near: '\u{1F7E7}', miss: '⬛' };
    const head = `${title} ${this.won ? this.guesses.length : 'X'}/${MAX_GUESSES}`;
    return [head, '', ...this.marks.map((row) => row.map((m) => sq[m]).join(''))].join('\n');
  }

  serialize() {
    return { answer: this.answer, guesses: this.guesses.slice() };
  }

  static restore(length: WordLength, s: { answer: string; guesses: string[] }): WordGame {
    const g = new WordGame(length, s.answer);
    for (const w of s.guesses.slice(0, MAX_GUESSES)) {
      g.guesses.push(w);
      g.marks.push(score(w, g.answer));
    }
    return g;
  }
}

export interface Stats {
  played: number;
  wins: number;
  streak: number;
  best: number;
  /** Wins by number of guesses (index 0 = solved in 1). */
  dist: number[];
  /** Daily mode: the last day played, to keep streaks to consecutive days. */
  lastDay: number;
}

export const emptyStats = (): Stats => ({ played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], lastDay: 0 });

/** Records a finished game. Daily streaks break when a day is skipped. */
export function recordResult(s: Stats, won: boolean, guesses: number, day = 0): Stats {
  const next: Stats = { ...s, dist: s.dist.slice() };
  next.played++;
  const consecutive = !day || !s.lastDay || day === s.lastDay + 1;
  if (won) {
    next.wins++;
    next.streak = consecutive ? s.streak + 1 : 1;
    next.best = Math.max(next.best, next.streak);
    next.dist[guesses - 1]!++;
  } else next.streak = 0;
  if (day) next.lastDay = day;
  return next;
}
