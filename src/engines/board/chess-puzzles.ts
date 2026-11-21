import { Chess, squareName, type Move } from './chess';

/*
 * Chess puzzles: mate in 1 and mate in 2, each with exactly one solution.
 * The puzzle set (src/data/chess-puzzles.json) was generated from computer
 * self-play with these functions, and the unit tests re-check every puzzle:
 * a mate in 1 has exactly one mating move; a mate in 2 has no mate in 1 and
 * exactly one first move after which every reply allows a mate.
 */
export interface ChessPuzzle {
  /** Position with the solver to move. */
  fen: string;
  /** 1 or 2: moves the solver needs to mate. */
  mate: 1 | 2;
  /** The one key move, as coordinates ("e2e4", "e7e8q"). */
  key: string;
}

const PROMO = ['', '', 'n', 'b', 'r', 'q'];
export const uci = (m: Move) => squareName(m.from) + squareName(m.to) + (m.promo ? PROMO[m.promo] : '');

const isMate = (g: Chess) => g.inCheck() && g.moves().length === 0;

/** Every move that mates at once. */
export function matingMoves(g: Chess, limit = Infinity): Move[] {
  const out: Move[] = [];
  for (const m of g.moves()) {
    g.makeMove(m);
    const mate = isMate(g);
    g.unmakeMove();
    if (mate) {
      out.push(m);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** First moves that force mate next move against every defence (stops after `limit`). */
export function mateInTwoKeys(g: Chess, limit = Infinity): Move[] {
  const out: Move[] = [];
  for (const m of g.moves()) {
    g.makeMove(m);
    const replies = g.moves();
    let forced = replies.length > 0;
    for (const r of replies) {
      g.makeMove(r);
      const ok = matingMoves(g, 1).length > 0;
      g.unmakeMove();
      if (!ok) {
        forced = false;
        break;
      }
    }
    g.unmakeMove();
    if (forced) {
      out.push(m);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** True when the puzzle has exactly the one stated solution. */
export function verifyPuzzle(p: ChessPuzzle): boolean {
  const g = new Chess(p.fen);
  if (p.mate === 1) {
    const mates = matingMoves(g);
    return mates.length === 1 && uci(mates[0]!) === p.key;
  }
  if (matingMoves(g, 1).length) return false;
  const keys = mateInTwoKeys(g, 2);
  return keys.length === 1 && uci(keys[0]!) === p.key;
}

/**
 * The defender's reply in a mate in 2: the reply that leaves the fewest
 * mating moves (the most stubborn defence), so the finish is never trivial.
 */
export function bestDefence(g: Chess): Move | null {
  let best: Move | null = null;
  let fewest = Infinity;
  for (const r of g.moves()) {
    g.makeMove(r);
    const n = matingMoves(g).length;
    g.unmakeMove();
    if (n < fewest) (fewest = n), (best = r);
  }
  return best;
}

/** Index of the daily puzzle for a day number: steps through the mate-in-2 set in a fixed shuffled order. */
export function dailyIndex(day: number, count: number) {
  // A multiplier coprime with any count that is not a multiple of 7919 visits every puzzle before repeating.
  return (((day * 7919) % count) + count) % count;
}
