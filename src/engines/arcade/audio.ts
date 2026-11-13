import { readJson, writeJson } from '../core/storage';

/**
 * Tiny Web Audio synth: every sound is an oscillator with a short envelope,
 * so the arcade games ship no audio files. The AudioContext is created on
 * the first sound (always after a tap or key press, as browsers require).
 */
export class Synth {
  private ctx: AudioContext | null = null;
  muted: boolean;

  constructor(private key = 'arcade:muted') {
    this.muted = readJson<boolean>(key, false);
  }

  setMuted(m: boolean) {
    this.muted = m;
    writeJson(this.key, m);
  }

  private context(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx ??= new Ctor();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Plays a tone of `freq` Hz for `ms` milliseconds. */
  tone(freq: number, ms: number, type: OscillatorType = 'sine', volume = 0.18, slideTo?: number) {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + ms / 1000);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  }
}
