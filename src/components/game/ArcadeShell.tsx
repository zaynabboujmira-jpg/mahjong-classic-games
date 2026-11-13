import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { Synth } from '../../engines/arcade/audio';
import { KEY_ACTIONS, emptyInput, swipeOf, type Action, type ArcadeEngine, type Input } from '../../engines/arcade/input';

export interface ArcadeButton {
  action: Action;
  label: string;
  aria: string;
}

export interface ArcadeShellProps<G extends ArcadeEngine> {
  name: string;
  storageKey: string;
  /** Logical game size; the canvas scales it to fit, keeping the aspect ratio. */
  width: number;
  height: number;
  create: (seed: string) => G;
  /** Draws the game in logical units (the context is already scaled). */
  draw: (ctx: CanvasRenderingContext2D, game: G, time: number) => void;
  sounds?: Record<string, (s: Synth) => void>;
  /** On-screen buttons, shown under the game on touch screens. */
  buttons?: ArcadeButton[];
  /** One sentence on how to play, for the start panel and screen readers. */
  help: string;
}

type Status = 'ready' | 'playing' | 'paused' | 'over';

/**
 * The shared arcade frame: one requestAnimationFrame loop at the screen's
 * refresh rate, keyboard / touch / mouse input turned into an `Input`,
 * on-screen buttons, sound, pause on tab switch, best score, and the
 * start, pause and game-over panels. Each game supplies only its engine and
 * a draw function.
 */
