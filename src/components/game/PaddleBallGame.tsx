import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { Synth } from '../../engines/arcade/audio';
import { BALL, FIELD, LEVELS, PADDLE, PaddleGame, WIN_SCORE, type Level, type PaddleEvent } from '../../engines/arcade/paddle';

type Players = 1 | 2;
const LEVEL_NAMES: Record<Level, string> = { easy: 'Easy', medium: 'Medium', unbeatable: 'Unbeatable' };

interface View {
  /** Field drawn turned 90° (player 1 at the bottom) on portrait screens. */
  turned: boolean;
  scale: number;
  w: number;
  h: number;
}

export default function PaddleBallGame() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<PaddleGame>(new PaddleGame('medium'));
  const view = useRef<View>({ turned: false, scale: 1, w: 0, h: 0 });
  const synth = useRef(new Synth());
  const raf = useRef(0);
  const last = useRef(0);
  const paused = useRef(false);
  const keys = useRef(new Set<string>());
  const pointers = useRef(new Map<number, number>());

  const [players, setPlayers] = useState<Players>(1);
  const [level, setLevel] = useState<Level>('medium');
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [over, setOver] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [wins, setWins] = useState(0);
  const [announce, setAnnounce] = useState('');

  const fit = () => {
    const box = boxRef.current;
    const c = canvasRef.current;
    if (!box || !c) return;
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    const turned = bh > bw * 1.15;
    const fw = turned ? FIELD.h : FIELD.w;
    const fh = turned ? FIELD.w : FIELD.h;
    const scale = Math.min(bw / fw, bh / fh);
    const w = Math.floor(fw * scale);
    const h = Math.floor(fh * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (w !== view.current.w || h !== view.current.h) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    view.current = { turned, scale, w, h };
    draw();
  };

  /** Field coordinates → screen: turned view puts player 1 (left) at the bottom. */
  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const { turned, scale, w, h } = view.current;
    const ctx = c.getContext('2d')!;
    const dpr = c.width / Math.max(1, w);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#123f33';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    if (turned) {
      // Field x runs bottom → top, field y runs left → right.
      ctx.translate(0, h);
      ctx.rotate(-Math.PI / 2);
    }
    ctx.scale(scale, scale);
    const g = game.current;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 14]);
    ctx.beginPath();
    ctx.moveTo(FIELD.w / 2, 0);
    ctx.lineTo(FIELD.w / 2, FIELD.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f5ecd2';
    const r = 4;
    for (const [p, x] of [
      [g.left, PADDLE.inset],
      [g.right, FIELD.w - PADDLE.inset - PADDLE.w],
    ] as const) {
      ctx.beginPath();
      ctx.roundRect(x, p.y - PADDLE.h / 2, PADDLE.w, PADDLE.h, r);
      ctx.fill();
    }
    if (g.serveIn <= 0 && !g.over) {
      ctx.fillStyle = '#f5d37a';
      ctx.beginPath();
      ctx.arc(g.ball.x, g.ball.y, BALL / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Scores, always upright.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `800 ${Math.round(Math.min(w, h) * 0.09)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (turned) {
      ctx.fillText(String(g.score[0]), w * 0.85, h * 0.62);
      ctx.fillText(String(g.score[1]), w * 0.85, h * 0.38);
    } else {
      ctx.fillText(String(g.score[0]), w * 0.4, h * 0.14);
      ctx.fillText(String(g.score[1]), w * 0.6, h * 0.14);
    }
  };

  const sound = (events: PaddleEvent[]) => {
    for (const e of events) {
      if (e === 'paddle') synth.current.tone(480, 60, 'square', 0.12);
      else if (e === 'wall') synth.current.tone(300, 45, 'square', 0.08);
      else if (e.startsWith('score')) synth.current.tone(620, 260, 'triangle', 0.14, 260);
      else synth.current.tone(523, 500, 'triangle', 0.16, 1046);
    }
  };

  const tick = (t: number) => {
    const g = game.current;
    const dt = last.current ? (t - last.current) / 1000 : 0;
    last.current = t;
    if (!paused.current && !g.over) {
      const k = keys.current;
      const two = !g.ai;
      g.left.dir = (k.has('s') || (!two && k.has('ArrowDown')) ? 1 : 0) - (k.has('w') || (!two && k.has('ArrowUp')) ? 1 : 0);
      if (two) g.right.dir = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
      const events = g.step(dt);
      if (events.length) {
        sound(events);
        if (events.some((e) => e !== 'paddle' && e !== 'wall')) {
          setScore([g.score[0], g.score[1]]);
          setAnnounce(`Score ${g.score[0]} to ${g.score[1]}.`);
        }
        if (g.over) {
          setOver(true);
          if (g.ai && g.score[0] > g.score[1]) {
            const key = `paddle:wins:${g.ai}`;
            const n = readJson<number>(key, 0) + 1;
            writeJson(key, n);
            setWins(n);
          }
        }
      }
    }
    draw();
    raf.current = requestAnimationFrame(tick);
  };

  const newGame = (p = players, l = level) => {
    game.current = new PaddleGame(p === 1 ? l : null, randomSeed());
    setPlayers(p);
    setLevel(l);
    setScore([0, 0]);
    setOver(false);
    paused.current = false;
    setPaused(false);
    setWins(readJson<number>(`paddle:wins:${l}`, 0));
    writeJson('paddle:settings', { players: p, level: l });
    canvasRef.current?.focus({ preventScroll: true });
  };

  /** Screen point → field position along the paddles' axis (field y). */
  const fieldY = (e: PointerEvent) => {
    const b = canvasRef.current!.getBoundingClientRect();
    const { turned, scale } = view.current;
    return turned ? (e.clientX - b.left) / scale : (e.clientY - b.top) / scale;
  };
  /** Which side of the field a point is on: 0 = player 1, 1 = player 2. */
  const sideOf = (e: PointerEvent) => {
    const b = canvasRef.current!.getBoundingClientRect();
    const { turned, scale } = view.current;
    const fx = turned ? (b.bottom - e.clientY) / scale : (e.clientX - b.left) / scale;
    return fx < FIELD.w / 2 ? 0 : 1;
  };

  const steer = (e: PointerEvent) => {
    const g = game.current;
    const side = g.ai ? 0 : sideOf(e);
    pointers.current.set(e.pointerId, side);
    (side === 0 ? g.left : g.right).target = fieldY(e);
  };

  useEffect(() => {
    const s = readJson<{ players?: Players; level?: Level }>('paddle:settings', {});
    const p: Players = s.players === 2 ? 2 : 1;
    const l: Level = s.level && LEVELS.includes(s.level) ? s.level : 'medium';
    setMuted(synth.current.muted);
    newGame(p, l);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(boxRef.current!);
    raf.current = requestAnimationFrame(tick);
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && t.tagName === 'INPUT') return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(k)) {
        e.preventDefault();
        keys.current.add(k);
      } else if (k === 'p' || (k === ' ' && t === canvasRef.current)) {
        e.preventDefault();
        paused.current = !paused.current;
        setPaused(paused.current);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const vis = () => {
      if (document.hidden) {
        paused.current = true;
        setPaused(true);
      }
      last.current = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  const g = game.current;
  const winner = over ? (score[0] > score[1] ? (players === 1 ? 'You win!' : 'Player 1 wins!') : players === 1 ? 'The computer wins' : 'Player 2 wins!') : '';

  return (
    <section class="game" aria-label="Paddle Ball">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={() => newGame()}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Players">
          {([1, 2] as Players[]).map((p) => (
            <button key={p} type="button" role="radio" class="seg" aria-checked={players === p} onClick={() => newGame(p, level)}>
              {p === 1 ? 'vs Computer' : '2 Players'}
            </button>
          ))}
        </div>
        {players === 1 && (
          <div class="segmented" role="radiogroup" aria-label="Computer level">
            {LEVELS.map((l) => (
              <button key={l} type="button" role="radio" class="seg" aria-checked={level === l} onClick={() => newGame(1, l)}>
                {LEVEL_NAMES[l]}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          class="btn"
          aria-pressed={isPaused}
          onClick={() => {
            paused.current = !paused.current;
            setPaused(paused.current);
          }}
        >
          {isPaused ? 'Resume' : 'Pause'}
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
            <dt>{players === 1 ? 'You' : 'P1'}</dt>
            <dd class="tabular-nums">{score[0]}</dd>
          </div>
          <div>
            <dt>{players === 1 ? 'CPU' : 'P2'}</dt>
            <dd class="tabular-nums">{score[1]}</dd>
          </div>
        </dl>
      </div>
      <div ref={boxRef} class="arcade-area paddle-area">
        <canvas
          ref={canvasRef}
          class="board paddle-board"
          tabIndex={0}
          role="application"
          aria-roledescription="Paddle Ball court"
          aria-label={`Paddle Ball, first to ${WIN_SCORE}. Drag on the court or move the mouse to steer your paddle. Keyboard: W and S${players === 2 ? ' for player 1, up and down arrows for player 2' : ' or the up and down arrows'}. P pauses.`}
          onPointerDown={(e) => {
            try {
              canvasRef.current!.setPointerCapture(e.pointerId);
            } catch {
              /* synthetic or already-released pointer */
            }
            steer(e);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' || pointers.current.has(e.pointerId)) steer(e);
          }}
          onPointerUp={(e) => pointers.current.delete(e.pointerId)}
          onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        />
        {(over || isPaused) && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="paddle-title">
            <div class="panel">
              <h2 id="paddle-title">{over ? winner : 'Paused'}</h2>
              <p>
                {score[0]} – {score[1]}
                {players === 1 && <> · {LEVEL_NAMES[level]} · wins at this level: {wins}</>}
              </p>
              <div class="panel-actions">
                {over ? (
                  <button type="button" class="btn btn-primary" onClick={() => newGame()}>
                    Play again
                  </button>
                ) : (
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      paused.current = false;
                      setPaused(false);
                    }}
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
        {g.over ? ` ${winner}` : ''}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Paddle Ball needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
