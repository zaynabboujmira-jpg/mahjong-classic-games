import { ALL, CELLS, PEERS, UNITS, bit, boxOf, colOf, popcount, rowOf } from './grid';

/**
 * A human-style Sudoku solver. It only uses deductions a person can make, in
 * order of difficulty, so it can (1) grade a puzzle by the hardest technique
 * it needs and (2) explain the next step as a hint. When it solves a puzzle
 * completely, that also proves the solution is unique: every step is forced.
 */
export type Technique =
  | 'naked-single'
  | 'hidden-single'
  | 'locked-candidates'
  | 'naked-pair'
  | 'hidden-pair'
  | 'naked-triple'
  | 'hidden-triple'
  | 'x-wing'
  | 'xy-wing'
  | 'swordfish';

/** 1: naked singles · 2: hidden singles · 3: intersections and subsets · 4: fish and wings. */
export const TECHNIQUE_LEVEL: Record<Technique, 1 | 2 | 3 | 4> = {
  'naked-single': 1,
  'hidden-single': 2,
  'locked-candidates': 3,
  'naked-pair': 3,
  'hidden-pair': 3,
  'naked-triple': 3,
  'hidden-triple': 3,
  'x-wing': 4,
  'xy-wing': 4,
  swordfish: 4,
};

export const TECHNIQUE_NAMES: Record<Technique, string> = {
  'naked-single': 'naked single',
  'hidden-single': 'hidden single',
  'locked-candidates': 'locked candidates',
  'naked-pair': 'naked pair',
  'hidden-pair': 'hidden pair',
  'naked-triple': 'naked triple',
  'hidden-triple': 'hidden triple',
  'x-wing': 'X-Wing',
  'xy-wing': 'XY-Wing',
  swordfish: 'Swordfish',
};

export interface Step {
  technique: Technique;
  /** Set for singles: the digit this step places. */
  place?: { cell: number; digit: number; unit?: number };
}

const unitName = (u: number) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);
export { unitName };

/** Calls fn for every 2- or 3-combination of indices below len; stops at the first true. */
function forCombos(len: number, n: 2 | 3, fn: (a: number, b: number, c: number) => boolean): boolean {
  for (let a = 0; a < len; a++)
    for (let b = a + 1; b < len; b++) {
      if (n === 2) {
        if (fn(a, b, -1)) return true;
        continue;
      }
      for (let c = b + 1; c < len; c++) if (fn(a, b, c)) return true;
    }
  return false;
}

export class LogicBoard {
  readonly values: number[];
  readonly cands: Uint16Array;
  /** Set when a cell is left with no candidate: the position is contradictory. */
  broken = false;

  constructor(values: readonly number[]) {
    this.values = values.slice();
    this.cands = new Uint16Array(CELLS);
    for (let i = 0; i < CELLS; i++) {
      if (this.values[i]) continue;
      let used = 0;
      for (const p of PEERS[i]!) if (this.values[p]) used |= bit(this.values[p]!);
      this.cands[i] = ALL & ~used;
    }
  }

  get solved(): boolean {
    return this.values.every((v) => v !== 0);
  }

  place(cell: number, digit: number): void {
    this.values[cell] = digit;
    this.cands[cell] = 0;
    for (const p of PEERS[cell]!) {
      if (!this.values[p]) {
        this.cands[p]! &= ~bit(digit);
        if (!this.cands[p]) this.broken = true;
      }
    }
  }

  /** Removes `mask` from the cells; returns true when anything changed. */
  private eliminate(cells: Iterable<number>, mask: number): boolean {
    let changed = false;
    for (const c of cells) {
      if (this.values[c] || !(this.cands[c]! & mask)) continue;
      this.cands[c]! &= ~mask;
      changed = true;
      if (!this.cands[c]) this.broken = true;
    }
    return changed;
  }

  /** Finds and applies the easiest available step up to `maxLevel`, or returns null. */
  step(maxLevel = 4): Step | null {
    if (this.broken) return null;
    return (
      this.nakedSingle() ??
      (maxLevel >= 2 ? this.hiddenSingle() : null) ??
      (maxLevel >= 3 ? (this.lockedCandidates() ?? this.nakedSubset(2) ?? this.hiddenSubset(2) ?? this.nakedSubset(3) ?? this.hiddenSubset(3)) : null) ??
      (maxLevel >= 4 ? (this.fish(2) ?? this.xyWing() ?? this.fish(3)) : null)
    );
  }

