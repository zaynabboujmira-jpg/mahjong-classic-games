import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { Synth } from '../../engines/arcade/audio';
import { LIVES, MEMORY_MODES, MemoryGame, PAD_TONES, type MemoryMode } from '../../engines/arcade/memory';

const PADS = [
  { name: 'Teal', color: '#0f9b8e', lit: '#5eead4', key: '1 ↑' },
  { name: 'Rose', color: '#c0264d', lit: '#fb7185', key: '2 →' },
  { name: 'Amber', color: '#c77c0a', lit: '#fcd34d', key: '3 ←' },
  { name: 'Indigo', color: '#4338ca', lit: '#a5b4fc', key: '4 ↓' },
];
const KEYS: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, ArrowUp: 0, ArrowRight: 1, ArrowLeft: 2, ArrowDown: 3 };
const MODE_NAMES: Record<MemoryMode, string> = { classic: 'Classic', strict: 'Strict', speed: 'Speed' };

export default function ColorMemoryGame() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<MemoryGame | null>(null);
  const synth = useRef(new Synth());
  const lit = useRef(-1);
  const timers = useRef<number[]>([]);
  const size = useRef(0);

  const [mode, setMode] = useState<MemoryMode>('classic');
  const [status, setStatus] = useState<'idle' | 'showing' | 'input' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState('Press Start, watch the pads light up, then repeat the sequence.');
  const [announce, setAnnounce] = useState('');

  const bestKey = (m: MemoryMode) => `memory:best:${m}`;

  const draw = () => {
    const c = canvasRef.current;
    const box = boxRef.current;
    if (!c || !box) return;
    const s = Math.floor(Math.min(box.clientWidth, box.clientHeight, 520));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (s !== size.current) {
      size.current = s;
      c.width = Math.round(s * dpr);
      c.height = Math.round(s * dpr);
      c.style.width = `${s}px`;
      c.style.height = `${s}px`;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);
    const gap = s * 0.04;
    const pad = (s - gap) / 2;
    PADS.forEach((p, i) => {
      const x = (i % 2) * (pad + gap);
      const y = Math.floor(i / 2) * (pad + gap);
      const on = lit.current === i;
      ctx.beginPath();
      ctx.roundRect(x, y, pad, pad, pad * 0.16);
      ctx.fillStyle = on ? p.lit : p.color;
      ctx.shadowColor = on ? p.lit : 'transparent';
      ctx.shadowBlur = on ? pad * 0.25 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = on ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.75)';
      ctx.font = `700 ${Math.max(12, pad * 0.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.key, x + pad / 2, y + pad / 2);
    });
  };

  const light = (i: number, ms: number) => {
    lit.current = i;
    draw();
    synth.current.tone(PAD_TONES[i]!, ms, 'triangle', 0.22);
    timers.current.push(
      window.setTimeout(() => {
        if (lit.current === i) lit.current = -1;
        draw();
      }, ms),
    );
  };

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  /** Plays the whole sequence back, then hands over to the player. */
  const playback = (delay = 500) => {
    const g = game.current!;
    clearTimers();
    setStatus('showing');
    setMessage(`Watch: ${g.sequence.length} ${g.sequence.length === 1 ? 'light' : 'lights'}.`);
    const step = g.stepMs();
    g.sequence.forEach((pad, k) => {
      timers.current.push(window.setTimeout(() => light(pad, step * 0.62), delay + k * step));
    });
    timers.current.push(
      window.setTimeout(() => {
        g.shown();
        setStatus('input');
        setMessage('Your turn: repeat the sequence.');
        setAnnounce(`Your turn. Repeat ${g.sequence.length} ${g.sequence.length === 1 ? 'light' : 'lights'}.`);
      }, delay + g.sequence.length * step),
    );
    setAnnounce(`Sequence: ${g.sequence.map((p) => PADS[p]!.name).join(', ')}.`);
  };

  const start = (m = mode) => {
    clearTimers();
    game.current = new MemoryGame(m, randomSeed());
    setMode(m);
    setScore(0);
    setLives(LIVES[m]);
    setBest(readJson<number>(bestKey(m), 0));
    writeJson('memory:mode', m);
    playback(600);
  };

  const press = (pad: number) => {
    const g = game.current;
    if (!g || g.status !== 'input') return;
    const res = g.input(pad);
    if (res === 'ok' || res === 'round') light(pad, 220);
    setScore(g.score);
    setLives(g.lives);
    if (res === 'round') {
      setMessage(`Round ${g.score} cleared!`);
      setAnnounce(`Correct. Score ${g.score}.`);
      if (g.score > readJson<number>(bestKey(g.mode), 0)) {
        writeJson(bestKey(g.mode), g.score);
        setBest(g.score);
      }
      setStatus('showing');
      timers.current.push(window.setTimeout(() => playback(0), 700));
    } else if (res === 'retry') {
      synth.current.tone(110, 380, 'sawtooth', 0.16);
      setMessage(`Not quite. ${g.lives} ${g.lives === 1 ? 'life' : 'lives'} left: watch again.`);
      setAnnounce(`Wrong pad. ${g.lives} lives left. Watch again.`);
      setStatus('showing');
      timers.current.push(window.setTimeout(() => playback(0), 900));
    } else if (res === 'over') {
      synth.current.tone(140, 600, 'sawtooth', 0.18, 70);
      setStatus('over');
      setMessage(`Game over. You remembered ${g.score} ${g.score === 1 ? 'round' : 'rounds'}.`);
      setAnnounce(`Game over. Score ${g.score}.`);
    }
  };

  useEffect(() => {
    const m = readJson<MemoryMode>('memory:mode', 'classic');
    if (MEMORY_MODES.includes(m)) setMode(m);
    setBest(readJson<number>(bestKey(MEMORY_MODES.includes(m) ? m : 'classic'), 0));
    setMuted(synth.current.muted);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(boxRef.current!);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && t.tagName === 'INPUT')) return;
      if (e.key in KEYS) {
        e.preventDefault();
        press(KEYS[e.key]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      clearTimers();
    };
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    const c = canvasRef.current!;
    const b = c.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    press((y < 0.5 ? 0 : 2) + (x < 0.5 ? 0 : 1));
  };

  return (
    <section class="game" aria-label="Color Memory">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          {status === 'idle' ? 'Start' : 'Restart'}
        </button>
        <div class="segmented" role="radiogroup" aria-label="Mode">
          {MEMORY_MODES.map((m) => (
            <button key={m} type="button" role="radio" class="seg" aria-checked={mode === m} onClick={() => start(m)}>
              {MODE_NAMES[m]}
            </button>
          ))}
        </div>
        <button
          type="button"
          class="btn"
          aria-pressed={!muted}
          onClick={() => {
            synth.current.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          Sound {muted ? 'off' : 'on'}
        </button>
        <dl class="stats">
          <div>
            <dt>Score</dt>
            <dd class="tabular-nums">{score}</dd>
          </div>
          <div>
            <dt>Lives</dt>
            <dd class="tabular-nums">{status === 'idle' ? LIVES[mode] : lives}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd class="tabular-nums">{best}</dd>
          </div>
        </dl>
      </div>
      <div class="arcade-area">
        <p class="arcade-message" aria-hidden="true">
          {message}
        </p>
        <div ref={boxRef} class="arcade-fit">
          <canvas
            ref={canvasRef}
            class="board"
            tabIndex={0}
            role="application"
            aria-roledescription="Memory pads"
            aria-label="Four coloured pads: Teal, Rose, Amber and Indigo. Press 1 to 4 or the arrow keys (up, right, left, down) to press a pad."
            onPointerDown={onPointerDown}
          />
        </div>
        {status === 'over' && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="mem-over">
            <div class="panel">
              <h2 id="mem-over">Game over</h2>
              <p>
                {MODE_NAMES[mode]} · <strong>{score}</strong> {score === 1 ? 'round' : 'rounds'} · Best {best}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start()}>
                  Play again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Color Memory needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
