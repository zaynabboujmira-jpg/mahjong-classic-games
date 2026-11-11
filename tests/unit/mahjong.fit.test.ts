import { describe, expect, it } from 'vitest';
import { boundsOf } from '../../src/engines/mahjong/board';
import { MIN_TILE, fitBoard, projectSlot } from '../../src/engines/mahjong/fit';
import { LAYOUTS } from '../../src/engines/mahjong/layouts';

const PHONES = [
  { name: 'iPhone SE', w: 375, h: 667 },
  { name: 'iPhone 15', w: 393, h: 852 },
  { name: 'Pixel 8', w: 412, h: 915 },
];

describe('fitBoard', () => {
  for (const layout of LAYOUTS) {
    const b = boundsOf(layout.slots);

    for (const phone of PHONES) {
      it(`${layout.name} on ${phone.name}: tiles >= ${MIN_TILE}px and no horizontal overflow`, () => {
        // The board area is roughly the viewport minus header and toolbar.
        const fit = fitBoard(b, phone.w, phone.h - 140);
        expect(fit.tileSize).toBeGreaterThanOrEqual(MIN_TILE);
        expect(fit.boardW).toBeLessThanOrEqual(phone.w + 0.01);
      });
    }

    it(`${layout.name} on desktop stays unrotated and fits entirely`, () => {
      const fit = fitBoard(b, 1200, 700);
      expect(fit.rotated).toBe(false);
      expect(fit.boardW).toBeLessThanOrEqual(1200);
      expect(fit.boardH).toBeLessThanOrEqual(700);
    });

    it(`${layout.name}: every projected tile lies inside the board`, () => {
      for (const [w, h] of [[1200, 700], [375, 600]] as const) {
        const fit = fitBoard(b, w, h);
        for (const s of layout.slots) {
          const r = projectSlot(s, b, fit);
          expect(r.x - fit.depth).toBeGreaterThanOrEqual(-0.01);
          expect(r.y).toBeGreaterThanOrEqual(-0.01);
          expect(r.x + r.w).toBeLessThanOrEqual(fit.boardW + 0.01);
          expect(r.y + r.h + fit.depth).toBeLessThanOrEqual(fit.boardH + 0.01);
        }
      }
    });
  }

  it('rotates on a portrait phone when that gives bigger tiles', () => {
    const turtle = LAYOUTS.find((l) => l.id === 'turtle')!;
    expect(fitBoard(boundsOf(turtle.slots), 375, 600).rotated).toBe(true);
  });

  it('never overflows horizontally even on a 320px screen', () => {
    for (const layout of LAYOUTS) {
      const fit = fitBoard(boundsOf(layout.slots), 320, 500);
      expect(fit.boardW).toBeLessThanOrEqual(320.01);
    }
  });
});
