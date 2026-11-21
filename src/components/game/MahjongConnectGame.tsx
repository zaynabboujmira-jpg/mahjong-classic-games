import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { randomSeed } from '../../engines/core/rng';
import { Synth } from '../../engines/arcade/audio';
import { CONNECT_LEVELS, ConnectGame, type ConnectLevel, type ConnectState } from '../../engines/mahjong-connect/connect';
import { faceById } from '../../engines/mahjong/tiles';
import { drawFace, roundRect } from '../../engines/mahjong/render/faces';

const NAMES: Record<ConnectLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const ASPECT = 0.76; // tile width / height
const PAD = 6;
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
interface Saved {
  state: ConnectState;
  elapsed: number;
}

export default function MahjongConnectGame() {
  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<ConnectGame>(new ConnectGame('easy', 'preview'));
  const layout = useRef({ cw: 0, ch: 0, w: 0, h: 0, flip: false, dpr: 1 });
  const faceCache = useRef(new Map<string, HTMLCanvasElement>());
  const selRef = useRef(-1);
  const hintRef = useRef<number[]>([]);
  const lineRef = useRef<number[] | null>(null);
  const lineTimer = useRef(0);
  const timer = useRef({ startedAt: 0, banked: 0 });
  const synth = useRef(new Synth());
  const [level, setLevel] = useState<ConnectLevel>('easy');
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const now = () => timer.current.banked + (timer.current.startedAt ? performance.now() - timer.current.startedAt : 0);

  /** Centre of grid cell i in CSS pixels (border cells sit on the canvas edge). */
  const centre = (i: number): [number, number] => {
    const g = game.current;
    const { cw, ch, flip } = layout.current;
    const r = Math.floor(i / g.W);
    const c = i % g.W;
    return flip ? [PAD + r * cw, PAD + c * ch] : [PAD + c * cw, PAD + r * ch];
  };

  const faceBitmap = (id: string, w: number, h: number) => {
    const key = `${id}:${Math.round(w)}`;
    let c = faceCache.current.get(key);
    if (c) return c;
    const dpr = layout.current.dpr;
    c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const x = c.getContext('2d')!;
    x.scale(dpr, dpr);
    const grad = x.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fbf6e9');
    grad.addColorStop(1, '#efe6cf');
    x.fillStyle = grad;
    roundRect(x, 0.5, 0.5, w - 1, h - 1, w * 0.12);
    x.fill();
    x.strokeStyle = '#a8987a';
    x.lineWidth = 1;
    x.stroke();
    drawFace(x, faceById(id), w, h);
    faceCache.current.set(key, c);
    return c;
  };

  const paint = () => {
    const cv = canvasRef.current;
    const L = layout.current;
    if (!cv || !L.cw) return;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);
    const g = game.current;
    const tw = L.cw - 2;
    const th = L.ch - 2;
    const depth = Math.max(1.5, tw * 0.06);
    g.s.tiles.forEach((f, i) => {
      if (!f) return;
      const [x, y] = centre(i);
      const rx = x - tw / 2;
      const ry = y - th / 2;
      ctx.fillStyle = '#b3a27c';
      roundRect(ctx, rx - depth, ry + depth, tw, th, tw * 0.12);
      ctx.fill();
      ctx.drawImage(faceBitmap(f, tw, th), rx, ry, tw, th);
      const sel = i === selRef.current;
      const hint = hintRef.current.includes(i);
      if (sel || hint) {
        ctx.fillStyle = sel ? 'rgba(245, 158, 11, 0.35)' : 'rgba(20, 184, 166, 0.28)';
        roundRect(ctx, rx, ry, tw, th, tw * 0.12);
        ctx.fill();
        ctx.strokeStyle = sel ? '#d97706' : '#0d9488';
        ctx.lineWidth = Math.max(2, tw * 0.07);
        roundRect(ctx, rx + 1, ry + 1, tw - 2, th - 2, tw * 0.12);
        ctx.stroke();
      }
    });
    const line = lineRef.current;
    if (line) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.max(3, tw * 0.1);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      line.forEach((i, k) => {
        const [x, y] = centre(i);
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
  };

  const fit = () => {
    const el = fitRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const g = game.current;
    const availW = el.clientWidth - PAD * 2;
    const availH = Math.max(200, el.clientHeight) - PAD * 2;
    // Units: half a cell of border on each side, so (cols + 1) cells across.
    const size = (across: number, down: number) => Math.min(availW / across, (availH / down) * ASPECT);
    const normal = size(g.s.cols + 1, g.s.rows + 1);
    const flipped = size(g.s.rows + 1, g.s.cols + 1);
    const flip = flipped > normal * 1.15;
    const cw = Math.floor(flip ? flipped : normal);
    const ch = cw / ASPECT;
    const across = flip ? g.s.rows + 1 : g.s.cols + 1;
    const down = flip ? g.s.cols + 1 : g.s.rows + 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(across * cw + PAD * 2);
    const h = Math.round(down * ch + PAD * 2);
    if (cw !== layout.current.cw || flip !== layout.current.flip) faceCache.current.clear();
    layout.current = { cw, ch, w, h, flip, dpr };
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    paint();
  };

  const save = () => {
    if (!game.current.isWon) writeJson('connect:game', { state: game.current.s, elapsed: now() } satisfies Saved);
  };

  const start = (lv: ConnectLevel, saved: Saved | null = null) => {
    game.current = saved ? new ConnectGame(saved.state) : new ConnectGame(lv, randomSeed());
    selRef.current = -1;
    hintRef.current = [];
    lineRef.current = null;
    timer.current = { startedAt: performance.now(), banked: saved?.elapsed ?? 0 };
    setLevel(game.current.s.level);
    setWon(false);
    setElapsed(saved?.elapsed ?? 0);
    setBest(readJson<number | null>(`connect:best:${game.current.s.level}`, null));
    setMessage(saved ? 'Welcome back: your game was restored.' : 'Tap two matching tiles that can be joined by a line with at most two bends.');
    writeJson('connect:level', game.current.s.level);
    fit();
    save();
    refresh();
  };

  const finishIfWon = () => {
    const g = game.current;
    if (!g.isWon) return;
    timer.current.banked = now();
    timer.current.startedAt = 0;
    const t = timer.current.banked;
    setElapsed(t);
    const key = `connect:best:${g.s.level}`;
    const prev = readJson<number | null>(key, null);
    if (prev === null || t < prev) {
      writeJson(key, t);
      setBest(t);
    }
    writeJson('connect:game', null);
    recordWin('mahjong-connect');
    setWon(true);
    setAnnounce(`Board cleared in ${fmt(t)}!`);
  };

  const afterRemove = () => {
    const g = game.current;
    if (g.isWon) return finishIfWon();
    if (!g.hint()) {
      g.shuffle(true);
      setMessage('No moves left, so the tiles were reshuffled for free.');
      setAnnounce('No moves left. Tiles reshuffled.');
    }
    save();
  };

  const tap = (i: number) => {
    const g = game.current;
    if (g.isWon || i < 0 || !g.s.tiles[i]) return;
    hintRef.current = [];
    const sel = selRef.current;
    if (sel < 0 || sel === i) {
      selRef.current = sel === i ? -1 : i;
      setAnnounce(sel === i ? 'Deselected.' : `${faceById(g.s.tiles[i]!).label} selected.`);
      paint();
      return;
    }
    const path = g.remove(sel, i);
    if (path) {
      selRef.current = -1;
      synth.current.tone(660, 60, 'triangle', 0.07);
      lineRef.current = path;
      window.clearTimeout(lineTimer.current);
      lineTimer.current = window.setTimeout(() => {
        lineRef.current = null;
        paint();
      }, 380);
      setMessage('');
      setAnnounce(`Pair removed. ${g.left} tiles left.`);
      afterRemove();
    } else {
      const same = faceById(g.s.tiles[sel]!).matchKey === faceById(g.s.tiles[i]!).matchKey;
      selRef.current = same ? -1 : i;
      if (same) setMessage('Those tiles match, but no line with two bends or fewer joins them.');
      setAnnounce(same ? 'No clear path between those tiles.' : `${faceById(g.s.tiles[i]!).label} selected.`);
    }
    paint();
    refresh();
  };

  const showHint = () => {
    const h = game.current.hint();
    if (!h) return;
    hintRef.current = [h.a, h.b];
    lineRef.current = h.path;
    window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => {
      lineRef.current = null;
      paint();
    }, 900);
    setAnnounce(`Hint: the two ${faceById(game.current.s.tiles[h.a]!).label} tiles.`);
    paint();
  };

  const shuffle = () => {
    if (game.current.shuffle()) {
      selRef.current = -1;
      hintRef.current = [];
      setMessage(`Tiles shuffled. ${game.current.s.shuffles} shuffle${game.current.s.shuffles === 1 ? '' : 's'} left.`);
      save();
      paint();
      refresh();
    }
  };

  const undo = () => {
    if (game.current.undo()) {
      selRef.current = -1;
      hintRef.current = [];
      setMessage('Pair put back.');
      save();
      paint();
      refresh();
    }
  };

  useEffect(() => {
    const saved = readJson<Saved | null>('connect:game', null);
    const ok = saved && saved.state && Array.isArray(saved.state.tiles) && CONNECT_LEVELS.includes(saved.state.level) && saved.state.tiles.some(Boolean);
    const lv = readJson<string>('connect:level', 'easy');
    start(CONNECT_LEVELS.includes(lv as ConnectLevel) ? (lv as ConnectLevel) : 'easy', ok ? saved : null);
    const ro = new ResizeObserver(fit);
    ro.observe(fitRef.current!);
    const tick = window.setInterval(() => {
      if (!game.current.isWon && !document.hidden) setElapsed(now());
    }, 1000);
    const onHide = () => document.hidden && save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      ro.disconnect();
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  const onPointer = (e: PointerEvent) => {
    const cv = canvasRef.current!;
    const b = cv.getBoundingClientRect();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    const g = game.current;
    const { cw, ch, flip } = layout.current;
    const a = Math.round((x - PAD) / cw);
    const d = Math.round((y - PAD) / ch);
    const r = flip ? a : d;
    const c = flip ? d : a;
    if (r < 1 || r > g.s.rows || c < 1 || c > g.s.cols) return;
    tap(r * g.W + c);
  };

  const g = game.current;
  return (
    <section class="game" aria-label="Mahjong Connect">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start(level)}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Board size">
          {CONNECT_LEVELS.map((l) => (
            <button key={l} type="button" role="radio" class="seg" aria-checked={l === level} onClick={() => start(l)}>
              {NAMES[l]}
            </button>
          ))}
        </div>
        <button type="button" class="btn" onClick={showHint} disabled={won}>
          Hint
        </button>
        <button type="button" class="btn" onClick={shuffle} disabled={won || g.s.shuffles <= 0}>
          Shuffle ({g.s.shuffles})
        </button>
        <button type="button" class="btn" onClick={undo} disabled={won || !g.s.history.length}>
          Undo
        </button>
        <dl class="stats">
          <div>
            <dt>Tiles</dt>
            <dd class="tabular-nums">{g.left}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(elapsed)}</dd>
          </div>
        </dl>
      </div>
      <div class="board-area mc-area">
        <p class="arcade-message mc-msg" aria-hidden="true">
          {message}
        </p>
        <div ref={fitRef} class="mc-fit">
          <canvas
            ref={canvasRef}
            class="board mc-board"
            role="application"
            aria-roledescription="Mahjong Connect board"
            aria-label={`Mahjong Connect board, ${g.left} tiles left. Tap two matching tiles that a line with at most two bends can join through empty space.`}
            onPointerDown={onPointer}
          />
        </div>
        {won && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="mc-win">
            <div class="panel">
              <h2 id="mc-win">Board cleared!</h2>
              <p>
                {NAMES[level]} in <strong>{fmt(elapsed)}</strong>
                {best !== null && <> · Best {fmt(best)}</>}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start(level)}>
                  Play again
                </button>
                <a class="btn" href="/mahjong/">
                  Mahjong Solitaire
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Mahjong Connect needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
