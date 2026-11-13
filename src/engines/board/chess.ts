/*
 * Chess rules: full legal move generation (castling, en passant, promotion),
 * check, checkmate, stalemate and the automatic draws (fifty-move rule,
 * threefold repetition, insufficient material), SAN notation and FEN.
 *
 * Squares are 0..63 with a1 = 0, h1 = 7, a8 = 56. Pieces are numbers: the
 * type (1 pawn … 6 king) plus 8 for black.
 */
export const WHITE = 0;
export const BLACK = 1;
export type Color = 0 | 1;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const typeOf = (p: number) => p & 7;
export const colorOf = (p: number): Color => (p >> 3) as Color;
const make = (type: number, color: Color) => type | (color << 3);

export const FLAG_EP = 1;
export const FLAG_CASTLE = 2;
export const FLAG_DOUBLE = 4;

export interface Move {
  from: number;
  to: number;
  piece: number;
  captured: number;
  /** Promotion piece type (2-5), or 0. */
  promo: number;
  flags: number;
}

interface Undo {
  move: Move;
  castle: number;
  ep: number;
  half: number;
}

const fileOf = (s: number) => s & 7;
const rankOf = (s: number) => s >> 3;
export const squareName = (s: number) => 'abcdefgh'[fileOf(s)]! + (rankOf(s) + 1);
export const parseSquare = (n: string) => 'abcdefgh'.indexOf(n[0]!) + (Number(n[1]) - 1) * 8;

function steps(deltas: readonly [number, number][]) {
  return Array.from({ length: 64 }, (_, s) => {
    const out: number[] = [];
    for (const [df, dr] of deltas) {
      const f = fileOf(s) + df;
      const r = rankOf(s) + dr;
      if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(r * 8 + f);
    }
    return out;
  });
}
const KNIGHT_STEPS = steps([
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]);
const KING_STEPS = steps([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]);
/** RAYS[dir][square]: squares outward from the square. Dirs 0-3 rook-like, 4-7 bishop-like. */
const DIRS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
const RAYS = DIRS.map(([df, dr]) =>
  Array.from({ length: 64 }, (_, s) => {
    const out: number[] = [];
    let f = fileOf(s) + df;
    let r = rankOf(s) + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      out.push(r * 8 + f);
      f += df;
      r += dr;
    }
    return out;
  }),
);

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const LETTERS = ' pnbrqk';

export type Outcome = 'checkmate' | 'stalemate' | 'fifty-move' | 'repetition' | 'material' | null;

export class Chess {
  board = new Array<number>(64).fill(0);
  turn: Color = WHITE;
  /** Castling rights: 1 white king side, 2 white queen side, 4 black king side, 8 black queen side. */
  castle = 0;
  ep = -1;
  half = 0;
  full = 1;
  kings: [number, number] = [4, 60];
  private stack: Undo[] = [];
  /** Moves played in the game (not search), with the position keys for repetition. */
  played: Move[] = [];
  keys: string[] = [];

  constructor(fen = START_FEN) {
    this.load(fen);
  }

  load(fen: string) {
    const [placement, side, castling, ep, half, full] = fen.trim().split(/\s+/);
    this.board.fill(0);
    let r = 7;
    let f = 0;
    for (const ch of placement!) {
      if (ch === '/') {
        r--;
        f = 0;
      } else if (/\d/.test(ch)) f += Number(ch);
      else {
        const t = LETTERS.indexOf(ch.toLowerCase());
        const p = make(t, ch === ch.toLowerCase() ? BLACK : WHITE);
        this.board[r * 8 + f] = p;
        if (t === KING) this.kings[colorOf(p)] = r * 8 + f;
        f++;
      }
    }
    this.turn = side === 'b' ? BLACK : WHITE;
    this.castle = (castling ?? '-').split('').reduce((m, c) => m | ({ K: 1, Q: 2, k: 4, q: 8 }[c] ?? 0), 0);
    this.ep = ep && ep !== '-' ? parseSquare(ep) : -1;
    this.half = Number(half ?? 0);
    this.full = Number(full ?? 1);
    this.stack = [];
    this.played = [];
    this.keys = [this.key()];
  }