export default function ArcadeShell<G extends ArcadeEngine>(props: ArcadeShellProps<G>) {
  const { name, storageKey, width, height, create, draw, sounds = {}, buttons = [], help } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<G>(create('preview'));
  const input = useRef<Input>(emptyInput());
  const status = useRef<Status>('ready');
  const scale = useRef(1);
  const synth = useRef(new Synth());
  const raf = useRef(0);
  const last = useRef(0);
  const overAt = useRef(0);
  const down = useRef(new Map<number, { x: number; y: number; moved: boolean }>());
  const hudAt = useRef(0);

  const [view, setView] = useState<Status>('ready');
  const [, setTick] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [touch, setTouch] = useState(false);
  const [announce, setAnnounce] = useState('');

  const bestKey = `${storageKey}:best`;
  const setStatus = (s: Status) => {
    status.current = s;
    setView(s);
  };

  const fit = () => {
    const box = boxRef.current;
    const c = canvasRef.current;
    if (!box || !c) return;
    const s = Math.min(box.clientWidth / width, box.clientHeight / height);
    if (!(s > 0)) return;
    scale.current = s;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.floor(width * s);
    const h = Math.floor(height * s);
    if (c.style.width !== `${w}px` || c.style.height !== `${h}px`) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    render(performance.now());
  };

  const render = (t: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const k = c.width / width;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    draw(ctx, game.current, t / 1000);
  };

  const begin = () => {
    game.current = create(randomSeed());
    input.current = emptyInput();
    setStatus('playing');
    setAnnounce(`${name} started. ${help}`);
  };

  /** Any key, tap or button starts a waiting game; after game over it restarts once the panel has been seen. */
  const wake = () => {
    if (status.current === 'ready') {
      const pending = input.current;
      begin();
      input.current = pending;
      return true;
    }
    if (status.current === 'over' && performance.now() - overAt.current > 600) {
      begin();
      return true;
    }
    return false;
  };

  const tick = (t: number) => {
    const dt = last.current ? Math.min(0.05, (t - last.current) / 1000) : 0;
    last.current = t;
    const g = game.current;
    if (status.current === 'playing' && dt > 0) {
      const events = g.step(dt, input.current);
      const inp = input.current;
      inp.pressed = new Set();
      inp.taps = 0;
      inp.swipe = null;
      for (const e of events) sounds[e]?.(synth.current);
      if (g.over) {
        setStatus('over');
        overAt.current = t;
        const prev = readJson<number>(bestKey, 0);
        if (g.score > prev) {
          writeJson(bestKey, g.score);
          setBest(g.score);
        }
        setAnnounce(`Game over. Score ${g.score}.${g.summary ? ` ${g.summary()}` : ''}`);
      }
      if (t - hudAt.current > 120) {
        hudAt.current = t;
        setTick((n) => n + 1);
      }
    }
    render(t);
    raf.current = requestAnimationFrame(tick);
  };

  const togglePause = () => {
    if (status.current === 'playing') setStatus('paused');
    else if (status.current === 'paused') {
      last.current = 0;
      setStatus('playing');
    }
  };

  // ----- input
  const press = (a: Action) => {
    const inp = input.current;
    if (!inp.held.has(a)) inp.pressed.add(a);
    inp.held.add(a);
  };
  const release = (a: Action) => input.current.held.delete(a);

  const toGame = (e: PointerEvent) => {
    const b = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - b.left) / scale.current, y: (e.clientY - b.top) / scale.current };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') setTouch(true);
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    down.current.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false });
    input.current.pointer = toGame(e);
    input.current.hover = false;
    wake();
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = down.current.get(e.pointerId);
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) d.moved = true;
    if (d || e.pointerType === 'mouse') {
      input.current.pointer = toGame(e);
      input.current.hover = !d;
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = down.current.get(e.pointerId);
    down.current.delete(e.pointerId);
    if (!d) return;
    const swipe = swipeOf(d.x, d.y, e.clientX, e.clientY);
    if (swipe) input.current.swipe = swipe;
    else if (!d.moved) input.current.taps++;
    if (e.pointerType === 'mouse') input.current.hover = true;
    else if (!down.current.size) input.current.pointer = null;
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !down.current.size) input.current.pointer = null;
  };

  useEffect(() => {
    setBest(readJson<number>(bestKey, 0));
    setMuted(synth.current.muted);
    setTouch(matchMedia('(pointer: coarse)').matches);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(boxRef.current!);
    raf.current = requestAnimationFrame(tick);
    const keyName = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const k = keyName(e);
      if (k === 'p' || k === 'Escape') {
        togglePause();
        return;
      }
      const a = KEY_ACTIONS[k];
      if (!a && k !== 'Enter') return;
      // Let Space and Enter activate a focused button instead of playing.
      if (t && t.tagName === 'BUTTON' && (k === ' ' || k === 'Enter')) return;
      if (status.current !== 'paused') e.preventDefault();
      if (a) press(a);
      if (!e.repeat) wake();
    };
    const onUp = (e: KeyboardEvent) => {
      const a = KEY_ACTIONS[keyName(e)];
      if (a) release(a);
    };
    const onVis = () => {
      if (document.hidden && status.current === 'playing') setStatus('paused');
      last.current = 0;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const g = game.current;
  const summary = view === 'over' && g.summary ? g.summary() : '';

  return (
    <section class="game" aria-label={name}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={begin}>
          {view === 'ready' ? 'Start' : 'New game'}
        </button>
        <button type="button" class="btn" onClick={togglePause} disabled={view !== 'playing' && view !== 'paused'} aria-pressed={view === 'paused'}>
          {view === 'paused' ? 'Resume' : 'Pause'}
        </button>
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
            <dd class="tabular-nums">{g.score}</dd>
          </div>
          {g.hud().map((h) => (
            <div key={h.label}>
              <dt>{h.label}</dt>
              <dd class="tabular-nums">{h.value}</dd>
            </div>
          ))}
          <div>
            <dt>Best</dt>
            <dd class="tabular-nums">{Math.max(best, view === 'over' ? g.score : 0)}</dd>
          </div>
        </dl>
      </div>
      <div class="arcade-area">
        <div ref={boxRef} class="arcade-fit">
          <canvas
            ref={canvasRef}
            class="board arcade-canvas"
            tabIndex={0}
            role="application"
            aria-roledescription={`${name} game`}
            aria-label={`${name}. ${help} P pauses.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        {touch && buttons.length > 0 && (
          <div class="arcade-pad" role="group" aria-label="Touch controls">
            {buttons.map((b) => (
              <button
                key={b.action}
                type="button"
                class={`arcade-btn arcade-btn-${b.action}`}
                aria-label={b.aria}
                onPointerDown={(e) => {
                  e.preventDefault();
                  press(b.action);
                  wake();
                }}
                onPointerUp={() => release(b.action)}
                onPointerCancel={() => release(b.action)}
                onPointerLeave={() => release(b.action)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
        {view !== 'playing' && (
          <div
            class="overlay overlay-soft"
            role="dialog"
            aria-labelledby={`${storageKey}-panel`}
            onPointerDown={(e) => {
              // Tapping the dimmed game (not the panel) starts or resumes too.
              if (e.target !== e.currentTarget) return;
              if (status.current === 'paused') togglePause();
              else wake() || (status.current === 'over' && begin());
            }}
          >
            <div class="panel">
              <h2 id={`${storageKey}-panel`}>{view === 'ready' ? name : view === 'paused' ? 'Paused' : 'Game over'}</h2>
              <p class="text-sm">{view === 'over' ? `Score ${g.score} · Best ${Math.max(best, g.score)}` : help}</p>
              {summary && <p class="text-sm font-semibold mt-1">{summary}</p>}
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={view === 'paused' ? togglePause : begin}>
                  {view === 'ready' ? 'Start' : view === 'paused' ? 'Resume' : 'Play again'}
                </button>
              </div>
              {view !== 'paused' && <p class="text-xs text-muted mt-2">Or tap the game, or press Space or an arrow key.</p>}
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: `<p class="noscript">${name} needs JavaScript to run. Please enable it to play.</p>` }} />
    </section>
  );
}
