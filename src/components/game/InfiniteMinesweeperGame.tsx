import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { randomSeed } from '../../engines/core/rng';
import { INF_LEVELS, InfiniteMines, LIVES, key, type InfLevel, type InfMode, type InfState } from '../../engines/minesweeper/infinite';

const NAMES: Record<InfLevel, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const NUMBER_COLORS = ['', '#1d4ed8', '#15803d', '#c2272d', '#1e3a8a', '#7f1d1d', '#0f766e', '#1b2823', '#6b7280'];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SAVE = 'infmines:game';

export default function InfiniteMinesweeperGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef(new InfiniteMines('preview', 'normal', 'classic'));
  const cam = useRef({ x: 0.5, y: 0.5, cell: 30, w: 0, h: 0, dpr: 1 });
  const cursor = useRef<[number, number]>([0, 0]);
  const showCursor = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; cx: number; cy: number; moved: boolean; long: boolean; timer: number } | null>(null);
  const saveTimer = useRef(0);
  const [level, setLevel] = useState<InfLevel>('normal');
  const [mode, setMode] = useState<InfMode>('classic');
  const [flagMode, setFlagMode] = useState(false);
  const [best, setBest] = useState(0);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const bestKey = (lv = game.current.level, md = game.current.mode) => `infmines:best:${lv}:${md}`;

  const paint = () => {
    const cv = canvasRef.current;
    const c = cam.current;
    if (!cv || !c.w) return;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    const g = game.current;
    const s = c.cell;
    const x0 = Math.floor(c.x - c.w / 2 / s) - 1;
    const y0 = Math.floor(c.y - c.h / 2 / s) - 1;
    const cols = Math.ceil(c.w / s) + 3;
    const rows = Math.ceil(c.h / s) + 3;
    ctx.fillStyle = '#d6ccb6';
    ctx.fillRect(0, 0, c.w, c.h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(s * 0.62)}px ${FONT}`;
    const b = Math.max(2, Math.round(s * 0.1));
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const gx = x0 + i;
        const gy = y0 + j;
        const px = Math.round((gx - c.x) * s + c.w / 2);
        const py = Math.round((gy - c.y) * s + c.h / 2);
        const k = key(gx, gy);
        const hit = g.hits.has(k);
        const open = g.revealed.has(k);
        const showMine = g.over && g.isMine(gx, gy) && !g.flags.has(k);
        if (open || hit || showMine) {
          ctx.fillStyle = hit ? '#ef4444' : '#f6f1e6';
          ctx.fillRect(px + 0.5, py + 0.5, s - 1, s - 1);
          if (hit || showMine) {
            ctx.fillStyle = '#1b2823';
            ctx.beginPath();
            ctx.arc(px + s / 2, py + s / 2, s * 0.24, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const n = g.count(gx, gy);
            if (n) {
              ctx.fillStyle = NUMBER_COLORS[n]!;
              ctx.fillText(String(n), px + s / 2, py + s / 2 + s * 0.04);
            }
          }
        } else {
          ctx.fillStyle = '#b9c8bd';
          ctx.fillRect(px, py, s, s);
          ctx.fillStyle = '#eef3ee';
          ctx.fillRect(px, py, s, b);
          ctx.fillRect(px, py, b, s);
          ctx.fillStyle = '#7d9186';
          ctx.fillRect(px, py + s - b, s, b);
          ctx.fillRect(px + s - b, py, b, s);
          if (g.flags.has(k)) {
            ctx.fillStyle = '#1b2823';
            ctx.fillRect(px + s * 0.48, py + s * 0.22, Math.max(1.5, s * 0.07), s * 0.5);
            ctx.fillStyle = '#c2272d';
            ctx.beginPath();
            ctx.moveTo(px + s * 0.55, py + s * 0.2);
            ctx.lineTo(px + s * 0.55, py + s * 0.5);
            ctx.lineTo(px + s * 0.24, py + s * 0.35);
            ctx.closePath();
            ctx.fill();
            if (g.over && !g.isMine(gx, gy)) {
              ctx.strokeStyle = '#c2272d';
              ctx.lineWidth = Math.max(2, s * 0.08);
              ctx.beginPath();
              ctx.moveTo(px + s * 0.2, py + s * 0.2);
              ctx.lineTo(px + s * 0.8, py + s * 0.8);
              ctx.moveTo(px + s * 0.8, py + s * 0.2);
              ctx.lineTo(px + s * 0.2, py + s * 0.8);
              ctx.stroke();
            }
          }
        }
      }
    if (showCursor.current) {
      const [cx, cy] = cursor.current;
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 3;
      ctx.strokeRect((cx - c.x) * s + c.w / 2 + 1.5, (cy - c.y) * s + c.h / 2 + 1.5, s - 3, s - 3);
    }
  };

  const fit = () => {
    const el = wrapRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cam.current = { ...cam.current, w, h, dpr };
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    paint();
  };

  const save = () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => writeJson(SAVE, game.current.serialize(cam.current.x, cam.current.y)), 250);
  };

  const start = (lv: InfLevel, md: InfMode, saved: InfState | null = null) => {
    game.current = saved ? new InfiniteMines(saved.seed, saved.level, saved.mode, saved) : new InfiniteMines(randomSeed(), lv, md);
    cam.current = { ...cam.current, x: saved?.cx ?? 0.5, y: saved?.cy ?? 0.5 };
    cursor.current = [0, 0];
    setLevel(game.current.level);
    setMode(game.current.mode);
    setBest(readJson<number>(bestKey(game.current.level, game.current.mode), 0));
    setMessage(saved ? 'Welcome back: your field was restored.' : 'Click any square near the middle to start: the centre is always safe. Drag to explore.');
    writeJson('infmines:settings', { level: game.current.level, mode: game.current.mode });
    save();
    paint();
    refresh();
  };

  const afterMove = (r: number | 'mine') => {
    const g = game.current;
    if (r === 'mine') {
      setMessage(g.over ? `Boom! You found a mine. Final score ${g.score.toLocaleString('en-US')}.` : `Boom! ${g.lives} ${g.lives === 1 ? 'life' : 'lives'} left.`);
      setAnnounce(g.over ? `Mine. Game over with ${g.score} cells.` : `Mine. ${g.lives} lives left.`);
    } else if (r) {
      setMessage('');
      setAnnounce(`${r} cell${r === 1 ? '' : 's'} opened. Score ${g.score}.`);
    }
    if (g.score > best) {
      writeJson(bestKey(), g.score);
      setBest(g.score);
    }
    save();
    paint();
    refresh();
  };

  const act = (gx: number, gy: number, flag: boolean) => {
    const g = game.current;
    if (g.over) return;
    const k = key(gx, gy);
    if (flag) {
      if (g.toggleFlag(gx, gy)) {
        setAnnounce(g.flags.has(k) ? 'Flag placed.' : 'Flag removed.');
        save();
        paint();
        refresh();
      }
      return;
    }
    afterMove(g.revealed.has(k) ? g.chord(gx, gy) : g.reveal(gx, gy));
  };

  const cellAt = (clientX: number, clientY: number): [number, number] => {
    const b = canvasRef.current!.getBoundingClientRect();
    const c = cam.current;
    return [Math.floor(c.x + (clientX - b.left - c.w / 2) / c.cell), Math.floor(c.y + (clientY - b.top - c.h / 2) / c.cell)];
  };

  const onDown = (e: PointerEvent) => {
    if (e.button === 2) return;
    showCursor.current = false;
    const id = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(id);
    const d = { id, x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false, long: false, timer: 0 };
    if (e.pointerType !== 'mouse')
      d.timer = window.setTimeout(() => {
        // Long press on touch places a flag.
        if (!d.moved) {
          d.long = true;
          const [gx, gy] = cellAt(d.x, d.y);
          act(gx, gy, true);
          navigator.vibrate?.(20);
        }
      }, 420);
    drag.current = d;
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 8) {
      d.moved = true;
      window.clearTimeout(d.timer);
    }
    if (d.moved) {
      cam.current.x = d.cx - dx / cam.current.cell;
      cam.current.y = d.cy - dy / cam.current.cell;
      paint();
    }
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    window.clearTimeout(d.timer);
    if (d.moved) return save();
    if (d.long) return;
    const [gx, gy] = cellAt(e.clientX, e.clientY);
    act(gx, gy, flagMode);
  };

  const zoom = (f: number) => {
    cam.current.cell = Math.max(16, Math.min(56, Math.round(cam.current.cell * f)));
    paint();
  };
  const recenter = () => {
    cam.current.x = 0.5;
    cam.current.y = 0.5;
    save();
    paint();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      showCursor.current = true;
      cursor.current = [cursor.current[0] + m[0], cursor.current[1] + m[1]];
      // Keep the cursor on screen.
      const c = cam.current;
      const [cx, cy] = cursor.current;
      const mx = c.w / c.cell / 2 - 2;
      const my = c.h / c.cell / 2 - 2;
      if (cx + 0.5 - c.x > mx) c.x = cx + 0.5 - mx;
      if (c.x - (cx + 0.5) > mx) c.x = cx + 0.5 + mx;
      if (cy + 0.5 - c.y > my) c.y = cy + 0.5 - my;
      if (c.y - (cy + 0.5) > my) c.y = cy + 0.5 + my;
      paint();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showCursor.current = true;
      act(cursor.current[0], cursor.current[1], false);
    } else if (e.key === 'f' || e.key === 'F') {
      showCursor.current = true;
      act(cursor.current[0], cursor.current[1], true);
    } else if (e.key === '+' || e.key === '=') zoom(1.2);
    else if (e.key === '-') zoom(1 / 1.2);
  };

  useEffect(() => {
    const saved = readJson<InfState | null>(SAVE, null);
    const settings = readJson<{ level?: InfLevel; mode?: InfMode }>('infmines:settings', {});
    const lv = INF_LEVELS.includes(settings.level as InfLevel) ? (settings.level as InfLevel) : 'normal';
    const md = settings.mode === 'relaxed' ? 'relaxed' : 'classic';
    const ok = saved && typeof saved.seed === 'string' && Array.isArray(saved.revealed) && INF_LEVELS.includes(saved.level) && !saved.over;
    if (window.matchMedia('(pointer: coarse)').matches) cam.current.cell = 34;
    start(lv, md, ok ? saved : null);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapRef.current!);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      else {
        cam.current.x += e.deltaX / cam.current.cell;
        cam.current.y += e.deltaY / cam.current.cell;
        paint();
        save();
      }
    };
    canvasRef.current!.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      canvasRef.current?.removeEventListener('wheel', onWheel);
    };
  }, []);

  const g = game.current;
  return (
    <section class="game" aria-label="Infinite Minesweeper" onKeyDown={onKeyDown}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start(level, mode)}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Mine density">
          {INF_LEVELS.map((l) => (
            <button key={l} type="button" role="radio" class="seg" aria-checked={l === level} onClick={() => start(l, mode)}>
              {NAMES[l]}
            </button>
          ))}
        </div>
        <div class="segmented" role="radiogroup" aria-label="Lives">
          {(['classic', 'relaxed'] as InfMode[]).map((m) => (
            <button key={m} type="button" role="radio" class="seg" aria-checked={m === mode} onClick={() => start(level, m)}>
              {m === 'classic' ? '1 life' : '3 lives'}
            </button>
          ))}
        </div>
        <div class="segmented" role="radiogroup" aria-label="Tap action">
          <button type="button" role="radio" class="seg" aria-checked={!flagMode} onClick={() => setFlagMode(false)}>
            Dig
          </button>
          <button type="button" role="radio" class="seg" aria-checked={flagMode} onClick={() => setFlagMode(true)}>
            Flag
          </button>
        </div>
        <button type="button" class="btn" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <button type="button" class="btn" onClick={() => zoom(1.2)} aria-label="Zoom in">
          +
        </button>
        <button type="button" class="btn" onClick={recenter}>
          Centre
        </button>
        <dl class="stats">
          <div>
            <dt>Score</dt>
            <dd class="tabular-nums">{g.score.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd class="tabular-nums">{best.toLocaleString('en-US')}</dd>
          </div>
          {g.mode === 'relaxed' && (
            <div>
              <dt>Lives</dt>
              <dd class="tabular-nums">
                {g.lives}/{LIVES.relaxed}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div class="board-area im-area">
        <p class="arcade-message im-msg" aria-hidden="true">
          {message}
        </p>
        <div ref={wrapRef} class="im-wrap">
          <canvas
            ref={canvasRef}
            class="board im-board"
            tabIndex={0}
            role="application"
            aria-roledescription="Infinite Minesweeper field"
            aria-label="Infinite Minesweeper field. Click or tap to dig, right-click or long-press to flag, drag to move around. With the keyboard, arrow keys move, Enter digs, F flags, plus and minus zoom."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => (drag.current = null)}
            onContextMenu={(e) => {
              e.preventDefault();
              const [gx, gy] = cellAt(e.clientX, e.clientY);
              act(gx, gy, true);
            }}
          />
        </div>
        {g.over && (
          <div class="overlay overlay-soft im-over" role="dialog" aria-labelledby="im-over">
            <div class="panel">
              <h2 id="im-over">Game over</h2>
              <p>
                You opened <strong>{g.score.toLocaleString('en-US')}</strong> safe squares.
                {g.score >= best && g.score > 0 ? ' A new best!' : ` Best: ${best.toLocaleString('en-US')}.`}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start(level, mode)}>
                  New game
                </button>
                <a class="btn" href="/minesweeper/">
                  Classic Minesweeper
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Infinite Minesweeper needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
