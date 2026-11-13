import { createRng, shuffleInPlace, type Rng } from '../core/rng';

/*
 * Dominoes with a double-six set (28 tiles). Each player gets 7 tiles with
 * two players, 5 with three or four. The holder of the highest double leads
 * it (or the highest tile when nobody has a double). Play a tile with a
 * matching number on either open end of the line.
 *
 * Draw game: a player who cannot play draws from the boneyard until they can
 * (and passes once it is empty). Block game: a player who cannot play passes.
 *
 * The round ends when a player goes out (they score the pips left in every
 * other hand) or when nobody can play (the lowest hand scores the others'
 * pips; a tie scores nothing). First to the target score wins the match.
 */
export type Tile = readonly [number, number];
export type DominoMode = 'draw' | 'block';
export type End = 'left' | 'right';

export interface Placed {
  tile: Tile;
  /** Pip shown on the left and right of this tile as laid in the line. */
  a: number;
  b: number;
  /** Who played it. */
  by: number;
}

export interface Play {
  tile: number;
  end: End;
}

export interface RoundResult {
  winner: number | null;
  points: number;
  blocked: boolean;
  pips: number[];
}

export const fullSet = (): Tile[] => {
  const out: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b]);
  return out;
};
export const pips = (t: Tile) => t[0] + t[1];
export const isDouble = (t: Tile) => t[0] === t[1];

export class Dominoes {
  readonly players: number;
  readonly mode: DominoMode;
  readonly target: number;
  hands: Tile[][] = [];
  boneyard: Tile[] = [];
  line: Placed[] = [];
  turn = 0;
  scores: number[];
  round = 0;
  /** Consecutive passes; a full circle of passes blocks the round. */
  passes = 0;
  result: RoundResult | null = null;
  /** Numbers each player is known not to hold (they passed or drew facing them). */
  lacks: Set<number>[] = [];
  private rng: Rng;

  constructor(players = 2, mode: DominoMode = 'draw', seed = 'dominoes', target = 100) {
    this.players = players;
    this.mode = mode;
    this.target = target;
    this.scores = new Array(players).fill(0);
    this.rng = createRng(`dominoes:${seed}`);
    this.deal();
  }

  get ends(): [number, number] | null {
    if (!this.line.length) return null;
    return [this.line[0]!.a, this.line[this.line.length - 1]!.b];
  }

  get matchWinner(): number | null {
    const i = this.scores.findIndex((s) => s >= this.target);
    return i >= 0 ? i : null;
  }

  handPips(p: number) {
    return this.hands[p]!.reduce((n, t) => n + pips(t), 0);
  }

  /** Deals a new round; the leader is the holder of the highest double (or tile). */
  deal() {
    const set = shuffleInPlace(fullSet(), this.rng);
    const size = this.players === 2 ? 7 : 5;
    this.hands = Array.from({ length: this.players }, (_, i) => set.slice(i * size, (i + 1) * size));
    this.boneyard = set.slice(this.players * size);
    this.line = [];
    this.passes = 0;
    this.result = null;
    this.lacks = Array.from({ length: this.players }, () => new Set<number>());
    this.round++;
    let best = -1;
    let leader = 0;
    this.hands.forEach((h, p) =>
      h.forEach((t) => {
        const rank = (isDouble(t) ? 100 : 0) + pips(t) * 2 + Math.max(...t) / 10;
        if (rank > best) {
          best = rank;
          leader = p;
        }
      }),
    );
    this.turn = leader;
  }

  /** The tile the leader must open with (highest double, else highest tile), as an index in their hand. */
  openingTile(): number {
    const h = this.hands[this.turn]!;
    let bi = 0;
    let best = -1;
    h.forEach((t, i) => {
      const rank = (isDouble(t) ? 100 : 0) + pips(t) * 2 + Math.max(...t) / 10;
      if (rank > best) {
        best = rank;
        bi = i;
      }
    });
    return bi;
  }

  /** Every legal placement for a player. */
  legal(p = this.turn): Play[] {
    if (this.result) return [];
    const ends = this.ends;
    if (!ends) return p === this.turn ? [{ tile: this.openingTile(), end: 'left' }] : [];
    const out: Play[] = [];
    this.hands[p]!.forEach((t, i) => {
      if (t.includes(ends[0])) out.push({ tile: i, end: 'left' });
      if (t.includes(ends[1])) out.push({ tile: i, end: 'right' });
    });
    return out;
  }

