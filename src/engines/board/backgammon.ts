import { createRng, type Rng } from '../core/rng';

/*
 * Backgammon. Points are indexed 0..23. White moves from 23 down to 0 and
 * bears off below 0 (home board 0-5); Black moves from 0 up to 23 and bears
 * off above 23 (home board 18-23). board[i] > 0 counts White checkers,
 * board[i] < 0 counts Black checkers.
 *
 * A turn must use as many dice as possible; when only one die can be used,
 * it must be the higher one if that one can be played. Doubles give four
 * moves. A single checker (a blot) that is hit goes to the bar and must
 * re-enter in the opponent's home board before anything else moves.
 */
export const WHITE = 0;
export const BLACK = 1;
export type Player = 0 | 1;
/** Pseudo-points: the bar (where re-entering checkers start) and off the board. */
export const BAR = 24;
export const OFF = -1;

export interface BgMove {
  from: number;
  to: number;
  die: number;
  hit: boolean;
}

export interface Position {
  board: number[];
  bar: [number, number];
  off: [number, number];
}

const sign = (p: Player) => (p === WHITE ? 1 : -1);

export const startPosition = (): Position => {
  const board = new Array<number>(24).fill(0);
  board[23] = 2;
  board[12] = 5;
  board[7] = 3;
  board[5] = 5;
  board[0] = -2;
  board[11] = -5;
  board[16] = -3;
  board[18] = -5;
  return { board, bar: [0, 0], off: [0, 0] };
};

const clone = (p: Position): Position => ({ board: [...p.board], bar: [p.bar[0], p.bar[1]], off: [p.off[0], p.off[1]] });

/** Checkers of `p` on point i (0 if none or the opponent's). */
const mine = (pos: Position, p: Player, i: number) => Math.max(0, pos.board[i]! * sign(p));
const theirs = (pos: Position, p: Player, i: number) => Math.max(0, -pos.board[i]! * sign(p));

/** Distance of point i from bearing off, for player p (1..24). */
export const distance = (p: Player, i: number) => (p === WHITE ? i + 1 : 24 - i);

export function allHome(pos: Position, p: Player) {
  if (pos.bar[p]) return false;
  for (let i = 0; i < 24; i++) if (mine(pos, p, i) && distance(p, i) > 6) return false;
  return true;
}

/** Every single-checker move for one die. */
export function singleMoves(pos: Position, p: Player, die: number): BgMove[] {
  const out: BgMove[] = [];
  const target = (from: number) => (p === WHITE ? from - die : from + die);
  const open = (to: number) => theirs(pos, p, to) <= 1;
  if (pos.bar[p]) {
    const to = p === WHITE ? 24 - die : die - 1;
    if (open(to)) out.push({ from: BAR, to, die, hit: theirs(pos, p, to) === 1 });
    return out;
  }
  const home = allHome(pos, p);
  for (let i = 0; i < 24; i++) {
    if (!mine(pos, p, i)) continue;
    const to = target(i);
    if (to >= 0 && to <= 23) {
      if (open(to)) out.push({ from: i, to, die, hit: theirs(pos, p, to) === 1 });
    } else if (home) {
      const d = distance(p, i);
      // Exact bear-off, or a higher die when no checker sits further back.
      const furthest = Math.max(...Array.from({ length: 24 }, (_, k) => (mine(pos, p, k) ? distance(p, k) : 0)));
      if (d === die || (die > d && d === furthest)) out.push({ from: i, to: OFF, die, hit: false });
    }
  }
  return out;
}

export function applyMove(pos: Position, p: Player, m: BgMove): Position {
  const n = clone(pos);
  const s = sign(p);
  if (m.from === BAR) n.bar[p]--;
  else n.board[m.from]! -= s;
  if (m.to === OFF) n.off[p]++;
  else {
    if (m.hit) {
      n.board[m.to] = 0;
      n.bar[p === WHITE ? BLACK : WHITE]++;
    }
    n.board[m.to]! += s;
  }
  return n;
}

export const diceList = (dice: [number, number]) => (dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]]);

export const positionKey = (pos: Position) => `${pos.board.join(',')}|${pos.bar.join(',')}|${pos.off.join(',')}`;

/**
 * Every legal way to play the roll, as move sequences (all orders kept, so
 * the UI can match the moves a player makes one at a time).
 */