  private nakedSingle(): Step | null {
    for (let i = 0; i < CELLS; i++) {
      const m = this.cands[i]!;
      if (!this.values[i] && m && (m & (m - 1)) === 0) {
        const digit = 31 - Math.clz32(m) + 1;
        this.place(i, digit);
        return { technique: 'naked-single', place: { cell: i, digit } };
      }
    }
    return null;
  }

  private hiddenSingle(): Step | null {
    // Boxes first: that is where people look for hidden singles.
    for (const u of [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
      const cells = UNITS[u]!;
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        let at = -1;
        let n = 0;
        for (const c of cells) {
          if (this.values[c] === d) {
            n = -1;
            break;
          }
          if (!this.values[c] && this.cands[c]! & b) {
            n++;
            at = c;
          }
        }
        if (n === 1) {
          this.place(at, d);
          return { technique: 'hidden-single', place: { cell: at, digit: d, unit: u } };
        }
      }
    }
    return null;
  }

  /** Places every naked single, repeatedly. Returns how many were placed. */
  nakedSingles(): number {
    let placed = 0;
    for (let again = true; again && !this.broken; ) {
      again = false;
      for (let i = 0; i < CELLS; i++) {
        const m = this.cands[i]!;
        if (!this.values[i] && m && (m & (m - 1)) === 0) {
          this.place(i, 31 - Math.clz32(m) + 1);
          placed++;
          again = true;
        }
      }
    }
    return placed;
  }

  /** Places every hidden single found in one sweep. Returns how many were placed. */
  hiddenSingles(): number {
    let placed = 0;
    for (const cells of UNITS) {
      let once = 0;
      let twice = 0;
      let done = 0;
      for (const c of cells) {
        const v = this.values[c]!;
        if (v) done |= bit(v);
        else {
          const m = this.cands[c]!;
          twice |= once & m;
          once |= m;
        }
      }
      const single = once & ~twice & ~done;
      if (!single) continue;
      for (const c of cells) {
        const m = this.cands[c]! & single;
        if (!this.values[c] && m && (m & (m - 1)) === 0) {
          this.place(c, 31 - Math.clz32(m) + 1);
          placed++;
        }
      }
    }
    return placed;
  }

  /** Pointing (box → line) and claiming (line → box), with one mask per box-line segment. */
  private lockedCandidates(): Step | null {
    const seg = (r: number, c0: number) => {
      let m = 0;
      for (let k = 0; k < 3; k++) {
        const i = r * 9 + c0 + k;
        if (!this.values[i]) m |= this.cands[i]!;
      }
      return m;
    };
    const segCol = (c: number, r0: number) => {
      let m = 0;
      for (let k = 0; k < 3; k++) {
        const i = (r0 + k) * 9 + c;
        if (!this.values[i]) m |= this.cands[i]!;
      }
      return m;
    };
    for (let bx = 0; bx < 9; bx++) {
      const r0 = Math.floor(bx / 3) * 3;
      const c0 = (bx % 3) * 3;
      const rows = [seg(r0, c0), seg(r0 + 1, c0), seg(r0 + 2, c0)];
      const cols = [segCol(c0, r0), segCol(c0 + 1, r0), segCol(c0 + 2, r0)];
      for (let k = 0; k < 3; k++) {
        // Pointing: digits of this box confined to one of its rows / columns.
        const rowOnly = rows[k]! & ~rows[(k + 1) % 3]! & ~rows[(k + 2) % 3]!;
        if (rowOnly && this.eliminate(UNITS[r0 + k]!.filter((x) => boxOf(x) !== bx), rowOnly)) return { technique: 'locked-candidates' };
        const colOnly = cols[k]! & ~cols[(k + 1) % 3]! & ~cols[(k + 2) % 3]!;
        if (colOnly && this.eliminate(UNITS[9 + c0 + k]!.filter((x) => boxOf(x) !== bx), colOnly)) return { technique: 'locked-candidates' };
      }
    }
    for (let line = 0; line < 9; line++) {
      // Claiming: digits of a row / column confined to one box.
      const rs = [seg(line, 0), seg(line, 3), seg(line, 6)];
      const cs = [segCol(line, 0), segCol(line, 3), segCol(line, 6)];
      for (let k = 0; k < 3; k++) {
        const rowClaim = rs[k]! & ~rs[(k + 1) % 3]! & ~rs[(k + 2) % 3]!;
        const bxR = Math.floor(line / 3) * 3 + k;
        if (rowClaim && this.eliminate(UNITS[18 + bxR]!.filter((x) => rowOf(x) !== line), rowClaim)) return { technique: 'locked-candidates' };
        const colClaim = cs[k]! & ~cs[(k + 1) % 3]! & ~cs[(k + 2) % 3]!;
        const bxC = k * 3 + Math.floor(line / 3);
        if (colClaim && this.eliminate(UNITS[18 + bxC]!.filter((x) => colOf(x) !== line), colClaim)) return { technique: 'locked-candidates' };
      }
    }
    return null;
  }