  fen(): string {
    const rows: string[] = [];
    for (let r = 7; r >= 0; r--) {
      let row = '';
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 8 + f]!;
        if (!p) {
          empty++;
          continue;
        }
        if (empty) row += empty;
        empty = 0;
        const ch = LETTERS[typeOf(p)]!;
        row += colorOf(p) === WHITE ? ch.toUpperCase() : ch;
      }
      rows.push(row + (empty ? empty : ''));
    }
    const c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return `${rows.join('/')} ${this.turn ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? squareName(this.ep) : '-'} ${this.half} ${this.full}`;
  }

  /** Position key for repetition: placement, side, castling and en passant. */
  key() {
    return this.fen().split(' ').slice(0, 4).join(' ');
  }

  isAttacked(sq: number, by: Color): boolean {
    const b = this.board;
    const f = fileOf(sq);
    if (by === WHITE) {
      if (f > 0 && sq - 9 >= 0 && b[sq - 9] === PAWN) return true;
      if (f < 7 && sq - 7 >= 0 && b[sq - 7] === PAWN) return true;
    } else {
      const bp = make(PAWN, BLACK);
      if (f > 0 && sq + 7 < 64 && b[sq + 7] === bp) return true;
      if (f < 7 && sq + 9 < 64 && b[sq + 9] === bp) return true;
    }
    const n = make(KNIGHT, by);
    for (const t of KNIGHT_STEPS[sq]!) if (b[t] === n) return true;
    const k = make(KING, by);
    for (const t of KING_STEPS[sq]!) if (b[t] === k) return true;
    const q = make(QUEEN, by);
    for (let d = 0; d < 8; d++) {
      const slider = make(d < 4 ? ROOK : BISHOP, by);
      for (const t of RAYS[d]![sq]!) {
        const p = b[t]!;
        if (!p) continue;
        if (p === slider || p === q) return true;
        break;
      }
    }
    return false;
  }

  inCheck(color: Color = this.turn) {
    return this.isAttacked(this.kings[color], (color ^ 1) as Color);
  }

  /** Pseudo-legal moves (may leave the king in check). */
  pseudoMoves(capturesOnly = false): Move[] {
    const out: Move[] = [];
    const b = this.board;
    const us = this.turn;
    const them = (us ^ 1) as Color;
    const add = (from: number, to: number, piece: number, captured: number, flags = 0) => {
      if (typeOf(piece) === PAWN && (rankOf(to) === 7 || rankOf(to) === 0)) {
        for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push({ from, to, piece, captured, promo, flags });
      } else out.push({ from, to, piece, captured, promo: 0, flags });
    };
    for (let s = 0; s < 64; s++) {
      const p = b[s]!;
      if (!p || colorOf(p) !== us) continue;
      const t = typeOf(p);
      if (t === PAWN) {
        const dir = us === WHITE ? 8 : -8;
        const one = s + dir;
        if (!capturesOnly || rankOf(one) === 7 || rankOf(one) === 0) {
          if (one >= 0 && one < 64 && !b[one]) {
            add(s, one, p, 0);
            const startRank = us === WHITE ? 1 : 6;
            if (!capturesOnly && rankOf(s) === startRank && !b[one + dir]) add(s, one + dir, p, 0, FLAG_DOUBLE);
          }
        }
        for (const df of [-1, 1]) {
          const f = fileOf(s) + df;
          if (f < 0 || f > 7) continue;
          const to = one + df;
          if (to < 0 || to > 63) continue;
          const c = b[to]!;
          if (c && colorOf(c) === them) add(s, to, p, c);
          else if (to === this.ep) add(s, to, p, make(PAWN, them), FLAG_EP);
        }
      } else if (t === KNIGHT || t === KING) {
        for (const to of (t === KNIGHT ? KNIGHT_STEPS : KING_STEPS)[s]!) {
          const c = b[to]!;
          if (c ? colorOf(c) === them : !capturesOnly) add(s, to, p, c);
        }
      } else {
        const d0 = t === BISHOP ? 4 : 0;
        const d1 = t === ROOK ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          for (const to of RAYS[d]![s]!) {
            const c = b[to]!;
            if (!c) {
              if (!capturesOnly) add(s, to, p, 0);
              continue;
            }
            if (colorOf(c) === them) add(s, to, p, c);
            break;
          }
        }
      }
    }
    if (!capturesOnly) this.castles(out);
    return out;
  }

  private castles(out: Move[]) {
    const b = this.board;
    const us = this.turn;
    const them = (us ^ 1) as Color;
    const k = make(KING, us);
    const r = make(ROOK, us);
    const base = us === WHITE ? 0 : 56;
    const kingSide = us === WHITE ? 1 : 4;
    const queenSide = us === WHITE ? 2 : 8;
    if (b[base + 4] !== k) return;
    if (this.castle & kingSide && b[base + 7] === r && !b[base + 5] && !b[base + 6]) {
      if (!this.isAttacked(base + 4, them) && !this.isAttacked(base + 5, them) && !this.isAttacked(base + 6, them))
        out.push({ from: base + 4, to: base + 6, piece: k, captured: 0, promo: 0, flags: FLAG_CASTLE });
    }
    if (this.castle & queenSide && b[base] === r && !b[base + 1] && !b[base + 2] && !b[base + 3]) {
      if (!this.isAttacked(base + 4, them) && !this.isAttacked(base + 3, them) && !this.isAttacked(base + 2, them))
        out.push({ from: base + 4, to: base + 2, piece: k, captured: 0, promo: 0, flags: FLAG_CASTLE });
    }
  }

  makeMove(m: Move) {
    const b = this.board;
    this.stack.push({ move: m, castle: this.castle, ep: this.ep, half: this.half });
    const us = colorOf(m.piece);
    b[m.from] = 0;
    b[m.to] = m.promo ? make(m.promo, us) : m.piece;
    if (m.flags & FLAG_EP) b[us === WHITE ? m.to - 8 : m.to + 8] = 0;
    if (m.flags & FLAG_CASTLE) {
      if (m.to === m.from + 2) {
        b[m.from + 3] = 0;
        b[m.from + 1] = make(ROOK, us);
      } else {
        b[m.from - 4] = 0;
        b[m.from - 1] = make(ROOK, us);
      }
    }
    if (typeOf(m.piece) === KING) {
      this.kings[us] = m.to;
      this.castle &= us === WHITE ? ~3 : ~12;
    }
    for (const s of [m.from, m.to]) {
      if (s === 0) this.castle &= ~2;
      else if (s === 7) this.castle &= ~1;
      else if (s === 56) this.castle &= ~8;
      else if (s === 63) this.castle &= ~4;
    }
    this.ep = m.flags & FLAG_DOUBLE ? (m.from + m.to) >> 1 : -1;
    this.half = typeOf(m.piece) === PAWN || m.captured ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.turn = (us ^ 1) as Color;
  }

  unmakeMove() {
    const u = this.stack.pop();
    if (!u) return;
    const { move: m } = u;
    const b = this.board;
    const us = colorOf(m.piece);
    b[m.from] = m.piece;
    b[m.to] = m.flags & FLAG_EP ? 0 : m.captured;
    if (m.flags & FLAG_EP) b[us === WHITE ? m.to - 8 : m.to + 8] = m.captured;
    if (m.flags & FLAG_CASTLE) {
      if (m.to === m.from + 2) {
        b[m.from + 1] = 0;
        b[m.from + 3] = make(ROOK, us);
      } else {
        b[m.from - 1] = 0;
        b[m.from - 4] = make(ROOK, us);
      }
    }
    if (typeOf(m.piece) === KING) this.kings[us] = m.from;
    this.castle = u.castle;
    this.ep = u.ep;
    this.half = u.half;
    if (us === BLACK) this.full--;
    this.turn = us;
  }

  /** Legal moves for the side to move (optionally from one square). */
  moves(from = -1, capturesOnly = false): Move[] {
    const us = this.turn;
    const them = (us ^ 1) as Color;
    const out: Move[] = [];
    for (const m of this.pseudoMoves(capturesOnly)) {
      if (from >= 0 && m.from !== from) continue;
      this.makeMove(m);
      if (!this.isAttacked(this.kings[us], them)) out.push(m);
      this.unmakeMove();
    }
    return out;
  }

  /** Counts leaf positions to a depth: the standard check of a move generator. */
  perft(depth: number): number {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of this.moves()) {
      this.makeMove(m);
      n += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmakeMove();
    }
    return n;
  }

  insufficientMaterial(): boolean {
    const minors: { type: number; square: number }[] = [];
    for (let s = 0; s < 64; s++) {
      const t = typeOf(this.board[s]!);
      if (!t || t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors.push({ type: t, square: s });
    }
    if (minors.length <= 1) return true;
    // Only bishops, all on the same square colour.
    return minors.every((m) => m.type === BISHOP) && new Set(minors.map((m) => (fileOf(m.square) + rankOf(m.square)) % 2)).size === 1;
  }

  outcome(): Outcome {
    if (this.moves().length === 0) return this.inCheck() ? 'checkmate' : 'stalemate';
    if (this.half >= 100) return 'fifty-move';
    if (this.insufficientMaterial()) return 'material';
    const k = this.keys[this.keys.length - 1];
    if (this.keys.filter((x) => x === k).length >= 3) return 'repetition';
    return null;
  }

  /** Standard algebraic notation for a legal move in this position. */
  san(m: Move): string {
    let s: string;
    if (m.flags & FLAG_CASTLE) s = m.to > m.from ? 'O-O' : 'O-O-O';
    else {
      const t = typeOf(m.piece);
      const cap = m.captured ? 'x' : '';
      if (t === PAWN) s = (cap ? 'abcdefgh'[fileOf(m.from)]! + 'x' : '') + squareName(m.to) + (m.promo ? '=' + LETTERS[m.promo]!.toUpperCase() : '');
      else {
        const rivals = this.moves().filter((o) => o.to === m.to && o.piece === m.piece && o.from !== m.from);
        let dis = '';
        if (rivals.length) {
          if (!rivals.some((o) => fileOf(o.from) === fileOf(m.from))) dis = 'abcdefgh'[fileOf(m.from)]!;
          else if (!rivals.some((o) => rankOf(o.from) === rankOf(m.from))) dis = String(rankOf(m.from) + 1);
          else dis = squareName(m.from);
        }
        s = LETTERS[t]!.toUpperCase() + dis + cap + squareName(m.to);
      }
    }
    this.makeMove(m);
    if (this.inCheck()) s += this.moves().length === 0 ? '#' : '+';
    this.unmakeMove();
    return s;
  }

  /** Plays a move in the game (keeps the history for undo and repetition). */
  play(m: Move) {
    this.makeMove(m);
    this.played.push(m);
    this.keys.push(this.key());
  }

  takeBack(): Move | null {
    const m = this.played.pop();
    if (!m) return null;
    this.unmakeMove();
    this.keys.pop();
    return m;
  }

  /** Finds a legal move from SAN or coordinates ("e2e4", "e7e8q"). */
  find(text: string): Move | null {
    const all = this.moves();
    const coord = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
    if (coord) {
      const from = parseSquare(coord[1]!);
      const to = parseSquare(coord[2]!);
      const promo = coord[3] ? LETTERS.indexOf(coord[3]) : 0;
      return all.find((m) => m.from === from && m.to === to && m.promo === (promo || (m.promo ? QUEEN : 0))) ?? null;
    }
    const clean = text.replace(/[+#!?]/g, '');
    return all.find((m) => this.san(m).replace(/[+#]/g, '') === clean) ?? null;
  }
}