export function legalSequences(pos: Position, p: Player, dice: [number, number]): BgMove[][] {
  const all: BgMove[][] = [];
  const walk = (cur: Position, left: number[], seq: BgMove[]) => {
    let moved = false;
    const tried = new Set<number>();
    for (let k = 0; k < left.length; k++) {
      const die = left[k]!;
      if (tried.has(die)) continue;
      tried.add(die);
      for (const m of singleMoves(cur, p, die)) {
        moved = true;
        walk(applyMove(cur, p, m), [...left.slice(0, k), ...left.slice(k + 1)], [...seq, m]);
      }
    }
    if (!moved) all.push(seq);
  };
  walk(pos, diceList(dice), []);
  const longest = Math.max(...all.map((s) => s.length));
  let legal = all.filter((s) => s.length === longest);
  if (longest === 1 && dice[0] !== dice[1]) {
    const high = Math.max(...dice);
    if (legal.some((s) => s[0]!.die === high)) legal = legal.filter((s) => s[0]!.die === high);
  }
  return longest === 0 ? [[]] : legal;
}

export const sameMove = (a: BgMove, b: BgMove) => a.from === b.from && a.to === b.to && a.die === b.die;

/** Pip count: total distance to bear off everything. */
export function pips(pos: Position, p: Player) {
  let n = pos.bar[p] * 25;
  for (let i = 0; i < 24; i++) n += mine(pos, p, i) * distance(p, i);
  return n;
}

/** 1 for a single game, 2 for a gammon, 3 for a backgammon; 0 while play goes on. */
export function winValue(pos: Position, winner: Player): number {
  if (pos.off[winner] < 15) return 0;
  const loser: Player = winner === WHITE ? BLACK : WHITE;
  if (pos.off[loser] > 0) return 1;
  const inWinnerHome = pos.bar[loser] > 0 || Array.from({ length: 24 }, (_, i) => i).some((i) => mine(pos, loser, i) && distance(winner, i) <= 6);
  return inWinnerHome ? 3 : 2;
}

export class Backgammon {
  pos: Position = startPosition();
  turn: Player = WHITE;
  dice: [number, number] | null = null;
  /** Moves played so far this turn. */
  played: BgMove[] = [];
  private turnStart: Position = startPosition();
  private sequences: BgMove[][] = [];
  winner: Player | null = null;
  points = 0;
  private rng: Rng;

  constructor(seed = 'backgammon') {
    this.rng = createRng(`bg:${seed}`);
  }

  /** Opening roll: each side rolls one die; the higher starts, using both. */
  opening(): [number, number] {
    for (;;) {
      const a = 1 + Math.floor(this.rng() * 6);
      const b = 1 + Math.floor(this.rng() * 6);
      if (a === b) continue;
      this.turn = a > b ? WHITE : BLACK;
      this.setDice([a, b]);
      return [a, b];
    }
  }

  roll(): [number, number] {
    const d: [number, number] = [1 + Math.floor(this.rng() * 6), 1 + Math.floor(this.rng() * 6)];
    this.setDice(d);
    return d;
  }

  setDice(d: [number, number]) {
    this.dice = d;
    this.played = [];
    this.turnStart = this.pos;
    this.sequences = legalSequences(this.pos, this.turn, d);
  }

  /** Moves allowed next, given the moves already played this turn. */
  nextMoves(): BgMove[] {
    const k = this.played.length;
    const out: BgMove[] = [];
    for (const s of this.sequences) {
      if (s.length <= k || !this.played.every((m, i) => sameMove(m, s[i]!))) continue;
      if (!out.some((m) => sameMove(m, s[k]!))) out.push(s[k]!);
    }
    return out;
  }

  /** True once the moves played use the whole roll (or no move is possible). */
  get turnComplete() {
    return this.dice !== null && this.nextMoves().length === 0;
  }

  move(m: BgMove): boolean {
    const legal = this.nextMoves().find((x) => sameMove(x, m));
    if (!legal) return false;
    this.pos = applyMove(this.pos, this.turn, legal);
    this.played.push(legal);
    const v = winValue(this.pos, this.turn);
    if (v) {
      this.winner = this.turn;
      this.points = v;
    }
    return true;
  }

  /** Takes back the last move of this turn. */
  undoMove(): boolean {
    if (!this.played.length) return false;
    this.played.pop();
    let p = this.turnStart;
    for (const m of this.played) p = applyMove(p, this.turn, m);
    this.pos = p;
    this.winner = null;
    this.points = 0;
    return true;
  }

  endTurn() {
    if (!this.turnComplete || this.winner !== null) return false;
    this.turn = this.turn === WHITE ? BLACK : WHITE;
    this.dice = null;
    this.played = [];
    return true;
  }

