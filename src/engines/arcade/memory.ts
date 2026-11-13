import { createRng, randomInt, type Rng } from '../core/rng';

export type MemoryMode = 'classic' | 'strict' | 'speed';
export const MEMORY_MODES: readonly MemoryMode[] = ['classic', 'strict', 'speed'];

/** Classic allows a few mistakes (the sequence replays); strict and speed end on the first one. */
export const LIVES: Record<MemoryMode, number> = { classic: 3, strict: 1, speed: 1 };

/** One note per pad: a C major arpeggio, low to high. */
export const PAD_TONES = [261.63, 329.63, 392.0, 523.25];

export type InputResult = 'ok' | 'round' | 'retry' | 'over';

/**
 * Memory sequence game: the board plays a growing sequence of the four pads
 * and the player repeats it. The engine is timing-free; the UI asks it how
 * fast to play back and feeds it the player's presses.
 */
export class MemoryGame {
  readonly mode: MemoryMode;
  readonly sequence: number[] = [];
  /** Position the player has reached in the current sequence. */
  pos = 0;
  lives: number;
  status: 'showing' | 'input' | 'over' = 'showing';
  private rng: Rng;

  constructor(mode: MemoryMode, seed: string | Rng) {
    this.mode = mode;
    this.lives = LIVES[mode];
    this.rng = typeof seed === 'string' ? createRng(`memory:${seed}`) : seed;
    this.extend();
  }

  /** Rounds completed so far (the score). */
  get score() {
    return this.sequence.length - 1;
  }

  private extend() {
    this.sequence.push(randomInt(this.rng, 4));
    this.pos = 0;
    this.status = 'showing';
  }

  /** The UI finished playing the sequence back: the player's turn. */
  shown() {
    if (this.status === 'showing') {
      this.status = 'input';
      this.pos = 0;
    }
  }

  /** Milliseconds per note during playback (speed mode gets faster every round). */
  stepMs(): number {
    const n = this.sequence.length;
    if (this.mode === 'speed') return Math.max(170, 520 - n * 28);
    return n < 6 ? 560 : n < 12 ? 480 : 420;
  }

  /** A pad press. 'round' = sequence completed (a longer one follows), 'retry' = mistake, replay. */
  input(pad: number): InputResult {
    if (this.status !== 'input') return 'ok';
    if (pad !== this.sequence[this.pos]) {
      this.lives--;
      if (this.lives <= 0) {
        this.status = 'over';
        return 'over';
      }
      this.pos = 0;
      this.status = 'showing';
      return 'retry';
    }
    this.pos++;
    if (this.pos < this.sequence.length) return 'ok';
    this.extend();
    return 'round';
  }
}
