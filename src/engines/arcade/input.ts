/**
 * Device-neutral input for the arcade games. The shell turns keys, on-screen
 * buttons, taps, swipes and pointer drags into this one shape; each engine
 * reads only what it needs, so engines stay pure and easy to test.
 */
export type Action = 'left' | 'right' | 'up' | 'down' | 'fire' | 'special';

export interface Input {
  /** Actions held down right now. */
  held: Set<Action>;
  /** Actions newly pressed since the previous step. */
  pressed: Set<Action>;
  /** Pointer (finger or mouse button) position in game units while it is down; or the mouse position when `hover` is true. */
  pointer: { x: number; y: number } | null;
  /** True when `pointer` is a mouse hovering without a button pressed. */
  hover: boolean;
  /** Taps since the previous step. */
  taps: number;
  /** Swipe direction since the previous step. */
  swipe: 'left' | 'right' | 'up' | 'down' | null;
}

export const emptyInput = (): Input => ({ held: new Set(), pressed: new Set(), pointer: null, hover: false, taps: 0, swipe: null });

/** Keyboard keys to actions: arrows and WASD steer, Space fires, H / Shift / X is the special action. */
export const KEY_ACTIONS: Record<string, Action> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ' ': 'fire',
  h: 'special',
  x: 'special',
  Shift: 'special',
};

/** Swipe direction of a drag from (x0, y0) to (x1, y1), in screen pixels, or null for a tap. */
export function swipeOf(x0: number, y0: number, x1: number, y1: number, min = 24): Input['swipe'] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

/** Shared engine contract: the shell drives any game through this. */
export interface ArcadeEngine {
  /** Advance by dt seconds; returns event names for sounds. */
  step(dt: number, input: Input): string[];
  readonly over: boolean;
  readonly score: number;
  /** Extra stats for the toolbar, e.g. lives and level. */
  hud(): { label: string; value: string }[];
  /** Optional line for the game-over panel (e.g. a medal). */
  summary?(): string;
}

/** Wraps a value into [0, max). */
export const wrap = (v: number, max: number) => ((v % max) + max) % max;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