  canPlay(p = this.turn) {
    return this.legal(p).length > 0;
  }

  /** Ends of the line a tile from the hand fits. */
  fits(p: number, tile: number): End[] {
    return this.legal(p)
      .filter((x) => x.tile === tile)
      .map((x) => x.end);
  }

  play(p: number, tile: number, end: End) {
    if (p !== this.turn || this.result) throw new Error('Not your turn');
    if (!this.legal(p).some((x) => x.tile === tile && x.end === end)) throw new Error('Illegal play');
    const t = this.hands[p]!.splice(tile, 1)[0]!;
    const ends = this.ends;
    if (!ends) this.line.push({ tile: t, a: t[0], b: t[1], by: p });
    else if (end === 'left') {
      const b = ends[0];
      this.line.unshift({ tile: t, a: t[0] === b ? t[1] : t[0], b, by: p });
    } else {
      const a = ends[1];
      this.line.push({ tile: t, a, b: t[0] === a ? t[1] : t[0], by: p });
    }
    this.passes = 0;
    if (this.hands[p]!.length === 0) this.finish(p, false);
    else this.next();
  }

  /** Draw game: take one tile from the boneyard (only when you cannot play). */
  draw(p = this.turn): Tile | null {
    if (this.mode !== 'draw' || p !== this.turn || this.canPlay(p) || !this.boneyard.length) return null;
    const ends = this.ends;
    if (ends) for (const e of ends) this.lacks[p]!.add(e);
    const t = this.boneyard.pop()!;
    this.hands[p]!.push(t);
    return t;
  }

  /** Pass when you cannot play (and, in the draw game, the boneyard is empty). */
  pass(p = this.turn) {
    if (p !== this.turn || this.canPlay(p) || (this.mode === 'draw' && this.boneyard.length)) throw new Error('Cannot pass');
    const ends = this.ends;
    if (ends) for (const e of ends) this.lacks[p]!.add(e);
    this.passes++;
    if (this.passes >= this.players) this.finish(null, true);
    else this.next();
  }

  private next() {
    this.turn = (this.turn + 1) % this.players;
  }

  private finish(outPlayer: number | null, blocked: boolean) {
    const handPips = this.hands.map((_, i) => this.handPips(i));
    let winner = outPlayer;
    if (blocked) {
      const low = Math.min(...handPips);
      const lows = handPips.flatMap((v, i) => (v === low ? [i] : []));
      winner = lows.length === 1 ? lows[0]! : null;
    }
    const points = winner === null ? 0 : handPips.reduce((n, v, i) => n + (i === winner ? 0 : v), 0);
    if (winner !== null) {
      this.scores[winner]! += points;
      this.turn = winner;
    }
    this.result = { winner, points, blocked, pips: handPips };
  }

  /** Starts the next round of the match. */
  nextRound() {
    if (!this.result || this.matchWinner !== null) return;
    this.deal();
  }
}

/**
 * The computer's choice: play heavy tiles and doubles early, keep a varied
 * hand, and leave open ends the next player is known to lack.
 */
export function chooseDominoPlay(g: Dominoes, p = g.turn): Play | null {
  const options = g.legal(p);
  if (!options.length) return null;
  if (options.length === 1) return options[0]!;
  const hand = g.hands[p]!;
  const nextPlayer = (p + 1) % g.players;
  const ends = g.ends;
  let best = options[0]!;
  let bestScore = -Infinity;
  for (const o of options) {
    const t = hand[o.tile]!;
    let score = pips(t) + (isDouble(t) ? 6 : 0);
    let newEnds: number[] = [];
    if (ends) {
      const matched = o.end === 'left' ? ends[0] : ends[1];
      const out = t[0] === matched ? t[1] : t[0];
      newEnds = o.end === 'left' ? [out, ends[1]] : [ends[0], out];
    } else newEnds = [t[0], t[1]];
    const rest = hand.filter((_, i) => i !== o.tile);
    // Keep control: tiles left that still fit the new ends.
    score += 3 * rest.filter((x) => newEnds.some((e) => x.includes(e))).length;
    // Keep variety: distinct numbers left in hand.
    score += 1.5 * new Set(rest.flat()).size;
    // Block: ends the next player cannot match.
    if (g.lacks[nextPlayer]!.size) score += 8 * newEnds.filter((e) => g.lacks[nextPlayer]!.has(e)).length;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}