  /** All distinct end positions reachable this turn, with one sequence each. */
  options(): { seq: BgMove[]; pos: Position }[] {
    const seen = new Map<string, { seq: BgMove[]; pos: Position }>();
    for (const s of this.sequences) {
      let p = this.turnStart;
      for (const m of s) p = applyMove(p, this.turn, m);
      const k = positionKey(p);
      if (!seen.has(k)) seen.set(k, { seq: s, pos: p });
    }
    return [...seen.values()];
  }
}

// ----- computer player -----

export type BgLevel = 'easy' | 'medium' | 'hard';
export const BG_LEVELS: readonly BgLevel[] = ['easy', 'medium', 'hard'];

/** Chance that a blot at distance d (1..24) is hit by a random roll, roughly. */
const SHOT = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 3, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1].map((n) => n / 36);

/** Static evaluation from `p`'s point of view (higher is better). */
export function evaluate(pos: Position, p: Player): number {
  const o: Player = p === WHITE ? BLACK : WHITE;
  if (pos.off[p] === 15) return 1000;
  if (pos.off[o] === 15) return -1000;
  let s = (pips(pos, o) - pips(pos, p)) * 1.0;
  s += (pos.off[p] - pos.off[o]) * 4;
  s -= pos.bar[p] * 12;
  s += pos.bar[o] * 12;
  // Contact: does any White checker still have to pass a Black one?
  let whiteBack = -1;
  let blackBack = 24;
  for (let i = 0; i < 24; i++) {
    if (pos.board[i]! > 0) whiteBack = Math.max(whiteBack, i);
    if (pos.board[i]! < 0) blackBack = Math.min(blackBack, i);
  }
  const contact = pos.bar[0] > 0 || pos.bar[1] > 0 || whiteBack > blackBack;
  if (!contact) return s * 2;
  for (let i = 0; i < 24; i++) {
    const n = mine(pos, p, i);
    const d = distance(p, i);
    if (n >= 2) {
      // Made points block the opponent; home-board points matter most.
      s += d <= 6 ? 6 : d <= 9 ? 4 : 2;
    } else if (n === 1) {
      // A blot: risk grows with how many opposing checkers can reach it.
      let risk = 0;
      for (let k = 0; k < 24; k++) {
        if (!theirs(pos, p, k)) continue;
        const gap = p === WHITE ? i - k : k - i;
        if (gap < 0 && -gap <= 24) risk = Math.max(risk, SHOT[-gap]!);
      }
      if (pos.bar[o]) risk = Math.max(risk, 11 / 36);
      s -= risk * (10 + (25 - d) * 0.6);
    }
  }
  // Primes: consecutive made points.
  let run = 0;
  let best = 0;
  for (let d = 1; d <= 24; d++) {
    const i = p === WHITE ? d - 1 : 24 - d;
    run = mine(pos, p, i) >= 2 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  s += best * best * 1.5;
  return s;
}

const ROLLS: [number, number, number][] = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push([a, b, a === b ? 1 : 2]);

/** The computer's whole turn, as a move sequence. */
export function chooseBgSequence(g: Backgammon, level: BgLevel, rng: Rng = Math.random): BgMove[] {
  const opts = g.options();
  if (opts.length <= 1) return opts[0]?.seq ?? [];
  const p = g.turn;
  const o: Player = p === WHITE ? BLACK : WHITE;
  let scored = opts.map((x) => ({ ...x, v: evaluate(x.pos, p) }));
  if (level === 'easy') scored = scored.map((x) => ({ ...x, v: x.v + (rng() - 0.5) * 60 }));
  scored.sort((a, b) => b.v - a.v);
  if (level !== 'hard') return scored[0]!.seq;
  // Hard: look one roll ahead at the opponent's best reply for the top candidates.
  let best = scored[0]!;
  let bestV = -Infinity;
  for (const cand of scored.slice(0, 6)) {
    if (cand.pos.off[p] === 15) return cand.seq;
    let ev = 0;
    for (const [a, b, w] of ROLLS) {
      const seqs = legalSequences(cand.pos, o, [a, b]);
      let worst = Infinity;
      const seen = new Set<string>();
      for (const s of seqs) {
        let q = cand.pos;
        for (const m of s) q = applyMove(q, o, m);
        const k = positionKey(q);
        if (seen.has(k)) continue;
        seen.add(k);
        worst = Math.min(worst, evaluate(q, p));
      }
      ev += w * worst;
    }
    ev /= 36;
    if (ev > bestV) {
      bestV = ev;
      best = cand;
    }
  }
  return best.seq;
}
