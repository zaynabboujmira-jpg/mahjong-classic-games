import { createRng, shuffleInPlace, type Rng } from '../core/rng';

/*
 * Word Builder: seven letters on a wheel (the letters of a common 7-letter
 * word). Make words of four or more letters using each wheel letter at most
 * as often as it appears. Words are checked against the public-domain ENABLE
 * list (4-6 letters) and the wheel word itself. Longer words score more; the
 * seven-letter word scores a bonus.
 */
export const BASE_WORDS: readonly string[] = [
  'another', 'balance', 'battery', 'bedroom', 'brother', 'capital', 'captain', 'central', 'chapter', 'chicken', 'climate',
  'compare', 'concert', 'contain', 'country', 'crystal', 'current', 'deliver', 'diamond', 'digital', 'dolphin', 'drawing', 'eastern',
  'element', 'evening', 'example', 'factory', 'fashion', 'feature', 'finance', 'freedom', 'garbage', 'general', 'glasses', 'harvest',
  'healthy', 'hearing', 'history', 'holiday', 'husband', 'imagine', 'journal', 'journey', 'kitchen', 'landing', 'leather', 'library',
  'machine', 'manager', 'married', 'measure', 'meeting', 'mineral', 'mission', 'monster', 'morning', 'natural', 'network', 'nothing',
  'officer', 'organic', 'painter', 'partner', 'passage', 'patient', 'pattern', 'picture', 'plastic', 'popular', 'present',
  'printer', 'problem', 'process', 'product', 'program', 'project', 'protein', 'purpose', 'quarter', 'reading', 'reality', 'regular',
  'release', 'respect', 'restore', 'retired', 'sailing', 'science', 'section', 'servant', 'service', 'shelter', 'silence', 'soldier',
  'special', 'station', 'storage', 'strange', 'student', 'subject', 'success', 'support', 'surface', 'teacher', 'theater',
  'through', 'tonight', 'traffic', 'trainer', 'transit', 'trouble', 'village', 'vintage', 'warning', 'weather', 'weekend', 'welcome',
  'western', 'whisper', 'winters', 'writing', 'painted', 'planets', 'singers', 'garden', 'stories', 'teaching', 'remains', 'orange',
].filter((w) => w.length === 7);

export const POINTS = (w: string) => (w.length === 4 ? 1 : w.length);
export const RANKS = [
  { name: 'Beginner', at: 0 },
  { name: 'Good', at: 0.05 },
  { name: 'Solid', at: 0.12 },
  { name: 'Nice', at: 0.2 },
  { name: 'Great', at: 0.3 },
  { name: 'Amazing', at: 0.42 },
  { name: 'Genius', at: 0.55 },
] as const;

const counts = (w: string) => {
  const m = new Map<string, number>();
  for (const ch of w) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
};

/** Can `word` be spelled from the letters (each used at most as often as given)? */
export function canSpell(word: string, letters: string): boolean {
  const have = counts(letters);
  for (const [ch, n] of counts(word)) if ((have.get(ch) ?? 0) < n) return false;
  return true;
}

/** Splits a packed word file (all words the same length, no separators). */
export function unpack(raw: string, n: number): string[] {
  const s = raw.trim();
  const out: string[] = [];
  for (let i = 0; i + n <= s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

export interface WheelPuzzle {
  base: string;
  letters: string[];
  answers: string[];
  total: number;
}

export function pickBase(seed: string, rng: Rng = createRng(`wheel:${seed}`)) {
  return BASE_WORDS[Math.floor(rng() * BASE_WORDS.length)]!;
}

/** Builds the puzzle for a base word from the dictionary words (4-6 letters). */
export function buildWheel(base: string, dictionary: Iterable<string>, seed = base): WheelPuzzle {
  const answers = new Set<string>([base]);
  for (const w of dictionary) if (w.length >= 4 && canSpell(w, base)) answers.add(w);
  const list = [...answers].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const letters = shuffleInPlace([...base], createRng(`wheel-letters:${seed}`));
  return { base, letters, answers: list, total: list.reduce((n, w) => n + POINTS(w) + (w === base ? 7 : 0), 0) };
}

export class WordBuilder {
  readonly puzzle: WheelPuzzle;
  found: string[] = [];
  score = 0;
  private answerSet: Set<string>;

  constructor(puzzle: WheelPuzzle) {
    this.puzzle = puzzle;
    this.answerSet = new Set(puzzle.answers);
  }

  /** 'ok' with points, or why the word was rejected. */
  submit(raw: string): { result: 'ok' | 'short' | 'letters' | 'unknown' | 'repeat'; points: number } {
    const w = raw.toLowerCase();
    if (w.length < 4) return { result: 'short', points: 0 };
    if (!canSpell(w, this.puzzle.base)) return { result: 'letters', points: 0 };
    if (this.found.includes(w)) return { result: 'repeat', points: 0 };
    if (!this.answerSet.has(w)) return { result: 'unknown', points: 0 };
    const points = POINTS(w) + (w === this.puzzle.base ? 7 : 0);
    this.found.push(w);
    this.score += points;
    return { result: 'ok', points };
  }

  get rank() {
    const share = this.score / Math.max(1, this.puzzle.total);
    return [...RANKS].reverse().find((r) => share >= r.at)!.name;
  }

  /** Points needed for the next rank, or null at the top. */
  get nextRank(): { name: string; points: number } | null {
    const share = this.score / Math.max(1, this.puzzle.total);
    const next = RANKS.find((r) => r.at > share);
    return next ? { name: next.name, points: Math.ceil(next.at * this.puzzle.total) - this.score } : null;
  }

  shuffle(rng: Rng = Math.random) {
    shuffleInPlace(this.puzzle.letters, rng);
  }
}