  /** Naked pairs/triples: n cells of a unit whose candidates together are only n digits. */
  private nakedSubset(n: 2 | 3): Step | null {
    const cells = new Int32Array(9);
    for (const unit of UNITS) {
      let k = 0;
      let open = 0;
      for (const c of unit) {
        if (this.values[c]) continue;
        open++;
        if (popcount(this.cands[c]!) <= n) cells[k++] = c;
      }
      if (k < n || open <= n) continue;
      const found = forCombos(k, n, (a, b, c) => {
        const group = n === 2 ? [cells[a]!, cells[b]!] : [cells[a]!, cells[b]!, cells[c]!];
        let union = 0;
        for (const x of group) union |= this.cands[x]!;
        return popcount(union) === n && this.eliminate(unit.filter((x) => !group.includes(x)), union);
      });
      if (found) return { technique: n === 2 ? 'naked-pair' : 'naked-triple' };
    }
    return null;
  }

  /** Hidden pairs/triples: n digits of a unit that fit in only the same n cells. */
  private hiddenSubset(n: 2 | 3): Step | null {
    const digits = new Int32Array(9);
    const where = new Int32Array(10);
    for (const unit of UNITS) {
      where.fill(0);
      let open = 0;
      for (let k = 0; k < 9; k++) {
        const c = unit[k]!;
        if (this.values[c]) continue;
        open++;
        for (let m = this.cands[c]!; m; m &= m - 1) where[31 - Math.clz32(m & -m) + 1]! |= 1 << k;
      }
      if (open <= n) continue;
      let nd = 0;
      for (let d = 1; d <= 9; d++) {
        const k = popcount(where[d]!);
        if (k >= 2 && k <= n) digits[nd++] = d;
      }
      const found = forCombos(nd, n, (a, b, c) => {
        const ds = n === 2 ? [digits[a]!, digits[b]!] : [digits[a]!, digits[b]!, digits[c]!];
        let pos = 0;
        let mask = 0;
        for (const d of ds) {
          pos |= where[d]!;
          mask |= bit(d);
        }
        if (popcount(pos) !== n) return false;
        let changed = false;
        for (let k = 0; k < 9; k++) {
          const x = unit[k]!;
          if (pos & (1 << k) && this.cands[x]! & ~mask) {
            this.cands[x]! &= mask;
            changed = true;
          }
        }
        return changed;
      });
      if (found) return { technique: n === 2 ? 'hidden-pair' : 'hidden-triple' };
    }
    return null;
  }

