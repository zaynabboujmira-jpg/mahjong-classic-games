import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { createRng, randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { fitBoard } from '../../engines/mahjong/fit';
import { MahjongGame as Engine } from '../../engines/mahjong/game';
import { BoardRenderer } from '../../engines/mahjong/render/canvas';
import type { Slot } from '../../engines/mahjong/types';

interface Props {
  layoutId: string;
  layoutName: string;
  slots: Slot[];
  next: { name: string; href: string };
}

type Status = 'playing' | 'won' | 'stuck';
interface Settings {
  dimBlocked: boolean;
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export default function MahjongGame({ layoutId, layoutName, slots, next }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<Engine | null>(null);
  const renderer = useRef<BoardRenderer | null>(null);
  const hintRef = useRef<number[]>([]);
  const hintTimer = useRef<number>(0);
  const focusRef = useRef<number | null>(null);
  const timer = useRef({ startedAt: 0, banked: 0 });

  const [, setVersion] = useState(0);
  const [status, setStatus] = useState<Status>('playing');
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [settings, setSettings] = useState<Settings>({ dimBlocked: false });
  const [best, setBest] = useState<number | null>(null);
  const [rotated, setRotated] = useState(false);

  const bestKey = `mahjong:best:${layoutId}`;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const draw = useCallback(() => {
    const g = game.current;
    const r = renderer.current;
    if (!g || !r) return;
    r.draw({
      isPresent: (i) => g.isPresent(i),
      isFree: (i) => g.isFree(i),
      faceAt: (i) => g.faceAt(i),
      selected: g.selected,
      hint: hintRef.current,
      focus: focusRef.current,
      dimBlocked: settingsRef.current.dimBlocked,
    });
  }, []);

  const now = () => timer.current.banked + (timer.current.startedAt ? performance.now() - timer.current.startedAt : 0);
  const startClock = () => {
    if (!timer.current.startedAt) timer.current.startedAt = performance.now();
    setRunning(true);
  };
  const stopClock = () => {
    timer.current.banked = now();
    timer.current.startedAt = 0;
    setRunning(false);
    setElapsed(timer.current.banked);
  };

  const refresh = useCallback(() => {
    const g = game.current!;
    setStatus(g.isWon ? 'won' : g.isStuck ? 'stuck' : 'playing');
    setVersion((v) => v + 1);
    draw();
  }, [draw]);

  const layout = useCallback(() => {
    const area = areaRef.current;
    const r = renderer.current;
    if (!area || !r) return;
    // The area's size comes from CSS (flex: 1 inside a viewport-high column),
    // so measuring it never moves the content below: zero layout shift.
    area.style.minHeight = '';
    const fit = fitBoard(r.boardBounds, area.clientWidth, area.clientHeight);
    r.resize(fit, Math.min(window.devicePixelRatio || 1, 3));
    // Only when tiles had to stay >= 36px does the board outgrow the area.
    if (fit.boardH > area.clientHeight) area.style.minHeight = `${Math.ceil(fit.boardH)}px`;
    setRotated(fit.rotated);
    draw();
  }, [draw]);

  const newGame = useCallback(
    (seed: string) => {
      game.current = new Engine(slots, createRng(seed));
      hintRef.current = [];
      focusRef.current = null;
      timer.current = { startedAt: 0, banked: 0 };
      setElapsed(0);
      setRunning(false);
      refresh();
    },
    [slots, refresh],
  );

  // Mount: build engine + renderer, size the board, load saved data.
  useEffect(() => {
    const canvas = canvasRef.current!;
    renderer.current = new BoardRenderer(canvas, slots);
    setSettings(readJson<Settings>('mahjong:settings', { dimBlocked: false }));
    setBest(readJson<number | null>(bestKey, null));
    const urlSeed = new URLSearchParams(location.search).get('seed');
    newGame(urlSeed && /^[\w-]{1,32}$/.test(urlSeed) ? urlSeed : randomSeed());
    layout();

    // Re-fit when the available space really changes. ResizeObserver covers
    // container changes; window resize/orientationchange are a fallback for
    // browsers that defer observer callbacks (e.g. background tabs).
    let last = '';
    const relayout = () => {
      const area = areaRef.current!;
      const key = `${area.clientWidth}x${area.clientHeight}x${window.innerWidth}x${window.innerHeight}`;
      if (key === last) return;
      last = key;
      layout();
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(areaRef.current!);
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', relayout);
    const onVisibility = () => {
      if (document.hidden && timer.current.startedAt) {
        timer.current.banked = now();
        timer.current.startedAt = 0;
      } else if (!document.hidden && game.current && game.current.moveCount > 0 && !game.current.isWon) {
        timer.current.startedAt = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', relayout);
      window.removeEventListener('orientationchange', relayout);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(hintTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    draw();
    writeJson('mahjong:settings', settings);
  }, [settings, draw]);

  const onWin = () => {
    stopClock();
    const time = timer.current.banked;
    const prev = readJson<number | null>(bestKey, null);
    if (prev === null || time < prev) {
      writeJson(bestKey, time);
      setBest(time);
    }
    setAnnounce(`You cleared the ${layoutName} layout in ${fmt(time)}.`);
  };

  const activate = (i: number) => {
    const g = game.current;
    if (!g) return;
    const face = g.faceAt(i);
    const res = g.select(i);
    hintRef.current = [];
    switch (res.kind) {
      case 'blocked':
        setAnnounce(`${face?.label ?? 'Tile'} is blocked.`);
        break;
      case 'selected':
      case 'mismatch':
        startClock();
        setAnnounce(`${face?.label} selected.`);
        break;
      case 'deselected':
        setAnnounce('Selection cleared.');
        break;
      case 'matched':
        startClock();
        setAnnounce(`Matched ${face?.label}. ${g.remaining} tiles left.`);
        if (focusRef.current !== null && !g.isPresent(focusRef.current)) focusRef.current = null;
        if (g.isWon) onWin();
        else if (g.isStuck) setAnnounce('No more moves. Shuffle or undo to continue.');
        break;
    }
    refresh();
  };

  const onCanvasClick = (e: MouseEvent) => {
    const r = renderer.current;
    const g = game.current;
    if (!r || !g || status === 'won') return;
    const box = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const i = r.hitTest(e.clientX - box.left, e.clientY - box.top, (k) => g.isPresent(k));
    if (i === null) {
      g.clearSelection();
      refresh();
      return;
    }
    focusRef.current = null;
    activate(i);
  };

  const onHint = () => {
    const g = game.current;
    if (!g) return;
    const h = g.hint();
    if (!h) {
      setAnnounce('No moves available. Try Shuffle.');
      return;
    }
    hintRef.current = h;
    // Keyboard players: move focus onto the hinted tile that still needs picking.
    if (document.activeElement === canvasRef.current) focusRef.current = h[0] === g.selected ? h[1] : h[0];
    setAnnounce(`Hint: ${g.faceAt(h[0])?.label} pair highlighted.${focusRef.current !== null && document.activeElement === canvasRef.current ? ' Focus moved to it; press Enter to select.' : ''}`);
    draw();
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      hintRef.current = [];
      draw();
    }, 2500);
  };

  const onUndo = () => {
    if (game.current?.undo()) {
      hintRef.current = [];
      if (status === 'won') startClock();
      setAnnounce('Move undone.');
      refresh();
    }
  };

  const onShuffle = () => {
    const g = game.current;
    if (!g || g.isWon) return;
    g.shuffle(createRng(randomSeed()));
    hintRef.current = [];
    setAnnounce('Tiles shuffled.');
    refresh();
  };

  /** Arrow keys walk between free tiles, picking the nearest one in that direction. */
  const onKeyDown = (e: KeyboardEvent) => {
    const g = game.current;
    const r = renderer.current;
    if (!g || !r) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      onUndo();
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      onHint();
      return;
    }
    const free = g.freeTiles();
    if (free.length === 0) return;
    const centre = (i: number) => {
      const b = r.rectOf(i)!;
      return [b.x + b.w / 2, b.y + b.h / 2] as const;
    };
    const dir = ARROWS[e.key];
    if (dir) {
      e.preventDefault();
      const from = focusRef.current;
      if (from === null || !g.isPresent(from)) {
        focusRef.current = free[0]!;
      } else {
        const [fx, fy] = centre(from);
        let bestIdx: number | null = null;
        let bestScore = Infinity;
        for (const i of free) {
          if (i === from) continue;
          const [x, y] = centre(i);
          const along = (x - fx) * dir[0] + (y - fy) * dir[1];
          if (along <= 0) continue;
          const across = Math.abs((x - fx) * dir[1]) + Math.abs((y - fy) * dir[0]);
          const score = along + across * 2;
          if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        if (bestIdx !== null) focusRef.current = bestIdx;
      }
      const f = g.faceAt(focusRef.current!);
      setAnnounce(`${f?.label}${g.selected === focusRef.current ? ', selected' : ''}`);
      draw();
    } else if ((e.key === 'Enter' || e.key === ' ') && focusRef.current !== null) {
      e.preventDefault();
      activate(focusRef.current);
    } else if (e.key === 'Escape') {
      g.clearSelection();
      setAnnounce('Selection cleared.');
      refresh();
    }
  };

  const g = game.current;
  const remaining = g?.remaining ?? slots.length;
  const pairs = g ? g.availablePairs().length : 0;

  return (
    <section class="game" aria-label={`${layoutName} Mahjong Solitaire`}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={() => newGame(randomSeed())}>
          New game
        </button>
        <button type="button" class="btn" onClick={onUndo} disabled={!g?.canUndo}>
          Undo
        </button>
        <button type="button" class="btn" onClick={onHint} disabled={status !== 'playing'}>
          Hint
        </button>
        <button type="button" class="btn" onClick={onShuffle} disabled={status === 'won'}>
          Shuffle
        </button>
        <dl class="stats">
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(elapsed)}</dd>
          </div>
          <div>
            <dt>Tiles</dt>
            <dd class="tabular-nums">{remaining}</dd>
          </div>
          <div>
            <dt>Moves</dt>
            <dd class="tabular-nums">{pairs}</dd>
          </div>
        </dl>
        <label class="toggle">
          <input
            type="checkbox"
            checked={settings.dimBlocked}
            onChange={(e) => setSettings({ ...settings, dimBlocked: (e.currentTarget as HTMLInputElement).checked })}
          />
          Dim blocked tiles
        </label>
      </div>

      <div ref={areaRef} class="board-area" data-rotated={rotated ? '' : undefined}>
        <canvas
          ref={canvasRef}
          class="board"
          tabIndex={0}
          role="application"
          aria-roledescription="Mahjong board"
          aria-label={`${layoutName} board. Arrow keys move between free tiles, Enter selects, H for a hint, Control+Z to undo.`}
          onClick={onCanvasClick}
          onKeyDown={onKeyDown}
        />

        {status === 'won' && (
          <div class="overlay" role="dialog" aria-modal="false" aria-labelledby="win-title">
            <div class="panel">
              <h2 id="win-title">Board cleared!</h2>
              <p>
                {layoutName} in <strong>{fmt(elapsed)}</strong>
                {best !== null && <> · Best {fmt(best)}</>}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => newGame(randomSeed())}>
                  Play again
                </button>
                <a class="btn" href={next.href}>
                  Try {next.name}
                </a>
              </div>
            </div>
          </div>
        )}
        {status === 'stuck' && (
          <div class="overlay overlay-soft" role="alertdialog" aria-labelledby="stuck-title">
            <div class="panel">
              <h2 id="stuck-title">No moves left</h2>
              <p>Shuffle the remaining tiles (this deal stays solvable) or undo your last moves.</p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={onShuffle}>
                  Shuffle
                </button>
                <button type="button" class="btn" onClick={onUndo}>
                  Undo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      {/* Raw HTML: browsers with JS never parse noscript children, so hydration must not diff them. */}
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Mahjong needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
