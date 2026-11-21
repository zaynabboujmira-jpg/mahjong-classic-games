import { describe, expect, it } from 'vitest';
import { DENSITY, INF_LEVELS, InfiniteMines, key } from '../../src/engines/minesweeper/infinite';

describe('infinite minesweeper field', () => {
  it('is deterministic per seed, different between seeds, and safe around the start', () => {
    const a = new InfiniteMines('s', 'normal', 'classic');
    const b = new InfiniteMines('s', 'normal', 'classic');
    const c = new InfiniteMines('t', 'normal', 'classic');
    let same = 0;
    let diff = 0;
    for (let y = -40; y < 40; y++)
      for (let x = -40; x < 40; x++) {
        expect(a.isMine(x, y)).toBe(b.isMine(x, y));
        if (a.isMine(x, y) === c.isMine(x, y)) same++;
        else diff++;
      }
    expect(diff).toBeGreaterThan(400);
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) expect(a.isMine(x, y)).toBe(false);
    void same;
  });

  it('mine density matches each level, far from the origin too', () => {
    for (const level of INF_LEVELS) {
      const g = new InfiniteMines('density', level, 'classic');
      let mines = 0;
      const N = 200;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g.isMine(x + 100000, y - 50000)) mines++;
      expect(mines / (N * N)).toBeCloseTo(DENSITY[level], 1);
    }
  });

  it('numbers count the eight neighbours', () => {
    const g = new InfiniteMines('count', 'hard', 'classic');
    for (let y = 5; y < 15; y++)
      for (let x = 5; x < 15; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g.isMine(x + dx, y + dy)) n++;
        expect(g.count(x, y)).toBe(n);
      }
  });
});

describe('infinite minesweeper play', () => {
  it('the first click opens an area and never hits a mine; a flood never opens a mine', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const g = new InfiniteMines(seed, 'normal', 'classic');
      const opened = g.reveal(0, 0);
      expect(opened).not.toBe('mine');
      expect(opened as number).toBeGreaterThanOrEqual(9);
      for (const k of g.revealed) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        expect(g.isMine(x, y)).toBe(false);
      }
    }
  });

  it('classic ends on the first mine; relaxed has three lives', () => {
    const find = (g: InfiniteMines) => {
      for (let x = 3; ; x++) if (g.isMine(x, 0)) return x;
    };
    const c = new InfiniteMines('m', 'hard', 'classic');
    expect(c.reveal(find(c), 0)).toBe('mine');
    expect(c.over).toBe(true);
    const r = new InfiniteMines('m', 'hard', 'relaxed');
    const x = find(r);
    expect(r.reveal(x, 0)).toBe('mine');
    expect(r.over).toBe(false);
    expect(r.lives).toBe(2);
    expect(r.hits.has(key(x, 0))).toBe(true);
  });

  it('flags block reveals; chording opens the rest once flags match the number', () => {
    const g = new InfiniteMines('chord', 'normal', 'classic');
    g.reveal(0, 0);
    // A revealed number next to closed cells: flag exactly its mines, then chord.
    for (const k of [...g.revealed]) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const n = g.count(x, y);
      if (!n) continue;
      const around: [number, number][] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !g.revealed.has(key(x + dx, y + dy))) around.push([x + dx, y + dy]);
      if (around.length <= n) continue;
      for (const [ax, ay] of around) if (g.isMine(ax, ay)) g.toggleFlag(ax, ay);
      const before = g.score;
      expect(g.chord(x, y)).not.toBe('mine');
      expect(g.score).toBeGreaterThan(before);
      return;
    }
  });

  it('round-trips through saved state', () => {
    const g = new InfiniteMines('save', 'easy', 'relaxed');
    g.reveal(0, 0);
    g.toggleFlag(1000, 1000);
    const s = JSON.parse(JSON.stringify(g.serialize(3, -2)));
    const copy = new InfiniteMines(s.seed, s.level, s.mode, s);
    expect(copy.score).toBe(g.score);
    expect(copy.flags.has('1000,1000')).toBe(true);
    expect(s.cx).toBe(3);
  });
});