  /** X-Wing (n = 2) and Swordfish (n = 3), on rows and on columns. */
  private fish(n: 2 | 3): Step | null {
    const lines = new Int32Array(9);
    const masks = new Int32Array(9);
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (const byRow of [true, false]) {
        let nl = 0;
        for (let l = 0; l < 9; l++) {
          let mask = 0;
          for (let k = 0; k < 9; k++) {
            const c = byRow ? l * 9 + k : k * 9 + l;
            if (!this.values[c] && this.cands[c]! & b) mask |= 1 << k;
          }
          const k = popcount(mask);
          if (k >= 2 && k <= n) {
            lines[nl] = l;
            masks[nl++] = mask;
          }
        }
        const found = forCombos(nl, n, (a, bb, c) => {
          const cover = masks[a]! | masks[bb]! | (n === 3 ? masks[c]! : 0);
          if (popcount(cover) !== n) return false;
          const inGroup = (1 << lines[a]!) | (1 << lines[bb]!) | (n === 3 ? 1 << lines[c]! : 0);
          const targets: number[] = [];
          for (let k = 0; k < 9; k++) {
            if (!(cover & (1 << k))) continue;
            for (let l = 0; l < 9; l++) if (!(inGroup & (1 << l))) targets.push(byRow ? l * 9 + k : k * 9 + l);
          }
          return this.eliminate(targets, b);
        });
        if (found) return { technique: n === 2 ? 'x-wing' : 'swordfish' };
      }
    }
    return null;
  }

  private xyWing(): Step | null {
    const pairs: number[] = [];
    for (let i = 0; i < CELLS; i++) if (!this.values[i] && popcount(this.cands[i]!) === 2) pairs.push(i);
    for (const pivot of pairs) {
      const pm = this.cands[pivot]!;
      const wings = PEERS[pivot]!.filter((p) => !this.values[p] && popcount(this.cands[p]!) === 2 && popcount(this.cands[p]! & pm) === 1);
      for (let a = 0; a < wings.length; a++) {
        for (let b = a + 1; b < wings.length; b++) {
          const x = wings[a]!;
          const y = wings[b]!;
          const mx = this.cands[x]!;
          const my = this.cands[y]!;
          const z = mx & my & ~pm;
          if (!z || popcount(z) !== 1 || (mx & pm) === (my & pm)) continue;
          const seen = PEERS[x]!.filter((c) => c !== pivot && c !== y && PEERS[y]!.includes(c));
          if (this.eliminate(seen, z)) return { technique: 'xy-wing' };
        }
      }
    }
    return null;
  }
}

export interface Grade {
  /** Hardest technique level used (1-4), or 5 when logic alone cannot finish. */
  level: number;
  solved: boolean;
  techniques: Partial<Record<Technique, number>>;
}

/** Solves with techniques up to `maxLevel` and reports the hardest one needed. */
export function grade(puzzle: readonly number[], maxLevel = 4): Grade {
  const board = new LogicBoard(puzzle);
  const techniques: Grade['techniques'] = {};
  let level = 1;
  // Singles are applied in batches (same result as one at a time, since a
  // harder technique is only tried once no single of any kind is left).
  for (;;) {
    if (board.broken) return { level: 5, solved: false, techniques };
    if (board.solved) return { level, solved: true, techniques };
    if (board.nakedSingles()) continue;
    if (maxLevel >= 2) {
      const n = board.hiddenSingles();
      if (n) {
        techniques['hidden-single'] = (techniques['hidden-single'] ?? 0) + n;
        level = Math.max(level, 2);
        continue;
      }
    }
    const s = board.step(maxLevel);
    if (!s) return { level: 5, solved: false, techniques };
    techniques[s.technique] = (techniques[s.technique] ?? 0) + 1;
    level = Math.max(level, TECHNIQUE_LEVEL[s.technique]);
  }
}

/**
 * The next placement a player can deduce from `values`, plus the hardest
 * technique needed to reach it (eliminations may come first).
 */
export function nextPlacement(values: readonly number[]): { cell: number; digit: number; technique: Technique; unit?: number } | null {
  const board = new LogicBoard(values);
  let hardest: Technique = 'naked-single';
  for (let guard = 0; guard < 500; guard++) {
    const s = board.step(4);
    if (!s) return null;
    if (TECHNIQUE_LEVEL[s.technique] > TECHNIQUE_LEVEL[hardest]) hardest = s.technique;
    if (s.place) {
      const technique = TECHNIQUE_LEVEL[hardest] > TECHNIQUE_LEVEL[s.technique] ? hardest : s.technique;
      return { ...s.place, technique };
    }
  }
  return null;
}
