import { describe, expect, it } from 'vitest';
import { MahjongGame } from '@engines/mahjong/game';
import { LAYOUTS } from '@engines/mahjong/layouts';
import { availableMoves } from '@engines/mahjong/board';

describe('MahjongGame', () => {
  it('starts playing with all tiles present and at least one move', () => {
    const g = new MahjongGame(LAYOUTS.turtle.layout, 'abc');
    const s = g.snapshot();
    expect(s.status).toBe('playing');
    expect(s.remaining).toBe(144);
    expect(availableMoves(g.getTiles()).length).toBeGreaterThan(0);
  });

  it('matches a free pair, counts the move and can undo it', () => {
    const g = new MahjongGame(LAYOUTS.turtle.layout, 'abc');
    const [a, b] = availableMoves(g.getTiles())[0];
    expect(g.select(a.id)).toBe('selected');
    expect(g.select(b.id)).toBe('matched');
    expect(g.snapshot().remaining).toBe(142);
    expect(g.snapshot().moves).toBe(1);
    expect(g.undo()).toBe(true);
    expect(g.snapshot().remaining).toBe(144);
    expect(g.undo()).toBe(false);
  });

  it('refuses blocked tiles and switches selection on mismatch', () => {
    const g = new MahjongGame(LAYOUTS.turtle.layout, 'abc');
    const blocked = g.getTiles().find((t) => !g.isTileFree(t.id))!;
    expect(g.select(blocked.id)).toBe('blocked');
    const free = g.getFreeTiles();
    const a = free[0];
    const b = free.find((t) => t.face.matchKey !== a.face.matchKey)!;
    g.select(a.id);
    expect(g.select(b.id)).toBe('mismatch');
    expect(g.snapshot().selected).toBe(b.id);
  });

  it('hint returns a valid free matching pair', () => {
    const g = new MahjongGame(LAYOUTS.pyramid.layout, 'hint');
    const h = g.hint();
    expect(h).not.toBeNull();
    const [a, b] = h!;
    expect(g.isTileFree(a)).toBe(true);
    expect(g.isTileFree(b)).toBe(true);
    expect(g.getTiles()[a].face.matchKey).toBe(g.getTiles()[b].face.matchKey);
  });

  it('shuffle keeps positions, keeps the face multiset and leaves the board solvable', () => {
    const g = new MahjongGame(LAYOUTS.turtle.layout, 'shuf');
    // Play a few moves first.
    for (let i = 0; i < 5; i++) {
      const [a, b] = availableMoves(g.getTiles())[0];
      g.select(a.id);
      g.select(b.id);
    }
    const before = g.getTiles().filter((t) => !t.removed).map((t) => t.face.id).sort();
    const positions = g.getTiles().map((t) => `${t.x},${t.y},${t.z},${t.removed}`).join('|');
    expect(g.shuffle()).toBe(true);
    const after = g.getTiles().filter((t) => !t.removed).map((t) => t.face.id).sort();
    expect(after).toEqual(before);
    expect(g.getTiles().map((t) => `${t.x},${t.y},${t.z},${t.removed}`).join('|')).toBe(positions);
    expect(g.snapshot().shuffles).toBe(1);
    expect(availableMoves(g.getTiles()).length).toBeGreaterThan(0);
  });

  it('can be played to a win by always taking an available move', () => {
    const g = new MahjongGame(LAYOUTS.pyramid.layout, 'win');
    let guard = 0;
    while (g.snapshot().status === 'playing' && guard++ < 500) {
      const moves = availableMoves(g.getTiles());
      const [a, b] = moves[0];
      g.select(a.id);
      g.select(b.id);
      if (g.snapshot().status === 'stuck') g.shuffle();
    }
    expect(g.snapshot().status).toBe('won');
  });
});
